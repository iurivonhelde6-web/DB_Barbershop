import express from 'express';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { cleanCpf, isValidCpf } from './src/lib/cpf.js';
import {
  RENEWAL_WINDOW_DAYS, formatDateBr, isCycleAlreadyPaid, newCycleFields, renewalOpensOn, todayInSaoPaulo,
} from './src/lib/billingCycle.js';

/**
 * Firestore do Admin SDK. Estas rotas rodam no servidor, sem sessão de usuário —
 * o SDK cliente teria `request.auth` null e as regras negariam toda escrita, que era
 * o motivo de renovações e falhas de pagamento nunca chegarem ao banco.
 */
type AdminFirestore = ReturnType<typeof getAdminFirestore>;

// ─── Lista de Planos do Backend (Evita erro de importação na Vercel) ──────────
// Percentuais: Basic 3/4/Family 4 = 55% | Plus 5/6 = 57,5% | Select 10/Family 8 = 60% | Avulso = 50%
const PLANS_LIST = [
  // --- CORTE SIMPLES (Avulso R$ 20,00 | comissão avulso R$ 10,00) ---
  {
    id: 'cs-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 3,
    totalPrice: 53,
    pricePerAtd: 17.67,
    costPerAtd: 17.67,
    barberSplitPerAtd: 9.72,
    houseMarginPerAtd: 7.95,
    totalBarberCommission: 29.15, // 55%
    totalHouseMargin: 23.85,      // 45%
    badgeTag: '🟢 Basic 3 ATD',
    recommendedFor: '3 atendimentos no mês.',
  },
  {
    id: 'cs-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 4,
    totalPrice: 64.00,
    pricePerAtd: 16.00,
    costPerAtd: 16.00,
    barberSplitPerAtd: 8.80,
    houseMarginPerAtd: 7.20,
    totalBarberCommission: 35.20, // 55%
    totalHouseMargin: 28.80,      // 45%
    badgeTag: '🟢 Basic 4 ATD',
    recommendedFor: '1 corte por semana.',
  },
  {
    id: 'cs-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 5,
    totalPrice: 75.00,
    pricePerAtd: 15.00,
    costPerAtd: 15.00,
    barberSplitPerAtd: 8.63,
    houseMarginPerAtd: 6.38,
    totalBarberCommission: 43.13, // 57,5%
    totalHouseMargin: 31.88,      // 42,5%
    badgeTag: '🔵 Plus 5 ATD',
    recommendedFor: 'Frequência intensa.',
  },
  {
    id: 'cs-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 6,
    totalPrice: 87.00,
    pricePerAtd: 14.50,
    costPerAtd: 14.50,
    barberSplitPerAtd: 8.34,
    houseMarginPerAtd: 6.16,
    totalBarberCommission: 50.03, // 57,5%
    totalHouseMargin: 36.98,      // 42,5%
    badgeTag: '🔵 Plus 6 ATD',
    recommendedFor: 'Visitas frequentes no mês.',
  },
  {
    id: 'cs-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 10,
    totalPrice: 140.00,
    pricePerAtd: 14.00,
    costPerAtd: 14.00,
    barberSplitPerAtd: 8.40,
    houseMarginPerAtd: 5.60,
    totalBarberCommission: 84.00, // 60%
    totalHouseMargin: 56.00,      // 40%
    badgeTag: '⭐ VIP 10 ATD',
    recommendedFor: 'Manutenção diária/quinzenal.',
  },
  {
    id: 'cs-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 4,
    totalPrice: 70,
    pricePerAtd: 17.50,
    costPerAtd: 17.50,
    barberSplitPerAtd: 9.63,
    houseMarginPerAtd: 7.88,
    totalBarberCommission: 38.50, // 55%
    totalHouseMargin: 31.50,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👦 Família 4 ATD',
    recommendedFor: 'Atendimentos compartilhados.',
  },
  {
    id: 'cs-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 8,
    totalPrice: 120,
    pricePerAtd: 15.00,
    costPerAtd: 15.00,
    barberSplitPerAtd: 9.00,
    houseMarginPerAtd: 6.00,
    totalBarberCommission: 72.00, // 60%
    totalHouseMargin: 48.00,      // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Família 8 ATD',
    recommendedFor: 'Até 4 familiares da mesma casa.',
  },

  // --- DISFARCE SÓ MÁQUINA (Avulso R$ 40,00 | comissão avulso R$ 20,00) ---
  {
    id: 'dm-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 3,
    totalPrice: 105.00,
    pricePerAtd: 35.00,
    costPerAtd: 35.00,
    barberSplitPerAtd: 19.25,
    houseMarginPerAtd: 15.75,
    totalBarberCommission: 57.75, // 55%
    totalHouseMargin: 47.25,      // 45%
    badgeTag: '🟢 Disfarce 3 ATD',
  },
  {
    id: 'dm-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 4,
    totalPrice: 128.00,
    pricePerAtd: 32.00,
    costPerAtd: 32.00,
    barberSplitPerAtd: 17.60,
    houseMarginPerAtd: 14.40,
    totalBarberCommission: 70.40, // 55%
    totalHouseMargin: 57.60,      // 45%
    badgeTag: '🟢 Disfarce 4 ATD',
  },
  {
    id: 'dm-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 5,
    totalPrice: 150.00,
    pricePerAtd: 30.00,
    costPerAtd: 30.00,
    barberSplitPerAtd: 17.25,
    houseMarginPerAtd: 12.75,
    totalBarberCommission: 86.25, // 57,5%
    totalHouseMargin: 63.75,      // 42,5%
    badgeTag: '🔵 Plus Disfarce 5',
  },
  {
    id: 'dm-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 6,
    totalPrice: 174.00,
    pricePerAtd: 29.00,
    costPerAtd: 29.00,
    barberSplitPerAtd: 16.68,
    houseMarginPerAtd: 12.33,
    totalBarberCommission: 100.05, // 57,5%
    totalHouseMargin: 73.95,       // 42,5%
    badgeTag: '🔵 Plus Disfarce 6',
  },
  {
    id: 'dm-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 10,
    totalPrice: 280.00,
    pricePerAtd: 28.00,
    costPerAtd: 28.00,
    barberSplitPerAtd: 16.80,
    houseMarginPerAtd: 11.20,
    totalBarberCommission: 168.00, // 60%
    totalHouseMargin: 112.00,      // 40%
    badgeTag: '⭐ SELECT 10 ATD',
  },
  {
    id: 'dm-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 4,
    totalPrice: 140,
    pricePerAtd: 35.00,
    costPerAtd: 35.00,
    barberSplitPerAtd: 19.25,
    houseMarginPerAtd: 15.75,
    totalBarberCommission: 77.00, // 55%
    totalHouseMargin: 63.00,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👩‍👧‍👦 Family 4 ATD',
  },
  {
    id: 'dm-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 8,
    totalPrice: 240,
    pricePerAtd: 30.00,
    costPerAtd: 30.00,
    barberSplitPerAtd: 18.00,
    houseMarginPerAtd: 12.00,
    totalBarberCommission: 144.00, // 60%
    totalHouseMargin: 96.00,       // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- DISFARCE MÁQUINA E TESOURA ✂️ (Avulso R$ 45,00 | comissão avulso R$ 22,50) ---
  {
    id: 'dmt-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 3,
    totalPrice: 118,
    pricePerAtd: 39.33,
    costPerAtd: 39.33,
    barberSplitPerAtd: 21.63,
    houseMarginPerAtd: 17.70,
    totalBarberCommission: 64.90, // 55%
    totalHouseMargin: 53.10,      // 45%
    badgeTag: '🟢 Básico Tesoura 3',
  },
  {
    id: 'dmt-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 144.00,
    pricePerAtd: 36.00,
    costPerAtd: 36.00,
    barberSplitPerAtd: 19.80,
    houseMarginPerAtd: 16.20,
    totalBarberCommission: 79.20, // 55%
    totalHouseMargin: 64.80,      // 45%
    badgeTag: '🟢 Básico Tesoura 4',
  },
  {
    id: 'dmt-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 5,
    totalPrice: 169,
    pricePerAtd: 33.80,
    costPerAtd: 33.80,
    barberSplitPerAtd: 19.44,
    houseMarginPerAtd: 14.37,
    totalBarberCommission: 97.18, // 57,5%
    totalHouseMargin: 71.83,      // 42,5%
    badgeTag: '🔵 Plus Tesoura 5',
  },
  {
    id: 'dmt-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 196,
    pricePerAtd: 32.67,
    costPerAtd: 32.67,
    barberSplitPerAtd: 18.78,
    houseMarginPerAtd: 13.88,
    totalBarberCommission: 112.70, // 57,5%
    totalHouseMargin: 83.30,       // 42,5%
    badgeTag: '🔵 Plus Tesoura 6',
  },
  {
    id: 'dmt-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 10,
    totalPrice: 315.00,
    pricePerAtd: 31.50,
    costPerAtd: 31.50,
    barberSplitPerAtd: 18.90,
    houseMarginPerAtd: 12.60,
    totalBarberCommission: 189.00, // 60%
    totalHouseMargin: 126.00,      // 40%
    badgeTag: '⭐ SELECT Tesoura 10',
  },
  {
    id: 'dmt-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 158,
    pricePerAtd: 39.50,
    costPerAtd: 39.50,
    barberSplitPerAtd: 21.73,
    houseMarginPerAtd: 17.78,
    totalBarberCommission: 86.90, // 55%
    totalHouseMargin: 71.10,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👩‍👧‍👦 Family 4 ATD',
  },
  {
    id: 'dmt-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 8,
    totalPrice: 270,
    pricePerAtd: 33.75,
    costPerAtd: 33.75,
    barberSplitPerAtd: 20.25,
    houseMarginPerAtd: 13.50,
    totalBarberCommission: 162.00, // 60%
    totalHouseMargin: 108.00,      // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- CORTE SÓ TESOURA ✂️ (Avulso R$ 50,00 | comissão avulso R$ 25,00) ---
  {
    id: 'st-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 3,
    totalPrice: 131,
    pricePerAtd: 43.67,
    costPerAtd: 43.67,
    barberSplitPerAtd: 24.02,
    houseMarginPerAtd: 19.65,
    totalBarberCommission: 72.05, // 55%
    totalHouseMargin: 58.95,      // 45%
    badgeTag: '🟢 Só Tesoura 3 ATD',
  },
  {
    id: 'st-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 160.00,
    pricePerAtd: 40.00,
    costPerAtd: 40.00,
    barberSplitPerAtd: 22.00,
    houseMarginPerAtd: 18.00,
    totalBarberCommission: 88.00, // 55%
    totalHouseMargin: 72.00,      // 45%
    badgeTag: '🟢 Só Tesoura 4 ATD',
  },
  {
    id: 'st-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 5,
    totalPrice: 188,
    pricePerAtd: 37.60,
    costPerAtd: 37.60,
    barberSplitPerAtd: 21.62,
    houseMarginPerAtd: 15.98,
    totalBarberCommission: 108.10, // 57,5%
    totalHouseMargin: 79.90,       // 42,5%
    badgeTag: '🔵 Plus Tesoura 5 ATD',
  },
  {
    id: 'st-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 218,
    pricePerAtd: 36.33,
    costPerAtd: 36.33,
    barberSplitPerAtd: 20.89,
    houseMarginPerAtd: 15.44,
    totalBarberCommission: 125.35, // 57,5%
    totalHouseMargin: 92.65,       // 42,5%
    badgeTag: '🔵 Plus Tesoura 6 ATD',
  },
  {
    id: 'st-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 10,
    totalPrice: 350.00,
    pricePerAtd: 35.00,
    costPerAtd: 35.00,
    barberSplitPerAtd: 21.00,
    houseMarginPerAtd: 14.00,
    totalBarberCommission: 210.00, // 60%
    totalHouseMargin: 140.00,      // 40%
    badgeTag: '⭐ SELECT Tesoura 10',
  },
  {
    id: 'st-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 176,
    pricePerAtd: 44.00,
    costPerAtd: 44.00,
    barberSplitPerAtd: 24.20,
    houseMarginPerAtd: 19.80,
    totalBarberCommission: 96.80, // 55%
    totalHouseMargin: 79.20,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👩‍👧‍👦 Family 4 ATD',
  },
  {
    id: 'st-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 8,
    totalPrice: 300,
    pricePerAtd: 37.50,
    costPerAtd: 37.50,
    barberSplitPerAtd: 22.50,
    houseMarginPerAtd: 15.00,
    totalBarberCommission: 180.00, // 60%
    totalHouseMargin: 120.00,      // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- BARBA SIMPLES (Avulso R$ 25,00 | comissão avulso R$ 12,50) ---
  {
    id: 'bs-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 3,
    totalPrice: 66,
    pricePerAtd: 22.00,
    costPerAtd: 22.00,
    barberSplitPerAtd: 12.10,
    houseMarginPerAtd: 9.90,
    totalBarberCommission: 36.30, // 55%
    totalHouseMargin: 29.70,      // 45%
    badgeTag: '🟢 Barba 3 ATD',
  },
  {
    id: 'bs-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 4,
    totalPrice: 80.00,
    pricePerAtd: 20.00,
    costPerAtd: 20.00,
    barberSplitPerAtd: 11.00,
    houseMarginPerAtd: 9.00,
    totalBarberCommission: 44.00, // 55%
    totalHouseMargin: 36.00,      // 45%
    badgeTag: '🟢 Barba 4 ATD',
  },
  {
    id: 'bs-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 5,
    totalPrice: 94,
    pricePerAtd: 18.80,
    costPerAtd: 18.80,
    barberSplitPerAtd: 10.81,
    houseMarginPerAtd: 7.99,
    totalBarberCommission: 54.05, // 57,5%
    totalHouseMargin: 39.95,      // 42,5%
    badgeTag: '🔵 Barba 5 ATD',
  },
  {
    id: 'bs-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 6,
    totalPrice: 109,
    pricePerAtd: 18.17,
    costPerAtd: 18.17,
    barberSplitPerAtd: 10.45,
    houseMarginPerAtd: 7.72,
    totalBarberCommission: 62.68, // 57,5%
    totalHouseMargin: 46.33,      // 42,5%
    badgeTag: '🔵 Barba 6 ATD',
  },
  {
    id: 'bs-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 10,
    totalPrice: 175.00,
    pricePerAtd: 17.50,
    costPerAtd: 17.50,
    barberSplitPerAtd: 10.50,
    houseMarginPerAtd: 7.00,
    totalBarberCommission: 105.00, // 60%
    totalHouseMargin: 70.00,       // 40%
    badgeTag: '⭐ SELECT Barba 10',
  },
  {
    id: 'bs-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 4,
    totalPrice: 88,
    pricePerAtd: 22.00,
    costPerAtd: 22.00,
    barberSplitPerAtd: 12.10,
    houseMarginPerAtd: 9.90,
    totalBarberCommission: 48.40, // 55%
    totalHouseMargin: 39.60,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👩‍👧‍👦 Family 4 ATD',
  },
  {
    id: 'bs-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 8,
    totalPrice: 150,
    pricePerAtd: 18.75,
    costPerAtd: 18.75,
    barberSplitPerAtd: 11.25,
    houseMarginPerAtd: 7.50,
    totalBarberCommission: 90.00, // 60%
    totalHouseMargin: 60.00,      // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- BARBA MODELADA (Avulso R$ 35,00 | comissão avulso R$ 17,50) ---
  {
    id: 'bm-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 3,
    totalPrice: 92,
    pricePerAtd: 30.67,
    costPerAtd: 30.67,
    barberSplitPerAtd: 16.87,
    houseMarginPerAtd: 13.80,
    totalBarberCommission: 50.60, // 55%
    totalHouseMargin: 41.40,      // 45%
    badgeTag: '🟢 Barba Modelada 3',
  },
  {
    id: 'bm-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 4,
    totalPrice: 112.00,
    pricePerAtd: 28.00,
    costPerAtd: 28.00,
    barberSplitPerAtd: 15.40,
    houseMarginPerAtd: 12.60,
    totalBarberCommission: 61.60, // 55%
    totalHouseMargin: 50.40,      // 45%
    badgeTag: '🟢 Barba Modelada 4',
  },
  {
    id: 'bm-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 5,
    totalPrice: 131,
    pricePerAtd: 26.20,
    costPerAtd: 26.20,
    barberSplitPerAtd: 15.07,
    houseMarginPerAtd: 11.14,
    totalBarberCommission: 75.33, // 57,5%
    totalHouseMargin: 55.68,      // 42,5%
    badgeTag: '🔵 Plus Barba Modelada 5',
  },
  {
    id: 'bm-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 6,
    totalPrice: 152,
    pricePerAtd: 25.33,
    costPerAtd: 25.33,
    barberSplitPerAtd: 14.57,
    houseMarginPerAtd: 10.77,
    totalBarberCommission: 87.40, // 57,5%
    totalHouseMargin: 64.60,      // 42,5%
    badgeTag: '🔵 Plus Barba Modelada 6',
  },
  {
    id: 'bm-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 10,
    totalPrice: 245.00,
    pricePerAtd: 24.50,
    costPerAtd: 24.50,
    barberSplitPerAtd: 14.70,
    houseMarginPerAtd: 9.80,
    totalBarberCommission: 147.00, // 60%
    totalHouseMargin: 98.00,       // 40%
    badgeTag: '⭐ SELECT Barba Modelada 10',
  },
  {
    id: 'bm-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 4,
    totalPrice: 123,
    pricePerAtd: 30.75,
    costPerAtd: 30.75,
    barberSplitPerAtd: 16.91,
    houseMarginPerAtd: 13.84,
    totalBarberCommission: 67.65, // 55%
    totalHouseMargin: 55.35,      // 45%
    familyMembers: 2,
    badgeTag: '👨‍👩‍👧‍👦 Family 4 ATD',
  },
  {
    id: 'bm-family-8',
    tier: 'family',
    tierLabel: 'FAMILY 8 (8 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 8,
    totalPrice: 210,
    pricePerAtd: 26.25,
    costPerAtd: 26.25,
    barberSplitPerAtd: 15.75,
    houseMarginPerAtd: 10.50,
    totalBarberCommission: 126.00, // 60%
    totalHouseMargin: 84.00,       // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- FLEX PREMIUM ⚫ ---
  {
    id: 'flex-premium-master',
    tier: 'flex_premium',
    tierLabel: '⚫ FLEX PREMIUM',
    serviceId: 'flex-multi',
    serviceName: 'Multi-Serviços Livres (Corte, Disfarce, Barba, Tesoura)',
    numAtendimentos: 8,
    totalPrice: 320,
    pricePerAtd: 40.00,
    costPerAtd: 40.00,
    barberSplitPerAtd: 24.00,
    houseMarginPerAtd: 16.00,
    totalBarberCommission: 192, // 60%
    totalHouseMargin: 128,      // 40%
    badgeTag: '⚫ O Mais Completo (Liberdade Total)',
    recommendedFor: 'Cliente exigente que quer liberdade sem ficar preso a um único serviço.',
    comingSoon: true,
  },
];

// ─── Inicialização Lazy do Stripe ──────────────────────────────────────────────
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '' || key.includes('sk_live_...') || key.includes('sk_test_...')) return null;
  if (!stripeInstance) {
    try { stripeInstance = new Stripe(key); }
    catch (err) { console.warn('[Stripe] Não foi possível inicializar:', err); return null; }
  }
  return stripeInstance;
}

/**
 * Lido a cada requisição, não no topo do módulo: este arquivo é importado por
 * server.ts antes de `dotenv.config()` rodar (imports ESM são avaliados primeiro),
 * então um const de módulo capturaria string vazia e o webhook rejeitaria todo
 * evento antes mesmo de verificar a assinatura em qualquer host que dependa do .env.
 */
function getWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
}

/**
 * Único portão que decide se um evento de webhook pode ativar/renovar uma assinatura.
 * checkout.session.completed cobre a ativação inicial (Stripe Checkout) quando o pagamento
 * já vem confirmado (cartão); checkout.session.async_payment_succeeded cobre os métodos de
 * notificação atrasada (Pix), em que o completed chega com payment_status 'unpaid' e a
 * confirmação real só vem depois; invoice.paid cobre as renovações recorrentes do cartão.
 * Nenhum outro caminho (frontend, criação da sessão, outros tipos de evento) tem permissão
 * para marcar um assinante como PAID/ACTIVE — é isso que fecha o bug de cartão sem limite
 * sendo aceito antes da confirmação real.
 */
export function isPaymentConfirmationEvent(
  eventType: string,
): eventType is 'checkout.session.completed' | 'checkout.session.async_payment_succeeded' | 'invoice.paid' {
  return eventType === 'checkout.session.completed'
    || eventType === 'checkout.session.async_payment_succeeded'
    || eventType === 'invoice.paid';
}

export type CheckoutPaymentMethod = 'CREDIT_CARD' | 'PIX';

type PlanEntry = (typeof PLANS_LIST)[number];

/**
 * Monta os parâmetros da Checkout Session para cada método de pagamento.
 *
 * DECISÃO DE ARQUITETURA — Pix como cobrança ÚNICA, não recorrente:
 * contas brasileiras do Stripe só suportam Pix recorrente via Pix Automático, que exige
 * mandato com regras próprias (aviso prévio de 3 dias antes de cada cobrança, valor máximo
 * do mandato etc.) — bem mais complexo que a assinatura de cartão. Para não reescrever a
 * arquitetura de assinatura, o Pix é um pagamento avulso (mode 'payment') equivalente a UM
 * ciclo do plano (30 dias). A cada ciclo o cliente (ou o admin, em ControlCardValidation)
 * gera um novo Pix pelo mesmo PaymentModal — exatamente como já acontece hoje na renovação
 * manual. Pix Automático fica para uma v2, se for avaliado depois.
 *
 * O cartão continua exatamente como antes: mode 'subscription' com recurring mensal.
 */
export function buildCheckoutSessionParams(args: {
  paymentMethod: CheckoutPaymentMethod;
  plan: PlanEntry;
  metadata: Record<string, string>;
  origin: string;
}): Stripe.Checkout.SessionCreateParams {
  const { paymentMethod, plan, metadata, origin } = args;
  const unitAmount = Math.round(plan.totalPrice * 100);
  const productData = {
    name: `Ded Black — ${plan.tierLabel} (${plan.serviceName})`,
    metadata: { barbershop: 'Ded Black', planId: plan.id },
  };
  const success_url = `${origin}/pagamento-sucesso?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${origin}/pagamento-cancelado`;

  if (paymentMethod === 'PIX') {
    return {
      mode: 'payment',
      payment_method_types: ['pix'],
      // QR code vale 1h; depois disso o Stripe dispara async_payment_failed e o cliente gera outro.
      payment_method_options: { pix: { expires_after_seconds: 3600 } },
      line_items: [
        {
          // Sem `recurring`: só é válido em mode 'subscription' e o Stripe rejeita a sessão.
          price_data: { currency: 'brl', unit_amount: unitAmount, product_data: productData },
          quantity: 1,
        },
      ],
      customer_creation: 'if_required',
      success_url,
      cancel_url,
      metadata,
      // Pagamento avulso não tem subscription_data; o metadata vai também no PaymentIntent.
      payment_intent_data: { metadata },
    };
  }

  return {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'brl',
          unit_amount: unitAmount,
          recurring: { interval: 'month' },
          product_data: productData,
        },
        quantity: 1,
      },
    ],
    success_url,
    cancel_url,
    metadata,
    subscription_data: { metadata },
  };
}

