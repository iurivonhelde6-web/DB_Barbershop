import { ServiceItem, PlanOption, ContractRule, SubscriberCard, Barber, Appointment } from '../types';

export const ADMIN_WHATSAPP = '5521980843448';
export const ADMIN_WHATSAPP_DISPLAY = '+55 21 98084-3448';

export const BARBERS_LIST: Barber[] = [
  {
    id: 'barber-01',
    name: 'Fernando Neves',
    specialty: '',
    rating: 5.0,
    avatar: '✂️',
    phone: ADMIN_WHATSAPP,
  },
  {
    id: 'barber-02',
    name: 'Ismael',
    specialty: '',
    rating: 5.0,
    avatar: '💈',
    phone: ADMIN_WHATSAPP,
  },
  {
    id: 'barber-03',
    name: 'Ricardo',
    specialty: '',
    rating: 5.0,
    avatar: '✂️',
    phone: ADMIN_WHATSAPP,
  },
  {
    id: 'barber-04',
    name: 'Carlos Bispo',
    specialty: '',
    rating: 5.0,
    avatar: '💈',
    phone: ADMIN_WHATSAPP,
  },
  {
    id: 'barber-05',
    name: 'Marcelo Gaúcho',
    specialty: '',
    rating: 5.0,
    avatar: '✂️',
    phone: ADMIN_WHATSAPP,
  },
  {
    id: 'barber-06',
    name: 'André (Ded Black)',
    specialty: '',
    rating: 5.0,
    avatar: '👑',
    phone: ADMIN_WHATSAPP,
  },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const SERVICES_LIST: ServiceItem[] = [
  {
    id: 'corte-simples',
    name: 'Corte Simples',
    avulsoPrice: 20,
    iconName: 'Scissors',
    description: 'Corte tradicional de cabelo sem disfarce avançado.',
    defaultCost: 10, // comissão avulso 50%: R$ 10,00
  },
  {
    id: 'disfarce-maquina',
    name: 'Disfarce Só Máquina',
    avulsoPrice: 40,
    iconName: 'Zap',
    description: 'Degradê / Disfarce executado exclusivamente na máquina.',
    defaultCost: 20, // comissão avulso 50%: R$ 20,00
  },
  {
    id: 'disfarce-tesoura-maquina',
    name: 'Disfarce Máquina e Tesoura ✂️',
    avulsoPrice: 45,
    iconName: 'Sparkles',
    description: 'Degradê na máquina com acabamento e topo trabalhado na tesoura.',
    defaultCost: 22.5, // comissão avulso 50%: R$ 22,50
  },
  {
    id: 'so-tesoura',
    name: 'Corte Tesoura ✂️',
    avulsoPrice: 50,
    iconName: 'Scissors',
    description: 'Corte estilizado 100% trabalhado na tesoura.',
    defaultCost: 25, // comissão avulso 50%: R$ 25,00
  },
  {
    id: 'barba-simples',
    name: 'Barba Simples',
    avulsoPrice: 25,
    iconName: 'UserCheck',
    description: 'Alinhamento rápido e rebaixamento da barba.',
    defaultCost: 12.5, // comissão avulso 50%: R$ 12,50
  },
  {
    id: 'barba-modelada',
    name: 'Barba Modelada',
    avulsoPrice: 35,
    iconName: 'Award',
    description: 'Barboterapia com toalha quente, óleo especial e desenho preciso.',
    defaultCost: 17.5, // comissão avulso 50%: R$ 17,50
  },
];

// ─── Percentuais de comissão por tipo de plano (Termômetro Interno D•B) ───────
// Basic 3, Basic 4, Family 4 → 55%  |  Plus 5, Plus 6 → 57,5%
// Select 10, Family 8 → 60%          |  Avulso → 50%

export const PLANS_LIST: PlanOption[] = [
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

export const CONTRACT_RULES: ContractRule[] = [
  {
    id: 1,
    number: '1.0',
    title: 'Comissões sobre Atendimentos',
    content: 'Atendimentos não utilizados pelo cliente ao final do ciclo mensal NÃO geram comissão para a equipe de barbeiros.',
    badge: 'REGRA',
  },
  {
    id: 2,
    number: '2.0',
    title: 'Não Acúmulo de Saldo',
    content: 'A assinatura e os atendimentos não utilizados NÃO acumulam para o mês seguinte. Cada ciclo expira estritamente em 30 dias.',
    badge: 'IMPORTANTE',
  },
  {
    id: 3,
    number: '3.0',
    title: 'Uso Pessoal e Intransferível',
    content: 'O plano é de uso estritamente pessoal e intransferível. A única exceção aplica-se à modalidade FAMILY (2 a 4 membros cadastrados).',
    badge: 'REGRA',
  },
  {
    id: 4,
    number: '4.0',
    title: 'Padrão de Atendimento Ded Black',
    content: 'O barbeiro colaborador e o cliente devem respeitar rigorosamente o padrão de qualidade, biossegurança e postura da casa.',
    badge: 'REGRA',
  },
  {
    id: 5,
    number: '5.0',
    title: 'Princípio do Modelo (Win-Win)',
    content: 'No modelo avulso o cliente paga mais por visita. A assinatura garante economia para o cliente, agenda cheia para o barbeiro e bônus no fechamento mensal.',
    badge: 'IMPORTANTE',
  },
  {
    id: 6,
    number: '6.0',
    title: 'Uso Mediante Documento e Cartão de Controle',
    content: 'A utilização do plano só é válida mediante apresentação de documento oficial de identificação e do Cartão de Controle (físico ou digital). Caso o cliente compareça sem o cartão de controle, o atendimento será cobrado pelo valor AVULSO da tabela.',
    badge: 'VALIDAÇÃO',
  },
  {
    id: 7,
    number: '7.0',
    title: 'Atrasos e Cancelamentos de Horário',
    content: 'Tolerância máxima de 10 minutos de atraso. Após esse período, o atendimento poderá ser remarcado conforme disponibilidade. Cancelamentos devem ser realizados com no mínimo 2 horas de antecedência.',
    badge: 'ATRASOS',
  },
  {
    id: 8,
    number: '8.0',
    title: 'Cancelamento ou Bloqueio do Plano',
    content: 'O cancelamento ou bloqueio ocorre no dia do vencimento caso não haja a renovação do pagamento mensal. Não haverá devolução proporcional de valores após o início do ciclo mensal.',
    badge: 'REGRA',
  },
  {
    id: 9,
    number: '9.0',
    title: 'Suspensão Solicitada pelo Cliente',
    content: 'O cliente poderá solicitar a suspensão temporária do plano no vencimento dos 30 dias, mediante avaliação e aprovação da barbearia.',
    badge: 'SUSPENSÃO',
  },
  {
    id: 10,
    number: '10.0',
    title: 'Regras de Compatibilidade e Troca de Serviços',
    content: '✅ Quem possui o plano Disfarçado Tesoura + Máquina PODE realizar um Corte Simples ou Barba se preferir.\n❌ Quem possui o plano de Corte Simples NÃO PODE trocar por um Disfarçado Tesoura + Máquina.\n❌ Não é permitido utilizar dois atendimentos para "completar" um serviço mais caro.\n⭐ Quem deseja total liberdade de escolha em cada visita deve aderir ao FLEX PREMIUM.',
    badge: 'IMPORTANTE',
    isAllowed: ['Disfarçado Tesoura + Máquina pode fazer Corte Simples ou Barba.'],
    isForbidden: ['Corte Simples NÃO troca por Disfarçado Tesoura.', 'NÃO pode somar 2 atendimentos para serviço mais caro.'],
  },
  {
    id: 11,
    number: '11.0',
    title: 'Alteração de Valores e Condições',
    content: 'A D•B BARBERSHOP reserva-se o direito de ajustar valores ou condições do plano mediante aviso prévio de 30 dias aos assinantes.',
    badge: 'REGRA',
  },
  {
    id: 12,
    number: '12.0',
    title: 'Atendimentos com Equipe de Colaboradores',
    content: 'O cliente pode ser atendido por qualquer barbeiro da equipe disponível aguardando na fila de espera (exceto atendimentos exclusivos com o GESTOR Ded Black, que requerem plano e agendamento específico).',
    badge: 'REGRA',
  },
  {
    id: 13,
    number: '13.0',
    title: 'Validação Obrigatória e Perda do Cartão',
    content: 'É obrigatório apresentar documento e cartão físico/digital no dia do corte. O cuidado do cartão é de total responsabilidade do cliente. Caso o cliente perca o cartão, o mesmo será dado como inválido e para ser atendido no plano novamente será cobrado um novo ciclo mensal.',
    badge: 'VALIDAÇÃO',
  },
  {
    id: 14,
    number: '14.0',
    title: 'Upgrade de Profissional — André de Souza (DED BLACK)',
    content: 'A assinatura D•B CLUB garante ao membro os serviços contratados com a equipe D•B, não estando vinculada a um profissional específico. Caso o membro opte pelo atendimento com André de Souza (DED BLACK), poderá utilizar o atendimento disponível em seu plano como crédito e complementar a diferença conforme o valor vigente desse atendimento. O upgrade está sujeito à disponibilidade de agenda, confirmação prévia e ao consumo normal do crédito utilizado no plano.',
    badge: 'IMPORTANTE',
  },
  {
    id: 15,
    number: '15.0',
    title: 'Disposições Finais e Vínculo Contratual',
    content: 'Este contrato representa o acordo oficial entre as partes e deverá ser cumprido integralmente.',
    badge: 'REGRA',
  },
];

// Upgrade de Profissional — André de Souza (DED BLACK)
// Valor complementar cobrado quando o membro usa o crédito do plano
// para um atendimento com André, por tier de assinatura.
export interface AndreUpgradePricing {
  serviceId: string;
  serviceName: string;
  basic: number;
  plus: number;
  select: number;
  family: number;
}

export const ANDRE_UPGRADE_BARBER_ID = 'barber-06'; // André (Ded Black)

export const ANDRE_UPGRADE_TABLE: AndreUpgradePricing[] = [
  {
    serviceId: 'disfarce-maquina',
    serviceName: 'Disfarce Só Máquina',
    basic: 15,
    plus: 20,
    select: 20,
    family: 20,
  },
  {
    serviceId: 'disfarce-tesoura-maquina',
    serviceName: 'Disfarce Máquina e Tesoura ✂️',
    basic: 20,
    plus: 25,
    select: 25,
    family: 25,
  },
  {
    serviceId: 'so-tesoura',
    serviceName: 'Corte Tesoura ✂️',
    basic: 20,
    plus: 20,
    select: 20,
    family: 20,
  },
  {
    serviceId: 'barba-simples',
    serviceName: 'Barba Simples',
    basic: 20,
    plus: 20,
    select: 20,
    family: 20,
  },
  {
    serviceId: 'barba-modelada',
    serviceName: 'Barba Modelada',
    basic: 15,
    plus: 20,
    select: 20,
    family: 20,
  },
];

export const MOCK_SUBSCRIBERS: SubscriberCard[] = [];