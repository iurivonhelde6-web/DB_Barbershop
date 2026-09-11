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
    totalPrice: 52.50,
    pricePerAtd: 17.50,
    costPerAtd: 17.50,
    barberSplitPerAtd: 9.63,
    houseMarginPerAtd: 7.88,
    totalBarberCommission: 28.88, // 55%
    totalHouseMargin: 23.63,      // 45%
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
    totalPrice: 64.00,
    pricePerAtd: 16.00,
    costPerAtd: 16.00,
    barberSplitPerAtd: 8.80,
    houseMarginPerAtd: 7.20,
    totalBarberCommission: 35.20, // 55%
    totalHouseMargin: 28.80,      // 45%
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
    totalPrice: 112.00,
    pricePerAtd: 14.00,
    costPerAtd: 14.00,
    barberSplitPerAtd: 8.40,
    houseMarginPerAtd: 5.60,
    totalBarberCommission: 67.20, // 60%
    totalHouseMargin: 44.80,      // 40%
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
    totalPrice: 128.00,
    pricePerAtd: 32.00,
    costPerAtd: 32.00,
    barberSplitPerAtd: 17.60,
    houseMarginPerAtd: 14.40,
    totalBarberCommission: 70.40, // 55%
    totalHouseMargin: 57.60,      // 45%
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
    totalPrice: 224.00,
    pricePerAtd: 28.00,
    costPerAtd: 28.00,
    barberSplitPerAtd: 16.80,
    houseMarginPerAtd: 11.20,
    totalBarberCommission: 134.40, // 60%
    totalHouseMargin: 89.60,       // 40%
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
    totalPrice: 118.12,
    pricePerAtd: 39.37,
    costPerAtd: 39.37,
    barberSplitPerAtd: 21.66,
    houseMarginPerAtd: 17.72,
    totalBarberCommission: 64.97, // 55%
    totalHouseMargin: 53.15,      // 45%
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
    totalPrice: 168.75,
    pricePerAtd: 33.75,
    costPerAtd: 33.75,
    barberSplitPerAtd: 19.41,
    houseMarginPerAtd: 14.34,
    totalBarberCommission: 97.03, // 57,5%
    totalHouseMargin: 71.72,      // 42,5%
    badgeTag: '🔵 Plus Tesoura 5',
  },
  {
    id: 'dmt-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 195.75,
    pricePerAtd: 32.63,
    costPerAtd: 32.63,
    barberSplitPerAtd: 18.76,
    houseMarginPerAtd: 13.87,
    totalBarberCommission: 112.56, // 57,5%
    totalHouseMargin: 83.19,       // 42,5%
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
    totalPrice: 144.00,
    pricePerAtd: 36.00,
    costPerAtd: 36.00,
    barberSplitPerAtd: 19.80,
    houseMarginPerAtd: 16.20,
    totalBarberCommission: 79.20, // 55%
    totalHouseMargin: 64.80,      // 45%
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
    totalPrice: 252.00,
    pricePerAtd: 31.50,
    costPerAtd: 31.50,
    barberSplitPerAtd: 18.90,
    houseMarginPerAtd: 12.60,
    totalBarberCommission: 151.20, // 60%
    totalHouseMargin: 100.80,      // 40%
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
    totalPrice: 131.25,
    pricePerAtd: 43.75,
    costPerAtd: 43.75,
    barberSplitPerAtd: 24.06,
    houseMarginPerAtd: 19.69,
    totalBarberCommission: 72.19, // 55%
    totalHouseMargin: 59.06,      // 45%
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
    totalPrice: 187.50,
    pricePerAtd: 37.50,
    costPerAtd: 37.50,
    barberSplitPerAtd: 21.56,
    houseMarginPerAtd: 15.94,
    totalBarberCommission: 107.81, // 57,5%
    totalHouseMargin: 79.69,       // 42,5%
    badgeTag: '🔵 Plus Tesoura 5 ATD',
  },
  {
    id: 'st-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 217.50,
    pricePerAtd: 36.25,
    costPerAtd: 36.25,
    barberSplitPerAtd: 20.84,
    houseMarginPerAtd: 15.41,
    totalBarberCommission: 125.06, // 57,5%
    totalHouseMargin: 92.44,       // 42,5%
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
    totalPrice: 160.00,
    pricePerAtd: 40.00,
    costPerAtd: 40.00,
    barberSplitPerAtd: 22.00,
    houseMarginPerAtd: 18.00,
    totalBarberCommission: 88.00, // 55%
    totalHouseMargin: 72.00,      // 45%
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
    totalPrice: 280.00,
    pricePerAtd: 35.00,
    costPerAtd: 35.00,
    barberSplitPerAtd: 21.00,
    houseMarginPerAtd: 14.00,
    totalBarberCommission: 168.00, // 60%
    totalHouseMargin: 112.00,      // 40%
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
    totalPrice: 65.62,
    pricePerAtd: 21.87,
    costPerAtd: 21.87,
    barberSplitPerAtd: 12.03,
    houseMarginPerAtd: 9.84,
    totalBarberCommission: 36.09, // 55%
    totalHouseMargin: 29.53,      // 45%
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
    totalPrice: 93.75,
    pricePerAtd: 18.75,
    costPerAtd: 18.75,
    barberSplitPerAtd: 10.78,
    houseMarginPerAtd: 7.97,
    totalBarberCommission: 53.91, // 57,5%
    totalHouseMargin: 39.84,      // 42,5%
    badgeTag: '🔵 Barba 5 ATD',
  },
  {
    id: 'bs-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 6,
    totalPrice: 108.75,
    pricePerAtd: 18.13,
    costPerAtd: 18.13,
    barberSplitPerAtd: 10.42,
    houseMarginPerAtd: 7.70,
    totalBarberCommission: 62.53, // 57,5%
    totalHouseMargin: 46.22,      // 42,5%
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
    totalPrice: 80.00,
    pricePerAtd: 20.00,
    costPerAtd: 20.00,
    barberSplitPerAtd: 11.00,
    houseMarginPerAtd: 9.00,
    totalBarberCommission: 44.00, // 55%
    totalHouseMargin: 36.00,      // 45%
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
    totalPrice: 140.00,
    pricePerAtd: 17.50,
    costPerAtd: 17.50,
    barberSplitPerAtd: 10.50,
    houseMarginPerAtd: 7.00,
    totalBarberCommission: 84.00, // 60%
    totalHouseMargin: 56.00,      // 40%
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
    totalPrice: 91.88,
    pricePerAtd: 30.63,
    costPerAtd: 30.63,
    barberSplitPerAtd: 16.84,
    houseMarginPerAtd: 13.78,
    totalBarberCommission: 50.53, // 55%
    totalHouseMargin: 41.35,      // 45%
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
    totalPrice: 131.25,
    pricePerAtd: 26.25,
    costPerAtd: 26.25,
    barberSplitPerAtd: 15.09,
    houseMarginPerAtd: 11.16,
    totalBarberCommission: 75.47, // 57,5%
    totalHouseMargin: 55.78,      // 42,5%
    badgeTag: '🔵 Plus Barba Modelada 5',
  },
  {
    id: 'bm-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 6,
    totalPrice: 152.25,
    pricePerAtd: 25.38,
    costPerAtd: 25.38,
    barberSplitPerAtd: 14.57,
    houseMarginPerAtd: 10.78,
    totalBarberCommission: 87.54, // 57,5%
    totalHouseMargin: 64.71,      // 42,5%
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
    totalPrice: 112.00,
    pricePerAtd: 28.00,
    costPerAtd: 28.00,
    barberSplitPerAtd: 15.40,
    houseMarginPerAtd: 12.60,
    totalBarberCommission: 61.60, // 55%
    totalHouseMargin: 50.40,      // 45%
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
    totalPrice: 196.00,
    pricePerAtd: 24.50,
    costPerAtd: 24.50,
    barberSplitPerAtd: 14.70,
    houseMarginPerAtd: 9.80,
    totalBarberCommission: 117.60, // 60%
    totalHouseMargin: 78.40,       // 40%
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

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function subscriptionStatusToInvoiceStatus(status: Stripe.Subscription.Status): 'PAID' | 'PENDING' {
  return status === 'active' || status === 'trialing' ? 'PAID' : 'PENDING';
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

  // ─── SetupIntent — Inicialização segura de cartão ─────────────────────────
  app.post('/api/stripe/setup-intent', jsonParser, async (req, res) => {
    try {
      const { clientName, clientCpf, planName } = req.body || {};
      const cleanCpf = typeof clientCpf === 'string' ? clientCpf.replace(/\D/g, '') : '';
      const name = typeof clientName === 'string' && clientName.trim() ? clientName.trim() : 'Cliente Ded Black';
      const stripe = getStripe();

      if (stripe) {
        let stripeCustomerId: string | undefined;

        if (cleanCpf) {
          try {
            const existingCustomers = await stripe.customers.search({ query: `metadata['cpf']:'${cleanCpf}'`, limit: 1 });
            if (existingCustomers.data.length > 0) {
              stripeCustomerId = existingCustomers.data[0].id;
            }
          } catch {
            // Ignora falha de busca por metadata caso a conta seja nova
          }
        }

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            name,
            metadata: { cpf: cleanCpf || 'PENDING', planName: planName || 'DESCONHECIDO' },
          });
          stripeCustomerId = customer.id;
        }

        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          usage: 'off_session',
          metadata: { cpf: cleanCpf, planName: planName || '', clientName: name },
        });

        return res.json({ clientSecret: setupIntent.client_secret, stripeCustomerId });
      }

      if (isProduction) return res.status(503).json({ error: 'Stripe não está configurado para produção.' });

      const mockSecret = `seti_mock_${Date.now().toString(36)}_secret_${Math.random().toString(36).substring(2, 10)}`;
      return res.json({ clientSecret: mockSecret, stripeCustomerId: `cus_mock_${cleanCpf || 'anon'}`, mockMode: true });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar SetupIntent:', err);
      return res.status(500).json({ error: err.message || 'Erro ao inicializar checkout seguro.' });
    }
  });

  // ─── Subscribe — Processamento final da assinatura ───────────────────────
  app.post('/api/stripe/subscribe', jsonParser, async (req, res) => {
    try {
      const { paymentMethodId, clientName, clientCpf, clientPhone, planName, planAmount, subscriberId, cardCode, userUid } = req.body || {};

      if (!paymentMethodId || !clientName || !clientCpf || !planAmount) {
        return res.status(400).json({ error: 'Dados obrigatórios ausentes (Método de Pagamento, Nome, CPF ou Valor).' });
      }

      const stripe = getStripe();
      if (isProduction && !stripe) return res.status(503).json({ error: 'Stripe não está configurado para produção.' });

      const cleanCpf = clientCpf.replace(/\D/g, '');
      const amountInCents = Math.round(Number(planAmount) * 100);
      const validPlan = PLANS_LIST.find((p) => p.tierLabel === planName || p.id === planName || p.serviceName === planName);
      if (!validPlan || Math.abs(validPlan.totalPrice - Number(planAmount)) > 0.01) {
        return res.status(400).json({ error: 'Plano ou valor inválido.' });
      }

      let stripeCustomerId = `cus_mock_${cleanCpf || Date.now()}`;
      let stripeSubscriptionId = `sub_mock_${Date.now().toString(36)}`;
      let stripePriceId = `price_mock_${Date.now().toString(36)}`;
      let cardBrand = 'VISA';
      let cardLast4 = '4242';
      let subscriptionStatus: Stripe.Subscription.Status = 'incomplete';
      let paymentClientSecret: string | null = null;

      if (stripe) {
        try {
          const existingCustomers = await stripe.customers.search({ query: `metadata['cpf']:'${cleanCpf}'`, limit: 1 });
          if (existingCustomers.data.length > 0) {
            stripeCustomerId = existingCustomers.data[0].id;
            await stripe.customers.update(stripeCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
          } else {
            const customer = await stripe.customers.create({ name: clientName, phone: clientPhone || undefined, payment_method: paymentMethodId, invoice_settings: { default_payment_method: paymentMethodId }, metadata: { cpf: cleanCpf, planName, barbershop: 'Ded Black' } });
            stripeCustomerId = customer.id;
          }
        } catch {
          const customer = await stripe.customers.create({ name: clientName, phone: clientPhone || undefined, payment_method: paymentMethodId, invoice_settings: { default_payment_method: paymentMethodId }, metadata: { cpf: cleanCpf, planName, barbershop: 'Ded Black' } });
          stripeCustomerId = customer.id;
        }

        if (paymentMethodId && !paymentMethodId.startsWith('pm_mock')) {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId }).catch(() => {});
        }

        const price = await stripe.prices.create({ unit_amount: amountInCents, currency: 'brl', recurring: { interval: 'month' }, product_data: { name: `Ded Black — ${planName}`, metadata: { barbershop: 'Ded Black' } } });
        stripePriceId = price.id;

        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId, items: [{ price: price.id }],
          default_payment_method: paymentMethodId.startsWith('pm_mock') ? undefined : paymentMethodId,
          payment_behavior: 'default_incomplete', payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent', 'default_payment_method'],
          metadata: { cpf: cleanCpf, planName, cardCode: cardCode || '', subscriberId: subscriberId || '', barbershop: 'Ded Black' },
        });
        stripeSubscriptionId = subscription.id;
        subscriptionStatus = subscription.status;

        // Extrai o payment_intent da invoice mais recente para confirmar pagamento no frontend.
        // Quando o expand não retorna o objeto completo (retorna string/ID), buscamos manualmente.
        let latestPaymentIntent: Stripe.PaymentIntent | null = null;
        const latestInvoiceRaw = subscription.latest_invoice;
        if (latestInvoiceRaw && typeof latestInvoiceRaw !== 'string') {
          latestPaymentIntent = ((latestInvoiceRaw as any).payment_intent as Stripe.PaymentIntent | null) ?? null;
        } else if (typeof latestInvoiceRaw === 'string' && subscriptionStatus !== 'active') {
          try {
            const invoiceObj = await stripe.invoices.retrieve(latestInvoiceRaw, { expand: ['payment_intent'] });
            latestPaymentIntent = ((invoiceObj as any).payment_intent as Stripe.PaymentIntent | null) ?? null;
          } catch (invoiceErr) {
            console.warn('[Stripe] Não foi possível recuperar invoice para confirmar pagamento:', invoiceErr);
          }
        }
        paymentClientSecret = (latestPaymentIntent?.status === 'requires_payment_method' || latestPaymentIntent?.status === 'requires_action') ? latestPaymentIntent.client_secret : null;

        const pm = subscription.default_payment_method as Stripe.PaymentMethod | null;
        cardBrand = pm?.card?.brand ? pm.card.brand.toUpperCase() : 'VISA';
        cardLast4 = pm?.card?.last4 || '4242';
      }

      const now = new Date();
      const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
      const startDateStr = now.toISOString().split('T')[0];
      const expDateStr = expDate.toISOString().split('T')[0];

      const newInvoice = {
        id: `INV-STRIPE-${Date.now()}`, invoiceCode: `STRIPE-${stripeSubscriptionId.slice(-8).toUpperCase()}`,
        planName, amount: planAmount, paymentMethod: 'CREDIT_CARD' as const,
        paymentDate: now.toLocaleString('pt-BR'), dueDate: startDateStr, period: 'Mensal Recorrente',
        status: subscriptionStatusToInvoiceStatus(subscriptionStatus),
        validationStatus: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'VALIDATED' as const : 'UNDER_REVIEW' as const,
        transactionId: stripeSubscriptionId, notes: `Assinatura Stripe (${cardBrand.toUpperCase()} •••• ${cardLast4})`,
      };

      const targetId = subscriberId || `stripe_${Date.now()}`;
      const subDocRef = db.collection('subscribers').doc(targetId);

      try {
        const snap = await subDocRef.get();
        const existing = (snap.exists ? snap.data() : {}) as Record<string, any>;
        const history = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];
        await subDocRef.set({
          ...existing, id: targetId,
          cardCode: existing.cardCode || cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName, cpf: cleanCpf, phone: clientPhone || existing.phone || '', planName,
          serviceName: existing.serviceName || planName, totalSessions: existing.totalSessions || 4,
          usedSessions: existing.usedSessions || 0, startDate: startDateStr, expirationDate: expDateStr,
          userUid: userUid || existing.userUid || '',
          status: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'ACTIVE' : 'PAYMENT_PENDING',
          paymentStatus: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'PAID' : 'PENDING',
          paymentMethod: 'CREDIT_CARD', paymentDate: startDateStr, transactionId: stripeSubscriptionId,
          paidAmount: planAmount, expectedAmount: planAmount, stripeCustomerId, stripeSubscriptionId,
          stripePriceId, cardLast4, cardBrand: cardBrand.toUpperCase(),
          paymentHistory: [newInvoice, ...history], updatedAt: now.toISOString(),
        }, { merge: true });
        console.log(`[Stripe] Assinante ${targetId} ativado — sub: ${stripeSubscriptionId}`);
      } catch (dbErr) { console.error('[Stripe] Erro ao salvar no Firestore:', dbErr); }

      return res.json({
        success: true, subscriptionId: stripeSubscriptionId, subscriberId: targetId,
        paymentClientSecret, subscriptionStatus,
        stripeCustomerId, cardBrand: cardBrand.toUpperCase(), cardLast4,
        status: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'ACTIVE' : 'PAYMENT_PENDING',
        expirationDate: expDateStr,
      });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar assinatura:', err);
      return res.status(500).json({ error: err.message || 'Erro ao processar assinatura.' });
    }
  });

  // ─── Verify Payment — verificação server-side pós-confirmCardPayment ─────
  app.post('/api/stripe/verify-payment', jsonParser, async (req, res) => {
    try {
      const { subscriptionId } = req.body || {};
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        return res.status(400).json({ error: 'subscriptionId obrigatório.', verified: false, paymentConfirmed: false });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({ error: 'Stripe não configurado.', verified: false, paymentConfirmed: false });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      });

      const isActive = subscription.status === 'active' || subscription.status === 'trialing';

      // Para subscriptions ainda incomplete, verifica o PaymentIntent diretamente
      let paymentConfirmed = isActive;
      if (!isActive && subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
        const pi = (subscription.latest_invoice as any).payment_intent as Stripe.PaymentIntent | null;
        paymentConfirmed = pi?.status === 'succeeded';
      }

      // Se o pagamento foi confirmado, atualizar Firestore via Admin SDK
      if (paymentConfirmed) {
        const snap = await db.collection('subscribers')
          .where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();

        if (!snap.empty) {
          const now = new Date();
          const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
          await snap.docs[0].ref.set({
            status: 'ACTIVE', paymentStatus: 'PAID',
            paymentDate: now.toISOString().split('T')[0],
            expirationDate: expDate.toISOString().split('T')[0],
            updatedAt: now.toISOString(),
          }, { merge: true });
          console.log(`[Stripe] verify-payment — assinante ${snap.docs[0].id} confirmado como PAID.`);
        }
      }

      // Buscar o subscriberId do documento para o frontend
      let subscriberId = '';
      const snap2 = await db.collection('subscribers')
        .where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
      if (!snap2.empty) subscriberId = snap2.docs[0].id;

      return res.json({
        verified: true, paymentConfirmed,
        subscriptionStatus: subscription.status,
        status: paymentConfirmed ? 'ACTIVE' : 'PAYMENT_PENDING',
        paymentStatus: paymentConfirmed ? 'PAID' : 'PENDING',
        subscriberId,
      });
    } catch (err: any) {
      console.error('[Stripe] Erro ao verificar pagamento:', err);
      return res.status(500).json({ error: err.message || 'Erro ao verificar pagamento.', verified: false, paymentConfirmed: false });
    }
  });

  // ─── Webhook Stripe — usa express.raw OBRIGATORIAMENTE ────────────────────
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];

      if (!sig || !STRIPE_WEBHOOK_SECRET) {
        console.warn('[Stripe Webhook] Assinatura ou secret ausente — rejeitando.');
        return res.status(400).json({ error: 'Webhook não autorizado.' });
      }

      const stripe = getStripe();
      if (!stripe) return res.status(400).json({ error: 'Stripe SDK não configurado no servidor.' });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
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
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
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
        console.error('[Stripe Webhook] Erro ao processar evento:', handlerErr);
      }

      return res.json({ received: true, event: event.type });
    },
  );
};