// ─── Idempotência da criação da sessão ───────────────────────────────────────────
// Antes o cadastro novo mandava ao Stripe um subscriberId `stripe_${Date.now()}`, que mudava
// a cada clique, enquanto a chave o deixava de fora: no duplo clique o Stripe recebia a MESMA
// chave com parâmetros DIFERENTES e recusava (idempotency_error → 500 para o cliente).
// Agora nenhum valor volátil vai nos parâmetros e a chave é estável por escopo, plano,
// método e janela de tempo.

/** Janela da chave de idempotência e do id de cadastro novo. */
export const CHECKOUT_KEY_WINDOW_MS = 10 * 60 * 1000;

function checkoutWindow(now: number = Date.now()): number {
  return Math.floor(now / CHECKOUT_KEY_WINDOW_MS);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Escopo do checkout: o assinante na renovação; no cadastro novo, quem chama + CPF (o mesmo
 * usuário — ou o admin no balcão — comprando para o mesmo CPF).
 */
export function checkoutScope(args: { subscriberId?: string; callerUid: string; cpfDigits: string }): string {
  return args.subscriberId ? `sub:${args.subscriberId}` : `new:${args.callerUid}:${args.cpfDigits}`;
}

/**
 * Id do cadastro novo, determinístico dentro da janela: o duplo clique gera o mesmo id e,
 * portanto, os mesmos parâmetros. É um hash — o CPF não aparece no id.
 */
export function newSubscriberIdFor(args: { callerUid: string; cpfDigits: string; planId: string; now?: number }): string {
  return `stripe_${sha256(['new-subscriber', args.callerUid, args.cpfDigits, args.planId, checkoutWindow(args.now)]).slice(0, 24)}`;
}

/**
 * Chave de idempotência: (escopo, plano, método, janela) + hash dos parâmetros. Os mesmos
 * dados na mesma janela → mesma chave → o Stripe devolve a MESMA sessão. Qualquer parâmetro
 * diferente (nome corrigido, checkout anterior liberado — replacesCheckoutSessionId) gera
 * chave nova, porque o Stripe recusa reutilizar uma chave com parâmetros diferentes.
 */
export function buildCheckoutIdempotencyKey(args: {
  scope: string;
  planId: string;
  paymentMethod: CheckoutPaymentMethod;
  params: Stripe.Checkout.SessionCreateParams;
  now?: number;
}): string {
  return `checkout-${sha256([args.scope, args.planId, args.paymentMethod, checkoutWindow(args.now), args.params])}`;
}

/**
 * Autoriza quem pode abrir checkout para um assinante.
 * - Sem subscriberId: cadastro novo — qualquer usuário autenticado.
 * - Com subscriberId (renovação): só o dono do cadastro (userUid gravado == uid do token)
 *   ou um admin (é assim que ControlCardValidation renova qualquer assinante).
 * Sem isso, quem soubesse o subscriberId de outro cliente (aparece em cardCode/URLs)
 * conseguiria, ao pagar com o próprio cartão/Pix, sobrescrever o cadastro dele no webhook.
 */
export async function resolveCheckoutTarget(args: {
  db: AdminFirestore;
  subscriberId: unknown;
  callerUid: string;
  isAdmin: () => Promise<boolean>;
}): Promise<
  | {
    ok: true; subscriberId: string; isRenewal: boolean; isAdmin: boolean; existingUserUid: string; existingSubscriptionId: string;
    /** Documento atual do assinante ({} no cadastro novo): vencimento, checkout pendente etc. */
    existingData: Record<string, any>;
  }
  | { ok: false; status: number; error: string }
> {
  const { db, subscriberId, callerUid } = args;

  if (subscriberId == null || subscriberId === '') {
    // O id do cadastro novo é calculado na rota (newSubscriberIdFor), depois de validar CPF e plano.
    return { ok: true, subscriberId: '', isRenewal: false, isAdmin: await args.isAdmin(), existingUserUid: '', existingSubscriptionId: '', existingData: {} };
  }
  if (typeof subscriberId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(subscriberId)) {
    return { ok: false, status: 400, error: 'Assinante inválido.' };
  }

  const snap = await db.collection('subscribers').doc(subscriberId).get();
  const existingData = (snap.exists ? snap.data() : {}) as Record<string, any>;
  const existingUserUid = String(existingData?.userUid || '');
  const isOwner = snap.exists && existingUserUid !== '' && existingUserUid === callerUid;
  const isAdmin = isOwner ? false : await args.isAdmin();

  if (!isOwner && !isAdmin) {
    // Mesma resposta para "não existe" e "não é seu": não revela quais IDs existem.
    return { ok: false, status: 403, error: 'Você não tem permissão para renovar este assinante.' };
  }
  if (!snap.exists) {
    return { ok: false, status: 404, error: 'Assinante não encontrado.' };
  }

  return {
    ok: true, subscriberId, isRenewal: true, isAdmin, existingUserUid,
    existingSubscriptionId: String(existingData?.stripeSubscriptionId || ''),
    existingData,
  };
}

// ─── Assinatura de cartão já existente (evita cobrança em dobro) ─────────────────
// Cada Checkout de cartão cria uma assinatura NOVA no Stripe. Antes, renovar pelo admin
// (ou trocar para Pix) deixava a assinatura antiga viva e cobrando todo mês junto com a nova.

/** Ainda cobra sozinha no próximo ciclo: renovar agora seria cobrar duas vezes. */
const CHARGING_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
/** Inadimplente mas viva (o Stripe ainda retenta a cobrança): pode ser substituída pelo novo pagamento. */
const REPLACEABLE_SUBSCRIPTION_STATUSES = new Set(['past_due', 'unpaid', 'incomplete', 'paused']);

export type ExistingSubscriptionDecision =
  | { action: 'none' }
  | { action: 'block'; status: string }
  | { action: 'replace'; status: string };

/**
 * Decide o que fazer com a assinatura de cartão já gravada no assinante antes de abrir
 * um novo checkout de renovação:
 * - ativa → bloqueia (a cobrança automática já vai acontecer; cancele o débito automático
 *   antes se quiser trocar para Pix);
 * - inadimplente → permite e marca para cancelar a antiga quando o novo pagamento confirmar;
 * - cancelada/expirada/inexistente → nada a fazer.
 * Erro do Stripe que não seja "não existe" é propagado: na dúvida, não abre checkout.
 */
export async function decideExistingSubscription(
  stripe: Pick<Stripe, 'subscriptions'>,
  subscriptionId: string,
): Promise<ExistingSubscriptionDecision> {
  if (!subscriptionId) return { action: 'none' };
  let status: string;
  try {
    status = (await stripe.subscriptions.retrieve(subscriptionId)).status;
  } catch (err: any) {
    if (err?.code === 'resource_missing') return { action: 'none' };
    throw err;
  }
  if (CHARGING_SUBSCRIPTION_STATUSES.has(status)) return { action: 'block', status };
  if (REPLACEABLE_SUBSCRIPTION_STATUSES.has(status)) return { action: 'replace', status };
  return { action: 'none' };
}

// ─── Checkout anterior ainda pagável (evita pagar o mesmo ciclo duas vezes) ──────
// O assinante guarda em pendingCheckoutSessionId o último checkout de renovação aberto.
// Antes de abrir outro, o anterior é liberado — nunca ficam dois pagáveis ao mesmo tempo.

export type PendingCheckoutOutcome = 'none' | 'released' | 'paid';

/**
 * Libera o checkout gerado antes para este assinante:
 * - sessão ainda 'open' (cliente não pagou nem gerou o QR code): expira a sessão;
 * - Pix com QR code exibido e não pago: o Stripe já marca a sessão como 'complete' quando
 *   o QR aparece, e sessão completa não pode ser expirada — cancela o PaymentIntent, o que
 *   invalida o QR code (o cliente não fica preso esperando ele vencer);
 * - já pago e o webhook ainda não processou: 'paid' — quem chama responde 409;
 * - expirada, cancelada ou inexistente: nada a fazer.
 * Se o expire/cancel falhar porque o cliente pagou no meio, relê e devolve 'paid'.
 * Qualquer outro erro do Stripe propaga: na dúvida, não abre checkout.
 */
export async function releasePendingCheckout(
  stripe: Pick<Stripe, 'checkout' | 'paymentIntents'>,
  sessionId: string,
): Promise<PendingCheckoutOutcome> {
  if (!sessionId) return 'none';

  const load = async () => {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    } catch (err: any) {
      if (err?.code === 'resource_missing') return null;
      throw err;
    }
  };

  let session = await load();
  if (!session) return 'none';

  if (session.status === 'open') {
    try {
      await stripe.checkout.sessions.expire(sessionId);
      return 'released';
    } catch (err) {
      // O cliente pode ter concluído o checkout entre a leitura e o expire.
      session = await load();
      if (!session || session.status === 'open') throw err;
    }
  }
  if (session.status !== 'complete') return 'none';
  if (session.payment_status === 'paid') return 'paid';

  // Completa e não paga: Pix com QR code exibido (no cartão a sessão completa já vem paga).
  // payment_intent pode vir null (sessão sem cobrança — nada pagável a cancelar) ou só como
  // id, se o expand não vier aplicado: nesse caso busca o PaymentIntent em vez de supor que
  // não há nada a cancelar, o que deixaria um QR code válido junto com o novo checkout.
  const rawPi = session.payment_intent;
  if (rawPi == null) return 'none';
  const pi = typeof rawPi === 'string' ? await stripe.paymentIntents.retrieve(rawPi) : rawPi;
  if (!pi?.id) return 'none';
  if (pi.status === 'succeeded' || pi.status === 'processing') return 'paid';
  if (pi.status === 'canceled') return 'none';

  try {
    await stripe.paymentIntents.cancel(pi.id);
    return 'released';
  } catch (err) {
    // Pix é instantâneo: o pagamento pode ter caído entre a leitura e o cancelamento.
    const fresh = await stripe.paymentIntents.retrieve(pi.id);
    if (fresh.status === 'succeeded' || fresh.status === 'processing') return 'paid';
    if (fresh.status === 'canceled') return 'released';
    throw err;
  }
}

