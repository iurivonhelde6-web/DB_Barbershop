import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Lock,
  ShieldCheck,
  X,
  Building
} from 'lucide-react';
import { SubscriberCard } from '../types';
import { auth } from '../lib/firebase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  serviceName: string;
  planAmount: number;
  clientName: string;
  clientCpf: string;
  clientPhone?: string;
  subscriberCard?: SubscriberCard | null;
  onPaymentSuccess: (paymentData: {
    paidAmount: number;
    paymentMethod: 'PIX' | 'CREDIT_CARD';
    transactionId: string;
    paymentDate: string;
  }) => void;
}

/**
 * Este modal NUNCA coleta número de cartão, validade ou CVV. Ele só reúne os dados
 * da assinatura e redireciona o cliente para o Stripe Checkout — a página hospedada
 * pelo próprio Stripe é quem captura o cartão. A confirmação real do pagamento
 * (e a ativação da assinatura no Firestore) só acontece depois, via webhook,
 * quando o cliente retorna em /pagamento-sucesso.
 */
export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  planName,
  serviceName,
  planAmount,
  clientName,
  clientCpf,
  clientPhone,
  subscriberCard,
}) => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsRedirecting(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formattedPlanAmount = planAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const handleGoToStripeCheckout = async () => {
    setErrorMessage('');
    setIsRedirecting(true);

    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          serviceName,
          planAmount,
          clientName,
          clientCpf,
          clientPhone: clientPhone || subscriberCard?.phone || '',
          subscriberId: subscriberCard?.id,
          cardCode: subscriberCard?.cardCode,
          userUid: auth.currentUser?.uid || '',
        }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('Falha na resposta do servidor ao iniciar o pagamento.');
      }

      if (!res.ok || !data.url) {
        setErrorMessage(data.error || 'Não foi possível iniciar o pagamento no Stripe. Tente novamente.');
        setIsRedirecting(false);
        return;
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('[Stripe Checkout Error]:', err);
      setErrorMessage(err?.message || 'Não foi possível iniciar o pagamento. Tente novamente.');
      setIsRedirecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#38472A]/60 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-[#38472A]/40 flex items-center justify-between bg-linear-to-r from-[#182013] to-[#111111]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#FDFDFD] tracking-tight flex items-center gap-2">
                <span>Pagamento e Liberação</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] uppercase font-extrabold border border-amber-500/30">
                  DB Barbershop
                </span>
              </h3>
              <p className="text-xs text-[#A4A9A5]">Checkout Seguro &bull; {planName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Resumo do Plano */}
          <div className="p-4 rounded-xl bg-[#161c13] border border-[#38472A]/50 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                Plano Selecionado
              </span>
              <h4 className="font-black text-lg text-[#FDFDFD]">{planName}</h4>
              <p className="text-xs text-[#A4A9A5]">{serviceName}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#A4A9A5] block">Valor Mensal</span>
              <span className="text-xl font-black text-amber-400 font-mono">{formattedPlanAmount}</span>
            </div>
          </div>

          {/* Alerta de Erro */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5 shadow-md">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Box de Segurança */}
          <div className="p-3.5 bg-[#181818] rounded-xl border border-white/5 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-stone-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Assinatura Recorrente Mensal Automática</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Você será redirecionado para a página segura do <strong className="text-stone-200">Stripe</strong>, onde informa
              os dados do cartão diretamente ao gateway de pagamento. Este site nunca recebe ou armazena número de
              cartão, validade ou CVV.
            </p>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Cobrança no valor de <strong className="text-stone-200 font-mono">R$ {planAmount.toFixed(2)}</strong> renovada a cada 30 dias.
            </p>
          </div>

          {/* Botão Pagar */}
          <button
            type="button"
            onClick={handleGoToStripeCheckout}
            disabled={isRedirecting}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-linear-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isRedirecting ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Abrindo Pagamento Seguro...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Ir para Pagamento Stripe (R$ {planAmount.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
