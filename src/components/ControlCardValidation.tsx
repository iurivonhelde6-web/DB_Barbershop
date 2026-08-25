import React, { useState } from 'react';
import { SubscriberCard, UserAccount, PaymentInvoice } from '../types';
import { PLANS_LIST } from '../data/barberData';
import { PaymentModal } from './PaymentModal';
import { DbLogo } from './DbLogo';
import { SubscriberStatusBadge, getSubscriberDynamicStatus } from '../utils/statusUtils';
import {
  ShieldCheck,
  CreditCard,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  Phone,
  Printer,
  QrCode,
  Scissors,
  XCircle,
  PlusCircle,
  Info,
  Trash2,
  Lock,
  Receipt,
  Sparkles,
  FileText,
  History,
  Download,
  ExternalLink,
  Clock
} from 'lucide-react';

interface ControlCardValidationProps {
  subscribers: SubscriberCard[];
  onUpdateSubscriber: (updatedSub: SubscriberCard) => void;
  onAddNewSubscriberClick: () => void;
  currentUser?: UserAccount | null;
  onDeleteSubscriber?: (subId: string) => void;
}

export const ControlCardValidation: React.FC<ControlCardValidationProps> = ({
  subscribers,
  onUpdateSubscriber,
  onAddNewSubscriberClick,
  currentUser,
  onDeleteSubscriber,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isClient = currentUser?.role === 'client';
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  // Filter subscribers list by role security
  const visibleSubscribers = subscribers.filter((sub) => {
    if (isClient && currentUser) {
      const matchesEmail = sub.email && currentUser.email && sub.email.toLowerCase() === currentUser.email.toLowerCase();
      const matchesUid = sub.userUid && sub.userUid === currentUser.id;
      const matchesName = currentUser.name && sub.clientName.toLowerCase().includes(currentUser.name.toLowerCase());
      const matchesCpf = currentUser.cpf && sub.cpf.replace(/\D/g, '') === currentUser.cpf.replace(/\D/g, '');
      const matchesCode = currentUser.cardCode && sub.cardCode.toLowerCase() === currentUser.cardCode.toLowerCase();
      return matchesEmail || matchesUid || matchesName || matchesCpf || matchesCode;
    }
    return true; // Admin sees all subscribers
  });

  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [isNoCardAlertOpen, setIsNoCardAlertOpen] = useState<boolean>(false);
  const [checkinSuccessMsg, setCheckinSuccessMsg] = useState<string | null>(null);

  // Admin Delete Confirmation State
  const [subToDelete, setSubToDelete] = useState<SubscriberCard | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  // Print Card Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Card Payment Modal State
  const [isCardPaymentModalOpen, setIsCardPaymentModalOpen] = useState<boolean>(false);

  // Selected Invoice for Receipt Modal
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<PaymentInvoice | null>(null);

  // Receipt Print State & Handler
  const [receiptToPrint, setReceiptToPrint] = useState<{
    invoice: PaymentInvoice;
    subscriber?: SubscriberCard;
  } | null>(null);

  const handlePrintReceipt = (invoice: PaymentInvoice) => {
    setReceiptToPrint({
      invoice,
      subscriber: selectedSub || undefined,
    });
    setTimeout(() => {
      window.print();
    }, 120);
  };

  // Helper to determine plan amount for selected sub
  const getSubPlanAmount = (sub: SubscriberCard): number => {
    if (sub.expectedAmount && sub.expectedAmount > 0) return sub.expectedAmount;
    if (sub.paidAmount && sub.paidAmount > 0) return sub.paidAmount;
    const matched = PLANS_LIST.find((p) => p.tierLabel.toLowerCase().includes(sub.planName.toLowerCase()) || sub.planName.toLowerCase().includes(p.tierLabel.toLowerCase()));
    return matched ? matched.totalPrice : 119.90;
  };

  // Helper to retrieve or construct subscriber payment history
  const getSubscriberPaymentHistory = (sub: SubscriberCard): PaymentInvoice[] => {
    if (sub.paymentHistory && sub.paymentHistory.length > 0) {
      return sub.paymentHistory;
    }

    const amount = getSubPlanAmount(sub);
    const isPaid = sub.paymentStatus === 'PAID' || sub.status === 'ACTIVE';

    const fallbackInvoice: PaymentInvoice = {
      id: `inv-${sub.id}-curr`,
      invoiceCode: `FAT-${sub.startDate ? sub.startDate.replace(/-/g, '') : '20260801'}-${sub.cardCode}`,
      planName: sub.planName,
      amount: isPaid ? (sub.paidAmount || amount) : amount,
      paymentMethod: sub.paymentMethod || 'PIX',
      paymentDate: isPaid ? (sub.paymentDate || sub.startDate || '01/08/2026') : 'Aguardando Quitação',
      dueDate: sub.startDate || '2026-08-01',
      period: 'Agosto / 2026',
      status: isPaid ? 'PAID' : 'PENDING',
      validationStatus: isPaid ? 'VALIDATED' : 'UNDER_REVIEW',
      transactionId: sub.transactionId || (isPaid ? `TXN-${sub.cardCode}-PIX` : `PENDING-${sub.cardCode}`),
      notes: isPaid
        ? 'Fatura quitada e validada no sistema Ded Black.'
        : 'Fatura aguardando confirmação de pagamento para liberação da carteirinha.',
    };

    return [fallbackInvoice];
  };

  // Revenue Metrics for Admin
  const totalPaidRevenue = subscribers
    .filter((s) => s.paymentStatus === 'PAID' || s.status === 'ACTIVE')
    .reduce((sum, s) => sum + (s.paidAmount || getSubPlanAmount(s)), 0);

  const totalPaidCount = subscribers.filter((s) => s.paymentStatus === 'PAID' || s.status === 'ACTIVE').length;
  const totalPendingCount = subscribers.filter((s) => s.paymentStatus === 'PENDING' || s.status === 'PAYMENT_PENDING').length;

  // Keep selectedSubId synced with available visibleSubscribers
  const selectedSub = visibleSubscribers.find((s) => s.id === selectedSubId) || visibleSubscribers[0];

  const filteredSubscribers = visibleSubscribers.filter((sub) => {
    const term = searchTerm.toLowerCase();
    const matchesTerm = (
      sub.clientName.toLowerCase().includes(term) ||
      sub.cardCode.toLowerCase().includes(term) ||
      sub.cpf.includes(term) ||
      sub.phone.includes(term)
    );

    if (paymentFilter === 'PAID') {
      return matchesTerm && (sub.paymentStatus === 'PAID' || sub.status === 'ACTIVE');
    }
    if (paymentFilter === 'PENDING') {
      return matchesTerm && (sub.paymentStatus === 'PENDING' || sub.status === 'PAYMENT_PENDING');
    }
    return matchesTerm;
  });

  const handleRegisterAttendance = () => {
    if (!selectedSub) return;

    if (selectedSub.status === 'PAYMENT_PENDING' || selectedSub.paymentStatus === 'PENDING') {
      alert(`⚠️ O cliente ${selectedSub.clientName} possui o pagamento do plano pendente! A carteirinha só é liberada após o pagamento.`);
      setIsCardPaymentModalOpen(true);
      return;
    }

    if (selectedSub.usedSessions >= selectedSub.totalSessions) {
      alert(`⚠️ O cliente ${selectedSub.clientName} já utilizou todos os ${selectedSub.totalSessions} atendimentos do ciclo atual!`);
      return;
    }

    const updated: SubscriberCard = {
      ...selectedSub,
      usedSessions: selectedSub.usedSessions + 1,
    };

    onUpdateSubscriber(updated);
    setCheckinSuccessMsg(
      `✅ Atendimento registrado com sucesso! Restam ${updated.totalSessions - updated.usedSessions} atendimentos no plano.`
    );

    setTimeout(() => setCheckinSuccessMsg(null), 5000);
  };

  const handleCardPaymentSuccess = (paymentData: {
    paidAmount: number;
    paymentMethod: 'PIX' | 'CREDIT_CARD';
    transactionId: string;
    paymentDate: string;
  }) => {
    if (!selectedSub) return;

    const newInvoice: PaymentInvoice = {
      id: `inv-${Date.now()}`,
      invoiceCode: `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      planName: selectedSub.planName,
      amount: paymentData.paidAmount,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentDate,
      dueDate: selectedSub.startDate || new Date().toISOString().slice(0, 10),
      period: `${new Date().toLocaleString('pt-BR', { month: 'long' })} / ${new Date().getFullYear()}`,
      status: 'PAID',
      validationStatus: 'VALIDATED',
      transactionId: paymentData.transactionId,
      notes: `Pagamento de R$ ${paymentData.paidAmount.toFixed(2)} confirmado via ${paymentData.paymentMethod}. Carteirinha ativada.`,
    };

    const currentHistory = getSubscriberPaymentHistory(selectedSub);
    const updatedHistory = [newInvoice, ...currentHistory.filter((inv) => inv.id !== newInvoice.id)];

    const updatedSub: SubscriberCard = {
      ...selectedSub,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paidAmount: paymentData.paidAmount,
      expectedAmount: paymentData.paidAmount,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentDate,
      transactionId: paymentData.transactionId,
      paymentHistory: updatedHistory,
      notes: `Mensalidade do plano quitada com sucesso em ${paymentData.paymentDate}. Transação: ${paymentData.transactionId}`,
    };

    onUpdateSubscriber(updatedSub);
    setCheckinSuccessMsg(
      `🎉 Mensalidade de ${selectedSub.clientName} quitada com sucesso (R$ ${paymentData.paidAmount.toFixed(2)})! Carteirinha e atendimentos liberados.`
    );
    setTimeout(() => setCheckinSuccessMsg(null), 6000);
  };

  const handleAdminManualPaymentConfirm = () => {
    if (!selectedSub) return;
    const amount = getSubPlanAmount(selectedSub);
    const todayStr = new Date().toLocaleDateString('pt-BR');

    const newInvoice: PaymentInvoice = {
      id: `inv-${Date.now()}`,
      invoiceCode: `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      planName: selectedSub.planName,
      amount: amount,
      paymentMethod: 'BALCÃO',
      paymentDate: `${todayStr} (Balcão)`,
      dueDate: selectedSub.startDate || new Date().toISOString().slice(0, 10),
      period: `${new Date().toLocaleString('pt-BR', { month: 'long' })} / ${new Date().getFullYear()}`,
      status: 'PAID',
      validationStatus: 'VALIDATED',
      transactionId: `ADM-MANUAL-${Math.floor(10000 + Math.random() * 90000)}`,
      notes: `Quitação em dinheiro/cartão no balcão confirmada pelo Administrador em ${todayStr}.`,
    };

    const currentHistory = getSubscriberPaymentHistory(selectedSub);
    const updatedHistory = [newInvoice, ...currentHistory.filter((inv) => inv.id !== newInvoice.id)];

    const updatedSub: SubscriberCard = {
      ...selectedSub,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      paidAmount: amount,
      expectedAmount: amount,
      paymentMethod: 'DEBIT_CARD',
      paymentDate: `${todayStr} (Balcão)`,
      transactionId: `ADM-MANUAL-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentHistory: updatedHistory,
      notes: `Quitação em dinheiro/cartão no balcão confirmada pelo Administrador em ${todayStr}.`,
    };

    onUpdateSubscriber(updatedSub);
    setCheckinSuccessMsg(
      `🎉 Pagamento de R$ ${amount.toFixed(2)} confirmado pelo Administrador! Carteirinha de ${selectedSub.clientName} ativada e liberada.`
    );
    setTimeout(() => setCheckinSuccessMsg(null), 6000);
  };

  const handleConfirmDelete = () => {
    if (!subToDelete || !onDeleteSubscriber) return;
    const deletedName = subToDelete.clientName;
    const deletedId = subToDelete.id;

    onDeleteSubscriber(deletedId);

    const remaining = subscribers.filter((s) => s.id !== deletedId);
    if (remaining.length > 0) {
      setSelectedSubId(remaining[0].id);
    } else {
      setSelectedSubId('');
    }

    setSubToDelete(null);
    setDeleteSuccessMsg(`Membro "${deletedName}" foi excluído permanentemente do sistema!`);
    setTimeout(() => setDeleteSuccessMsg(null), 5000);
  };

  const remainingSessions = selectedSub ? selectedSub.totalSessions - selectedSub.usedSessions : 0;
  const isExpired = selectedSub ? new Date(selectedSub.expirationDate) < new Date() : false;

  return (
    <div className="bg-[#0c0c0c] min-h-screen text-[#e0e0e0] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#556b2f]/30 pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#556b2f]/20 text-[#556b2f] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 border border-[#556b2f]/40">
            <ShieldCheck className="w-3.5 h-3.5 text-[#556b2f]" />
            Validação Obrigatória - Cláusulas 6 e 13
          </span>
          <h2 className="text-3xl font-serif italic text-white">
            Cartão de Controle &amp; Check-in de Assinantes
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 opacity-80">
            Pesquise por Nome, CPF ou Código do Cartão. Verifique o saldo de atendimentos antes de iniciar o serviço.
          </p>
        </div>

        <button
          onClick={onAddNewSubscriberClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black text-[10px] font-bold uppercase tracking-widest transition shadow-lg"
        >
          <PlusCircle className="w-4 h-4 text-black" />
          Cadastrar Novo Assinante
        </button>
      </div>

      {/* Admin Revenue & Carteirinhas Metric Header */}
      {isAdmin && (
        <div className="bg-[#151515] border border-[#556b2f]/30 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#556b2f]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Painel do Administrador &bull; Arrecadação de Carteirinhas
              </h3>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              Total em Carteirinhas Ativas: R$ {totalPaidRevenue.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0a0a0a] border border-[#556b2f]/40 p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
                Total Arrecadado em Carteirinhas
              </span>
              <div className="text-2xl font-mono font-bold text-[#556b2f]">
                R$ {totalPaidRevenue.toFixed(2)}
              </div>
              <span className="text-[10px] text-stone-500 block mt-1">
                Valores quitados pelos clientes
              </span>
            </div>

            <div className="bg-[#0a0a0a] border border-emerald-500/30 p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
                Carteirinhas Liberadas
              </span>
              <div className="text-2xl font-mono font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                <span>{totalPaidCount} Quitadas</span>
              </div>
              <span className="text-[10px] text-stone-500 block mt-1">
                Clientes com pagamento e acesso liberados
              </span>
            </div>

            <div className="bg-[#0a0a0a] border border-amber-500/30 p-4 rounded-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
                Aguardando Pagamento
              </span>
              <div className="text-2xl font-mono font-bold text-amber-400 flex items-center gap-2">
                <Lock className="w-6 h-6" />
                <span>{totalPendingCount} Bloqueadas</span>
              </div>
              <span className="text-[10px] text-stone-500 block mt-1">
                Aguardando quitação do plano para liberar
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Search & Subscriber List */}
        <div className="lg:col-span-5 bg-[#151515] rounded border border-[#556b2f]/20 p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar por Nome, CPF ou Código DB-XXXX..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0a] text-stone-100 text-xs rounded pl-10 pr-4 py-3 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
            />
          </div>

          {/* Filter Tabs for Admin */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0a0a0a] rounded border border-white/5 text-[10px] font-bold uppercase">
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`flex-1 py-1.5 rounded transition ${
                paymentFilter === 'ALL'
                  ? 'bg-[#556b2f] text-black font-extrabold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Todas ({visibleSubscribers.length})
            </button>
            <button
              onClick={() => setPaymentFilter('PAID')}
              className={`flex-1 py-1.5 rounded transition ${
                paymentFilter === 'PAID'
                  ? 'bg-[#556b2f] text-black font-extrabold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Quitadas ({totalPaidCount})
            </button>
            <button
              onClick={() => setPaymentFilter('PENDING')}
              className={`flex-1 py-1.5 rounded transition ${
                paymentFilter === 'PENDING'
                  ? 'bg-amber-500 text-black font-extrabold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Pendentes ({totalPendingCount})
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 px-1 font-semibold">
            <span className="uppercase tracking-wider text-[10px]">Membros Cadastrados ({filteredSubscribers.length})</span>
            <span className="text-[10px] text-[#556b2f] uppercase tracking-wider">Clique para selecionar</span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredSubscribers.map((sub) => {
              const isSelected = sub.id === selectedSub?.id;
              const subRemaining = sub.totalSessions - sub.usedSessions;
              const isPaid = sub.paymentStatus === 'PAID' || sub.status === 'ACTIVE';
              const paidVal = sub.paidAmount || getSubPlanAmount(sub);

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubId(sub.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedSubId(sub.id);
                    }
                  }}
                  className={`w-full text-left p-3.5 rounded transition border flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-[#556b2f]/20 border-[#556b2f] shadow-md'
                      : 'bg-[#0a0a0a] border-white/5 hover:border-[#556b2f]/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{sub.clientName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151515] text-[#556b2f] border border-[#556b2f]/30">
                        {sub.cardCode}
                      </span>
                      {/* Dynamic Subscriber Status Badge (Ativo / Pendente / Expirado) */}
                      <SubscriberStatusBadge subscriber={sub} showDaysDetail size="sm" />
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{sub.planName}</p>
                    
                    {/* Paid Amount Badge */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {isPaid ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          R$ {paidVal.toFixed(2)} QUITADO
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          R$ {getSubPlanAmount(sub).toFixed(2)} PENDENTE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          subRemaining > 0
                            ? 'bg-[#556b2f]/20 text-[#556b2f]'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {subRemaining} ATD Restantes
                      </span>
                      <span className="text-[10px] text-stone-400 block mt-1 font-mono">
                        Vence: {sub.expirationDate}
                      </span>
                    </div>

                    {isAdmin && onDeleteSubscriber && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubToDelete(sub);
                        }}
                        className="p-1.5 rounded hover:bg-red-950/80 text-stone-500 hover:text-red-400 transition ml-1"
                        title={`Excluir membro ${sub.clientName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Subscriber Pass Card & Controls */}
        {!selectedSub ? (
          <div className="lg:col-span-7 bg-[#151515] rounded border border-[#556b2f]/20 p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[380px]">
            <div className="w-16 h-16 rounded-full bg-[#556b2f]/10 border border-[#556b2f]/30 flex items-center justify-center text-[#556b2f]">
              <PlusCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-serif italic text-white">Nenhum Assinante Selecionado</h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                {subscribers.length === 0
                  ? 'Nenhum membro cadastrado no sistema. Cadastre um cliente para gerar seu Cartão de Controle.'
                  : 'Selecione um membro da lista ao lado para visualizar o Cartão de Controle ou dar check-in no atendimento.'}
              </p>
            </div>
            <button
              onClick={onAddNewSubscriberClick}
              className="px-5 py-2.5 rounded bg-[#556b2f] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-lg flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-black" />
              <span>Cadastrar Novo Assinante</span>
            </button>
          </div>
        ) : (
          <div className="lg:col-span-7 space-y-6">
            {/* Success Toast */}
            {checkinSuccessMsg && (
              <div className="bg-[#556b2f]/20 border border-[#556b2f] p-4 rounded text-xs text-stone-100 font-bold flex items-center gap-2 animate-fade-in shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-[#556b2f] shrink-0" />
                <span>{checkinSuccessMsg}</span>
              </div>
            )}

            {/* Delete Toast */}
            {deleteSuccessMsg && (
              <div className="bg-red-950/40 border border-red-500/50 p-4 rounded text-xs text-red-200 font-bold flex items-center gap-2 animate-fade-in shadow-lg">
                <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
                <span>{deleteSuccessMsg}</span>
              </div>
            )}

            {/* Main Digital Pass Card Component */}
            <div className="bg-[#111111] border border-[#556b2f]/40 rounded p-6 shadow-2xl relative overflow-hidden">
              {/* Card Top */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
                <div className="flex items-center gap-3">
                  <DbLogo className="w-12 h-12" />
                  <div>
                    <h3 className="text-lg font-serif italic text-white tracking-wide">
                      CARTÃO DE CONTROLE D•B
                    </h3>
                    <p className="text-xs text-[#556b2f] font-mono font-bold">
                      CÓDIGO: {selectedSub.cardCode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SubscriberStatusBadge subscriber={selectedSub} size="lg" showDaysDetail />
                </div>
              </div>

              {/* Payment Status Banner */}
              {selectedSub.status === 'PAYMENT_PENDING' || selectedSub.paymentStatus === 'PENDING' ? (
                <div className="my-4 bg-amber-950/40 border-2 border-amber-500/60 rounded-xl p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400 shrink-0">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                        🔒 Carteirinha Bloqueada - Aguardando Pagamento
                      </h4>
                      <p className="text-xs text-stone-200 mt-1 leading-relaxed">
                        Conforme as regras da Ded Black, <strong>o cliente só poderá fazer e utilizar a carteirinha digital caso pague o plano que escolher assinar</strong>.
                        O valor a ser quitado é de <strong className="text-amber-400 font-mono text-sm">R$ {getSubPlanAmount(selectedSub).toFixed(2)}</strong> ({selectedSub.planName}).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-amber-500/30">
                    <button
                      onClick={() => setIsCardPaymentModalOpen(true)}
                      className="w-full sm:w-auto px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold uppercase text-xs tracking-wider transition shadow-lg flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4 text-black" />
                      <span>Efetuar Pagamento de R$ {getSubPlanAmount(selectedSub).toFixed(2)}</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={handleAdminManualPaymentConfirm}
                        className="w-full sm:w-auto px-4 py-3 rounded-lg bg-[#556b2f]/30 hover:bg-[#556b2f]/50 text-[#556b2f] border border-[#556b2f] font-bold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2"
                        title="Registra a quitação presencial em dinheiro ou maquininha no balcão"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#556b2f]" />
                        <span>Confirmar Pagamento no Balcão (Admin)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : selectedSub.paymentStatus === 'PAID' ? (
                <div className="my-4 bg-[#556b2f]/10 border-2 border-[#556b2f]/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[#556b2f] shrink-0" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Comprovante do Administrador &bull; Valor Pago Confirmado
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-[#556b2f] bg-[#556b2f]/20 px-2.5 py-1 rounded-full border border-[#556b2f]/40">
                      Carteirinha Liberada
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
                    <div className="bg-[#0a0a0a] p-2.5 rounded border border-[#556b2f]/30">
                      <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-sans">Valor Pago do Plano</span>
                      <strong className="text-emerald-400 text-sm font-bold">R$ {(selectedSub.paidAmount || getSubPlanAmount(selectedSub)).toFixed(2)}</strong>
                    </div>

                    <div className="bg-[#0a0a0a] p-2.5 rounded border border-white/5">
                      <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-sans">Forma de Pagamento</span>
                      <strong className="text-stone-200">{selectedSub.paymentMethod || 'PIX / Cartão'}</strong>
                    </div>

                    <div className="bg-[#0a0a0a] p-2.5 rounded border border-white/5">
                      <span className="text-[9px] text-stone-400 uppercase tracking-widest block font-sans">Data &amp; Transação</span>
                      <strong className="text-amber-300 truncate block text-[11px]">{selectedSub.paymentDate || selectedSub.startDate} ({selectedSub.transactionId || 'Aguardando'})</strong>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Client Info Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 text-xs">
                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">Nome do Titular</span>
                  <strong className="text-white text-sm font-bold block">{selectedSub.clientName}</strong>
                </div>

                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">CPF do Assinante</span>
                  <strong className="text-stone-200 font-mono">{selectedSub.cpf}</strong>
                </div>

                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">Plano Contratado</span>
                  <strong className="text-[#556b2f] font-bold">{selectedSub.planName}</strong>
                </div>

                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">Serviço Vínculado</span>
                  <strong className="text-stone-200">{selectedSub.serviceName}</strong>
                </div>

                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">Validade do Ciclo</span>
                  <strong className="text-yellow-400 font-mono">até {selectedSub.expirationDate}</strong>
                </div>

                <div>
                  <span className="text-stone-400 block font-medium uppercase text-[10px] tracking-wider">Telefone / Contato</span>
                  <strong className="text-stone-200">{selectedSub.phone}</strong>
                </div>
              </div>

              {/* Usage Progress Bar */}
              <div className="bg-[#0a0a0a] p-4 rounded border border-white/5 my-5">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-stone-300">
                    Sessões Utilizadas: {selectedSub.usedSessions} / {selectedSub.totalSessions}
                  </span>
                  <span className="text-[#556b2f] font-bold">
                    {remainingSessions} Atendimentos Restantes
                  </span>
                </div>

                <div className="w-full h-3 bg-[#151515] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-[#556b2f] transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (selectedSub.usedSessions / selectedSub.totalSessions) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* QR Code and Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 bg-[#0a0a0a] p-2.5 rounded border border-white/5">
                  <div className="w-12 h-12 bg-[#151515] p-1 rounded border border-[#556b2f]/30 flex items-center justify-center text-[#556b2f]">
                    <QrCode className="w-9 h-9 text-[#556b2f]" />
                  </div>
                  <div className="text-[10px] text-stone-400">
                    <span className="font-bold text-stone-200 uppercase tracking-wider block">QR CODE OFICIAL D•B</span>
                    Apresentação Obrigatória na Visita
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {isAdmin && onDeleteSubscriber && (
                    <button
                      onClick={() => setSubToDelete(selectedSub)}
                      className="flex-1 sm:flex-none px-3.5 py-2.5 rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 text-[10px] font-bold uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-md group"
                      title="Exclusão de membro exclusiva do Administrador"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                      <span>Excluir Membro</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsPrintModalOpen(true)}
                    className="flex-1 sm:flex-none px-3.5 py-2.5 rounded bg-[#202020] hover:bg-[#282828] text-stone-200 text-[10px] font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Printer className="w-4 h-4 text-stone-300" />
                    Imprimir Cartão
                  </button>

                  <button
                    onClick={handleRegisterAttendance}
                    disabled={remainingSessions <= 0 || isExpired}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] disabled:opacity-50 text-black text-[10px] font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    Registrar Atendimento (-1 ATD)
                  </button>
                </div>
              </div>

              {/* Seção: Histórico de Pagamentos e Faturas do Perfil */}
              <div className="bg-[#0f0f0f] border border-[#556b2f]/30 rounded-xl p-5 my-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded bg-[#556b2f]/20 border border-[#556b2f]/40 text-[#556b2f]">
                      <Receipt className="w-5 h-5 text-[#556b2f]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <span>Histórico de Pagamentos &amp; Faturas</span>
                        <span className="text-[10px] font-mono bg-[#556b2f]/20 text-[#556b2f] border border-[#556b2f]/40 px-2.5 py-0.5 rounded-full font-bold">
                          {getSubscriberPaymentHistory(selectedSub).length} {getSubscriberPaymentHistory(selectedSub).length === 1 ? 'Fatura' : 'Faturas'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        Registro cronológico de mensalidades, faturas pagas e status de validação do contrato.
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-stone-500 block font-sans">Perfil do Assinante</span>
                    <span className="text-xs font-bold text-stone-200 font-mono">{selectedSub.clientName} ({selectedSub.cardCode})</span>
                  </div>
                </div>

                {/* Invoices Chronological List */}
                <div className="space-y-3">
                  {getSubscriberPaymentHistory(selectedSub).map((invoice) => {
                    const isPaid = invoice.status === 'PAID';

                    return (
                      <div
                        key={invoice.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-[#0a0a0a] border-[#556b2f]/30 hover:border-[#556b2f]/60'
                            : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          {/* Left Info */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-mono font-extrabold bg-[#1a1a1a] text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded">
                                {invoice.invoiceCode}
                              </span>

                              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/5 text-stone-300 px-2.5 py-0.5 rounded border border-white/10">
                                {invoice.period}
                              </span>

                              {isPaid ? (
                                <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  QUITADO &amp; VALIDADO
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold font-mono text-amber-300 bg-amber-950/80 border border-amber-500/50 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                  AGUARDANDO VALIDAÇÃO
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-white pt-0.5">
                              {invoice.planName}
                            </div>

                            <div className="flex items-center gap-4 text-[11px] text-stone-400 font-mono flex-wrap">
                              <span>Pagamento: <strong className="text-stone-200">{invoice.paymentDate}</strong></span>
                              <span>Método: <strong className="text-stone-200">{invoice.paymentMethod}</strong></span>
                              <span>Transação: <strong className="text-amber-300">{invoice.transactionId}</strong></span>
                            </div>
                          </div>

                          {/* Right Amount & Receipt Action Buttons */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                            <div className="text-left md:text-right">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 block">Valor Quitado</span>
                              <span className={`text-base font-mono font-extrabold ${isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                                R$ {invoice.amount.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handlePrintReceipt(invoice)}
                                className="px-3 py-2 rounded-lg bg-[#38472A]/50 hover:bg-[#38472A] border border-[#6D7E5A]/60 text-[#FDFDFD] text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-md hover:shadow-lg"
                                title="Imprimir comprovante fiscal/recibo da transação"
                              >
                                <Printer className="w-3.5 h-3.5 text-[#6D7E5A]" />
                                <span>Imprimir Recibo</span>
                              </button>

                              <button
                                onClick={() => setSelectedInvoiceForModal(invoice)}
                                className="px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-stone-200 text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#6D7E5A]" />
                                <span>Ver Detalhes</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Note / Remarks */}
                        {invoice.notes && (
                          <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-stone-400 flex items-start gap-1.5 italic">
                            <Info className="w-3.5 h-3.5 text-[#556b2f] shrink-0 mt-0.5" />
                            <span>{invoice.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rule Warning Trigger Card */}
            <div className="bg-yellow-950/20 border border-yellow-500/30 rounded p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">
                    Aviso Regra #6 &amp; #13: Cliente sem Cartão?
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5 opacity-80">
                    Se o cliente comparecer ao atendimento sem o cartão físico ou digital, a regra contratual exige a cobrança no valor AVULSO.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsNoCardAlertOpen(true)}
                className="px-3 py-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-bold uppercase tracking-widest border border-yellow-500/40 whitespace-nowrap shrink-0"
              >
                Cobrar Tabela Avulso
              </button>
            </div>
          </div>
        )}
      </div>

      {/* No Card Warning Modal */}
      {isNoCardAlertOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0c]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-yellow-500/40 rounded max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mx-auto border border-yellow-500/40">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-serif italic text-white">
                Atenção: Ausência do Cartão de Controle
              </h3>
              <p className="text-xs text-stone-300 mt-2 leading-relaxed opacity-80">
                Conforme as cláusulas <strong>6</strong> e <strong>13</strong> do contrato oficial Ded Black:
              </p>
              <div className="bg-[#0a0a0a] p-3 rounded border border-white/5 text-yellow-300 text-xs font-semibold my-3 text-left">
                "Caso o cliente venha cortar sem o Cartão de Controle (físico ou digital), o serviço DEVERÁ ser cobrado pelo valor AVULSO da tabela no dia do atendimento."
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setIsNoCardAlertOpen(false)}
                className="w-full py-2.5 rounded bg-yellow-500 text-black font-bold text-[10px] uppercase tracking-widest"
              >
                Entendido, Aplicar Cobrança Avulso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Digital Card Modal */}
      {isPrintModalOpen && selectedSub && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0c]/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-[#556b2f]/40 rounded max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-lg font-serif italic text-white">
                Cartão Físico / Digital Ded Black
              </h3>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-stone-400 hover:text-white text-xs font-bold uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>

            {/* Printable Pass Graphic */}
            <div className="bg-[#0a0a0a] p-6 rounded border border-[#556b2f]/50 space-y-4 text-stone-100 font-sans shadow-2xl relative">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-[#556b2f]" />
                  <span className="font-bold text-sm tracking-widest font-serif text-white uppercase">DED BLACK BARBERSHOP</span>
                </div>
                <span className="text-[10px] font-mono text-[#556b2f] bg-[#151515] px-2 py-0.5 rounded border border-[#556b2f]/40">
                  {selectedSub.cardCode}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest block">Titular do Cartão</span>
                <p className="text-base font-bold text-white">{selectedSub.clientName}</p>
                <p className="text-xs text-stone-400 font-mono">CPF: {selectedSub.cpf}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-[#151515] p-3 rounded border border-white/5">
                <div>
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest block">Plano</span>
                  <span className="font-bold text-[#556b2f]">{selectedSub.planName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest block">Validade</span>
                  <span className="font-bold text-yellow-400">{selectedSub.expirationDate}</span>
                </div>
              </div>

              {/* Session Boxes */}
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-1.5">
                  Controle de Atendimentos do Mês:
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {Array.from({ length: selectedSub.totalSessions }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-8 rounded flex items-center justify-center font-bold text-xs border ${
                        idx < selectedSub.usedSessions
                          ? 'bg-[#556b2f]/30 text-[#556b2f] border-[#556b2f]/50'
                          : 'bg-[#151515] text-stone-600 border-white/5'
                      }`}
                    >
                      {idx < selectedSub.usedSessions ? '✓' : idx + 1}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-[10px] text-stone-400 border-t border-white/5">
                <span className="uppercase tracking-wider">D•B Barbershop - Assinatura do Titular</span>
                <QrCode className="w-6 h-6 text-[#556b2f]" />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Admin Delete Confirmation Modal */}
      {subToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-red-500/40 w-full max-w-md rounded-xl shadow-2xl p-6 text-stone-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-red-500/30 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-white italic">
                  Excluir Membro Assinante
                </h3>
                <p className="text-[11px] text-red-300">Ação de Administrador</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <p>Tem certeza de que deseja EXCLUIR permanentemente o cadastro do membro abaixo?</p>
              <div className="bg-[#0a0a0a] p-3 rounded border border-white/10 space-y-1 font-mono text-white">
                <p className="font-bold text-sm text-[#556b2f]">{subToDelete.clientName}</p>
                <p className="text-[11px] text-stone-400">
                  Cartão: <span className="text-white font-bold">{subToDelete.cardCode}</span> | CPF: {subToDelete.cpf}
                </p>
                <p className="text-[11px] text-stone-400">Plano: {subToDelete.planName}</p>
              </div>
              <p className="text-[11px] text-red-400 font-semibold italic">
                ⚠️ Esta ação removerá o Cartão de Controle, o histórico de acessos e o cadastro do assinante.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSubToDelete(null)}
                className="px-4 py-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold uppercase tracking-wider transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Sim, Excluir Membro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal for Selected Subscriber Card */}
      {selectedSub && (
        <PaymentModal
          isOpen={isCardPaymentModalOpen}
          onClose={() => setIsCardPaymentModalOpen(false)}
          planName={selectedSub.planName}
          serviceName={selectedSub.serviceName}
          planAmount={getSubPlanAmount(selectedSub)}
          clientName={selectedSub.clientName}
          clientCpf={selectedSub.cpf}
          clientPhone={selectedSub.phone}
          subscriberCard={selectedSub}
          onPaymentSuccess={(data) => {
            setIsCardPaymentModalOpen(false);
            handleCardPaymentSuccess(data);
          }}
        />
      )}

      {/* Invoice Receipt / Comprovante Modal */}
      {selectedInvoiceForModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#121212] border-2 border-[#556b2f]/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-stone-100 relative my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <DbLogo className="w-8 h-8" />
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Comprovante Oficial de Quitação
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    DED BLACK BARBERSHOP &bull; SISTEMA DE SUBSCRIÇÃO
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedInvoiceForModal(null)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Status Banner */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              selectedInvoiceForModal.status === 'PAID'
                ? 'bg-[#556b2f]/10 border-[#556b2f]/50 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
            }`}>
              <CheckCircle2 className={`w-6 h-6 shrink-0 mt-0.5 ${
                selectedInvoiceForModal.status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
              }`} />
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider">
                  {selectedInvoiceForModal.status === 'PAID'
                    ? 'Fatura Quitada e Validada com Sucesso'
                    : 'Fatura Pendente de Quitação'}
                </h4>
                <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                  {selectedInvoiceForModal.status === 'PAID'
                    ? 'A quitação deste plano foi autenticada e validada no sistema. O titular possui acesso livre aos atendimentos do seu ciclo.'
                    : 'Esta fatura aguarda confirmação de pagamento para liberar a utilização da carteirinha digital.'}
                </p>
              </div>
            </div>

            {/* Invoice Particulars Grid */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Código da Fatura:</span>
                <strong className="text-amber-400 font-bold">{selectedInvoiceForModal.invoiceCode}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Titular do Plano:</span>
                <strong className="text-white font-bold">{selectedSub?.clientName}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">CPF do Titular:</span>
                <strong className="text-stone-300">{selectedSub?.cpf}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Plano / Assinatura:</span>
                <strong className="text-[#556b2f] font-bold text-right">{selectedInvoiceForModal.planName}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Competência / Período:</span>
                <strong className="text-stone-200">{selectedInvoiceForModal.period}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Data &amp; Hora:</span>
                <strong className="text-stone-200">{selectedInvoiceForModal.paymentDate}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">Forma de Pagamento:</span>
                <strong className="text-stone-200">{selectedInvoiceForModal.paymentMethod}</strong>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-stone-400 font-sans uppercase text-[10px]">ID da Transação:</span>
                <strong className="text-amber-300 text-[11px]">{selectedInvoiceForModal.transactionId}</strong>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-stone-400 font-sans uppercase text-[11px] font-bold">Valor Total Quitante:</span>
                <strong className="text-emerald-400 text-lg font-bold">R$ {selectedInvoiceForModal.amount.toFixed(2)}</strong>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handlePrintReceipt(selectedInvoiceForModal)}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#6D7E5A] to-[#38472A] hover:from-[#7e9169] hover:to-[#465835] text-[#FDFDFD] font-extrabold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer className="w-4 h-4 text-[#FDFDFD]" />
                <span>Imprimir Recibo</span>
              </button>

              <button
                onClick={() => setSelectedInvoiceForModal(null)}
                className="px-5 py-3 rounded-xl bg-[#202020] hover:bg-[#2a2a2a] border border-white/10 text-stone-300 text-xs font-bold uppercase tracking-wider transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Receipt for CSS @media print */}
      {receiptToPrint && (
        <div id="printable-receipt" className="hidden print:block text-black bg-white p-6 font-mono text-xs max-w-md mx-auto">
          <div className="border-2 border-black p-5 space-y-4">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3">
              <h2 className="text-base font-extrabold tracking-wider uppercase">DED BLACK BARBERSHOP</h2>
              <p className="text-[11px] font-bold uppercase text-stone-800">Comprovante de Pagamento & Quitação</p>
              <p className="text-[9px] text-stone-600 mt-1">D•B Club de Membros | CNPJ: 48.921.340/0001-89</p>
            </div>

            {/* Identificação da Fatura */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-stone-400 pb-3">
              <div className="flex justify-between">
                <span className="font-sans font-bold">CÓD. FATURA:</span>
                <span className="font-bold">{receiptToPrint.invoice.invoiceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">TRANSAÇÃO ID:</span>
                <span>{receiptToPrint.invoice.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">DATA / HORA:</span>
                <span>{receiptToPrint.invoice.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">FORMA DE PAGAMENTO:</span>
                <span>{receiptToPrint.invoice.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">STATUS:</span>
                <span className="font-bold">QUITADO E VALIDADO</span>
              </div>
            </div>

            {/* Titular */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-stone-400 pb-3">
              <div className="flex justify-between">
                <span className="font-sans font-bold">TITULAR DO PLANO:</span>
                <span className="font-bold">{receiptToPrint.subscriber?.clientName || 'Cliente D•B'}</span>
              </div>
              {receiptToPrint.subscriber?.cpf && (
                <div className="flex justify-between">
                  <span className="font-sans font-bold">CPF:</span>
                  <span>{receiptToPrint.subscriber.cpf}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-sans font-bold">CARTEIRINHA:</span>
                <span className="font-bold">{receiptToPrint.subscriber?.cardCode || '-'}</span>
              </div>
            </div>

            {/* Detalhes do Plano */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-stone-400 pb-3">
              <div className="flex justify-between">
                <span className="font-sans font-bold">PLANO:</span>
                <span className="font-bold">{receiptToPrint.invoice.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">COMPETÊNCIA:</span>
                <span>{receiptToPrint.invoice.period}</span>
              </div>
            </div>

            {/* Valor Total */}
            <div className="flex justify-between items-center text-sm font-extrabold border-b-2 border-black pb-2 pt-1">
              <span>VALOR TOTAL:</span>
              <span className="text-base">R$ {receiptToPrint.invoice.amount.toFixed(2)}</span>
            </div>

            {/* Rodapé e Selo */}
            <div className="text-center text-[9px] space-y-1 pt-1 text-stone-700">
              <p className="font-bold">AUTENTICAÇÃO DO SISTEMA D•B</p>
              <p className="font-mono text-[8px] break-all">
                DB-AUTH-{receiptToPrint.invoice.invoiceCode}-{receiptToPrint.invoice.transactionId.slice(-8)}
              </p>
              <p className="text-[8px] italic pt-1">
                Este comprovante atesta a quitação de mensalidade no sistema Ded Black Barbershop.
              </p>
              <p className="text-[8px] text-stone-500">
                Documento impresso em: {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