export type PendingCheckoutPlan =
  | { action: 'reuse'; sessionId: string; url: string }
  | { action: 'paid' }
  | { action: 'new'; replacesSessionId: string };

/**
 * Renovação: o que fazer com o checkout pendente (pendingCheckoutSessionId) antes de criar outro.
 * - Mesmo pedido (pendingCheckoutKey == chave base deste) e a sessão ainda aberta: devolve a
 *   MESMA sessão. É o duplo clique/retry — liberar e recriar mandaria o primeiro clique para
 *   uma sessão morta.
 * - Senão, libera o anterior (A4). 'paid' vira 409; nos demais casos o id do anterior vai em
 *   replacesCheckoutSessionId, o que também muda a chave — o Stripe não devolve a sessão antiga.
 */
export async function resolvePendingCheckout(
  stripe: Pick<Stripe, 'checkout' | 'paymentIntents'>,
  existingData: Record<string, any>,
  baseKey: string,
): Promise<PendingCheckoutPlan> {
  const pendingId = String(existingData?.pendingCheckoutSessionId || '');
  if (!pendingId || isSessionRecorded(existingData, pendingId)) return { action: 'new', replacesSessionId: '' };

  if (existingData?.pendingCheckoutKey && existingData.pendingCheckoutKey === baseKey) {
    let current: Stripe.Checkout.Session | null = null;
    try {
      current = await stripe.checkout.sessions.retrieve(pendingId);
    } catch (err: any) {
      if (err?.code !== 'resource_missing') throw err;
    }
    if (current?.status === 'open' && current.url) return { action: 'reuse', sessionId: current.id, url: current.url };
  }

  const outcome = await releasePendingCheckout(stripe, pendingId);
  if (outcome === 'paid') return { action: 'paid' };
  return { action: 'new', replacesSessionId: pendingId };
}

