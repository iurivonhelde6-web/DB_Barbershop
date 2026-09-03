import React, { useEffect } from 'react';
import { Bell, CheckCircle2, DollarSign, Calendar, User, Phone, X, Volume2, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { playAppointmentAlert, playPaymentAlert, unlockAudioAndTest } from '../utils/soundAlert';

export interface AdminNotification {
  id: string;
  type: 'APPOINTMENT' | 'PAYMENT';
  title: string;
  clientName: string;
  clientPhone?: string;
  serviceOrPlan: string;
  barberName?: string;
  dateOrPaymentDate: string;
  time?: string;
  amount?: number;
  paymentMethod?: string;
  cardCode?: string;
  timestamp: string;
}

interface AdminNotificationToastProps {
  notification: AdminNotification | null;
  onClose: () => void;
  adminPhone?: string;
}

export const AdminNotificationToast: React.FC<AdminNotificationToastProps> = ({
  notification,
  onClose,
  adminPhone = '5521998876655',
}) => {
  useEffect(() => {
    if (!notification) return;

    // Automatically trigger audio alert sound on arrival
    if (notification.type === 'APPOINTMENT') {
      playAppointmentAlert();
    } else {
      playPaymentAlert();
    }
  }, [notification]);

  if (!notification) return null;

  const isAppointment = notification.type === 'APPOINTMENT';

  // Format WhatsApp admin alert message
  const formatAdminWhatsAppMessage = () => {
    let msg = '';
    if (isAppointment) {
      msg = `🚨 *NOVO AGENDAMENTO D•B CLUB!*\n\n` +
        `👤 *Cliente:* ${notification.clientName}\n` +
        `📱 *Telefone:* ${notification.clientPhone || 'Não informado'}\n` +
        `✂️ *Serviço:* ${notification.serviceOrPlan}\n` +
        `💈 *Barbeiro:* ${notification.barberName || 'Ded Black'}\n` +
        `📅 *Data/Hora:* ${notification.dateOrPaymentDate} às ${notification.time || 'Horário agendado'}\n` +
        (notification.cardCode ? `💳 *Cartão Mapeado:* ${notification.cardCode}\n` : '') +
        `\n📌 *Notificação recebida via Painel Admin D•B.*`;
    } else {
      msg = `💰 *NOVA ASSINATURA & PAGAMENTO CONFIRMADO!*\n\n` +
        `👤 *Cliente:* ${notification.clientName}\n` +
        `📱 *Telefone:* ${notification.clientPhone || 'Não informado'}\n` +
        `🏆 *Plano Assinado:* ${notification.serviceOrPlan}\n` +
        `💵 *Valor Quitado:* R$ ${notification.amount?.toFixed(2) || '0.00'}\n` +
        `💳 *Forma de Pagamento:* ${notification.paymentMethod || 'PIX/Cartão'}\n` +
        `📅 *Data da Transação:* ${notification.dateOrPaymentDate}\n` +
        (notification.cardCode ? `🎟️ *Código do Cartão:* ${notification.cardCode}\n` : '') +
        `\n📌 *Assinatura ativada no sistema D•B BARBERSHOP!*`;
    }

    const cleanPhone = (notification.clientPhone || adminPhone).replace(/\D/g, '');
    const phoneToUse = cleanPhone.length >= 10 ? (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`) : adminPhone;
    return `https://wa.me/${phoneToUse}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[9999] max-w-md w-[calc(100vw-2rem)] animate-bounce-in shadow-2xl">
      <div className={`rounded-xl border p-4 backdrop-blur-xl ${
        isAppointment 
          ? 'bg-[#121810]/95 border-[#94a288] text-stone-100 shadow-[#94a288]/20' 
          : 'bg-[#1c1808]/95 border-yellow-500 text-stone-100 shadow-yellow-500/20'
      } border-2`}>
        
        {/* Header bar with animated icon and sound pulse */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isAppointment ? 'bg-[#94a288]/30 text-[#94a288]' : 'bg-yellow-500/30 text-yellow-400'} animate-pulse`}>
              {isAppointment ? <Calendar className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                  isAppointment ? 'bg-[#94a288] text-black' : 'bg-yellow-500 text-black'
                }`}>
                  ALERTA SONORO ENVIADO
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isAppointment ? 'bg-[#94a288]' : 'bg-yellow-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isAppointment ? 'bg-[#94a288]' : 'bg-yellow-500'}`}></span>
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                {notification.title}
              </h4>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            title="Fechar Notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Details Card */}
        <div className="space-y-2 text-xs font-medium text-stone-300">
          <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
            <span className="flex items-center gap-1.5 text-stone-400">
              <User className="w-3.5 h-3.5 text-stone-400" /> Cliente:
            </span>
            <span className="font-bold text-white text-sm">{notification.clientName}</span>
          </div>

          {notification.clientPhone && (
            <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
              <span className="flex items-center gap-1.5 text-stone-400">
                <Phone className="w-3.5 h-3.5 text-stone-400" /> Contato:
              </span>
              <span className="font-mono text-stone-200">{notification.clientPhone}</span>
            </div>
          )}

          <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
            <span className="flex items-center gap-1.5 text-stone-400">
              {isAppointment ? <Calendar className="w-3.5 h-3.5 text-[#94a288]" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-400" />} 
              {isAppointment ? 'Serviço / Barbeiro:' : 'Plano Assinado:'}
            </span>
            <span className="font-bold text-stone-100">
              {notification.serviceOrPlan} {notification.barberName ? `(${notification.barberName})` : ''}
            </span>
          </div>

          {isAppointment ? (
            <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
              <span className="text-stone-400">Data e Horário:</span>
              <span className="font-bold text-yellow-400 font-mono">
                {notification.dateOrPaymentDate} às {notification.time}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
              <span className="text-stone-400">Valor Quitado:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                R$ {notification.amount?.toFixed(2)} ({notification.paymentMethod})
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <button
            onClick={() => unlockAudioAndTest(isAppointment ? 'appointment' : 'payment')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/5 hover:bg-white/10 text-stone-300 text-[10px] font-bold transition border border-white/10"
            title="Tocar som novamente"
          >
            <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
            <span>Ouvir Som</span>
          </button>

          <a
            href={formatAdminWhatsAppMessage()}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded font-bold text-[11px] transition uppercase tracking-wider ${
              isAppointment
                ? 'bg-[#94a288] hover:bg-[#6b873b] text-black shadow-lg shadow-[#94a288]/30'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/30'
            }`}
          >
            <span>Notificar no WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
