import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { SubscriberCard, Appointment } from '../types';
import { BARBERS_LIST, SERVICES_LIST, PLANS_LIST } from '../data/barberData';
import { FinancialCalculator } from './FinancialCalculator';
import { verifyBackendAdminRole } from '../lib/firebase';
import { SubscriberStatusBadge } from '../utils/statusUtils';
import {
  DollarSign,
  Users,
  CalendarCheck,
  TrendingUp,
  Scissors,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  PlusCircle,
  ShieldCheck,
  Phone,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Filter,
  UserCheck,
  ChevronRight,
  Calculator,
  LayoutDashboard,
  ShieldAlert,
  Lock,
  Calendar,
  CalendarDays,
  RotateCcw,
  X,
  Database,
  CreditCard,
  Download,
  RefreshCw,
  FileJson,
  Server,
  HardDrive,
  AlertTriangle,
  Bell
} from 'lucide-react';

interface AdminDashboardProps {
  subscribers: SubscriberCard[];
  appointments: Appointment[];
  onOpenBooking: () => void;
  onOpenCheckin: () => void;
  onOpenRegister: () => void;
  onDeleteAppointment?: (id: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  subscribers,
  appointments,
  onOpenBooking,
  onOpenCheckin,
  onOpenRegister,
  onDeleteAppointment,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'calculator' | 'backups'>('overview');
  const [appointmentFilter, setAppointmentFilter] = useState<'ALL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [backendVerified, setBackendVerified] = useState<boolean | null>(null);

  // Backup States & Actions
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackupStatus = async () => {
    try {
      const { getAuthHeaders } = await import('../lib/firebase');
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/backup/latest', { headers });
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch (err) {
      console.warn('Erro ao consultar backup status:', err);
    }
  };

  const triggerManualBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const { getAuthHeaders } = await import('../lib/firebase');
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/backup/export', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setBackupMsg({
          type: 'success',
          text: `Backup em JSON gerado com sucesso! Arquivo: ${data.filename} (${data.subscribersCount} assinantes, ${data.appointmentsCount} agendamentos, ${data.usersCount} usuários).`,
        });
        fetchBackupStatus();
      } else {
        setBackupMsg({
          type: 'error',
          text: data.error || 'Erro ao gerar backup de segurança.',
        });
      }
    } catch (err: any) {
      setBackupMsg({
        type: 'error',
        text: 'Erro de comunicação com o servidor ao solicitar backup.',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const downloadBackupJson = async (fileName?: string) => {
    try {
      const { getAuthHeaders } = await import('../lib/firebase');
      const headers = await getAuthHeaders();
      const url = fileName ? `/api/admin/backup/download?file=${encodeURIComponent(fileName)}` : '/api/admin/backup/download';
      const res = await fetch(url, { headers });
      if (!res.ok) {
        alert('Erro ao baixar arquivo de backup.');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'latest-backup.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erro no download do JSON:', err);
      alert('Erro ao baixar arquivo de backup.');
    }
  };

  useEffect(() => {
    if (activeTab === 'backups') {
      fetchBackupStatus();
    }
  }, [activeTab]);

  // Date Range Filtering States
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    verifyBackendAdminRole().then((res) => {
      setBackendVerified(res.verified);
    });
  }, []);

  // Helper to parse date strings (YYYY-MM-DD, DD/MM/YYYY, ISO)
  const parseDateString = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    if (!str) return null;

    if (str.includes('-')) {
      const cleanStr = str.split('T')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1;
        const dy = parseInt(parts[2], 10);
        if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
          return new Date(yr, mo, dy);
        }
      }
    }

    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const dy = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1;
        const yr = parseInt(parts[2], 10);
        if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
          return new Date(yr, mo, dy);
        }
      }
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    return null;
  };

  // Compute Active Range Boundaries
  const { rangeStart, rangeEnd } = (() => {
    const now = new Date();

    if (datePreset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { rangeStart: start, rangeEnd: end };
    }

    if (datePreset === 'THIS_WEEK') {
      const dayOfWeek = now.getDay();
      const diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mon = new Date(now.getFullYear(), now.getMonth(), diffToMon, 0, 0, 0, 0);
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);
      return { rangeStart: mon, rangeEnd: sun };
    }

    if (datePreset === 'THIS_MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { rangeStart: monthStart, rangeEnd: monthEnd };
    }

    if (datePreset === 'LAST_30_DAYS') {
      const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { rangeStart: start30, rangeEnd: endToday };
    }

    if (datePreset === 'LAST_90_DAYS') {
      const start90 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 0, 0, 0, 0);
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { rangeStart: start90, rangeEnd: endToday };
    }

    if (datePreset === 'CUSTOM') {
      const start = customStartDate ? parseDateString(customStartDate) : null;
      if (start) start.setHours(0, 0, 0, 0);
      const end = customEndDate ? parseDateString(customEndDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      return { rangeStart: start, rangeEnd: end };
    }

    return { rangeStart: null, rangeEnd: null };
  })();

  const isDateInRange = (dateStr: string | undefined | null) => {
    if (!rangeStart && !rangeEnd) return true;
    const d = parseDateString(dateStr);
    if (!d) return true;
    if (rangeStart && d < rangeStart) return false;
    if (rangeEnd && d > rangeEnd) return false;
    return true;
  };

  const formatBRDate = (d: Date | null) => {
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const activeDateLabel = (() => {
    if (datePreset === 'ALL' && !customStartDate && !customEndDate) return null;
    if (datePreset === 'TODAY') return `Hoje (${formatBRDate(rangeStart)})`;
    if (datePreset === 'THIS_WEEK') return `Esta Semana (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
    if (datePreset === 'THIS_MONTH') return `Mês Atual (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
    if (datePreset === 'LAST_30_DAYS') return `Últimos 30 Dias (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
    if (datePreset === 'LAST_90_DAYS') return `Últimos 90 Dias (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
    if (rangeStart || rangeEnd) {
      const s = rangeStart ? formatBRDate(rangeStart) : 'Início';
      const e = rangeEnd ? formatBRDate(rangeEnd) : 'Hoje';
      return `${s} até ${e}`;
    }
    return null;
  })();

  // 1. Calculate Active Subscribers Metrics
  const activeSubscribers = subscribers.filter((s) => s.status === 'ACTIVE');
  const totalActiveCount = activeSubscribers.length;

  // Calculate monthly recurring revenue from active subscribers
  const monthlyRecurringRevenue = activeSubscribers.reduce((sum, sub) => {
    if (sub.paidAmount && sub.paidAmount > 0) return sum + sub.paidAmount;
    if (sub.expectedAmount && sub.expectedAmount > 0) return sum + sub.expectedAmount;
    const plan = PLANS_LIST.find((p) => p.tierLabel === sub.planName || p.id === sub.planName);
    return sum + (plan ? plan.totalPrice : 0);
  }, 0);

  // 2. Filter Appointments by Date Range
  const dateFilteredAppointments = appointments.filter((apt) => isDateInRange(apt.date));
  const totalAppointmentsCount = dateFilteredAppointments.length;
  const confirmedAppointments = dateFilteredAppointments.filter((a) => a.status === 'CONFIRMED' || !a.status);
  const completedAppointments = dateFilteredAppointments.filter((a) => a.status === 'COMPLETED');

  // Calculate avulso appointments revenue within date range
  const estimatedAvulsoRevenue = dateFilteredAppointments.reduce((sum, apt) => {
    const srv = SERVICES_LIST.find((s) => s.name === apt.serviceName || s.id === apt.serviceId);
    return sum + (srv ? srv.avulsoPrice : 0);
  }, 0);

  // Total Estimated Gross Revenue in Period
  const totalEstimatedRevenue = monthlyRecurringRevenue + estimatedAvulsoRevenue;

  // Helper to parse dates in various string formats (YYYY-MM-DD, DD/MM/YYYY, ISO)
  const parseAnyDateString = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    if (!str) return null;

    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    }

    if (str.includes('-')) {
      const clean = str.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    return null;
  };

  // Helper to calculate expiration details based on payment date / expiration date
  const getSubExpirationDetails = (sub: SubscriberCard) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Try explicit expirationDate if present
    let expDate = parseAnyDateString(sub.expirationDate);

    // 2. If no expirationDate, derive from paymentDate or startDate + 30 days
    if (!expDate) {
      const baseDate = parseAnyDateString(sub.paymentDate || sub.startDate);
      if (baseDate) {
        expDate = new Date(baseDate);
        expDate.setDate(expDate.getDate() + 30);
      }
    }

    if (!expDate) return null;

    expDate.setHours(0, 0, 0, 0);
    const diffMs = expDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Subscription is expiring in <= 3 days (0, 1, 2, 3 days) or recently expired within the last 7 days
    const isExpiringIn3DaysOrLess = daysRemaining >= 0 && daysRemaining <= 3;
    const isRecentlyExpired = daysRemaining < 0 && daysRemaining >= -7;
    const isUrgent = isExpiringIn3DaysOrLess || isRecentlyExpired;

    const day = String(expDate.getDate()).padStart(2, '0');
    const month = String(expDate.getMonth() + 1).padStart(2, '0');
    const year = expDate.getFullYear();
    const formattedExpDate = `${day}/${month}/${year}`;

    return {
      expDate,
      formattedExpDate,
      daysRemaining,
      isExpiringIn3DaysOrLess,
      isRecentlyExpired,
      isUrgent,
    };
  };

  // Filter subscriptions that are close to expiring (< 3 days) or recently expired
  const expiringSubscribersList = subscribers
    .map((sub) => ({ sub, expDetails: getSubExpirationDetails(sub) }))
    .filter(
      (item) =>
        item.expDetails !== null &&
        item.expDetails.isUrgent &&
        item.sub.status !== 'SUSPENDED' &&
        item.sub.status !== 'BLOCKED'
    )
    .sort((a, b) => a.expDetails!.daysRemaining - b.expDetails!.daysRemaining);

  // 3. Compute Monthly Revenue for the Last 6 Months (taking date filter into account)
  const last6MonthsData = (() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const now = new Date();

    const result: Array<{
      monthKey: string;
      monthLabel: string;
      fullMonthName: string;
      year: number;
      receita: number;
      assinantesCount: number;
      isCurrentMonth: boolean;
    }> = [];

    // Create 6 month slots chronologically
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIdx = d.getMonth();
      const year = d.getFullYear();
      const yearShort = String(year).slice(-2);
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[monthIdx]}/${yearShort}`;

      result.push({
        monthKey,
        monthLabel,
        fullMonthName: fullMonthNames[monthIdx],
        year,
        receita: 0,
        assinantesCount: 0,
        isCurrentMonth: i === 0,
      });
    }

    // Accumulate real subscription revenue
    subscribers.forEach((sub) => {
      let value = sub.paidAmount && sub.paidAmount > 0 ? sub.paidAmount : 0;
      if (!value) {
        const plan = PLANS_LIST.find((p) => p.tierLabel === sub.planName || p.id === sub.planName);
        if (plan) value = plan.totalPrice;
      }

      if (sub.paymentHistory && sub.paymentHistory.length > 0) {
        sub.paymentHistory.forEach((inv) => {
          if (inv.status === 'PAID') {
            const dateStr = inv.paymentDate || inv.dueDate || '';
            if (isDateInRange(dateStr)) {
              const amount = inv.amount || value;
              addValue(dateStr, amount);
            }
          }
        });
      } else {
        const isPaid = sub.paymentStatus === 'PAID' || sub.status === 'ACTIVE';
        if (isPaid && value > 0) {
          const dateStr = sub.paymentDate || sub.startDate || '';
          if (isDateInRange(dateStr)) {
            addValue(dateStr, value);
          }
        }
      }
    });

    function addValue(dateStr: string, amount: number) {
      if (!dateStr) return;
      let yr: number | null = null;
      let mo: number | null = null;

      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          mo = Number(parts[1]);
          yr = Number(parts[2]);
        }
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          yr = Number(parts[0]);
          mo = Number(parts[1]);
        }
      }

      if (yr && mo) {
        const key = `${yr}-${String(mo).padStart(2, '0')}`;
        const item = result.find((m) => m.monthKey === key);
        if (item) {
          item.receita += amount;
          item.assinantesCount += 1;
        }
      }
    }

    // Ensure current month displays active subscriptions if no historical invoices exist yet
    const currentMonth = result[result.length - 1];
    if (currentMonth.receita === 0 && monthlyRecurringRevenue > 0 && isDateInRange(now.toISOString())) {
      currentMonth.receita = monthlyRecurringRevenue;
      currentMonth.assinantesCount = totalActiveCount;
    }

    return result;
  })();

  const total6MonthsRevenue = last6MonthsData.reduce((sum, item) => sum + item.receita, 0);
  const avgMonthlyRevenue = total6MonthsRevenue / 6;

  // 4. Filtered Appointments List (combining Date Range + Barber + Status + Search)
  const filteredAppointments = dateFilteredAppointments.filter((apt) => {
    const matchesFilter =
      appointmentFilter === 'ALL' ||
      (appointmentFilter === 'CONFIRMED' && (apt.status === 'CONFIRMED' || !apt.status)) ||
      apt.status === appointmentFilter;

    const matchesBarber =
      selectedBarberFilter === 'ALL' ||
      apt.barberId === selectedBarberFilter ||
      apt.barberName === selectedBarberFilter ||
      (apt.barberName && apt.barberName.toLowerCase().includes(selectedBarberFilter.toLowerCase()));

    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      apt.clientName.toLowerCase().includes(query) ||
      apt.clientPhone.includes(query) ||
      apt.barberName.toLowerCase().includes(query) ||
      apt.serviceName.toLowerCase().includes(query) ||
      (apt.cardCode && apt.cardCode.toLowerCase().includes(query));

    return matchesFilter && matchesBarber && matchesSearch;
  });

  // Sort upcoming appointments by date & time
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const dateA = `${a.date} ${a.time}`;
    const dateB = `${b.date} ${b.time}`;
    return dateA.localeCompare(dateB);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-[#FDFDFD]">
      {/* Top Banner & Title Section */}
      <div className="bg-gradient-to-br from-[#111111] via-[#1a2215] to-[#111111] rounded-2xl p-6 sm:p-8 border border-[#38472A]/60 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#6D7E5A]/15 to-[#38472A]/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#6D7E5A]/25 to-[#38472A]/40 border border-[#6D7E5A]/50 text-[#FDFDFD] text-xs font-bold uppercase tracking-wider shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6D7E5A]" />
                <span>Painel Central de Gestão Administrador</span>
              </div>
              {backendVerified === true && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Lock className="w-3 h-3" />
                  <span>Backend: Papel Admin Validado no Firestore</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#FDFDFD] tracking-tight">
              Visão Geral & Métricas D•B
            </h1>
            <p className="text-[#A4A9A5] text-sm max-w-2xl">
              Acompanhamento centralizado de faturamento mensal estimado, gestão de assinantes com Cartão de Membro e lista de próximos agendamentos em tempo real.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenBooking}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6D7E5A] to-[#38472A] hover:from-[#7b8e67] hover:to-[#435633] text-[#FDFDFD] font-extrabold text-xs uppercase tracking-wider transition shadow-lg border border-[#6D7E5A]/40 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </button>

            <button
              onClick={onOpenCheckin}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#111111] to-[#181d15] hover:from-[#181d15] hover:to-[#22281e] text-[#FDFDFD] border border-[#38472A]/50 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-[#6D7E5A]" />
              <span>Validar Cartão Membro</span>
            </button>

            <button
              onClick={onOpenRegister}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#111111] to-[#1d1b14] hover:from-[#1d1b14] hover:to-[#28241a] text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Cadastrar Membro</span>
            </button>
          </div>
        </div>

        {/* View Selector Tabs (Overview vs Calculator) */}
        <div className="mt-8 pt-6 border-t border-[#38472A]/40 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-xl border border-[#6D7E5A]/50'
                : 'bg-[#111111] text-[#A4A9A5] border border-[#38472A]/30 hover:text-[#FDFDFD] hover:border-[#6D7E5A]/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Métricas & Agendamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'calculator'
                ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-xl border border-[#6D7E5A]/50'
                : 'bg-[#111111] text-[#A4A9A5] border border-[#38472A]/30 hover:text-[#FDFDFD] hover:border-[#6D7E5A]/40'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Simulador & Calculadora Financeira</span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
              activeTab === 'backups'
                ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-xl border border-[#6D7E5A]/50'
                : 'bg-[#111111] text-[#A4A9A5] border border-[#38472A]/30 hover:text-[#FDFDFD] hover:border-[#6D7E5A]/40'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Cópias de Segurança (Backups JSON)</span>
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Seletor de Intervalo de Datas / Filtro por Período */}
          <div className="bg-gradient-to-br from-[#111111] via-[#161c13] to-[#111111] rounded-2xl border border-[#38472A]/50 p-5 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#38472A]/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#6D7E5A]/20 to-[#38472A]/30 border border-[#6D7E5A]/40 text-[#6D7E5A]">
                  <CalendarDays className="w-5 h-5 text-[#6D7E5A]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#FDFDFD] uppercase tracking-wider flex items-center gap-2">
                    <span>Filtrar Métrica por Período / Intervalo de Datas</span>
                    {activeDateLabel && (
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] font-extrabold text-[10px] uppercase font-mono shadow-sm">
                        Filtro Ativo
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#A4A9A5]">
                    Selecione um intervalo para filtrar receitas, métricas e lista de agendamentos.
                  </p>
                </div>
              </div>

              {(datePreset !== 'ALL' || customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setDatePreset('ALL');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Filtro de Data</span>
                </button>
              )}
            </div>

            {/* Quick Presets Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'ALL', label: 'Todos os Períodos' },
                { id: 'TODAY', label: 'Hoje' },
                { id: 'THIS_WEEK', label: 'Esta Semana' },
                { id: 'THIS_MONTH', label: 'Mês Atual' },
                { id: 'LAST_30_DAYS', label: 'Últimos 30 Dias' },
                { id: 'LAST_90_DAYS', label: 'Últimos 90 Dias' },
                { id: 'CUSTOM', label: 'Personalizado' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setDatePreset(preset.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
                    datePreset === preset.id
                      ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-lg border border-[#6D7E5A]/50 font-extrabold'
                      : 'bg-[#111111] text-[#A4A9A5] border border-[#38472A]/30 hover:text-[#FDFDFD]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            {datePreset === 'CUSTOM' && (
              <div className="pt-3 border-t border-[#38472A]/30 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#111111]/80 p-4 rounded-xl border border-[#38472A]/40">
                <div>
                  <label className="block text-[11px] font-bold text-[#A4A9A5] uppercase tracking-wider mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-[#111111] border border-[#38472A]/50 rounded-xl px-3 py-2 text-xs text-[#FDFDFD] focus:outline-none focus:border-[#6D7E5A] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#A4A9A5] uppercase tracking-wider mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-[#111111] border border-[#38472A]/50 rounded-xl px-3 py-2 text-xs text-[#FDFDFD] focus:outline-none focus:border-[#6D7E5A] font-mono"
                  />
                </div>
              </div>
            )}

            {/* Active Interval Description Badge */}
            {activeDateLabel && (
              <div className="bg-gradient-to-r from-[#111111] via-[#1a2215] to-[#111111] border border-[#6D7E5A]/40 rounded-xl px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#A4A9A5]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#6D7E5A] shrink-0" />
                  <span>
                    Intervalo Ativo: <strong className="text-[#FDFDFD] font-mono">{activeDateLabel}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#A4A9A5] font-mono">
                  <span>Agendamentos: <strong className="text-emerald-400">{dateFilteredAppointments.length}</strong></span>
                  <span>&bull;</span>
                  <span>Receita no Período: <strong className="text-[#FDFDFD]">R$ {totalEstimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Key KPI Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* KPI 1: Receita Mensal Estimada */}
            <div className="bg-gradient-to-br from-[#111111] via-[#172014] to-[#111111] p-6 rounded-2xl border border-[#6D7E5A]/40 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#A4A9A5] flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#6D7E5A]" />
                  Receita Mensal Estimada
                </span>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-md">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#FDFDFD] font-mono tracking-tight">
                  R$ {totalEstimatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-[#A4A9A5] mt-1">
                  {totalEstimatedRevenue > 0
                    ? 'Faturamento apurado das assinaturas ativas e atendimentos.'
                    : 'Aguardando novas assinaturas ou atendimentos.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#38472A]/30 grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#111111]/80 p-2.5 rounded-lg border border-[#38472A]/40">
                  <span className="text-[#A4A9A5] block text-[10px] uppercase font-semibold">Assinaturas</span>
                  <span className="text-[#FDFDFD] font-mono font-bold">R$ {monthlyRecurringRevenue.toFixed(2)}</span>
                </div>
                <div className="bg-[#111111]/80 p-2.5 rounded-lg border border-[#38472A]/40">
                  <span className="text-[#A4A9A5] block text-[10px] uppercase font-semibold">Cortes Avulsos</span>
                  <span className="text-amber-300 font-mono font-bold">R$ {estimatedAvulsoRevenue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Total de Assinantes Ativos */}
            <div className="bg-gradient-to-br from-[#111111] via-[#191e17] to-[#111111] p-6 rounded-2xl border border-[#38472A]/40 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#A4A9A5] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#A4A9A5]" />
                  Assinantes Ativos D•B
                </span>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#6D7E5A]/30 to-[#38472A]/50 border border-[#6D7E5A]/40 text-[#FDFDFD]">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#FDFDFD] font-mono tracking-tight">
                  {totalActiveCount} <span className="text-sm font-normal text-[#A4A9A5]">membros</span>
                </div>
                <p className="text-xs text-[#A4A9A5] mt-1">
                  {subscribers.length > 0
                    ? `${subscribers.length} assinante(s) cadastrado(s) no sistema`
                    : 'Nenhum assinante cadastrado no momento.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#38472A]/30 flex items-center justify-between">
                <span className="text-xs text-[#A4A9A5]">Status da Base</span>
                <div className="flex items-center gap-1.5">
                  {expiringSubscribersList.length > 0 && (
                    <span className="text-[10px] font-bold font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/50 animate-pulse">
                      ⚠️ {expiringSubscribersList.length} a vencer
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    totalActiveCount > 0
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-[#A4A9A5] bg-[#111111] border-[#38472A]/40'
                  }`}>
                    {subscribers.length > 0
                      ? `${Math.round((totalActiveCount / subscribers.length) * 100)}% Ativos`
                      : 'Base Zerada'}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Próximos Agendamentos */}
            <div className="bg-gradient-to-br from-[#111111] via-[#171c15] to-[#111111] p-6 rounded-2xl border border-[#38472A]/40 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#A4A9A5] flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-sky-400" />
                  Próximos Agendamentos
                </span>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#38472A] to-[#111111] border border-[#38472A]/60 text-[#A4A9A5]">
                  <Clock className="w-5 h-5 text-sky-400" />
                </div>
              </div>

              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#FDFDFD] font-mono tracking-tight">
                  {confirmedAppointments.length} <span className="text-sm font-normal text-[#A4A9A5]">confirmados</span>
                </div>
                <p className="text-xs text-[#A4A9A5] mt-1">
                  {completedAppointments.length} atendimentos concluídos
                </p>
              </div>

              <div className="pt-3 border-t border-[#38472A]/30 flex items-center justify-between">
                <span className="text-xs text-[#A4A9A5]">Barbeiros na Escala</span>
                <span className="text-xs font-bold text-[#FDFDFD] font-mono bg-[#111111] px-2.5 py-1 rounded-full border border-[#38472A]/40">
                  {BARBERS_LIST.length} Barbeiros
                </span>
              </div>
            </div>
          </div>

          {/* PAINEL DE ALERTA VISUAL: Assinaturas Próximas do Vencimento (< 3 Dias) */}
          {expiringSubscribersList.length > 0 ? (
            <div className="bg-gradient-to-br from-[#1c160c] via-[#261d0f] to-[#141009] rounded-2xl border-2 border-amber-500/60 p-6 shadow-2xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-500/30 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-extrabold text-[#FDFDFD] tracking-tight flex items-center gap-2">
                        <span>Alerta de Vencimento de Assinaturas</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-extrabold text-xs font-mono shadow">
                          {expiringSubscribersList.length} {expiringSubscribersList.length === 1 ? 'Alerta' : 'Alertas'}
                        </span>
                      </h2>
                    </div>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      Notificação para o Administrador: Assinaturas a menos de 3 dias do vencimento (calculado com base na data do último pagamento armazenada).
                    </p>
                  </div>
                </div>

                <div className="text-xs text-amber-300 font-mono font-bold bg-amber-950/90 border border-amber-500/50 px-3.5 py-1.5 rounded-xl self-start sm:self-auto shadow-sm flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ação: Lembrete via WhatsApp</span>
                </div>
              </div>

              {/* Cards Grid de Assinantes Próximos de Expirar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                {expiringSubscribersList.map(({ sub, expDetails }) => {
                  const { daysRemaining, formattedExpDate, isRecentlyExpired } = expDetails!;

                  let badgeStyle = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  let daysBadgeLabel = `Vence em ${daysRemaining} dias`;

                  if (daysRemaining === 0) {
                    badgeStyle = "bg-red-500/30 text-red-200 border-red-500/60 font-black";
                    daysBadgeLabel = "🚨 VENCE HOJE!";
                  } else if (daysRemaining === 1) {
                    badgeStyle = "bg-amber-500/30 text-amber-200 border-amber-500/60 font-bold";
                    daysBadgeLabel = "⚠️ Vence AMANHÃ (1d)";
                  } else if (isRecentlyExpired) {
                    badgeStyle = "bg-rose-950 text-rose-300 border-rose-500/60 font-bold";
                    daysBadgeLabel = `🔴 Expirou há ${Math.abs(daysRemaining)}d`;
                  }

                  const storedPaymentDate = sub.paymentDate || sub.startDate || 'Não registrada';

                  // Prepara texto legível para envio via WhatsApp
                  const whatsappMsg = encodeURIComponent(
                    `Olá, ${sub.clientName}! 💈\n\nSua assinatura do plano *${sub.planName}* na *Ded Black Barbershop* ${
                      daysRemaining === 0
                        ? 'vence *HOJE*'
                        : daysRemaining > 0
                        ? `vence em *${daysRemaining} dia(s)* (${formattedExpDate})`
                        : `venceu recentemente`
                    }.\n\nPara manter seus cortes e benefícios ativos no Cartão de Membro (*${sub.cardCode}*), acesse nosso aplicativo e confirme a renovação!\n\nUm abraço da equipe D•B! ✂️`
                  );

                  const cleanPhone = sub.phone ? sub.phone.replace(/\D/g, '') : '';
                  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${whatsappMsg}` : '#';

                  return (
                    <div
                      key={sub.id}
                      className="bg-[#121212]/90 border border-amber-500/40 hover:border-amber-500/80 rounded-xl p-4 space-y-3 shadow-xl relative flex flex-col justify-between transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1f1a12] text-amber-400 border border-amber-500/30">
                            {sub.cardCode}
                          </span>
                          <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                            {daysBadgeLabel}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-[#FDFDFD] text-sm tracking-tight">
                            {sub.clientName}
                          </h4>
                          <p className="text-xs text-amber-200/70 font-medium">{sub.planName}</p>
                        </div>

                        <div className="bg-[#181818] p-2.5 rounded-lg border border-white/5 space-y-1 text-[11px] font-mono">
                          <div className="flex justify-between text-stone-400">
                            <span>Último Pagamento:</span>
                            <span className="text-stone-200 font-bold">{storedPaymentDate}</span>
                          </div>
                          <div className="flex justify-between text-stone-400">
                            <span>Vencimento do Ciclo:</span>
                            <span className="text-amber-300 font-bold">{formattedExpDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-amber-500/20 flex items-center gap-2">
                        {cleanPhone ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-[11px] uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md"
                            title="Notificar cliente sobre a renovação pelo WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 fill-current" />
                            <span>Notificar via WhatsApp</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-stone-500 italic block text-center w-full">Telefone não informado</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#111111] rounded-2xl border border-[#38472A]/40 p-4 shadow-md flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#FDFDFD] uppercase tracking-wider">
                    Status das Assinaturas em Dia
                  </h4>
                  <p className="text-[11px] text-[#A4A9A5]">
                    Nenhuma assinatura a menos de 3 dias de expirar no momento.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-extrabold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40 uppercase">
                100% Em Dia
              </span>
            </div>
          )}

          {/* Recharts Bar Chart: Receita Mensal dos Últimos 6 Meses */}
          <div className="bg-gradient-to-br from-[#111111] via-[#161c13] to-[#111111] rounded-2xl border border-[#38472A]/50 p-6 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#38472A]/30">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-gradient-to-r from-[#6D7E5A]/20 to-[#38472A]/40 border border-[#6D7E5A]/40 text-[#FDFDFD] text-[10px] font-bold uppercase tracking-wider">
                  <BarChart3 className="w-3.5 h-3.5 text-[#6D7E5A]" />
                  <span>Histórico & Projeção Financeira</span>
                </div>
                <h2 className="text-xl font-extrabold text-[#FDFDFD] flex items-center gap-2 tracking-tight">
                  <span>Receita Mensal de Assinaturas (Últimos 6 Meses)</span>
                </h2>
                <p className="text-xs text-[#A4A9A5]">
                  Faturamento acumulado de assinaturas pagas mês a mês com projeção baseada nos planos ativos.
                </p>
              </div>

              {/* Summary Stats Badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-[#111111] border border-[#38472A]/40 rounded-xl px-3.5 py-2 shadow-inner">
                  <span className="text-[10px] text-[#A4A9A5] uppercase font-semibold block">Total 6 Meses</span>
                  <span className="text-sm font-extrabold text-[#FDFDFD] font-mono">
                    R$ {total6MonthsRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-[#111111] border border-[#38472A]/40 rounded-xl px-3.5 py-2 shadow-inner">
                  <span className="text-[10px] text-[#A4A9A5] uppercase font-semibold block">Média Mensal</span>
                  <span className="text-sm font-extrabold text-[#6D7E5A] font-mono">
                    R$ {avgMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Recharts BarChart Container */}
            <div className="w-full h-72 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last6MonthsData}
                  margin={{ top: 20, right: 15, left: 10, bottom: 5 }}
                >
                  <defs>
                    {/* Smooth Gradient for Regular Months (Olive Sage -> Deep Forest) */}
                    <linearGradient id="barGradRegular" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6D7E5A" stopOpacity={1} />
                      <stop offset="100%" stopColor="#38472A" stopOpacity={0.9} />
                    </linearGradient>
                    {/* Smooth Gradient for Current Month (Silver highlight -> Olive Sage) */}
                    <linearGradient id="barGradCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FDFDFD" stopOpacity={1} />
                      <stop offset="40%" stopColor="#A4A9A5" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#6D7E5A" stopOpacity={1} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#38472A" strokeOpacity={0.35} vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    stroke="#A4A9A5"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#38472A', strokeOpacity: 0.5 }}
                  />
                  <YAxis
                    stroke="#A4A9A5"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#38472A', strokeOpacity: 0.5 }}
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(109, 126, 90, 0.12)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-gradient-to-br from-[#111111] via-[#1a2215] to-[#111111] border border-[#6D7E5A]/60 p-3.5 rounded-xl shadow-2xl text-xs space-y-1.5 font-sans">
                            <div className="font-bold text-[#FDFDFD] border-b border-[#38472A]/50 pb-1.5 flex items-center justify-between gap-4">
                              <span>{data.fullMonthName} {data.year}</span>
                              {data.isCurrentMonth && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] font-extrabold shadow-sm">
                                  MÊS ATUAL
                                </span>
                              )}
                            </div>
                            <div className="text-[#FDFDFD] font-mono font-extrabold text-sm pt-0.5">
                              R$ {data.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[#A4A9A5] text-[11px]">
                              ● Assinaturas pagas: <strong className="text-[#FDFDFD] font-mono">{data.assinantesCount}</strong>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                    {last6MonthsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isCurrentMonth ? 'url(#barGradCurrent)' : 'url(#barGradRegular)'}
                        className="hover:opacity-100 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subscribers Dynamic Status List */}
          <div className="bg-[#121212] rounded-2xl border border-white/10 p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>Base de Assinantes & Badges de Status</span>
                </h2>
                <p className="text-xs text-stone-400">
                  Status dinâmicos calculados automaticamente com base na data e confirmação do pagamento.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50">
                  ● Ativos: {subscribers.filter((s) => s.paymentStatus === 'PAID' || s.status === 'ACTIVE').length}
                </span>
                <span className="px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-500/50">
                  ● Pendentes: {subscribers.filter((s) => s.paymentStatus === 'PENDING' || s.status === 'PAYMENT_PENDING').length}
                </span>
                <span className="px-2.5 py-1 rounded bg-rose-950/80 text-rose-300 border border-rose-500/50">
                  ● Expirados: {subscribers.filter((s) => s.status === 'EXPIRED').length}
                </span>
              </div>
            </div>

            {subscribers.length === 0 ? (
              <div className="text-center py-8 bg-[#181818] rounded-xl border border-white/5 space-y-2">
                <Users className="w-8 h-8 text-stone-600 mx-auto" />
                <p className="text-stone-400 text-xs font-semibold">
                  Nenhum assinante cadastrado na base de dados no momento.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-[#181818] text-stone-400 font-bold uppercase text-[10px] tracking-wider border-b border-white/5">
                    <tr>
                      <th className="py-3 px-4">Carteirinha / Cliente</th>
                      <th className="py-3 px-4">Plano Contratado</th>
                      <th className="py-3 px-4">Data Pagamento</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4 text-center">Status Dinâmico</th>
                      <th className="py-3 px-4 text-right">Atendimentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subscribers.slice(0, 8).map((sub) => {
                      const remaining = sub.totalSessions - sub.usedSessions;
                      return (
                        <tr key={sub.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181818] text-[#556b2f] border border-[#556b2f]/30">
                                {sub.cardCode}
                              </span>
                              <span>{sub.clientName}</span>
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono font-normal mt-0.5">{sub.phone}</div>
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-200 whitespace-nowrap">
                            <div>{sub.planName}</div>
                            {sub.cardLast4 ? (
                              <div className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                                <CreditCard className="w-2.5 h-2.5" />
                                <span>{sub.cardBrand || 'VISA'} •••• {sub.cardLast4} (Stripe)</span>
                              </div>
                            ) : (
                              <div className="text-[9px] font-mono text-stone-500 mt-0.5">Cobrança Avulsa / PIX</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-stone-300 whitespace-nowrap">
                            {sub.paymentDate || sub.startDate || 'Não Registrada'}
                          </td>
                          <td className="py-3 px-4 font-mono text-stone-300 whitespace-nowrap">
                            {sub.expirationDate || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <SubscriberStatusBadge subscriber={sub} showDaysDetail size="md" />
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                            <span className={remaining > 0 ? 'text-[#556b2f]' : 'text-rose-400'}>
                              {sub.usedSessions} / {sub.totalSessions} ATD
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Real-time Appointments Section */}
          <div className="bg-gradient-to-br from-[#111111] via-[#161c13] to-[#111111] rounded-2xl border border-[#38472A]/50 p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#FDFDFD] flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-[#6D7E5A]" />
                  <span>Próximos Agendamentos em Tempo Real</span>
                </h2>
                <p className="text-xs text-[#A4A9A5]">
                  Gerencie a fila de horários marcados, confirmações e contatos de clientes.
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {(['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAppointmentFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                      appointmentFilter === st
                        ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-md border border-[#6D7E5A]/50 font-extrabold'
                        : 'bg-[#111111] text-[#A4A9A5] border border-[#38472A]/30 hover:text-[#FDFDFD]'
                    }`}
                  >
                    {st === 'ALL' && 'Todos'}
                    {st === 'CONFIRMED' && 'Confirmados'}
                    {st === 'COMPLETED' && 'Concluídos'}
                    {st === 'CANCELLED' && 'Cancelados'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Controls: Barber Filter Bar & Status Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#111111]/80 p-3 rounded-xl border border-[#38472A]/40">
              {/* Barber Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#A4A9A5] flex items-center gap-1.5 whitespace-nowrap">
                  <Scissors className="w-3.5 h-3.5 text-[#6D7E5A]" />
                  <span>Barbeiro:</span>
                </span>
                <select
                  value={selectedBarberFilter}
                  onChange={(e) => setSelectedBarberFilter(e.target.value)}
                  className="bg-[#111111] border border-[#38472A]/50 rounded-lg px-3 py-1.5 text-xs text-[#FDFDFD] font-bold focus:outline-none focus:border-[#6D7E5A] transition cursor-pointer"
                >
                  <option value="ALL">💈 Todos os Barbeiros ({appointments.length})</option>
                  {BARBERS_LIST.map((b) => {
                    const barberCount = appointments.filter(
                      (a) =>
                        a.barberId === b.id ||
                        a.barberName === b.name ||
                        (a.barberName && a.barberName.toLowerCase().includes(b.name.toLowerCase()))
                    ).length;
                    return (
                      <option key={b.id} value={b.name}>
                        {b.avatar} {b.name} ({barberCount} agendamento{barberCount !== 1 ? 's' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Barber Quick Pills / Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                <button
                  onClick={() => setSelectedBarberFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition whitespace-nowrap ${
                    selectedBarberFilter === 'ALL'
                      ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-sm font-extrabold'
                      : 'bg-[#111111] text-[#A4A9A5] hover:text-[#FDFDFD] border border-[#38472A]/30'
                  }`}
                >
                  Todos
                </button>
                {BARBERS_LIST.map((b) => {
                  const isSelected =
                    selectedBarberFilter === b.name ||
                    selectedBarberFilter === b.id ||
                    (selectedBarberFilter !== 'ALL' && b.name.toLowerCase().includes(selectedBarberFilter.toLowerCase()));
                  const count = appointments.filter(
                    (a) =>
                      a.barberId === b.id ||
                      a.barberName === b.name ||
                      (a.barberName && a.barberName.toLowerCase().includes(b.name.toLowerCase()))
                  ).length;

                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBarberFilter(isSelected ? 'ALL' : b.name)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 whitespace-nowrap ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#6D7E5A] to-[#38472A] text-[#FDFDFD] shadow-sm font-extrabold'
                          : 'bg-[#111111] text-[#A4A9A5] hover:text-[#FDFDFD] border border-[#38472A]/30'
                      }`}
                      title={`Filtrar agendamentos de ${b.name}`}
                    >
                      <span>{b.avatar}</span>
                      <span>{b.name.split(' ')[0]}</span>
                      <span className={`text-[9px] px-1 rounded-full ${isSelected ? 'bg-black/40 text-[#FDFDFD]' : 'bg-white/10 text-[#A4A9A5]'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#A4A9A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, telefone, barbeiro ou serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111111] border border-[#38472A]/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#FDFDFD] placeholder-[#A4A9A5]/60 focus:outline-none focus:border-[#6D7E5A] transition"
              />
            </div>

            {/* Appointments Table / Cards */}
            {sortedAppointments.length === 0 ? (
              <div className="text-center py-12 bg-[#111111]/80 rounded-xl border border-[#38472A]/40 space-y-3">
                <CalendarCheck className="w-10 h-10 text-[#6D7E5A]/50 mx-auto" />
                <p className="text-[#A4A9A5] text-xs font-semibold">
                  Nenhum agendamento encontrado para o filtro selecionado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#A4A9A5]">
                  <thead className="bg-[#111111] text-[#A4A9A5] font-bold uppercase text-[10px] tracking-wider border-b border-[#38472A]/40">
                    <tr>
                      <th className="py-3 px-4">Data & Horário</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Serviço</th>
                      <th className="py-3 px-4">Barbeiro</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#38472A]/30">
                    {sortedAppointments.map((apt) => {
                      const isConfirmed = apt.status === 'CONFIRMED' || !apt.status;
                      const isCompleted = apt.status === 'COMPLETED';
                      const isCancelled = apt.status === 'CANCELLED';

                      return (
                        <tr key={apt.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#FDFDFD] whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-[#6D7E5A]" />
                              <span>{apt.date} às {apt.time}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#FDFDFD] whitespace-nowrap">
                            <div>{apt.clientName}</div>
                            <div className="text-[10px] text-[#A4A9A5] font-mono font-normal">{apt.clientPhone}</div>
                          </td>
                          <td className="py-3.5 px-4 text-[#A4A9A5] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111111] text-[#FDFDFD] border border-[#38472A]/40">
                              <Scissors className="w-3 h-3 text-[#6D7E5A]" />
                              {apt.serviceName}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-300 font-medium whitespace-nowrap">
                            {apt.barberName}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isConfirmed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Confirmado
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3" /> Concluído
                              </span>
                            )}
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                                <XCircle className="w-3 h-3" /> Cancelado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`https://wa.me/55${apt.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                  `Olá ${apt.clientName}, confirmando seu agendamento na Ded Black Barbershop para ${apt.date} às ${apt.time} com o barbeiro ${apt.barberName}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition"
                                title="Enviar mensagem no WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              {onDeleteAppointment && (
                                <button
                                  onClick={() => onDeleteAppointment(apt.id)}
                                  className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition"
                                  title="Remover agendamento"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Barbers Team Capacity Grid */}
          <div className="bg-[#121212] rounded-2xl border border-white/10 p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#556b2f]" />
              <span>Escala e Desempenho dos Barbeiros</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BARBERS_LIST.map((barber) => {
                const barberApts = appointments.filter(
                  (a) => a.barberName.toLowerCase() === barber.name.toLowerCase() || a.barberId === barber.id
                );
                return (
                  <div
                    key={barber.id}
                    className="p-4 rounded-xl bg-[#181818] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#222] border border-white/10 flex items-center justify-center text-lg">
                        {barber.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">{barber.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">★ {barber.rating}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-amber-400 font-mono">
                        {barberApts.length}
                      </div>
                      <div className="text-[9px] text-stone-500 uppercase font-semibold">Agendamentos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : activeTab === 'backups' ? (
        /* Backup & Data Export View */
        <div className="bg-[#121212] rounded-2xl border border-[#556b2f]/30 p-6 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#556b2f]/20 border border-[#556b2f]/40 text-[#556b2f]">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Cópia de Segurança Periódica (Backup JSON fora do Firestore)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono uppercase font-bold">
                    Rotina Ativa no Backend
                  </span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  O servidor executa uma rotina em segundo plano exportando todos os dados de assinantes e agendamentos para arquivos JSON locais no servidor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={triggerManualBackup}
                disabled={backupLoading}
                className="px-4 py-2.5 rounded-xl bg-[#556b2f] hover:bg-[#68823a] text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${backupLoading ? 'animate-spin' : ''}`} />
                <span>{backupLoading ? 'Gerando Backup...' : 'Gerar Backup Agora'}</span>
              </button>

              <button
                onClick={() => downloadBackupJson()}
                className="px-4 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-amber-400 border border-amber-500/30 font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Último JSON</span>
              </button>
            </div>
          </div>

          {/* Message Banner */}
          {backupMsg && (
            <div className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
              backupMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {backupMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />}
                <span>{backupMsg.text}</span>
              </div>
              <button onClick={() => setBackupMsg(null)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Backup KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 space-y-1">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center justify-between">
                <span>Último Backup do Backend</span>
                <Clock className="w-3.5 h-3.5 text-[#556b2f]" />
              </div>
              <div className="text-sm font-extrabold text-white font-mono pt-1">
                {backupStatus?.generatedAtFormatted || (backupStatus?.exists ? 'Salvo recentemente' : 'Aguardando primeiro ciclo')}
              </div>
              <div className="text-[10px] text-stone-500">
                Rotina periódica executada a cada 1h no backend
              </div>
            </div>

            <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 space-y-1">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center justify-between">
                <span>Assinantes no Backup</span>
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono pt-1">
                {backupStatus?.counts?.subscribers ?? subscribers.length} registros
              </div>
              <div className="text-[10px] text-stone-500">
                Cartões e assinaturas ativas/inativas protegidas
              </div>
            </div>

            <div className="bg-[#181818] p-5 rounded-2xl border border-white/5 space-y-1">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center justify-between">
                <span>Agendamentos no Backup</span>
                <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-extrabold text-amber-400 font-mono pt-1">
                {backupStatus?.counts?.appointments ?? appointments.length} agendamentos
              </div>
              <div className="text-[10px] text-stone-500">
                Histórico de cortes e horários preservados
              </div>
            </div>
          </div>

          {/* Backup File Explorer Table */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[#556b2f]" />
              <span>Arquivos de Cópia em JSON Disponíveis no Servidor</span>
            </h4>

            <div className="bg-[#181818] rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3">
                  <FileJson className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white font-mono">latest-backup.json</div>
                    <div className="text-[10px] text-stone-400">Cópia acumulada mais recente exportada do Firestore</div>
                  </div>
                </div>
                <button
                  onClick={() => downloadBackupJson('latest-backup.json')}
                  className="px-3 py-1.5 rounded-lg bg-[#556b2f]/20 hover:bg-[#556b2f]/40 text-[#556b2f] border border-[#556b2f]/40 font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar JSON</span>
                </button>
              </div>

              {backupStatus?.availableFiles?.map((fname: string) => (
                <div key={fname} className="p-4 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <FileJson className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-stone-200 font-mono">{fname}</div>
                      <div className="text-[10px] text-stone-500">Arquivo histórico de backup do servidor</div>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadBackupJson(fname)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Integrated Financial Calculator View */
        <FinancialCalculator />
      )}
    </div>
  );
};