/** Resposta devolvida pelo Stripe a partir da chave de idempotência (não é uma sessão nova). */
function isIdempotentReplay(session: Stripe.Checkout.Session, now: number = Date.now()): boolean {
  const headers: any = (session as any).lastResponse?.headers;
  const flag = typeof headers?.get === 'function' ? headers.get('idempotent-replayed') : headers?.['idempotent-replayed'];
  if (flag === 'true') return true;
  // Reserva se o cabeçalho não vier: sessão "recém-criada" com mais de 1 minuto é um replay.
  return typeof session.created === 'number' && now / 1000 - session.created > 60;
}

/**
 * Cria a sessão com a chave de idempotência. No replay, o Stripe devolve a resposta ORIGINAL
 * (status e URL de quando foi criada), mesmo que a sessão tenha expirado, sido liberada ou
 * paga depois. Por isso confere o estado atual:
 * - ainda aberta → é o duplo clique: devolve a mesma;
 * - já paga → 'paid' (409, nada de cobrar de novo);
 * - expirada/QR vencido/liberada → cria outra com chave derivada da sessão antiga.
 */
export async function createCheckoutSessionOnce(
  stripe: Pick<Stripe, 'checkout' | 'paymentIntents'>,
  params: Stripe.Checkout.SessionCreateParams,
  idempotencyKey: string,
): Promise<{ paid: true } | { paid: false; session: Stripe.Checkout.Session }> {
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey });
  if (!isIdempotentReplay(session)) return { paid: false, session };

  const current = await stripe.checkout.sessions.retrieve(session.id);
  if (current.status === 'open' && current.url) return { paid: false, session: current };

  const outcome = await releasePendingCheckout(stripe, session.id);
  if (outcome === 'paid') return { paid: true };
  const fresh = await stripe.checkout.sessions.create(params, { idempotencyKey: `${idempotencyKey}:after:${session.id}` });
  return { paid: false, session: fresh };
}

/** Esta sessão já foi gravada pelo webhook no assinante (marcador antigo, não um pagamento novo). */
export function isSessionRecorded(data: Record<string, any>, sessionId: string): boolean {
  if (!sessionId) return false;
  const history: any[] = Array.isArray(data?.paymentHistory) ? data.paymentHistory : [];
  return data?.checkoutSessionId === sessionId || history.some((inv) => inv?.checkoutSessionId === sessionId);
}

/**
 * Limpa o marcador de checkout pendente se ele ainda apontar para esta sessão
 * (Pix vencido/falhou, checkout expirado). Em transação: se um checkout novo já
 * substituiu o marcador, ele não é apagado.
 */
export async function clearPendingCheckout(db: AdminFirestore, subscriberId: string, sessionId: string): Promise<boolean> {
  if (!subscriberId || !sessionId) return false;
  const ref = db.collection('subscribers').doc(subscriberId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || (snap.data() as Record<string, any>)?.pendingCheckoutSessionId !== sessionId) return false;
    tx.set(ref, { pendingCheckoutSessionId: '', updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  });
}

/**
 * Renovação mensal do cartão (invoice.paid). Leitura e gravação na mesma transação, para
 * não sobrescrever um check-in feito no meio; a mesma fatura nunca é aplicada duas vezes —
 * com o vencimento somando ao atual, uma reentrega do Stripe daria 30 dias grátis e
 * zeraria os atendimentos no meio do ciclo.
 */
