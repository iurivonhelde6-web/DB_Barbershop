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
    defaultCost: 9,
  },
  {
    id: 'disfarce-maquina',
    name: 'Disfarce Só Máquina',
    avulsoPrice: 40,
    iconName: 'Zap',
    description: 'Degradê / Disfarce executado exclusivamente na máquina.',
    defaultCost: 17.5,
  },
  {
    id: 'disfarce-tesoura-maquina',
    name: 'Disfarce Máquina e Tesoura ✂️',
    avulsoPrice: 45,
    iconName: 'Sparkles',
    description: 'Degradê na máquina com acabamento e topo trabalhado na tesoura.',
    defaultCost: 20,
  },
  {
    id: 'so-tesoura',
    name: 'Corte Tesoura ✂️',
    avulsoPrice: 50,
    iconName: 'Scissors',
    description: 'Corte estilizado 100% trabalhado na tesoura.',
    defaultCost: 20,
  },
  {
    id: 'barba-simples',
    name: 'Barba Simples',
    avulsoPrice: 25,
    iconName: 'UserCheck',
    description: 'Alinhamento rápido e rebaixamento da barba.',
    defaultCost: 10,
  },
  {
    id: 'barba-modelada',
    name: 'Barba Modelada',
    avulsoPrice: 35,
    iconName: 'Award',
    description: 'Barboterapia com toalha quente, óleo especial e desenho preciso.',
    defaultCost: 14,
  },
];

export const PLANS_LIST: PlanOption[] = [
  // --- CORTE SIMPLES (Avulso R$ 20) ---
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
    totalBarberCommission: 29.7, // 55%
    totalHouseMargin: 24.3,     // 45%
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