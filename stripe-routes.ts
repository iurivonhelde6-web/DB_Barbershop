import express from 'express';
import Stripe from 'stripe';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

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
 * checkout.session.completed cobre a ativação inicial (Stripe Checkout); invoice.paid
 * cobre as renovações recorrentes. Nenhum outro caminho (frontend, criação da sessão,
 * outros tipos de evento) tem permissão para marcar um assinante como PAID/ACTIVE —
 * é isso que fecha o bug de cartão sem limite sendo aceito antes da confirmação real.
 */
export function isPaymentConfirmationEvent(
  eventType: string,
): eventType is 'checkout.session.completed' | 'invoice.paid' {
  return eventType === 'checkout.session.completed' || eventType === 'invoice.paid';
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function createAuthMiddleware(adminAuth: ReturnType<typeof getAdminAuth>) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação obrigatório.' });
      }
      const token = authHeader.slice('Bearer '.length).trim();
      const decoded = await adminAuth.verifyIdToken(token);
      (req as any).firebaseUser = decoded;
      next();
    } catch (err) {
      console.warn('[Stripe Auth] Token inválido:', err instanceof Error ? err.message : err);
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
  };
}

export function registerStripeRoutes(app: express.Application, db: AdminFirestore) {
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
  app.post('/api/stripe/create-checkout-session', jsonParser, async (req, res) => {
    try {
      const { planName, serviceName, planAmount, clientName, clientCpf, clientPhone, subscriberId, cardCode, userUid, barberId } = req.body || {};

      if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
        return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
      }

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

      const cleanCpf = typeof clientCpf === 'string' ? clientCpf.replace(/\D/g, '') : '';
      const targetSubscriberId = subscriberId || `stripe_${Date.now()}`;
      // Origem tomada do próprio request (nunca de um campo enviado pelo cliente),
      // evitando que success_url/cancel_url virem um open redirect controlado por quem chama a rota.
      const origin = `${req.protocol}://${req.get('host')}`;

      const sharedMetadata: Record<string, string> = {
        subscriberId: targetSubscriberId,
        planoId: validPlan.id,
        planName: validPlan.tierLabel,
        serviceName: validPlan.serviceName,
        clientName: clientName.trim(),
        clientCpf: cleanCpf,
        clientPhone: clientPhone || '',
        cardCode: cardCode || '',
        userUid: userUid || '',
        barbeiroId: barberId || '',
      };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              unit_amount: Math.round(validPlan.totalPrice * 100),
              recurring: { interval: 'month' },
              product_data: {
                name: `Ded Black — ${validPlan.tierLabel} (${validPlan.serviceName})`,
                metadata: { barbershop: 'Ded Black', planId: validPlan.id },
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/pagamento-sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pagamento-cancelado`,
        metadata: sharedMetadata,
        subscription_data: { metadata: sharedMetadata },
      });

      if (!session.url) {
        return res.status(502).json({ error: 'Stripe não retornou a URL da sessão de checkout.' });
      }

      return res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar checkout session:', err);
      return res.status(500).json({ error: err.message || 'Erro ao iniciar pagamento.' });
    }
  });

  // ─── Checkout Session Status — consulta somente leitura para a tela de retorno ──
  // Nunca escreve no Firestore: serve só para a página /pagamento-sucesso mostrar
  // "processando..." até que o webhook (única fonte de verdade) tenha ativado a
  // assinatura de fato.
  app.get('/api/stripe/checkout-session-status', async (req, res) => {
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
            if (byCustomer) return byCustomer;
          }
        } catch (e) { console.error('[Stripe Webhook] Erro ao buscar assinante:', e); }
        return null;
      };

      try {
        switch (event.type) {
          // Ativação inicial da assinatura — só acontece aqui, depois que o Stripe confirma
          // que o Checkout foi concluído e o pagamento foi de fato aprovado pelo emissor do
          // cartão (isPaymentConfirmationEvent documenta e testa esse contrato).
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;

            // Segunda trava, redundante com a acima: mesmo dentro deste evento, só ativa
            // se o Stripe realmente marcou a sessão como paga.
            if (session.payment_status !== 'paid') {
              console.warn(`[Stripe Webhook] checkout.session.completed sem pagamento confirmado (payment_status=${session.payment_status}) — ignorado.`);
              break;
            }

            const metadata = session.metadata || {};
            const plan = PLANS_LIST.find((p) => p.id === metadata.planoId);
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
            const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

            let cardBrand = 'CARD';
            let cardLast4 = '****';
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
            const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
            const startDateStr = now.toISOString().split('T')[0];
            const expDateStr = expDate.toISOString().split('T')[0];
            const paidAmount = (session.amount_total ?? Math.round((plan?.totalPrice || 0) * 100)) / 100;

            const newInvoice = {
              id: `INV-STRIPE-${Date.now()}`,
              invoiceCode: `STRIPE-${(subscriptionId || session.id).slice(-8).toUpperCase()}`,
              planName: plan?.tierLabel || metadata.planName || 'Assinatura Ded Black',
              amount: paidAmount, paymentMethod: 'CREDIT_CARD' as const,
              paymentDate: now.toLocaleString('pt-BR'), dueDate: startDateStr, period: 'Mensal Recorrente',
              status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
              transactionId: subscriptionId || session.id,
              notes: `Assinatura via Stripe Checkout (${cardBrand} •••• ${cardLast4})`,
            };

            const targetId = metadata.subscriberId || `stripe_${Date.now()}`;
            const subDocRef = db.collection('subscribers').doc(targetId);
            const snap = await subDocRef.get();
            const existing = (snap.exists ? snap.data() : {}) as Record<string, any>;
            const history = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];

            await subDocRef.set({
              ...existing, id: targetId,
              cardCode: existing.cardCode || metadata.cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
              clientName: metadata.clientName || existing.clientName || '',
              cpf: metadata.clientCpf || existing.cpf || '',
              phone: metadata.clientPhone || existing.phone || '',
              planName: plan?.tierLabel || metadata.planName || existing.planName || '',
              serviceName: plan?.serviceName || metadata.serviceName || existing.serviceName || '',
              totalSessions: plan?.numAtendimentos || existing.totalSessions || 4,
              usedSessions: existing.usedSessions || 0,
              startDate: existing.startDate || startDateStr, expirationDate: expDateStr,
              userUid: metadata.userUid || existing.userUid || '',
              status: 'ACTIVE', paymentStatus: 'PAID',
              paymentMethod: 'CREDIT_CARD', paymentDate: startDateStr,
              transactionId: subscriptionId || session.id,
              paidAmount, expectedAmount: plan?.totalPrice ?? paidAmount,
              stripeCustomerId: customerId || existing.stripeCustomerId || '',
              stripeSubscriptionId: subscriptionId || existing.stripeSubscriptionId || '',
              checkoutSessionId: session.id,
              cardLast4, cardBrand,
              paymentHistory: [newInvoice, ...history], updatedAt: now.toISOString(),
            }, { merge: true });

            console.log(`[Stripe Webhook] checkout.session.completed — assinante ${targetId} ativado (sub: ${subscriptionId}).`);
            break;
          }

          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;

            // A primeira fatura de uma assinatura nova já foi tratada por
            // checkout.session.completed — só entra aqui em renovações reais, evitando
            // duplicar o registro de pagamento no histórico do assinante.
            if (invoice.billing_reason === 'subscription_create') {
              console.log('[Stripe Webhook] invoice.paid da fatura inicial — já ativado via checkout.session.completed, ignorando.');
              break;
            }

            const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
            const subId = typeof subscription === 'string' ? subscription : subscription?.id;
            const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            const match = await findSubscriber(subId || undefined, custId || undefined);

            const now = new Date();
            const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
            const paidInvoice = {
              id: `INV-STRIPE-RENEW-${Date.now()}`, invoiceCode: `STRIPE-RNW-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
              planName: match?.data.planName || 'Assinatura Recorrente', amount: (invoice.amount_paid || 0) / 100,
              paymentMethod: 'CREDIT_CARD' as const, paymentDate: now.toLocaleString('pt-BR'),
              dueDate: now.toISOString().split('T')[0], period: 'Renovação Recorrente',
              status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
              transactionId: invoice.id || `stripe-${Date.now()}`,
              notes: 'Fatura paga via Stripe (invoice.paid)',
            };

            if (match) {
              const history = Array.isArray(match.data.paymentHistory) ? match.data.paymentHistory : [];
              await db.collection('subscribers').doc(match.id).set({ ...match.data, status: 'ACTIVE', paymentStatus: 'PAID', paymentDate: now.toISOString().split('T')[0], expirationDate: expDate.toISOString().split('T')[0], paymentHistory: [paidInvoice, ...history], updatedAt: now.toISOString() }, { merge: true });
              console.log(`[Stripe Webhook] invoice.paid — assinante ${match.id} ativado.`);
            } else {
              // Documento não encontrado — cria registro mínimo para não perder o pagamento
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
              console.warn(`[Stripe Webhook] invoice.paid — assinante não encontrado, fallback criado: ${fallbackId}`);
            }
            break;
          }

          case 'customer.subscription.updated': {
            const sub = event.data.object as Stripe.Subscription;
            const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
            const match = await findSubscriber(sub.id, custId || undefined);
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