export async function renewSubscriberFromInvoice(
  db: AdminFirestore,
  subscriberId: string,
  invoice: Stripe.Invoice,
  now: Date = new Date(),
): Promise<'renewed' | 'already_processed'> {
  const ref = db.collection('subscribers').doc(subscriberId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const history: any[] = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];
    if (invoice.id && history.some((inv) => inv?.transactionId === invoice.id)) return 'already_processed' as const;

    const today = todayInSaoPaulo(now);
    const paidInvoice = {
      id: `INV-STRIPE-RENEW-${Date.now()}`, invoiceCode: `STRIPE-RNW-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
      planName: existing.planName || 'Assinatura Recorrente', amount: (invoice.amount_paid || 0) / 100,
      paymentMethod: 'CREDIT_CARD' as const, paymentDate: now.toLocaleString('pt-BR'),
      dueDate: today, period: 'Renovação Recorrente',
      status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
      transactionId: invoice.id || `stripe-${Date.now()}`,
      notes: 'Fatura paga via Stripe (invoice.paid)',
    };
    tx.set(ref, {
      status: 'ACTIVE', paymentStatus: 'PAID', paymentDate: today,
      // Ciclo novo: zera os atendimentos e soma 30 dias ao vencimento atual.
      ...newCycleFields(existing.expirationDate, now),
      paymentHistory: [paidInvoice, ...history], updatedAt: now.toISOString(),
    }, { merge: true });
    return 'renewed' as const;
  });
}

/** Assinante encontrado pelo webhook (stale = assinatura substituída/cancelada por nós). */
export type SubscriberMatch = { id: string; data: Record<string, any>; stale?: boolean } | null;

export type InvoicePaidOutcome = 'skipped_initial' | 'stale' | 'renewed' | 'already_processed' | 'fallback_created';

/**
 * invoice.paid. A PRIMEIRA fatura de uma assinatura de cartão (billing_reason
 * 'subscription_create') chega junto com o checkout.session.completed, em qualquer ordem, e
 * já foi aplicada por activateSubscriberFromSession: é ignorada aqui ANTES de qualquer
 * leitura ou gravação. Como o vencimento agora soma ao atual, processá-la de novo daria
 * +30 dias e zeraria os atendimentos uma segunda vez. Só renovações reais seguem adiante.
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: AdminFirestore,
  findSubscriber: (subscriptionId?: string, customerId?: string) => Promise<SubscriberMatch>,
  now: Date = new Date(),
): Promise<{ outcome: InvoicePaidOutcome; subscriberId?: string; subscriptionId?: string }> {
  if (invoice.billing_reason === 'subscription_create') return { outcome: 'skipped_initial' };

  const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  const subId = typeof subscription === 'string' ? subscription : subscription?.id;
  const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const match = await findSubscriber(subId || undefined, custId || undefined);
  if (match?.stale) return { outcome: 'stale', subscriberId: match.id, subscriptionId: subId };

  if (match) {
    const result = await renewSubscriberFromInvoice(db, match.id, invoice, now);
    return { outcome: result, subscriberId: match.id };
  }

  // Documento não encontrado — cria registro mínimo para não perder o pagamento.
  // Fallback mantido como estava (será revisto na Fase C).
  const expDate = new Date(now); expDate.setDate(expDate.getDate() + 30);
  const paidInvoice = {
    id: `INV-STRIPE-RENEW-${Date.now()}`, invoiceCode: `STRIPE-RNW-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
    planName: 'Assinatura Recorrente', amount: (invoice.amount_paid || 0) / 100,
    paymentMethod: 'CREDIT_CARD' as const, paymentDate: now.toLocaleString('pt-BR'),
    dueDate: now.toISOString().split('T')[0], period: 'Renovação Recorrente',
    status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
    transactionId: invoice.id || `stripe-${Date.now()}`,
    notes: 'Fatura paga via Stripe (invoice.paid)',
  };
  const fallbackId = `stripe_${(subId || custId || Date.now()).toString().replace(/\W/g, '_')}`;
  await db.collection('subscribers').doc(fallbackId).set({
    id: fallbackId, stripeSubscriptionId: subId || '', stripeCustomerId: custId || '',
    planName: 'Assinatura Recorrente', serviceName: 'Assinatura Recorrente',
    status: 'ACTIVE', paymentStatus: 'PAID',
    paymentMethod: 'CREDIT_CARD', paymentDate: now.toISOString().split('T')[0],
    startDate: now.toISOString().split('T')[0], expirationDate: expDate.toISOString().split('T')[0],
    paidAmount: (invoice.amount_paid || 0) / 100, expectedAmount: (invoice.amount_paid || 0) / 100,
    totalSessions: 0, usedSessions: 0, userUid: '', cardCode: '',
    clientName: '', cpf: '', phone: '', cardLast4: '', cardBrand: '',
    paymentHistory: [paidInvoice], updatedAt: now.toISOString(),
  });
  return { outcome: 'fallback_created', subscriberId: fallbackId };
}

/** Cancela a assinatura substituída. Idempotente: já cancelada ou inexistente não é erro. */
export async function cancelReplacedSubscription(
  stripe: Pick<Stripe, 'subscriptions'>,
  subscriptionId: string,
): Promise<'canceled' | 'already_canceled' | 'missing'> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return 'already_canceled';
    await stripe.subscriptions.cancel(subscriptionId);
    return 'canceled';
  } catch (err: any) {
    if (err?.code === 'resource_missing') return 'missing';
    throw err;
  }
}

/**
 * Evento de webhook de uma assinatura que não é mais a atual deste assinante (foi
 * substituída/cancelada por nós). Sem isso, o customer.subscription.deleted disparado pelo
 * próprio cancelamento — que cai no fallback por stripeCustomerId — suspenderia quem acabou
 * de pagar a renovação.
 */
export function isStaleSubscriptionEvent(data: Record<string, any>, subscriptionId?: string): boolean {
  if (!subscriptionId) return false;
  const replaced: unknown[] = Array.isArray(data?.replacedStripeSubscriptionIds) ? data.replacedStripeSubscriptionIds : [];
  if (replaced.includes(subscriptionId)) return true;
  return !!data?.stripeSubscriptionId && data.stripeSubscriptionId !== subscriptionId;
}

/** Campos que marcam `oldSubscriptionId` como substituída no documento do assinante. */
function replacedSubscriptionFields(existing: Record<string, any>, oldSubscriptionId: string, newSubscriptionId = '') {
  const replaced: string[] = Array.isArray(existing.replacedStripeSubscriptionIds) ? existing.replacedStripeSubscriptionIds : [];
  return {
    replacedStripeSubscriptionIds: replaced.includes(oldSubscriptionId) ? replaced : [...replaced, oldSubscriptionId],
    stripeSubscriptionId: newSubscriptionId
      || (existing.stripeSubscriptionId === oldSubscriptionId ? '' : (existing.stripeSubscriptionId || '')),
  };
}

/**
 * Cancela o débito automático no cartão a pedido do dono/admin (ex.: trocar para Pix).
 * Marca a assinatura como substituída ANTES de cancelar, para o webhook de
 * subscription.deleted ser ignorado; se o cancelamento falhar, desfaz a marcação — senão
 * a assinatura seguiria cobrando com os pagamentos sendo ignorados pelo webhook.
 * O acesso já pago (expirationDate) não muda.
 */
