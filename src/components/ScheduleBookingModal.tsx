import React, { useState } from 'react';
import { Barber, Appointment, UserAccount } from '../types';
import { BARBERS_LIST, SERVICES_LIST, INITIAL_APPOINTMENTS, ADMIN_WHATSAPP, ADMIN_WHATSAPP_DISPLAY } from '../data/barberData';
import {
  Calendar,
  Clock,
  Scissors,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
  ShieldAlert,
  Sparkles,
  Trash2,
  Check,
  CalendarCheck,
  MessageSquare,
  Copy,
  ExternalLink,
  Bell,
  Send,
  Volume2
} from 'lucide-react';
import { playAppointmentAlert } from '../utils/soundAlert';

interface ScheduleBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  appointments: Appointment[];
  onAddAppointment: (apt: Appointment) => void;
  onCancelAppointment: (aptId: string) => void;
}

const AVAILABLE_TIMES = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:30',
  '14:30',
  '15:30',
  '16:30',
  '17:30',
  '18:30',
  '19:30'
];

export const ScheduleBookingModal: React.FC<ScheduleBookingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  appointments,
  onAddAppointment,
  onCancelAppointment,
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'list'>('book');

  // Booking Form State
  const [selectedBarberId, setSelectedBarberId] = useState<string>(BARBERS_LIST[0].id);
  const [selectedServiceName, setSelectedServiceName] = useState<string>(SERVICES_LIST[2].name);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedTime, setSelectedTime] = useState<string>('14:30');

  const [clientName, setClientName] = useState<string>(currentUser?.name || '');
  const [clientPhone, setClientPhone] = useState<string>('(21) 99887-6655');
  const [cardCode, setCardCode] = useState<string>(currentUser?.cardCode || 'DB-8842');

  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    message: string;
    barberName: string;
    date: string;
    time: string;
    serviceName: string;
    clientName: string;
    clientPhone: string;
    cardCode?: string;
  } | null>(null);

  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [selectedAppointmentForMsg, setSelectedAppointmentForMsg] = useState<Appointment | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<{ id: string; message: string; isLate: boolean } | null>(null);

  if (!isOpen) return null;

  const selectedBarber = BARBERS_LIST.find((b) => b.id === selectedBarberId) || BARBERS_LIST[0];

  // Play audio chime when booking confirms
  const playConfirmationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // Audio context blocked by user interaction policy
    }
  };

  // Check if a time slot is already taken for selected barber and date
  const isTimeSlotTaken = (time: string) => {
    return appointments.some(
      (apt) =>
        apt.barberId === selectedBarberId &&
        apt.date === selectedDate &&
        apt.time === time &&
        apt.status === 'CONFIRMED'
    );
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || '(21) 99887-6655',
      cardCode: cardCode.trim() || undefined,
      barberId: selectedBarber.id,
      barberName: selectedBarber.name,
      serviceName: selectedServiceName,
      date: selectedDate,
      time: selectedTime,
      createdAt: new Date().toISOString(),
      status: 'CONFIRMED',
    };

    onAddAppointment(newApt);
    playConfirmationChime();
    playAppointmentAlert();

    const toastData = {
      id: `toast-${Date.now()}`,
      title: '✨ AGENDAMENTO CONFIRMADO COM SUCESSO!',
      message: `Mensagem de agendamento gerada para ${clientName.trim()}`,
      barberName: selectedBarber.name,
      date: selectedDate,
      time: selectedTime,
      serviceName: selectedServiceName,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      cardCode: cardCode.trim() || undefined,
    };

    setToastNotification(toastData);
    setSuccessFeedback(`Horário agendado com sucesso! Barbeiro: ${selectedBarber.name} às ${selectedTime} (${selectedDate}).`);

    // Auto switch tab to appointment list
    setTimeout(() => {
      setActiveTab('list');
    }, 2500);
  };

  const formatWhatsAppMessage = (apt: {
    clientName: string;
    barberName: string;
    date: string;
    time: string;
    serviceName: string;
    clientPhone?: string;
    cardCode?: string;
  }) => {
    return `💈 *BARBEARIA DED BLACK - CONFIRMAÇÃO DE AGENDAMENTO* 💈\n\n` +
      `👤 *Cliente:* ${apt.clientName}\n` +
      `✂️ *Barbeiro Escolhido:* ${apt.barberName}\n` +
      `⏰ *Horário:* ${apt.time}\n` +
      `📅 *Data:* ${apt.date}\n` +
      `💈 *Serviço:* ${apt.serviceName}\n` +
      (apt.cardCode ? `💳 *Cartão D•B:* ${apt.cardCode}\n` : '') +
      `\n📍 *Endereço:* Barbearia Ded Black - Unidade Principal\n` +
      `⚠️ *Tolerância:* 10 minutos improrrogáveis.`;
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleAttemptCancel = (apt: Appointment) => {
    // Calculate hours between now and appointment date/time
    const aptDateTime = new Date(`${apt.date}T${apt.time}:00`);
    const now = new Date();
    const diffInMinutes = (aptDateTime.getTime() - now.getTime()) / (1000 * 60);

    const isLateCancellation = diffInMinutes < 120; // less than 2 hours (120 mins)

    if (isLateCancellation) {
      setCancelNotice({
        id: apt.id,
        message: `Atenção: Falta menos de 2 horas (${Math.max(0, Math.round(diffInMinutes))} min) para este horário. Segundo a Regra #4 do contrato D•B, cancelamentos com menos de 2h de antecedência perdem a sessão do ciclo.`,
        isLate: true,
      });
    } else {
      setCancelNotice({
        id: apt.id,
        message: `Cancelamento dentro da tolerância de antecedência (>2h). O seu saldo continuará 100% intacto!`,
        isLate: false,
      });
    }
  };

  const confirmCancel = (aptId: string) => {
    onCancelAppointment(aptId);
    setCancelNotice(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {/* CONFIRMATION MESSAGE POPUP / TOAST NOTIFICATION */}
      {(toastNotification || selectedAppointmentForMsg) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
          <div className="bg-[#151515] border-2 border-[#556b2f] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-stone-100 relative overflow-hidden backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-[#556b2f]/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#556b2f] text-black flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                    📩 Mensagem de Agendamento Recebida!
                  </h4>
                  <p className="text-[10px] text-[#556b2f] font-mono">
                    Confirmação do Horário &amp; Barbeiro Escolhido
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setToastNotification(null);
                  setSelectedAppointmentForMsg(null);
                }}
                className="p-1 rounded text-stone-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRE-FORMATTED MESSAGE DISPLAY BOX */}
            <div className="bg-[#0a0a0a] border border-[#556b2f]/40 rounded-xl p-4 font-mono text-xs space-y-2 text-stone-200 leading-relaxed shadow-inner">
              <div className="text-amber-400 font-bold text-center border-b border-white/10 pb-2 mb-2">
                💈 BARBEARIA DED BLACK - AGENDAMENTO CONFIRMADO 💈
              </div>

              {(() => {
                const info = toastNotification || selectedAppointmentForMsg!;
                return (
                  <>
                    <p className="flex items-center justify-between">
                      <span className="text-stone-400">👤 Cliente:</span>
                      <strong className="text-white">{info.clientName}</strong>
                    </p>
                    <p className="flex items-center justify-between bg-[#556b2f]/20 p-2 rounded border border-[#556b2f]/40">
                      <span className="text-stone-300 font-bold">✂️ Barbeiro Escolhido:</span>
                      <strong className="text-[#556b2f] font-serif text-sm">{info.barberName}</strong>
                    </p>
                    <p className="flex items-center justify-between bg-amber-950/30 p-2 rounded border border-amber-500/30">
                      <span className="text-stone-300 font-bold">⏰ Horário Reservado:</span>
                      <strong className="text-amber-300 font-mono text-sm">{info.time} hrs ({info.date})</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-stone-400">💈 Serviço:</span>
                      <strong className="text-white">{info.serviceName}</strong>
                    </p>
                    {info.cardCode && (
                      <p className="flex items-center justify-between">
                        <span className="text-stone-400">💳 Cartão D•B:</span>
                        <strong className="text-emerald-400">{info.cardCode}</strong>
                      </p>
                    )}
                    <div className="border-t border-white/10 pt-2 mt-2 text-[10px] text-stone-400 italic">
                      📍 Endereço: Barbearia Ded Black - Unidade Principal<br />
                      ⚠️ Tolerância máxima de atraso: 10 minutos.
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {(() => {
                const info = toastNotification || selectedAppointmentForMsg!;
                const msgText = formatWhatsAppMessage(info);
                const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msgText)}`;

                return (
                  <>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                    >
                      <Send className="w-4 h-4" />
                      Enviar no WhatsApp
                    </a>

                    <button
                      onClick={() => handleCopyMessage(msgText)}
                      className="py-2.5 px-3 rounded-lg bg-[#556b2f] hover:bg-[#69843a] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition"
                    >
                      {copiedMessage ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar Mensagem
                        </>
                      )}
                    </button>
                  </>
                );
              })()}
            </div>

            <button
              onClick={() => {
                setToastNotification(null);
                setSelectedAppointmentForMsg(null);
              }}
              className="w-full py-2 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition text-center"
            >
              Fechar Visualização da Mensagem
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#121212] border border-[#556b2f]/40 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden relative text-stone-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#0a0a0a] px-6 py-4 border-b border-[#556b2f]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#556b2f]/20 border border-[#556b2f]/50 flex items-center justify-center text-[#556b2f]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white italic flex items-center gap-2">
                Agendamento de Horários D•B
                <span className="text-[10px] bg-[#556b2f] text-black font-sans font-bold px-2 py-0.5 rounded uppercase">
                  Regras Ativas
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Escolha seu barbeiro, verifique a disponibilidade e atente-se às regras de tolerância.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="grid grid-cols-2 bg-[#0c0c0c] border-b border-white/5 p-2 gap-2">
          <button
            onClick={() => setActiveTab('book')}
            className={`py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
              activeTab === 'book'
                ? 'bg-[#556b2f] text-black shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Novo Agendamento
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
              activeTab === 'list'
                ? 'bg-[#556b2f] text-black shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            Meus Horários ({appointments.filter(a => a.status === 'CONFIRMED').length})
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* CRITICAL RULES HIGHLIGHT BANNER */}
          <div className="bg-[#181818] border border-amber-500/30 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              Regras do Contrato D•B (Tolerância &amp; Cancelamentos)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-300 text-[11px] pt-1">
              <div className="bg-[#0a0a0a] p-2.5 rounded border border-white/5">
                <span className="text-white font-bold block mb-0.5 flex items-center gap-1">
                  ⏱️ 10 Minutos de Tolerância
                </span>
                Atrasos superiores a 10 minutos sujeitam o cliente ao remanejamento de horário ou encaixe no final da agenda.
              </div>
              <div className="bg-[#0a0a0a] p-2.5 rounded border border-white/5">
                <span className="text-white font-bold block mb-0.5 flex items-center gap-1">
                  🚫 Cancelamento com 2h Antecedência
                </span>
                Cancelamentos com menos de 2 horas do horário agendado debitarão 1 atendimento do ciclo mensal.
              </div>
            </div>
          </div>

          {/* SUCCESS FEEDBACK TOAST */}
          {successFeedback && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successFeedback}</span>
            </div>
          )}

          {/* TAB 1: FORM TO BOOK APPOINTMENT */}
          {activeTab === 'book' && (
            <form onSubmit={handleBookingSubmit} className="space-y-6">
              {/* 1. Barber Selection */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-2.5 flex items-center justify-between">
                  <span>1. Escolha o Barbeiro D•B</span>
                  <span className="text-stone-500 font-normal text-[10px]">Equipe Especializada</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BARBERS_LIST.map((barber) => {
                    const isSelected = barber.id === selectedBarberId;
                    return (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() => setSelectedBarberId(barber.id)}
                        className={`p-3 rounded-lg border text-left transition flex items-center gap-3 ${
                          isSelected
                            ? 'bg-[#556b2f]/20 border-[#556b2f] text-white shadow-md'
                            : 'bg-[#0a0a0a] border-white/5 hover:border-white/20 text-stone-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-[#1c1c1c] border border-white/10 flex items-center justify-center text-xl shrink-0">
                          {barber.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate text-white">{barber.name}</span>
                            <span className="text-[10px] text-amber-400 font-mono">★ {barber.rating}</span>
                          </div>
                          {barber.specialty && (
                            <span className="text-[10px] text-stone-400 block truncate">{barber.specialty}</span>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#556b2f] text-black flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Service & Date Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-1.5">
                    2. Serviço Exigido
                  </label>
                  <select
                    value={selectedServiceName}
                    onChange={(e) => setSelectedServiceName(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                  >
                    {SERVICES_LIST.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} (Avulso R$ {s.avulsoPrice.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-1.5">
                    3. Data do Atendimento
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                  />
                </div>
              </div>

              {/* 3. Time Slots */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-2 flex items-center justify-between">
                  <span>4. Horários Disponíveis para {selectedBarber.name}</span>
                  <span className="text-[10px] text-stone-400 font-mono">10 min de tolerância</span>
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {AVAILABLE_TIMES.map((time) => {
                    const taken = isTimeSlotTaken(time);
                    const isSelected = selectedTime === time;

                    return (
                      <button
                        key={time}
                        type="button"
                        disabled={taken}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 px-1 rounded text-xs font-mono text-center font-bold transition border ${
                          taken
                            ? 'bg-red-950/20 border-red-900/40 text-red-500/50 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-[#556b2f] border-[#556b2f] text-black shadow-md'
                            : 'bg-[#0a0a0a] border-white/5 hover:border-[#556b2f]/50 text-stone-300'
                        }`}
                      >
                        {time}
                        {taken && <span className="block text-[8px] no-underline">Ocupado</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Client Info Inputs */}
              <div className="bg-[#0a0a0a] p-4 rounded-lg border border-white/5 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">
                  Dados de Confirmação do Atendimento
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Nome do Cliente
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: Lucas Andrade"
                      className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(21) 99887-6655"
                      className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Código do Cartão D•B
                    </label>
                    <input
                      type="text"
                      value={cardCode}
                      onChange={(e) => setCardCode(e.target.value)}
                      placeholder="Ex: DB-8842"
                      className="w-full bg-[#141414] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-lg bg-[#556b2f] hover:bg-[#69843a] text-black font-bold uppercase text-xs tracking-wider transition shadow-xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Agendamento com {selectedBarber.name} ({selectedDate} - {selectedTime})
              </button>
            </form>
          )}

          {/* TAB 2: MY APPOINTMENTS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Horários Agendados na Barbearia
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  Validação Automática de Regra 2H
                </span>
              </div>

              {/* Cancellation Dialog Warning */}
              {cancelNotice && (
                <div
                  className={`p-4 rounded-lg border text-xs space-y-3 ${
                    cancelNotice.isLate
                      ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                      : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-bold text-white text-sm">Confirmação de Cancelamento</p>
                      <p className="mt-1 leading-relaxed text-[11px]">{cancelNotice.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => setCancelNotice(null)}
                      className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                    >
                      Manter Agendamento
                    </button>
                    <button
                      onClick={() => confirmCancel(cancelNotice.id)}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                    >
                      Confirmar Cancelamento
                    </button>
                  </div>
                </div>
              )}

              {appointments.filter((a) => a.status === 'CONFIRMED').length === 0 ? (
                <div className="p-8 text-center bg-[#0a0a0a] rounded-lg border border-white/5 space-y-2">
                  <Calendar className="w-8 h-8 text-stone-500 mx-auto" />
                  <p className="text-stone-300 text-sm font-bold">Nenhum horário agendado no momento</p>
                  <p className="text-stone-500 text-xs">
                    Clique na aba &quot;Novo Agendamento&quot; acima para escolher o seu barbeiro preferido.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments
                    .filter((a) => a.status === 'CONFIRMED')
                    .map((apt) => (
                      <div
                        key={apt.id}
                        className="bg-[#0a0a0a] border border-white/10 hover:border-[#556b2f]/50 p-4 rounded-lg transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{apt.clientName}</span>
                            {apt.cardCode && (
                              <span className="text-[10px] bg-[#556b2f]/20 text-[#556b2f] border border-[#556b2f]/40 px-2 py-0.5 rounded font-mono font-bold">
                                {apt.cardCode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-300 font-medium">
                            💈 Barbeiro: <strong className="text-white">{apt.barberName}</strong> &bull; {apt.serviceName}
                          </p>
                          <p className="text-[11px] text-stone-400 font-mono flex items-center gap-3 pt-0.5">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Calendar className="w-3.5 h-3.5" /> {apt.date}
                            </span>
                            <span className="flex items-center gap-1 text-yellow-400">
                              <Clock className="w-3.5 h-3.5" /> {apt.time}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                          <button
                            onClick={() => setSelectedAppointmentForMsg(apt)}
                            className="px-3 py-2 rounded bg-[#556b2f]/20 hover:bg-[#556b2f]/40 text-[#556b2f] border border-[#556b2f]/40 text-xs font-bold transition flex items-center gap-1.5"
                            title="Ver mensagem detalhada do agendamento"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            Ver Mensagem
                          </button>

                          {(() => {
                            const msgText = formatWhatsAppMessage(apt);
                            const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(msgText)}`;
                            return (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5"
                                title={`Enviar mensagem no WhatsApp do Admin (${ADMIN_WHATSAPP_DISPLAY})`}
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                WhatsApp Admin
                              </a>
                            );
                          })()}
                          <button
                            onClick={() => handleAttemptCancel(apt)}
                            className="px-3 py-2 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#0a0a0a] px-6 py-3 border-t border-white/5 text-[10px] text-stone-500 flex items-center justify-between">
          <span>Barbearia Ded Black &bull; Tolerância Improrrogável: 10 min</span>
          <span className="font-mono">Central de Reservas</span>
        </div>
      </div>
    </div>
  );
};
