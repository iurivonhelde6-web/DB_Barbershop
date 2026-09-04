import express from 'express';
import Stripe from 'stripe';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// ─── Lista de Planos do Backend (Evita erro de importação na Vercel) ──────────
const PLANS_LIST = [
  {
    id: 'cs-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'corte-simples',
    serviceName: 'Corte Simples',
    numAtendimentos: 3,
    totalPrice: 54,
    pricePerAtd: 18,
    costPerAtd: 18,
    barberSplitPerAtd: 9.9,
    houseMarginPerAtd: 8.1,
    totalBarberCommission: 29.7,
    totalHouseMargin: 24.3,
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
    totalPrice: 68,
    pricePerAtd: 17,
    costPerAtd: 17,
    barberSplitPerAtd: 9.35,
    houseMarginPerAtd: 7.65,
    totalBarberCommission: 37.4, // 55%
    totalHouseMargin: 30.6,     // 45%
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
    totalPrice: 85,
    pricePerAtd: 17,
    costPerAtd: 17,
    barberSplitPerAtd: 9.77,
    houseMarginPerAtd: 7.23,
    totalBarberCommission: 48.87, // 57.5%
    totalHouseMargin: 36.13,     // 42.5%
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
    totalPrice: 96,
    pricePerAtd: 16,
    costPerAtd: 16,
    barberSplitPerAtd: 9.2,
    houseMarginPerAtd: 6.8,
    totalBarberCommission: 55.2, // 57.5%
    totalHouseMargin: 40.8,     // 42.5%
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
    totalPrice: 160,
    pricePerAtd: 16,
    costPerAtd: 16,
    barberSplitPerAtd: 9.6,
    houseMarginPerAtd: 6.4,
    totalBarberCommission: 96, // 60%
    totalHouseMargin: 64,     // 40%
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
    totalPrice: 68,
    pricePerAtd: 17,
    costPerAtd: 17,
    barberSplitPerAtd: 10.2,
    houseMarginPerAtd: 6.8,
    totalBarberCommission: 40.8, // 60%
    totalHouseMargin: 27.2,     // 40%
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
    totalPrice: 128,
    pricePerAtd: 16,
    costPerAtd: 16,
    barberSplitPerAtd: 9.6,
    houseMarginPerAtd: 6.4,
    totalBarberCommission: 76.8, // 60%
    totalHouseMargin: 51.2,     // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Família 8 ATD',
    recommendedFor: 'Até 4 familiares da mesma casa.',
  },

  // --- DISFARCE SÓ MÁQUINA (Avulso R$ 40) ---
  {
    id: 'dm-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 3,
    totalPrice: 108,
    pricePerAtd: 36,
    costPerAtd: 36,
    barberSplitPerAtd: 19.8,
    houseMarginPerAtd: 16.2,
    totalBarberCommission: 59.4, // 55%
    totalHouseMargin: 48.6,     // 45%
    badgeTag: '🟢 Disfarce 3 ATD',
  },
  {
    id: 'dm-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 4,
    totalPrice: 136,
    pricePerAtd: 34,
    costPerAtd: 34,
    barberSplitPerAtd: 18.7,
    houseMarginPerAtd: 15.3,
    totalBarberCommission: 74.8, // 55%
    totalHouseMargin: 61.2,     // 45%
    badgeTag: '🟢 Disfarce 4 ATD',
  },
  {
    id: 'dm-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 5,
    totalPrice: 165,
    pricePerAtd: 33,
    costPerAtd: 33,
    barberSplitPerAtd: 18.97,
    houseMarginPerAtd: 14.03,
    totalBarberCommission: 94.87, // 57.5%
    totalHouseMargin: 70.13,      // 42.5%
    badgeTag: '🔵 Plus Disfarce 5',
  },
  {
    id: 'dm-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 6,
    totalPrice: 192,
    pricePerAtd: 32,
    costPerAtd: 32,
    barberSplitPerAtd: 18.4,
    houseMarginPerAtd: 13.6,
    totalBarberCommission: 110.4, // 57.5%
    totalHouseMargin: 81.6,      // 42.5%
    badgeTag: '🔵 Plus Disfarce 6',
  },
  {
    id: 'dm-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 10,
    totalPrice: 320,
    pricePerAtd: 32,
    costPerAtd: 32,
    barberSplitPerAtd: 19.2,
    houseMarginPerAtd: 12.8,
    totalBarberCommission: 192, // 60%
    totalHouseMargin: 128,     // 40%
    badgeTag: '⭐ SELECT 10 ATD',
  },
  {
    id: 'dm-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    numAtendimentos: 4,
    totalPrice: 136,
    pricePerAtd: 34,
    costPerAtd: 34,
    barberSplitPerAtd: 20.4,
    houseMarginPerAtd: 13.6,
    totalBarberCommission: 81.6, // 60%
    totalHouseMargin: 54.4,     // 40%
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
    totalPrice: 256,
    pricePerAtd: 32,
    costPerAtd: 32,
    barberSplitPerAtd: 19.2,
    houseMarginPerAtd: 12.8,
    totalBarberCommission: 153.6, // 60%
    totalHouseMargin: 102.4,     // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- DISFARCE MÁQUINA E TESOURA ✂️ (Avulso R$ 45) ---
  {
    id: 'dmt-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 3,
    totalPrice: 122,
    pricePerAtd: 40.67,
    costPerAtd: 40.67,
    barberSplitPerAtd: 22.37,
    houseMarginPerAtd: 18.3,
    totalBarberCommission: 67.1, // 55%
    totalHouseMargin: 54.9,     // 45%
    badgeTag: '🟢 Básico Tesoura 3',
  },
  {
    id: 'dmt-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 153,
    pricePerAtd: 38.25,
    costPerAtd: 38.25,
    barberSplitPerAtd: 21.04,
    houseMarginPerAtd: 17.21,
    totalBarberCommission: 84.15, // 55%
    totalHouseMargin: 68.85,     // 45%
    badgeTag: '🟢 Básico Tesoura 4',
  },
  {
    id: 'dmt-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 5,
    totalPrice: 185,
    pricePerAtd: 37,
    costPerAtd: 37,
    barberSplitPerAtd: 21.27,
    houseMarginPerAtd: 15.73,
    totalBarberCommission: 106.37, // 57.5%
    totalHouseMargin: 78.63,      // 42.5%
    badgeTag: '🔵 Plus Tesoura 5',
  },
  {
    id: 'dmt-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 216,
    pricePerAtd: 36,
    costPerAtd: 36,
    barberSplitPerAtd: 20.7,
    houseMarginPerAtd: 15.3,
    totalBarberCommission: 124.2, // 57.5%
    totalHouseMargin: 91.8,      // 42.5%
    badgeTag: '🔵 Plus Tesoura 6',
  },
  {
    id: 'dmt-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 10,
    totalPrice: 360,
    pricePerAtd: 36,
    costPerAtd: 36,
    barberSplitPerAtd: 21.6,
    houseMarginPerAtd: 14.4,
    totalBarberCommission: 216, // 60%
    totalHouseMargin: 144,     // 40%
    badgeTag: '⭐ SELECT Tesoura 10',
  },
  {
    id: 'dmt-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 153,
    pricePerAtd: 38.25,
    costPerAtd: 38.25,
    barberSplitPerAtd: 22.95,
    houseMarginPerAtd: 15.3,
    totalBarberCommission: 91.8, // 60%
    totalHouseMargin: 61.2,     // 40%
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
    totalPrice: 288,
    pricePerAtd: 36,
    costPerAtd: 36,
    barberSplitPerAtd: 21.6,
    houseMarginPerAtd: 14.4,
    totalBarberCommission: 172.8, // 60%
    totalHouseMargin: 115.2,     // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- CORTE SÓ TESOURA ✂️ (Avulso R$ 50) ---
  {
    id: 'st-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 3,
    totalPrice: 135,
    pricePerAtd: 45,
    costPerAtd: 45,
    barberSplitPerAtd: 24.75,
    houseMarginPerAtd: 20.25,
    totalBarberCommission: 74.25, // 55%
    totalHouseMargin: 60.75,     // 45%
    badgeTag: '🟢 Só Tesoura 3 ATD',
  },
  {
    id: 'st-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 170,
    pricePerAtd: 42.5,
    costPerAtd: 42.5,
    barberSplitPerAtd: 23.38,
    houseMarginPerAtd: 19.12,
    totalBarberCommission: 93.5, // 55%
    totalHouseMargin: 76.5,     // 45%
    badgeTag: '🟢 Só Tesoura 4 ATD',
  },
  {
    id: 'st-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 5,
    totalPrice: 205,
    pricePerAtd: 41,
    costPerAtd: 41,
    barberSplitPerAtd: 23.57,
    houseMarginPerAtd: 17.43,
    totalBarberCommission: 117.87, // 57.5%
    totalHouseMargin: 87.13,      // 42.5%
    badgeTag: '🔵 Plus Tesoura 5 ATD',
  },
  {
    id: 'st-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 6,
    totalPrice: 240,
    pricePerAtd: 40,
    costPerAtd: 40,
    barberSplitPerAtd: 23.0,
    houseMarginPerAtd: 17.0,
    totalBarberCommission: 138, // 57.5%
    totalHouseMargin: 102,     // 42.5%
    badgeTag: '🔵 Plus Tesoura 6 ATD',
  },
  {
    id: 'st-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 10,
    totalPrice: 400,
    pricePerAtd: 40,
    costPerAtd: 40,
    barberSplitPerAtd: 24.0,
    houseMarginPerAtd: 16.0,
    totalBarberCommission: 240, // 60%
    totalHouseMargin: 160,     // 40%
    badgeTag: '⭐ SELECT Tesoura 10',
  },
  {
    id: 'st-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    numAtendimentos: 4,
    totalPrice: 170,
    pricePerAtd: 42.5,
    costPerAtd: 42.5,
    barberSplitPerAtd: 25.5,
    houseMarginPerAtd: 17.0,
    totalBarberCommission: 102, // 60%
    totalHouseMargin: 68,      // 40%
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
    totalPrice: 320,
    pricePerAtd: 40,
    costPerAtd: 40,
    barberSplitPerAtd: 24.0,
    houseMarginPerAtd: 16.0,
    totalBarberCommission: 192, // 60%
    totalHouseMargin: 128,     // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- BARBA SIMPLES (Avulso R$ 25) ---
  {
    id: 'bs-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 3,
    totalPrice: 68,
    pricePerAtd: 22.67,
    costPerAtd: 22.67,
    barberSplitPerAtd: 12.47,
    houseMarginPerAtd: 10.2,
    totalBarberCommission: 37.4, // 55%
    totalHouseMargin: 30.6,     // 45%
    badgeTag: '🟢 Barba 3 ATD',
  },
  {
    id: 'bs-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 4,
    totalPrice: 85,
    pricePerAtd: 21.25,
    costPerAtd: 21.25,
    barberSplitPerAtd: 11.69,
    houseMarginPerAtd: 9.56,
    totalBarberCommission: 46.75, // 55%
    totalHouseMargin: 38.25,     // 45%
    badgeTag: '🟢 Barba 4 ATD',
  },
  {
    id: 'bs-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 5,
    totalPrice: 105,
    pricePerAtd: 21,
    costPerAtd: 21,
    barberSplitPerAtd: 12.07,
    houseMarginPerAtd: 8.93,
    totalBarberCommission: 60.37, // 57.5%
    totalHouseMargin: 44.63,     // 42.5%
    badgeTag: '🔵 Barba 5 ATD',
  },
  {
    id: 'bs-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 6,
    totalPrice: 120,
    pricePerAtd: 20,
    costPerAtd: 20,
    barberSplitPerAtd: 11.5,
    houseMarginPerAtd: 8.5,
    totalBarberCommission: 69, // 57.5%
    totalHouseMargin: 51,     // 42.5%
    badgeTag: '🔵 Barba 6 ATD',
  },
  {
    id: 'bs-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 10,
    totalPrice: 200,
    pricePerAtd: 20,
    costPerAtd: 20,
    barberSplitPerAtd: 12.0,
    houseMarginPerAtd: 8.0,
    totalBarberCommission: 120, // 60%
    totalHouseMargin: 80,      // 40%
    badgeTag: '⭐ SELECT Barba 10',
  },
  {
    id: 'bs-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    numAtendimentos: 4,
    totalPrice: 85,
    pricePerAtd: 21.25,
    costPerAtd: 21.25,
    barberSplitPerAtd: 12.75,
    houseMarginPerAtd: 8.5,
    totalBarberCommission: 51, // 60%
    totalHouseMargin: 34,     // 40%
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
    totalPrice: 160,
    pricePerAtd: 20,
    costPerAtd: 20,
    barberSplitPerAtd: 12.0,
    houseMarginPerAtd: 8.0,
    totalBarberCommission: 96, // 60%
    totalHouseMargin: 64,     // 40%
    familyMembers: 4,
    badgeTag: '👨‍👩‍👧‍👦 Family 8 ATD',
  },

  // --- BARBA MODELADA (Avulso R$ 35) ---
  {
    id: 'bm-basic-3',
    tier: 'basic',
    tierLabel: 'BASIC 3 (3 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 3,
    totalPrice: 95,
    pricePerAtd: 31.67,
    costPerAtd: 31.67,
    barberSplitPerAtd: 17.42,
    houseMarginPerAtd: 14.25,
    totalBarberCommission: 52.25, // 55%
    totalHouseMargin: 42.75,     // 45%
    badgeTag: '🟢 Barba Modelada 3',
  },
  {
    id: 'bm-basic-4',
    tier: 'basic',
    tierLabel: 'BASIC 4 (4 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 4,
    totalPrice: 119,
    pricePerAtd: 29.75,
    costPerAtd: 29.75,
    barberSplitPerAtd: 16.36,
    houseMarginPerAtd: 13.39,
    totalBarberCommission: 65.45, // 55%
    totalHouseMargin: 53.55,     // 45%
    badgeTag: '🟢 Barba Modelada 4',
  },
  {
    id: 'bm-plus-5',
    tier: 'plus',
    tierLabel: 'PLUS 5 (5 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 5,
    totalPrice: 145,
    pricePerAtd: 29,
    costPerAtd: 29,
    barberSplitPerAtd: 16.68,
    houseMarginPerAtd: 12.32,
    totalBarberCommission: 83.38, // 57.5%
    totalHouseMargin: 61.62,     // 42.5%
    badgeTag: '🔵 Plus Barba Modelada 5',
  },
  {
    id: 'bm-plus-6',
    tier: 'plus',
    tierLabel: 'PLUS 6 (6 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 6,
    totalPrice: 168,
    pricePerAtd: 28,
    costPerAtd: 28,
    barberSplitPerAtd: 16.1,
    houseMarginPerAtd: 11.9,
    totalBarberCommission: 96.6, // 57.5%
    totalHouseMargin: 71.4,     // 42.5%
    badgeTag: '🔵 Plus Barba Modelada 6',
  },
  {
    id: 'bm-select-10',
    tier: 'select',
    tierLabel: 'SELECT 10 ⭐ (10 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 10,
    totalPrice: 280,
    pricePerAtd: 28,
    costPerAtd: 28,
    barberSplitPerAtd: 16.8,
    houseMarginPerAtd: 11.2,
    totalBarberCommission: 168, // 60%
    totalHouseMargin: 112,     // 40%
    badgeTag: '⭐ SELECT Barba Modelada 10',
  },
  {
    id: 'bm-family-4',
    tier: 'family',
    tierLabel: 'FAMILY 4 (4 ATD)',
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    numAtendimentos: 4,
    totalPrice: 119,
    pricePerAtd: 29.75,
    costPerAtd: 29.75,
    barberSplitPerAtd: 17.85,
    houseMarginPerAtd: 11.9,
    totalBarberCommission: 71.4, // 60%
    totalHouseMargin: 47.6,     // 40%
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
    totalPrice: 224,
    pricePerAtd: 28,
    costPerAtd: 28,
    barberSplitPerAtd: 16.8,
    houseMarginPerAtd: 11.2,
    totalBarberCommission: 134.4, // 60%
    totalHouseMargin: 89.6,      // 40%
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
    pricePerAtd: 36.25,
    costPerAtd: 36.25,
    barberSplitPerAtd: 21.75,
    houseMarginPerAtd: 14.5,
    totalBarberCommission: 174, // 60%
    totalHouseMargin: 116,     // 40%
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

export function registerStripeRoutes(app: express.Application, db: any) {
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
        await getDocs(collection(db, 'subscribers'));
        firestoreStatus = 'authenticated';
      } catch { firestoreStatus = 'connected'; }
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
      const { paymentMethodId, clientName, clientCpf, clientPhone, planName, planAmount, subscriberId, cardCode } = req.body || {};

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
      let subscriptionStatus: Stripe.Subscription.Status = isProduction ? 'incomplete' : 'active';
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

        const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
        const latestPaymentIntent = (latestInvoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | null })?.payment_intent ?? null;
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
      const subDocRef = doc(db, 'subscribers', targetId);

      try {
        const snap = await getDoc(subDocRef);
        const existing = snap.exists() ? snap.data() : {};
        const history = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];
        await setDoc(subDocRef, {
          ...existing, id: targetId,
          cardCode: existing.cardCode || cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName, cpf: cleanCpf, phone: clientPhone || existing.phone || '', planName,
          serviceName: existing.serviceName || planName, totalSessions: existing.totalSessions || 4,
          usedSessions: existing.usedSessions || 0, startDate: startDateStr, expirationDate: expDateStr,
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
        success: true, subscriptionId: stripeSubscriptionId, paymentClientSecret, subscriptionStatus,
        stripeCustomerId, cardBrand: cardBrand.toUpperCase(), cardLast4,
        status: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'ACTIVE' : 'PAYMENT_PENDING',
        expirationDate: expDateStr,
      });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar assinatura:', err);
      return res.status(500).json({ error: err.message || 'Erro ao processar assinatura.' });
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
        try {
          const snap = await getDocs(collection(db, 'subscribers'));
          for (const d of snap.docs) {
            const data = d.data();
            if ((subscriptionId && data.stripeSubscriptionId === subscriptionId) || (customerId && data.stripeCustomerId === customerId)) {
              return { id: d.id, data };
            }
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
            if (!match) break;

            const now = new Date();
            const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
            const renewalInvoice = {
              id: `INV-STRIPE-RENEW-${Date.now()}`, invoiceCode: `STRIPE-RNW-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
              planName: match.data.planName || 'Assinatura Recorrente', amount: (invoice.amount_paid || 0) / 100,
              paymentMethod: 'CREDIT_CARD' as const, paymentDate: now.toLocaleString('pt-BR'),
              dueDate: now.toISOString().split('T')[0], period: 'Renovação Recorrente',
              status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
              transactionId: invoice.id || `stripe-${Date.now()}`,
              notes: 'Fatura renovada automaticamente via Stripe (invoice.paid)',
            };
            const history = Array.isArray(match.data.paymentHistory) ? match.data.paymentHistory : [];
            await setDoc(doc(db, 'subscribers', match.id), { ...match.data, status: 'ACTIVE', paymentStatus: 'PAID', paymentDate: now.toISOString().split('T')[0], expirationDate: expDate.toISOString().split('T')[0], paymentHistory: [renewalInvoice, ...history], updatedAt: now.toISOString() }, { merge: true });
            console.log(`[Stripe Webhook] invoice.paid — assinante ${match.id} renovado.`);
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
            await setDoc(doc(db, 'subscribers', match.id), { ...match.data, status: 'PAYMENT_PENDING', paymentStatus: 'FAILED', paymentHistory: [failedInvoice, ...history], updatedAt: new Date().toISOString() }, { merge: true });
            console.warn(`[Stripe Webhook] invoice.payment_failed — assinante ${match.id} → PAYMENT_PENDING.`);
            break;
          }

          case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const match = await findSubscriber(sub.id, typeof sub.customer === 'string' ? sub.customer : sub.customer?.id);
            if (!match) break;
            await setDoc(doc(db, 'subscribers', match.id), { status: 'SUSPENDED', updatedAt: new Date().toISOString() }, { merge: true });
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