export async function cancelAutoRenewal(
  stripe: Pick<Stripe, 'subscriptions'>,
  db: AdminFirestore,
  subscriberDocId: string,
): Promise<'canceled' | 'nothing_to_cancel'> {
  const ref = db.collection('subscribers').doc(subscriberDocId);
  const before = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const subId = String(existing.stripeSubscriptionId || '');
    if (!subId) return null;
    tx.set(ref, {
      ...replacedSubscriptionFields(existing, subId),
      autoRenewalCanceledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return { subId, replaced: existing.replacedStripeSubscriptionIds ?? [] };
  });
  if (!before) return 'nothing_to_cancel';

  try {
    await cancelReplacedSubscription(stripe, before.subId);
  } catch (err) {
    await ref.set({
      stripeSubscriptionId: before.subId,
      replacedStripeSubscriptionIds: before.replaced,
      autoRenewalCanceledAt: '',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    throw err;
  }
  return 'canceled';
}

/**
 * Ativa (ou renova) o assinante a partir de uma Checkout Session paga. Compartilhada por
 * checkout.session.completed (cartão, pago na hora) e checkout.session.async_payment_succeeded
 * (Pix, pago minutos depois).
 *
 * Idempotente: o Stripe reentrega o mesmo evento quando a resposta demora ou falha, e antes
 * cada reentrega empilhava outra entrada em paymentHistory e empurrava expirationDate mais
 * 30 dias. A checagem + gravação roda numa transação do Firestore, então nem duas entregas
 * simultâneas do mesmo evento conseguem processar a sessão duas vezes.
 */
export async function activateSubscriberFromSession(
  session: Stripe.Checkout.Session,
  stripe: Pick<Stripe, 'subscriptions'>,
  db: AdminFirestore,
): Promise<'activated' | 'already_processed' | 'not_paid'> {
  // Trava redundante com isPaymentConfirmationEvent: mesmo dentro de um evento de
  // confirmação, só ativa se o Stripe realmente marcou a sessão como paga. No Pix, o
  // checkout.session.completed chega com 'unpaid' (QR code exibido, ainda não pago).
  if (session.payment_status !== 'paid') return 'not_paid';

  const metadata = session.metadata || {};
  const paymentMethod: CheckoutPaymentMethod = metadata.paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD';
  const isPix = paymentMethod === 'PIX';
  const plan = PLANS_LIST.find((p) => p.id === metadata.planoId);
  // Sessões Pix (mode 'payment') nunca têm subscription — o `if (subscriptionId)` abaixo cobre isso.
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const transactionId = subscriptionId || paymentIntentId || session.id;

  // Pix não tem cartão: não inventa bandeira/final.
  let cardBrand = isPix ? 'PIX' : 'CARD';
  let cardLast4 = isPix ? '' : '****';
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['default_payment_method'] });
      const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
      if (pm?.card) { cardBrand = pm.card.brand.toUpperCase(); cardLast4 = pm.card.last4; }
    } catch (pmErr) {
      console.warn('[Stripe Webhook] Não foi possível recuperar o método de pagamento da assinatura:', pmErr);
    }
  }

  const now = new Date();
  const startDateStr = todayInSaoPaulo(now);
  const paidAmount = (session.amount_total ?? Math.round((plan?.totalPrice || 0) * 100)) / 100;

  const newInvoice = {
    id: `INV-STRIPE-${Date.now()}`,
    invoiceCode: `STRIPE-${transactionId.slice(-8).toUpperCase()}`,
    planName: plan?.tierLabel || metadata.planName || 'Assinatura Ded Black',
    amount: paidAmount, paymentMethod,
    paymentDate: now.toLocaleString('pt-BR'), dueDate: startDateStr,
    period: isPix ? 'Ciclo de 30 dias (Pix)' : 'Mensal Recorrente',
    status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
    transactionId,
    checkoutSessionId: session.id,
    notes: isPix
      ? 'Pagamento único via Pix (Stripe Checkout) — ciclo de 30 dias, sem renovação automática'
      : `Assinatura via Stripe Checkout (${cardBrand} •••• ${cardLast4})`,
  };

  const targetId = metadata.subscriberId || `stripe_${session.id}`;
  const subDocRef = db.collection('subscribers').doc(targetId);
  // Assinatura de cartão inadimplente que este pagamento substitui (veja decideExistingSubscription).
  const replacesSubscriptionId = metadata.replacesSubscriptionId && metadata.replacesSubscriptionId !== subscriptionId
    ? metadata.replacesSubscriptionId
    : '';

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(subDocRef);
    const existing = (snap.exists ? snap.data() : {}) as Record<string, any>;
    const history: any[] = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];

    const alreadyProcessed = existing.checkoutSessionId === session.id
      || history.some((inv) => inv?.checkoutSessionId === session.id || inv?.transactionId === transactionId);
    if (alreadyProcessed) return 'already_processed' as const;

    tx.set(subDocRef, {
      ...existing, id: targetId,
      cardCode: existing.cardCode || metadata.cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: metadata.clientName || existing.clientName || '',
      cpf: metadata.clientCpf || existing.cpf || '',
      phone: metadata.clientPhone || existing.phone || '',
      planName: plan?.tierLabel || metadata.planName || existing.planName || '',
      serviceName: plan?.serviceName || metadata.serviceName || existing.serviceName || '',
      totalSessions: plan?.numAtendimentos || existing.totalSessions || 4,
      // Ciclo novo: zera os atendimentos e soma 30 dias ao vencimento atual (Pix e cartão).
      ...newCycleFields(existing.expirationDate, now),
      startDate: existing.startDate || startDateStr,
      userUid: metadata.userUid || existing.userUid || '',
      status: 'ACTIVE', paymentStatus: 'PAID',
      paymentMethod, paymentDate: startDateStr,
      transactionId,
      paidAmount, expectedAmount: plan?.totalPrice ?? paidAmount,
      stripeCustomerId: customerId || existing.stripeCustomerId || '',
      stripeSubscriptionId: subscriptionId || existing.stripeSubscriptionId || '',
      // Depois do spread acima: troca stripeSubscriptionId e registra a antiga como substituída.
      ...(replacesSubscriptionId ? replacedSubscriptionFields(existing, replacesSubscriptionId, subscriptionId || '') : {}),
      checkoutSessionId: session.id,
      // O checkout pendente era este: pago, deixa de ser liberado no próximo checkout.
      ...(existing.pendingCheckoutSessionId === session.id ? { pendingCheckoutSessionId: '' } : {}),
      cardLast4, cardBrand,
      paymentHistory: [newInvoice, ...history], updatedAt: now.toISOString(),
    }, { merge: true });
    return 'activated' as const;
  });

  // Fora da transação (que pode ser re-executada) e também em 'already_processed': se o
  // cancelamento falhou numa entrega anterior, a reentrega do Stripe tenta de novo. Uma
  // falha aqui propaga → webhook responde 500 → o Stripe reentrega.
  if (replacesSubscriptionId) {
    const outcome = await cancelReplacedSubscription(stripe, replacesSubscriptionId);
    if (outcome === 'canceled') {
      console.log(`[Stripe Webhook] Assinatura antiga ${replacesSubscriptionId} cancelada (substituída pela sessão ${session.id}).`);
    }
  }
  return result;
}

/** Middlewares de server.ts, injetados para evitar import circular. */
export interface StripeRouteGuards {
  authCheckMiddleware: express.RequestHandler;
  /** Recebe o token decodificado (req.firebaseUser) e diz se é admin, sem responder 403. */
  resolveIsAdmin: (decoded: { uid: string; admin?: unknown }) => Promise<boolean>;
  checkoutRateLimiter: express.RequestHandler;
  checkoutStatusRateLimiter: express.RequestHandler;
}

