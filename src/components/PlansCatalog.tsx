import React, { useState } from 'react';
import { SERVICES_LIST, PLANS_LIST } from '../data/barberData';
import { PlanOption, SubscriberCard } from '../types';
import { PaymentModal } from './PaymentModal';
import { playPaymentAlert } from '../utils/soundAlert';
import {
  CheckCircle2,
  Scissors,
  Sparkles,
  Zap,
  Award,
  Users,
  CreditCard,
  ShieldCheck,
  TrendingDown,
  Info,
  X,
  Calendar,
  Clock,
  AlertTriangle,
  Lock
} from 'lucide-react';

interface PlansCatalogProps {
  onAddSubscriber: (sub: SubscriberCard) => void;
  onOpenCheckin: () => void;
  onOpenBooking?: () => void;
}

export const PlansCatalog: React.FC<PlansCatalogProps> = ({ onAddSubscriber, onOpenCheckin, onOpenBooking }) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');

  // ROI Simulator State
  const [simServiceId, setSimServiceId] = useState<string>('disfarce-tesoura-maquina');
  const [simVisitsCount, setSimVisitsCount] = useState<number>(4);

  // Subscription Modal State
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState<boolean>(false);
  const [selectedPlanForSub, setSelectedPlanForSub] = useState<PlanOption | null>(null);
  const [clientNameInput, setClientNameInput] = useState<string>('');
  const [clientCpfInput, setClientCpfInput] = useState<string>('');
  const [clientPhoneInput, setClientPhoneInput] = useState<string>('');
  const [createdSubSuccess, setCreatedSubSuccess] = useState<SubscriberCard | null>(null);

  // Payment Integration State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Filter plans
  const filteredPlans = PLANS_LIST.filter((p) => {
    const matchesService =
      selectedServiceId === 'all' ||
      p.serviceId === selectedServiceId ||
      (selectedServiceId === 'flex' && p.tier === 'flex_premium');

    const matchesTier =
      selectedTierFilter === 'all' || p.tier === selectedTierFilter;

    return matchesService && matchesTier;
  });

  // Calculate ROI
  const simService = SERVICES_LIST.find((s) => s.id === simServiceId) || SERVICES_LIST[2];
  const totalAvulsoCost = simService.avulsoPrice * simVisitsCount;

  // Find best plan for simulation
  const matchingPlan = PLANS_LIST.find(
    (p) => p.serviceId === simServiceId && p.numAtendimentos >= simVisitsCount
  ) || PLANS_LIST.find((p) => p.serviceId === simServiceId) || PLANS_LIST[0];

  const planMonthlyPrice = matchingPlan ? matchingPlan.totalPrice : totalAvulsoCost * 0.8;
  const monthlySavings = Math.max(0, totalAvulsoCost - planMonthlyPrice);
  const annualSavings = monthlySavings * 12;

  const handleOpenSubscribeModal = (plan: PlanOption) => {
    setSelectedPlanForSub(plan);
    setCreatedSubSuccess(null);
    setClientNameInput('');
    setClientCpfInput('');
    setClientPhoneInput('');
    setIsSubscribeModalOpen(true);
  };

  const handleStartPaymentStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForSub || !clientNameInput.trim()) return;
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (paymentData: {
    paidAmount: number;
    paymentMethod: 'PIX' | 'CREDIT_CARD';
    transactionId: string;
    paymentDate: string;
  }) => {
    if (!selectedPlanForSub) return;

    const randomId = Math.floor(1000 + Math.random() * 9000);
    const newCardCode = `DB-${randomId}`;

    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const expDateObj = new Date();
    expDateObj.setDate(expDateObj.getDate() + 30);
    const expirationDate = expDateObj.toISOString().split('T')[0];

    const newSub: SubscriberCard = {
      id: `sub-${Date.now()}`,
      cardCode: newCardCode,
      clientName: clientNameInput.trim(),
      cpf: clientCpfInput.trim() || '000.000.000-00',
      phone: clientPhoneInput.trim() || '(21) 90000-0000',
      planName: selectedPlanForSub.tierLabel,
      serviceName: selectedPlanForSub.serviceName,
      totalSessions: selectedPlanForSub.numAtendimentos,
      usedSessions: 0,
      startDate,
      expirationDate,
      status: 'ACTIVE',
      qrCodeValue: `${newCardCode}-${clientNameInput.toUpperCase().replace(/\s+/g, '-')}`,
      notes: `Plano quitado e ativado. Transação: ${paymentData.transactionId}`,
      paymentStatus: 'PAID',
      paidAmount: paymentData.paidAmount,
      expectedAmount: selectedPlanForSub.totalPrice,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentDate,
      transactionId: paymentData.transactionId,
    };

    onAddSubscriber(newSub);
    playPaymentAlert();
    setCreatedSubSuccess(newSub);
  };

  return (
    <div className="bg-[#0c0c0c] pb-16 min-h-screen text-[#e0e0e0]">
      {/* Hero Header */}
      <section className="bg-[#0f0f0f] py-12 border-b border-[#556b2f]/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#556b2f]/20 text-[#556b2f] text-[10px] font-bold uppercase tracking-[0.3em] mb-4 border border-[#556b2f]/40">
              <Award className="w-3.5 h-3.5 text-[#556b2f]" />
              Clube de Assinaturas Ded Black
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif italic text-white leading-tight">
              Planos de <span className="text-[#556b2f]">Membro</span>
            </h2>
            <p className="mt-4 text-stone-300 text-xs sm:text-sm leading-relaxed opacity-80 font-sans">
              Escolha o plano ideal para a sua rotina. Economize até 40% em relação aos serviços avulsos, garanta prioridade e controle total pelo seu Cartão de Membro.
            </p>
          </div>

          {/* Service Cards Filter */}
          <div className="mt-8 pt-6 border-t border-[#556b2f]/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[0.25em] text-[#556b2f] font-bold flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-[#556b2f]" />
                Filtrar por Serviço Desejado:
              </label>
              <span className="text-[10px] text-stone-500 font-mono sm:hidden">
                (Toque para selecionar)
              </span>
            </div>

            {/* Mobile Select Dropdown for narrow screens (< sm) */}
            <div className="block sm:hidden">
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-[#151515] text-white text-xs font-bold rounded-lg px-3.5 py-3 border border-[#556b2f]/50 focus:outline-none focus:border-[#556b2f] shadow-lg"
              >
                <option value="all">✂️ Todos os Serviços</option>
                {SERVICES_LIST.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} (R$ {srv.avulsoPrice.toFixed(2)} avulso)
                  </option>
                ))}
                <option value="flex">⚫ FLEX PREMIUM (Livre Escolha)</option>
              </select>
            </div>

            {/* Desktop & Tablet Horizontal Flex-Wrap Pill Bar */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setSelectedServiceId('all')}
                className={`px-3.5 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition border ${
                  selectedServiceId === 'all'
                    ? 'bg-[#556b2f] text-black border-[#556b2f] shadow-md font-black'
                    : 'bg-[#151515] text-stone-300 border-[#556b2f]/30 hover:text-white hover:bg-[#202020]'
                }`}
              >
                ✂️ Todos os Serviços
              </button>

              {SERVICES_LIST.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => setSelectedServiceId(srv.id)}
                  className={`px-3.5 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition border flex items-center gap-1.5 ${
                    selectedServiceId === srv.id
                      ? 'bg-[#556b2f] text-black border-[#556b2f] shadow-md font-black'
                      : 'bg-[#151515] text-stone-300 border-[#556b2f]/30 hover:text-white hover:bg-[#202020]'
                  }`}
                >
                  <span>{srv.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                    selectedServiceId === srv.id ? 'bg-black/20 text-black font-extrabold' : 'bg-[#556b2f]/20 text-[#556b2f] font-bold'
                  }`}>
                    R$ {srv.avulsoPrice.toFixed(2)}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setSelectedServiceId('flex')}
                className={`px-3.5 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition border ${
                  selectedServiceId === 'flex'
                    ? 'bg-amber-400 text-black border-amber-300 shadow-lg font-black'
                    : 'bg-[#151515] text-amber-400 border-amber-500/30 hover:bg-[#202020]'
                }`}
              >
                ⚫ FLEX PREMIUM (Livre Escolha)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Appointment Booking Banner & Rules Box */}
      {onOpenBooking && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-gradient-to-r from-[#141414] via-[#1a1c14] to-[#141414] rounded-lg p-6 border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest border border-amber-500/30">
                <Calendar className="w-3.5 h-3.5" />
                Agendamento Online com Escolha de Barbeiro
              </span>
              <h3 className="text-xl font-serif italic text-white">
                Garanta seu Horário sem Filas de Espera
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Escolha o seu barbeiro de preferência e confira a disponibilidade de horários. Lembrando que cumprimos rigorosamente as regras de 
                <strong className="text-amber-400"> 10 minutos de tolerância de atraso </strong> e 
                <strong className="text-amber-400"> cancelamento sem custo com 2 horas de antecedência</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={onOpenBooking}
                className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-xs tracking-wider transition shadow-xl flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Agendar Atendimento Agora
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Client ROI Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#111111] rounded-lg p-6 sm:p-8 border border-[#556b2f]/30 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#556b2f] uppercase tracking-[0.25em] mb-2">
                <TrendingDown className="w-4 h-4" />
                Simulador de Economia para Clientes
              </span>
              <h3 className="text-xl sm:text-2xl font-serif italic text-white">
                Quanto você economiza sendo Membro Ded Black?
              </h3>
              <p className="text-xs text-stone-300 mt-1 opacity-80">
                Ajuste sua frequência mensal e compare o custo Avulso com o valor do Plano de Assinatura.
              </p>

              {/* Selector Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1.5">
                    Serviço de preferência:
                  </label>
                  <select
                    value={simServiceId}
                    onChange={(e) => setSimServiceId(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-stone-100 text-xs font-semibold rounded px-3 py-2.5 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
                  >
                    {SERVICES_LIST.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} (R$ {srv.avulsoPrice} avulso)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1.5">
                    Visitas por mês: <span className="text-[#556b2f] font-bold">{simVisitsCount} atendimentos</span>
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={simVisitsCount}
                    onChange={(e) => setSimVisitsCount(Number(e.target.value))}
                    className="w-full accent-[#556b2f] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1 uppercase tracking-wider">
                    <span>2 (Quinzenal)</span>
                    <span>4 (Semanal)</span>
                    <span>10 (Frequente)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Display Box */}
            <div className="w-full lg:w-auto bg-[#0a0a0a] rounded-lg p-5 border border-[#556b2f]/40 flex flex-col sm:flex-row lg:flex-col items-center justify-between gap-4 min-w-[280px]">
              <div className="text-center sm:text-left lg:text-center w-full">
                <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-bold">Custo Avulso vs. Plano Ded Black</span>
                <div className="flex items-baseline justify-center sm:justify-start lg:justify-center gap-2 mt-1">
                  <span className="line-through text-stone-500 text-xs">R$ {totalAvulsoCost.toFixed(2)}</span>
                  <span className="text-2xl font-serif text-[#556b2f] font-bold">
                    R$ {planMonthlyPrice.toFixed(2)}
                  </span>
                  <span className="text-xs text-stone-400 italic">/mês</span>
                </div>
              </div>

              <div className="bg-[#556b2f]/10 px-4 py-2.5 rounded text-center w-full border border-[#556b2f]/30">
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#556b2f] block">Sua Economia Estimada</span>
                <span className="text-lg font-serif italic font-bold text-white">
                  R$ {monthlySavings.toFixed(2)} <span className="text-xs font-normal text-stone-300">/mês</span>
                </span>
                <p className="text-[10px] text-[#556b2f] font-bold mt-0.5 uppercase tracking-wider">
                  Economia anual de ~R$ {annualSavings.toFixed(2)}!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Standalone Services Price Table */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#111111] rounded-lg p-6 sm:p-8 border border-[#556b2f]/30 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#556b2f] uppercase tracking-[0.25em] mb-1">
                <Scissors className="w-3.5 h-3.5" />
                Tabela Oficial de Preços Avulsos
              </span>
              <h3 className="text-xl sm:text-2xl font-serif italic text-white">
                Serviços <span className="text-[#556b2f]">Avulsos</span> (Atendimentos Avulsos)
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Valores para atendimentos individuais sem adesão aos planos de membros recorrentes.
              </p>
            </div>

            <div className="bg-[#556b2f]/10 border border-[#556b2f]/30 px-3.5 py-2 rounded text-right">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 block font-bold">Dica Ded Black</span>
              <span className="text-xs text-[#556b2f] font-bold">Membros economizam até 40% por visita!</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES_LIST.map((srv) => {
              const isSelected = selectedServiceId === srv.id;
              const isSoTesoura = srv.id === 'so-tesoura';

              return (
                <div
                  key={srv.id}
                  onClick={() => setSelectedServiceId(srv.id)}
                  className={`p-5 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col justify-between relative ${
                    isSoTesoura
                      ? 'bg-gradient-to-br from-[#1a1c14] to-[#121212] border-amber-500/50 shadow-lg hover:border-amber-400'
                      : isSelected
                      ? 'bg-[#1a1a1a] border-[#556b2f] shadow-lg ring-1 ring-[#556b2f]'
                      : 'bg-[#0a0a0a] border-white/10 hover:border-[#556b2f]/40 hover:bg-[#141414]'
                  }`}
                >
                  {isSoTesoura && (
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded bg-amber-500 text-black font-black text-[9px] uppercase tracking-widest shadow">
                      ⭐ 100% Tesoura
                    </span>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-[#556b2f] shrink-0" />
                        {srv.name}
                      </h4>
                    </div>
                    <p className="text-xs text-stone-400 leading-relaxed mb-4">
                      {srv.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">Valor Avulso:</span>
                    <div className="text-right">
                      <span className={`text-xl font-serif font-bold ${isSoTesoura ? 'text-amber-400' : 'text-[#556b2f]'}`}>
                        R$ {srv.avulsoPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-stone-500 block font-mono">/ atendimento</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-serif italic text-white">
              Catálogo de <span className="text-[#556b2f]">Planos</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5 uppercase tracking-wider">
              Exibindo {filteredPlans.length} opções disponíveis
            </p>
          </div>

          {/* Tier Selector Filter */}
          <div className="flex items-center gap-1 bg-[#151515] p-1.5 rounded-xl border border-[#556b2f]/30 text-xs overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setSelectedTierFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${
                selectedTierFilter === 'all'
                  ? 'bg-[#556b2f] text-black shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Todos Tiers
            </button>
            <button
              onClick={() => setSelectedTierFilter('basic')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${
                selectedTierFilter === 'basic'
                  ? 'bg-[#556b2f] text-black shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              BASIC 🟢
            </button>
            <button
              onClick={() => setSelectedTierFilter('plus')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${
                selectedTierFilter === 'plus'
                  ? 'bg-blue-700 text-white shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              PLUS 🔵
            </button>
            <button
              onClick={() => setSelectedTierFilter('select')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${
                selectedTierFilter === 'select'
                  ? 'bg-amber-500 text-black shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              SELECT ⭐
            </button>
            <button
              onClick={() => setSelectedTierFilter('family')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition whitespace-nowrap ${
                selectedTierFilter === 'family'
                  ? 'bg-white text-black shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              FAMILY 👨‍👩‍👧‍👦
            </button>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const isFlex = plan.tier === 'flex_premium';
            const isSelect = plan.tier === 'select';
            const isFamily = plan.tier === 'family';

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 sm:p-7 transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.02] flex flex-col justify-between relative border cursor-pointer group shadow-xl hover:shadow-2xl hover:shadow-[#556b2f]/40 backdrop-blur-sm hover:backdrop-blur-md ${
                  isFlex
                    ? 'bg-[#2b3818]/95 border-[#556b2f] hover:bg-[#384820]/80 hover:border-white/50 shadow-2xl ring-1 ring-[#556b2f]/50'
                    : isSelect
                    ? 'bg-[#2b3818]/95 border-amber-500/50 hover:bg-[#384820]/80 hover:border-amber-300'
                    : isFamily
                    ? 'bg-[#2b3818]/95 border-white/30 hover:bg-[#384820]/80 hover:border-white/60'
                    : 'bg-[#2b3818]/95 border-[#556b2f]/40 hover:bg-[#384820]/80 hover:border-white/50'
                }`}
              >
                {/* Highlight Badge */}
                {plan.badgeTag && (
                  <div className="mb-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md border ${
                        isFlex
                          ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                          : isSelect
                          ? 'bg-amber-500 text-black border-amber-300'
                          : isFamily
                          ? 'bg-white text-black border-white'
                          : 'bg-white/20 text-white border-white/30'
                      }`}
                    >
                      {plan.badgeTag}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-2xl font-serif font-extrabold text-white uppercase tracking-widest drop-shadow-sm">
                        {plan.tierLabel}
                      </h4>
                      <p className="text-xs text-lime-300 font-bold uppercase tracking-wider mt-0.5">
                        {plan.serviceName}
                      </p>
                    </div>

                    {isFlex ? (
                      <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />
                    ) : isFamily ? (
                      <Users className="w-6 h-6 text-white" />
                    ) : (
                      <Scissors className="w-5 h-5 text-lime-300" />
                    )}
                  </div>

                  {/* Price Block */}
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-[10px] text-stone-300 uppercase tracking-widest font-semibold">A partir de</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-serif font-extrabold text-white">
                        R$ {plan.totalPrice.toFixed(2)}
                      </span>
                      <span className="text-xs text-stone-300 italic font-serif">/mês</span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                      <span className="bg-black/40 text-stone-100 px-3 py-1 rounded-full text-[10px] font-mono border border-white/15">
                        {plan.numAtendimentos} ATD
                      </span>
                      <span className="text-lime-300 font-extrabold text-[11px]">
                        R$ {plan.pricePerAtd.toFixed(2)} / corte
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="mt-5 space-y-2.5 text-xs text-stone-100 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                      <span>{plan.numAtendimentos} atendimentos no ciclo de 30 dias</span>
                    </li>

                    {isFlex && (
                      <li className="flex items-center gap-2 text-amber-300 font-extrabold">
                        <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>Troca livre entre Barba, Disfarce Tesoura e Corte!</span>
                      </li>
                    )}

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                      <span>Cartão de Controle Físico &amp; Digital para validação</span>
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" />
                      <span>Sem fidelidade obrigatória (30 dias por ciclo)</span>
                    </li>

                    {plan.recommendedFor && (
                      <li className="mt-3 bg-black/40 p-3 rounded-2xl text-[11px] text-stone-200 border border-white/10 leading-relaxed">
                        <strong className="text-lime-300">Para quem é:</strong> {plan.recommendedFor}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Card Action Button */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleOpenSubscribeModal(plan)}
                    className="w-full px-6 py-3.5 bg-white text-stone-900 font-extrabold uppercase text-xs tracking-widest hover:bg-stone-100 active:scale-[0.99] transition-all rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-black/20"
                  >
                    <CreditCard className="w-4 h-4 text-stone-900" />
                    Assinar Agora
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Quero Assinar */}
      {isSubscribeModalOpen && selectedPlanForSub && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0c]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-[#556b2f]/40 rounded-lg max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSubscribeModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded bg-[#0a0a0a]"
            >
              <X className="w-5 h-5" />
            </button>

            {!createdSubSuccess ? (
              <div>
                <div className="flex items-center gap-2 text-[#556b2f] text-[10px] font-bold uppercase tracking-widest mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Ativação de Assinatura Ded Black
                </div>
                <h3 className="text-xl font-serif italic text-white">
                  Aderir ao {selectedPlanForSub.tierLabel}
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  {selectedPlanForSub.serviceName} &bull; {selectedPlanForSub.numAtendimentos} Atendimentos (R$ {selectedPlanForSub.totalPrice.toFixed(2)}/mês)
                </p>

                <form onSubmit={handleStartPaymentStep} className="mt-5 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                      Nome Completo do Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo Silva"
                      value={clientNameInput}
                      onChange={(e) => setClientNameInput(e.target.value)}
                      className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3.5 py-2.5 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                        CPF do Cliente
                      </label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={clientCpfInput}
                        onChange={(e) => setClientCpfInput(e.target.value)}
                        className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3.5 py-2.5 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
                        WhatsApp / Celular
                      </label>
                      <input
                        type="text"
                        placeholder="(21) 99999-8888"
                        value={clientPhoneInput}
                        onChange={(e) => setClientPhoneInput(e.target.value)}
                        className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3.5 py-2.5 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
                      />
                    </div>
                  </div>

                  <div className="bg-[#556b2f]/10 p-3 rounded border border-[#556b2f]/30 text-xs text-stone-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#556b2f] shrink-0 mt-0.5" />
                    <span>
                      Após o pagamento do valor exato de <strong>R$ {selectedPlanForSub.totalPrice.toFixed(2)}</strong>, o <strong>Cartão de Membro</strong> é liberado e ativado instantaneamente.
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSubscribeModalOpen(false)}
                      className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-stone-400 hover:bg-[#202020]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black font-bold uppercase text-[10px] tracking-widest flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-black" />
                      Ir para Pagamento (R$ {selectedPlanForSub.totalPrice.toFixed(2)})
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 bg-[#556b2f]/20 text-[#556b2f] rounded-full flex items-center justify-center mx-auto border border-[#556b2f]/40">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-serif italic text-white">
                  Assinatura Ativada com Sucesso!
                </h3>
                <p className="text-xs text-stone-300">
                  O cliente <strong>{createdSubSuccess.clientName}</strong> já pode utilizar seus {createdSubSuccess.totalSessions} atendimentos.
                </p>

                {/* Card Preview Mini */}
                <div className="bg-[#0a0a0a] p-4 rounded border border-[#556b2f]/40 text-left text-xs space-y-1.5 font-mono">
                  <div className="text-[#556b2f] font-bold">CÓDIGO CARTÃO: {createdSubSuccess.cardCode}</div>
                  <div>PLANO: {createdSubSuccess.planName}</div>
                  <div>SERVIÇO: {createdSubSuccess.serviceName}</div>
                  <div>SESSÕES DISPONÍVEIS: {createdSubSuccess.totalSessions} atendimentos</div>
                  <div>VALIDADE: até {createdSubSuccess.expirationDate}</div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setIsSubscribeModalOpen(false);
                      onOpenCheckin();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black font-bold uppercase text-[10px] tracking-widest shadow-md"
                  >
                    Ver Cartão de Controle em Detalhes
                  </button>
                  <button
                    onClick={() => setIsSubscribeModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded bg-[#202020] text-stone-300 text-xs font-bold uppercase tracking-widest"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrated Payment Modal */}
      {selectedPlanForSub && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          planName={selectedPlanForSub.tierLabel}
          serviceName={selectedPlanForSub.serviceName}
          planAmount={selectedPlanForSub.totalPrice}
          clientName={clientNameInput.trim() || 'Cliente'}
          clientCpf={clientCpfInput.trim() || '000.000.000-00'}
          clientPhone={clientPhoneInput.trim()}
          onPaymentSuccess={(data) => {
            setIsPaymentModalOpen(false);
            handlePaymentSuccess(data);
          }}
        />
      )}
    </div>
  );
};
