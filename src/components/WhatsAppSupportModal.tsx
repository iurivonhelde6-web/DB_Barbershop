import React, { useState } from 'react';
import { UserAccount } from '../types';
import { ADMIN_WHATSAPP, ADMIN_WHATSAPP_DISPLAY } from '../data/barberData';
import {
  MessageSquare,
  X,
  ExternalLink,
  ShieldCheck,
  Phone
} from 'lucide-react';

interface WhatsAppSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
}

export const WhatsAppSupportModal: React.FC<WhatsAppSupportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [subject, setSubject] = useState<string>('Dúvida sobre Agendamento / Horário');
  const [customText, setCustomText] = useState<string>('');

  if (!isOpen) return null;

  const defaultMessage = `Olá, Admin Ded Black! Meu nome é ${currentUser?.name || 'Cliente D•B'}${
    currentUser?.cardCode ? ` (Cartão: ${currentUser.cardCode})` : ''
  }.\n\nAssunto: ${subject}.${customText ? `\n\nMensagem: ${customText}` : ''}`;

  const handleOpenWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    const encoded = encodeURIComponent(defaultMessage);
    const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-emerald-500/40 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden relative text-stone-100">
        {/* Header */}
        <div className="bg-emerald-950/60 px-6 py-4 border-b border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-white italic flex items-center gap-2">
                WhatsApp Oficial do Admin D•B
              </h3>
              <p className="text-[11px] text-emerald-200/80">
                Atendimento direto com a administração e recepção principal
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

        {/* Body */}
        <form onSubmit={handleOpenWhatsApp} className="p-6 space-y-5">
          {/* Admin Contact Info Card */}
          <div className="bg-[#0a0a0a] border border-emerald-500/30 rounded-lg p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
                  CONTATO DO ADMINISTRADOR
                </span>
                <p className="text-sm font-bold text-white font-mono">
                  {ADMIN_WHATSAPP_DISPLAY}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/40">
              Online
            </span>
          </div>

          {/* Preset Subject */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-1.5">
              1. Selecione o Assunto:
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Dúvida sobre Agendamento / Horário">Dúvida sobre Agendamento / Horário</option>
              <option value="Ajuste / Remanejamento de Atendimento">Ajuste / Remanejamento de Atendimento</option>
              <option value="Informações dos Planos de Assinatura D•B">Informações dos Planos de Assinatura D•B</option>
              <option value="Consultoria de Visagismo e Estilo">Consultoria de Visagismo e Estilo</option>
              <option value="Suporte Geral da Barbearia">Suporte Geral da Barbearia</option>
            </select>
          </div>

          {/* Optional Extra Notes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-stone-300 block mb-1.5">
              2. Mensagem Adicional (Opcional):
            </label>
            <textarea
              rows={2}
              placeholder="Digite sua dúvida ou detalhes sobre seu atendimento..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Message Preview Box */}
          <div className="bg-[#0a0a0a] p-3 rounded-lg border border-white/5 space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 block">
              💬 Pré-visualização da mensagem:
            </span>
            <p className="text-[11px] text-stone-300 font-mono italic whitespace-pre-line leading-snug">
              &quot;{defaultMessage}&quot;
            </p>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-xs tracking-wider transition shadow-xl flex items-center justify-center gap-2 group"
          >
            <MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>Abrir Conversa no WhatsApp com o Admin ({ADMIN_WHATSAPP_DISPLAY})</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-200 opacity-70" />
          </button>
        </form>

        {/* Footer */}
        <div className="bg-[#0a0a0a] px-6 py-2.5 border-t border-white/5 text-[10px] text-stone-500 flex items-center justify-between">
          <span>Ded Black Barbershop &bull; Suporte Oficial do Admin</span>
          <span className="font-mono text-emerald-400 font-bold">{ADMIN_WHATSAPP_DISPLAY}</span>
        </div>
      </div>
    </div>
  );
};