export function registerStripeRoutes(app: express.Application, db: AdminFirestore, guards: StripeRouteGuards) {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const publicKey = process.env.VITE_STRIPE_PUBLIC_KEY || '';
  const isStripeConfigured = stripeKey.length > 0 && !stripeKey.includes('sk_live_...') && !stripeKey.includes('sk_test_...');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !isStripeConfigured) {
    console.error('[Stripe] STRIPE_SECRET_KEY não configurada para produção. Checkout bloqueado.');
  }

  console.log('─────────────────────────────────────────────────────────────────');
  console.log('[Stripe Diagnostic] Inicializando Rotas Stripe:');
  console.log(`  - STRIPE_SECRET_KEY: ${stripeKey ? (isStripeConfigured ? `${stripeKey.substring(0, 7)}...` : 'Placeholder/Pendente') : 'NÃO CONFIGURADO'}`);
  console.log(`  - STRIPE_WEBHOOK_SECRET: ${webhookSecret ? (webhookSecret.includes('whsec_...') ? 'Placeholder' : 'Configurado') : 'NÃO CONFIGURADO'}`);
  console.log(`  - VITE_STRIPE_PUBLIC_KEY: ${publicKey ? (publicKey.includes('pk_live_...') ? 'Placeholder' : `${publicKey.substring(0, 7)}...`) : 'NÃO CONFIGURADO'}`);
  console.log(`  - Firestore: ${db ? 'Conectado' : 'Indisponível'}`);
  console.log(`  - Modo: ${isStripeConfigured ? 'PRODUÇÃO' : 'MOCK/DEV'}`);
  console.log('─────────────────────────────────────────────────────────────────');

  // Middleware JSON para rotas comuns do Stripe
  const jsonParser = express.json({ limit: '1mb' });

  // ─── Health Check (público, sem auth) ─────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const stripe = getStripe();
    let stripeStatus = 'unconfigured_mock';
    let stripeDetails: any = { configured: false, mode: 'mock' };

    if (stripe) {
      try {
        await stripe.customers.list({ limit: 1 });
        stripeStatus = 'authenticated';
        stripeDetails = { configured: true, mode: 'live_authenticated' };
      } catch (stripeErr: any) {
        stripeStatus = 'auth_error';
        stripeDetails = { configured: true, mode: 'error', error: stripeErr?.message };
      }
    }

    let firestoreStatus = 'unconfigured';
    if (db) {
      try {
        await db.collection('subscribers').limit(1).get();
        firestoreStatus = 'authenticated';
      } catch (dbErr) {
        console.error('[Health] Firestore inacessível:', dbErr);
        firestoreStatus = 'error';
      }
    }

    return res.json({
      status: 'ok', timestamp: new Date().toISOString(),
      services: {
        stripe: { status: stripeStatus, ...stripeDetails },
        firestore: { status: firestoreStatus, type: 'Firestore' },
      },
      env: {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Present' : 'Missing',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'Present' : 'Missing',
        VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY ? 'Present' : 'Missing',
      },
    });
  });

  // ─── Checkout Session — Redireciona o cliente para a página hospedada pelo Stripe ──
  // Nenhum dado de cartão (número, validade, CVV) passa por este servidor ou pelo
  // frontend: o Stripe Checkout Session coleta tudo na própria página do Stripe.
  // A assinatura só é ativada quando o webhook confirmar o pagamento (veja
  // isPaymentConfirmationEvent), nunca aqui na criação da sessão.
  //
  // Exige Firebase ID token (authCheckMiddleware) e rate limit. Renovação (subscriberId no
  // body) só para o dono do cadastro ou admin — veja resolveCheckoutTarget.
  app.post(
    '/api/stripe/create-checkout-session',
    guards.checkoutRateLimiter,
    jsonParser,
    guards.authCheckMiddleware,
    async (req, res) => {
    try {
      const {
        planName, serviceName, planAmount, clientName, clientCpf, clientPhone,
        subscriberId, cardCode, userUid, barberId,
      } = req.body || {};
      // Default 'CREDIT_CARD' para não quebrar quem já chama a rota sem o campo.
      const rawMethod = req.body?.paymentMethod ?? 'CREDIT_CARD';
      if (rawMethod !== 'CREDIT_CARD' && rawMethod !== 'PIX') {
        return res.status(400).json({ error: 'Forma de pagamento inválida.' });
      }
      const paymentMethod: CheckoutPaymentMethod = rawMethod;
      const caller = (req as any).firebaseUser as { uid: string; admin?: unknown };

      if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
        return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
      }

      // CPF real obrigatório para os dois métodos — o placeholder 000.000.000-00 que o
      // front mandava com o campo vazio era aceito sem validação. No Pix é ainda mais
      // crítico: o Stripe exige o documento real do pagador.
      const cpfDigits = cleanCpf(clientCpf);
      if (!isValidCpf(cpfDigits)) {
        return res.status(400).json({ error: 'CPF inválido. Informe um CPF real com 11 dígitos.' });
      }

      // Mesma checagem de plano/valor para cartão e Pix: o valor cobrado vem SEMPRE do
      // PLANS_LIST do servidor, nunca do body.
      const validPlan = PLANS_LIST.find(
        (p) => (p.tierLabel === planName && p.serviceName === serviceName) || p.id === planName,
      );
      if (!validPlan || (planAmount != null && Math.abs(validPlan.totalPrice - Number(planAmount)) > 0.01)) {
        return res.status(400).json({ error: 'Plano ou valor inválido.' });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe não está configurado neste ambiente.' });
      }

      const target = await resolveCheckoutTarget({
        db,
        subscriberId,
        callerUid: caller.uid,
        isAdmin: () => guards.resolveIsAdmin(caller),
      });
      // `'error' in` em vez de `!target.ok`: sem strictNullChecks o TS não estreita pelo booleano.
      if ('error' in target) {
        return res.status(target.status).json({ error: target.error });
      }

      // Renovação de quem já tem assinatura de cartão: abrir outro checkout criaria uma
      // segunda cobrança mensal (ou, no Pix, deixaria o cartão cobrando junto).
      const existingSub = target.isRenewal
        ? await decideExistingSubscription(stripe, target.existingSubscriptionId)
        : { action: 'none' as const };
      if (existingSub.action === 'block') {
        return res.status(409).json({
          code: 'ACTIVE_CARD_SUBSCRIPTION',
          error: paymentMethod === 'PIX'
            ? 'Este assinante tem débito automático ativo no cartão. Cancele o débito automático antes de pagar com Pix, senão o cartão continua sendo cobrado todo mês.'
            : 'Este assinante já tem débito automático ativo no cartão — a renovação é cobrada automaticamente. Não é preciso gerar outro pagamento.',
        });
      }

      // Ciclo atual já pago e longe de vencer: mesma janela para Pix e cartão.
      if (target.isRenewal && isCycleAlreadyPaid(target.existingData)) {
        const exp = String(target.existingData.expirationDate);
        return res.status(409).json({
          code: 'CYCLE_ALREADY_PAID',
          error: `Este ciclo já está pago até ${formatDateBr(exp)}. A renovação fica liberada a partir de ${formatDateBr(renewalOpensOn(exp))} (${RENEWAL_WINDOW_DAYS} dias antes do vencimento), e os dias que faltam são somados ao novo ciclo.`,
        });
      }

      // Origem tomada do próprio request (nunca de um campo enviado pelo cliente),
      // evitando que success_url/cancel_url virem um open redirect controlado por quem chama a rota.
      const origin = `${req.protocol}://${req.get('host')}`;

      // userUid nunca vem livre do body: na renovação mantém o dono já gravado (antes, a
      // renovação feita pelo admin trocava o dono do cadastro pelo uid do admin); no cadastro
      // novo é o próprio usuário logado, exceto quando um admin cadastra um cliente no balcão.
      const ownerUid = target.isRenewal
        ? target.existingUserUid
        : (target.isAdmin ? (typeof userUid === 'string' ? userUid : '') : caller.uid);

      const subscriberDocId = target.isRenewal
        ? target.subscriberId
        : newSubscriberIdFor({ callerUid: caller.uid, cpfDigits, planId: validPlan.id });

      const sharedMetadata: Record<string, string> = {
        subscriberId: subscriberDocId,
        planoId: validPlan.id,
        planName: validPlan.tierLabel,
        serviceName: validPlan.serviceName,
        clientName: clientName.trim().slice(0, 120),
        clientCpf: cpfDigits,
        clientPhone: typeof clientPhone === 'string' ? clientPhone.slice(0, 30) : '',
        cardCode: target.isAdmin && typeof cardCode === 'string' ? cardCode.slice(0, 40) : '',
        userUid: ownerUid,
        barbeiroId: typeof barberId === 'string' ? barberId.slice(0, 60) : '',
        paymentMethod,
        // Assinatura inadimplente que o webhook cancela quando este pagamento confirmar.
        replacesSubscriptionId: existingSub.action === 'replace' ? target.existingSubscriptionId : '',
        // Checkout anterior liberado (preenchido abaixo, se houver).
        replacesCheckoutSessionId: '',
      };

      const scope = checkoutScope({ subscriberId: target.isRenewal ? target.subscriberId : '', callerUid: caller.uid, cpfDigits });
      const keyFor = (metadata: Record<string, string>) => {
        const params = buildCheckoutSessionParams({ paymentMethod, plan: validPlan, metadata, origin });
        return { params, key: buildCheckoutIdempotencyKey({ scope, planId: validPlan.id, paymentMethod, params }) };
      };
      // Chave "base": a deste pedido sem checkout anterior liberado. É ela que identifica o
      // duplo clique (gravada em pendingCheckoutKey).
      const base = keyFor(sharedMetadata);

      // Checkout anterior deste assinante (Pix ou cartão): reaproveita se for o mesmo pedido
      // e ainda estiver aberto; senão libera antes de abrir outro (veja resolvePendingCheckout).
      const pending = target.isRenewal
        ? await resolvePendingCheckout(stripe, target.existingData, base.key)
        : { action: 'new' as const, replacesSessionId: '' };
      if (pending.action === 'paid') {
        return res.status(409).json({
          code: 'PAYMENT_PROCESSING',
          error: 'O pagamento anterior deste ciclo já foi feito e está sendo confirmado. Aguarde alguns minutos — não é preciso pagar de novo.',
        });
      }
      if (pending.action === 'reuse') {
        return res.json({ url: pending.url, sessionId: pending.sessionId });
      }

      const request = pending.replacesSessionId
        ? keyFor({ ...sharedMetadata, replacesCheckoutSessionId: pending.replacesSessionId })
        : base;
      const created = await createCheckoutSessionOnce(stripe, request.params, request.key);
      // `'session' in` em vez de `created.paid`: sem strictNullChecks o TS não estreita pelo booleano.
      if (!('session' in created)) {
        return res.status(409).json({
          code: 'PAYMENT_PROCESSING',
          error: 'Este pagamento já foi feito e está sendo confirmado. Aguarde alguns minutos — não é preciso pagar de novo.',
        });
      }
      const session = created.session;

      if (!session.url) {
        return res.status(502).json({ error: 'Stripe não retornou a URL da sessão de checkout.' });
      }

      // Marca este checkout como o pendente do assinante, para o próximo liberá-lo.
      // Cadastro novo ainda não tem documento nem ciclo pago para duplicar.
      if (target.isRenewal) {
        await db.collection('subscribers').doc(target.subscriberId).set(
          { pendingCheckoutSessionId: session.id, pendingCheckoutKey: base.key, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      }

      return res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar checkout session:', err?.type || '', err?.message || err);
      return res.status(500).json({ error: err.message || 'Erro ao iniciar pagamento.' });
    }
    },
  );

  // ─── Cancelar débito automático no cartão (ex.: para trocar para Pix) ───────────
  // Mesma regra de acesso da renovação: dono do cadastro ou admin.
  app.post(
    '/api/stripe/cancel-auto-renewal',
    guards.checkoutRateLimiter,
    jsonParser,
    guards.authCheckMiddleware,
    async (req, res) => {
      try {
        const caller = (req as any).firebaseUser as { uid: string; admin?: unknown };
        if (!req.body?.subscriberId) {
          return res.status(400).json({ error: 'subscriberId obrigatório.' });
        }
        const target = await resolveCheckoutTarget({
          db,
          subscriberId: req.body.subscriberId,
          callerUid: caller.uid,
          isAdmin: () => guards.resolveIsAdmin(caller),
        });
        if ('error' in target) {
          return res.status(target.status).json({ error: target.error });
        }

        const stripe = getStripe();
        if (!stripe) {
          return res.status(503).json({ error: 'Stripe não está configurado neste ambiente.' });
        }

        const result = await cancelAutoRenewal(stripe, db, target.subscriberId);
        console.log(`[Stripe] cancel-auto-renewal — assinante ${target.subscriberId}: ${result} (por ${target.isAdmin ? 'admin' : 'dono'}).`);
        return res.json({ result });
      } catch (err: any) {
        console.error('[Stripe] Erro ao cancelar débito automático:', err?.type || '', err?.message || err);
        return res.status(502).json({ error: 'Não foi possível cancelar o débito automático no Stripe. Tente novamente.' });
      }
    },
  );

  // ─── Checkout Session Status — consulta somente leitura para a tela de retorno ──
  // Nunca escreve no Firestore: serve só para a página /pagamento-sucesso mostrar
  // "processando..." até que o webhook (única fonte de verdade) tenha ativado a
  // assinatura de fato.
  // Continua pública (só lê, e session_id não é adivinhável), mas com rate limit.
  app.get('/api/stripe/checkout-session-status', guards.checkoutStatusRateLimiter, async (req, res) => {
    try {
      const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
      if (!sessionId) {
        return res.status(400).json({ error: 'session_id obrigatório.' });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe não está configurado neste ambiente.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const subscriberId = session.metadata?.subscriberId || '';

      let activated = false;
      let subscriberSnapshot: Record<string, any> | null = null;
      if (subscriberId) {
        const snap = await db.collection('subscribers').doc(subscriberId).get();
        if (snap.exists) {
          const data = snap.data() as Record<string, any>;
          // Só considera ativado se o webhook já gravou o resultado desta sessão específica.
          activated = data.paymentStatus === 'PAID' && data.checkoutSessionId === sessionId;
          subscriberSnapshot = activated ? { cardCode: data.cardCode, planName: data.planName, totalSessions: data.totalSessions } : null;
        }
      }

      return res.json({
        sessionId,
        paymentStatus: session.payment_status,
        subscriberId,
        activated,
        subscriber: subscriberSnapshot,
      });
    } catch (err: any) {
      console.error('[Stripe] Erro ao consultar status da checkout session:', err);
      return res.status(500).json({ error: err.message || 'Erro ao consultar status do pagamento.' });
    }
  });

  // ─── Webhook Stripe — usa express.raw OBRIGATORIAMENTE ────────────────────
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const webhookSigningSecret = getWebhookSecret();

      if (!sig || !webhookSigningSecret) {
        console.warn('[Stripe Webhook] Assinatura ou secret ausente — rejeitando.');
        return res.status(400).json({ error: 'Webhook não autorizado.' });
      }

      const stripe = getStripe();
      if (!stripe) return res.status(400).json({ error: 'Stripe SDK não configurado no servidor.' });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSigningSecret);
      } catch (err: any) {
        console.error('[Stripe Webhook] Assinatura inválida:', err.message);
        return res.status(400).json({ error: `Webhook inválido: ${err.message}` });
      }

      console.log(`[Stripe Webhook] Evento: ${event.type}`);

      const findSubscriber = async (subscriptionId?: string, customerId?: string) => {
        // Consulta indexada por campo, em vez de varrer a coleção inteira a cada webhook.
        // Igualdade em campo único usa o índice automático do Firestore — nada a publicar.
        const queryBy = async (field: string, value: string) => {
          const snap = await db.collection('subscribers').where(field, '==', value).limit(1).get();
          return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data() as Record<string, any> };
        };

        try {
          if (subscriptionId) {
            const bySubscription = await queryBy('stripeSubscriptionId', subscriptionId);
            if (bySubscription) return bySubscription;
          }
          if (customerId) {
            const byCustomer = await queryBy('stripeCustomerId', customerId);
            if (byCustomer) {
              return isStaleSubscriptionEvent(byCustomer.data, subscriptionId)
                ? { ...byCustomer, stale: true }
                : byCustomer;
            }
          }
        } catch (e) { console.error('[Stripe Webhook] Erro ao buscar assinante:', e); }
        return null;
      };

      const skipStale = (match: { id: string; stale?: boolean } | null, subId?: string) => {
        if (!match?.stale) return false;
        console.log(`[Stripe Webhook] ${event.type} da assinatura ${subId} ignorado — não é mais a atual do assinante ${match.id} (substituída/cancelada).`);
        return true;
      };

      try {
        switch (event.type) {
          // Ativação inicial da assinatura — só acontece aqui, depois que o Stripe confirma
          // que o pagamento foi de fato aprovado (isPaymentConfirmationEvent documenta e testa
          // esse contrato). Cartão: completed já chega 'paid'. Pix: completed chega 'unpaid'
          // (só o QR code foi exibido) e é ignorado; a confirmação real vem depois em
          // async_payment_succeeded — o Stripe NÃO reenvia completed quando o Pix é pago.
          case 'checkout.session.completed':
          case 'checkout.session.async_payment_succeeded': {
            const session = event.data.object as Stripe.Checkout.Session;
            const result = await activateSubscriberFromSession(session, stripe, db);
            const method = session.metadata?.paymentMethod || 'CREDIT_CARD';
            const target = session.metadata?.subscriberId || '(novo)';

            if (result === 'not_paid') {
              console.warn(`[Stripe Webhook] ${event.type} sem pagamento confirmado (payment_status=${session.payment_status}, método=${method}) — aguardando confirmação.`);
            } else if (result === 'already_processed') {
              console.log(`[Stripe Webhook] ${event.type} — sessão ${session.id} já processada para ${target}; reentrega ignorada.`);
            } else {
              console.log(`[Stripe Webhook] ${event.type} — assinante ${target} ativado (método=${method}).`);
            }
            break;
          }

          // Pix expirou (QR code não pago em 1h) ou falhou. Nada é ativado; o cliente/admin
          // gera um novo Pix pelo PaymentModal.
          case 'checkout.session.async_payment_failed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.warn(`[Stripe Webhook] checkout.session.async_payment_failed — pagamento da sessão ${session.id} (assinante ${session.metadata?.subscriberId || '(novo)'}, método=${session.metadata?.paymentMethod || 'desconhecido'}) não foi concluído. Nenhuma ativação feita.`);
            if (await clearPendingCheckout(db, session.metadata?.subscriberId || '', session.id)) {
              console.log(`[Stripe Webhook] Marcador de checkout pendente limpo (sessão ${session.id}).`);
            }
            break;
          }

          // Checkout abandonado (ou expirado por nós ao abrir um novo). Nada a ativar; só
          // limpa o marcador se ele ainda apontar para esta sessão.
          case 'checkout.session.expired': {
            const session = event.data.object as Stripe.Checkout.Session;
            if (await clearPendingCheckout(db, session.metadata?.subscriberId || '', session.id)) {
              console.log(`[Stripe Webhook] checkout.session.expired — marcador de checkout pendente limpo (sessão ${session.id}).`);
            }
            break;
          }

          // invoice.* só existe para a assinatura de cartão (mode 'subscription'). O Pix é
          // pagamento avulso (mode 'payment', sem fatura), por isso o CREDIT_CARD fixo abaixo
          // continua correto.
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            // A primeira fatura (subscription_create) é ignorada dentro de handleInvoicePaid.
            const { outcome, subscriberId, subscriptionId } = await handleInvoicePaid(invoice, db, findSubscriber);
            if (outcome === 'skipped_initial') {
              console.log('[Stripe Webhook] invoice.paid da fatura inicial — já ativado via checkout.session.completed, ignorando.');
            } else if (outcome === 'stale') {
              skipStale({ id: subscriberId!, stale: true }, subscriptionId);
            } else if (outcome === 'already_processed') {
              console.log(`[Stripe Webhook] invoice.paid — fatura ${invoice.id} já registrada para ${subscriberId}; reentrega ignorada.`);
            } else if (outcome === 'renewed') {
              console.log(`[Stripe Webhook] invoice.paid — assinante ${subscriberId} renovado.`);
            } else {
              console.warn(`[Stripe Webhook] invoice.paid — assinante não encontrado, fallback criado: ${subscriberId}`);
            }
            break;
          }

          case 'customer.subscription.updated': {
            const sub = event.data.object as Stripe.Subscription;
            const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
            const match = await findSubscriber(sub.id, custId || undefined);
            if (skipStale(match, sub.id)) break;
            if (!match) break;
            const newStatus = sub.status === 'active' || sub.status === 'trialing' ? 'ACTIVE'
              : sub.status === 'canceled' || sub.status === 'unpaid' ? 'SUSPENDED'
              : 'PAYMENT_PENDING';
            if (match.data.status !== newStatus) {
              await db.collection('subscribers').doc(match.id).set({ status: newStatus, paymentStatus: newStatus === 'ACTIVE' ? 'PAID' : 'PENDING', updatedAt: new Date().toISOString() }, { merge: true });
              console.log(`[Stripe Webhook] subscription.updated — assinante ${match.id} → ${newStatus}.`);
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
            const subId = typeof subscription === 'string' ? subscription : subscription?.id;
            const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            const match = await findSubscriber(subId || undefined, custId || undefined);
            if (skipStale(match, subId)) break;
            if (!match) break;

            const failedInvoice = {
              id: `INV-STRIPE-FAIL-${Date.now()}`, invoiceCode: `STRIPE-FAIL-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
              planName: match.data.planName || 'Assinatura Recorrente', amount: (invoice.amount_due || 0) / 100,
              paymentMethod: 'CREDIT_CARD' as const, paymentDate: new Date().toLocaleString('pt-BR'),
              period: 'Tentativa de Cobrança', status: 'FAILED' as const, validationStatus: 'EXPIRED' as const,
              transactionId: invoice.id || `stripe-fail-${Date.now()}`,
              notes: 'Falha na cobrança automática via Stripe. Cliente deve atualizar o cartão.',
            };
            const history = Array.isArray(match.data.paymentHistory) ? match.data.paymentHistory : [];
            await db.collection('subscribers').doc(match.id).set({ ...match.data, status: 'PAYMENT_PENDING', paymentStatus: 'FAILED', paymentHistory: [failedInvoice, ...history], updatedAt: new Date().toISOString() }, { merge: true });
            console.warn(`[Stripe Webhook] invoice.payment_failed — assinante ${match.id} → PAYMENT_PENDING.`);
            break;
          }

          case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const match = await findSubscriber(sub.id, typeof sub.customer === 'string' ? sub.customer : sub.customer?.id);
            if (skipStale(match, sub.id)) break;
            if (!match) break;
            await db.collection('subscribers').doc(match.id).set({ status: 'SUSPENDED', updatedAt: new Date().toISOString() }, { merge: true });
            console.log(`[Stripe Webhook] subscription.deleted — assinante ${match.id} suspenso.`);
            break;
          }

          default: break;
        }
      } catch (handlerErr) {
        // 500 (e não 200) de propósito: responder "recebido" com a gravação quebrada faz o
        // Stripe marcar o evento como entregue e nunca mais retentar — foi assim que o
        // Firestore fora do ar em 16/09/2026 virou pagamento aprovado sem assinatura, sem
        // nenhum sinal de erro. Com 5xx o Stripe reentrega por até 3 dias e o caso se resolve
        // sozinho quando a causa for corrigida.
        console.error('[Stripe Webhook] Erro ao processar evento:', handlerErr);
        return res.status(500).json({
          error: 'Falha ao processar evento — o Stripe deve reentregar.',
          event: event.type,
        });
      }

      return res.json({ received: true, event: event.type });
    },
  );
};