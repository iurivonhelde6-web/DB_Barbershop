export type UserRole = 'admin' | 'client';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cpf?: string;
  age?: number;
  address?: string;
  cardCode?: string;
  planName?: string;
  avatarUrl?: string;
}

export type PlanTier = 'basic' | 'plus' | 'select' | 'family' | 'flex_premium';

export interface ServiceItem {
  id: string;
  name: string;
  avulsoPrice: number;
  iconName: string;
  description: string;
  defaultCost: number;
}

export interface PlanOption {
  id: string;
  tier: PlanTier;
  tierLabel: string;
  serviceId: string;
  serviceName: string;
  numAtendimentos: number;
  totalPrice: number;
  pricePerAtd: number;
  costPerAtd: number;
  barberSplitPerAtd?: number;
  houseMarginPerAtd?: number;
  totalBarberCommission: number;
  totalHouseMargin: number;
  familyMembers?: number;
  badgeTag?: string;
  recommendedFor?: string;
}

export interface SubscriberCard {
  id: string;
  cardCode: string;
  clientName: string;
  cpf: string;
  age?: number;
  address?: string;
  phone: string;
  email?: string;
  userUid?: string;
  planName: string;
  serviceName: string;
  totalSessions: number;
  usedSessions: number;
  expirationDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'SUSPENDED' | 'PAYMENT_PENDING';
  barberPreferred?: string;
  notes?: string;
  qrCodeValue: string;
  paymentStatus?: 'PAID' | 'PENDING' | 'FAILED';
  paidAmount?: number;
  expectedAmount?: number;
  paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'GATEWAY';
  paymentDate?: string;
  transactionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;

  cardLast4?: string;
  cardBrand?: string;
  paymentHistory?: PaymentInvoice[];
}

export interface PaymentInvoice {
  id: string;
  invoiceCode: string;
  planName: string;
  amount: number;
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'GATEWAY' | 'BALCÃO';
  paymentDate: string;
  dueDate?: string;
  period: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  validationStatus: 'VALIDATED' | 'UNDER_REVIEW' | 'EXPIRED' | 'BLOCKED';
  transactionId: string;
  receiptUrl?: string;
  notes?: string;
}

export interface ContractRule {
  id: number;
  number: string;
  title: string;
  content: string;
  badge?: 'REGRA' | 'IMPORTANTE' | 'SUSPENSÃO' | 'ATRASOS' | 'VALIDAÇÃO';
  isAllowed?: string[];
  isForbidden?: string[];
}

export interface BusinessSimulation {
  totalClients: number;
  subscribersCount: number;
  avulsoClientsCount: number;
  occupancyRate: number; // percentage e.g. 75%
  avgTicket: number; // average ticket in R$
  recurrenceRate: number; // % of returning clients
  barberCommissionPercent: number; // default 50%-60%
}

export interface Barber {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  avatar: string;
  phone?: string;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  userUid?: string;
  cardCode?: string;
  barberId: string;
  barberName: string;
  serviceId?: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  createdAt: string; // ISO String
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
