import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Lock,
  ShieldCheck,
  X,
  Building,
  CreditCard,
  QrCode
} from 'lucide-react';
import { SubscriberCard } from '../types';
import { auth, getAuthHeaders } from '../lib/firebase';
import { formatCpf, isValidCpf } from '../lib/cpf';

type CheckoutPaymentMethod = 'CREDIT_CARD' | 'PIX';

/** Identificador desta tentativa de checkout, reenviado em duplo clique/retry (idempotência no Stripe). */
function newCheckoutAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

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
 *
 * Pix é cobrança ÚNICA de um ciclo de 30 dias (não há débito automático — veja
 * buildCheckoutSessionParams em stripe-routes.ts). A renovação é gerar um novo Pix por
 * este mesmo modal, tanto no cadastro (PlansCatalog) quanto no admin (ControlCardValidation).
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
  // Default cartão: quem já usa o fluxo hoje não percebe mudança nenhuma.
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('CREDIT_CARD');
  // Editável aqui porque cadastros antigos podem ter CPF vazio ou o placeholder 000.000.000-00.
  const [cpfInput, setCpfInput] = useState(formatCpf(clientCpf || ''));
  const [checkoutAttemptId, setCheckoutAttemptId] = useState(newCheckoutAttemptId);
  // O backend recusou porque o assinante já tem débito automático ativo no cartão.
  const [hasActiveCardSubscription, setHasActiveCardSubscription] = useState(false);
  const [isCancelingAutoRenewal, setIsCancelingAutoRenewal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsRedirecting(false);
      setErrorMessage('');
      setInfoMessage('');
      setHasActiveCardSubscription(false);
      setPaymentMethod('CREDIT_CARD');
    } else {
      setCpfInput(formatCpf(clientCpf || ''));
      setCheckoutAttemptId(newCheckoutAttemptId());
    }
    // Só reinicia ao abrir/fechar — um re-render do pai com o modal aberto não deve
    // apagar o CPF digitado nem trocar a chave de idempotência no meio da tentativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const isPix = paymentMethod === 'PIX';
  const cpfIsValid = isValidCpf(cpfInput);
  const showCpfError = cpfInput.replace(/\D/g, '').length === 11 && !cpfIsValid;

  const formattedPlanAmount = planAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  // Trocar cartão → Pix: sem cancelar o débito automático, o cartão continuaria cobrando
  // todo mês junto com o Pix. O acesso já pago não muda.
  const handleCancelAutoRenewal = async () => {
    if (!subscriberCard?.id) return;
    const ok = window.confirm(
      `Cancelar o débito automático no cartão de ${clientName}? O cartão não será mais cobrado; o período já pago continua valendo e as próximas renovações serão por Pix.`
    );
    if (!ok) return;

    setErrorMessage('');
    setIsCancelingAutoRenewal(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/stripe/cancel-auto-renewal', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscriberId: subscriberCard.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error || 'Não foi possível cancelar o débito automático. Tente novamente.');
        return;
      }
      setHasActiveCardSubscription(false);
      setInfoMessage('Débito automático no cartão cancelado. Agora você pode gerar o Pix.');
    } catch {
      setErrorMessage('Não foi possível cancelar o débito automático. Tente novamente.');
    } finally {
      setIsCancelingAutoRenewal(false);
    }
  };

  const handleGoToStripeCheckout = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!cpfIsValid) {
      setErrorMessage('Informe um CPF válido para continuar.');
      return;
    }
    setIsRedirecting(true);

    try {
      // A rota exige o Firebase ID token (Authorization: Bearer ...).
      const headers = await getAuthHeaders();
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planName,
          serviceName,
          planAmount,
          clientName,
          clientCpf: cpfInput.replace(/\D/g, ''),
          paymentMethod,
          checkoutAttemptId,
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

      if (res.status === 409 && data.code === 'ACTIVE_CARD_SUBSCRIPTION') {
        setHasActiveCardSubscription(true);
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

          {hasActiveCardSubscription && isPix && subscriberCard?.id && (
            <button
              type="button"
              onClick={handleCancelAutoRenewal}
              disabled={isCancelingAutoRenewal}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#202020] hover:bg-[#282828] border border-red-500/40 text-red-200 uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isCancelingAutoRenewal ? 'Cancelando débito automático...' : 'Cancelar débito automático no cartão'}
            </button>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
              Forma de Pagamento
            </span>
            <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
              {([
                { value: 'CREDIT_CARD', label: 'Cartão', Icon: CreditCard },
                { value: 'PIX', label: 'Pix', Icon: QrCode },
              ] as const).map(({ value, label, Icon }) => {
                const selected = paymentMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isRedirecting}
                    onClick={() => { setPaymentMethod(value); setErrorMessage(''); setInfoMessage(''); }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                      selected
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-[#181818] border-white/10 text-stone-400 hover:text-stone-200 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CPF — obrigatório e validado para os dois métodos */}
          <div>
            <label htmlFor="payment-cpf" className="text-[11px] font-bold uppercase tracking-wider text-stone-300 block mb-1">
              CPF do Titular *
            </label>
            <input
              id="payment-cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpfInput}
              onChange={(e) => setCpfInput(formatCpf(e.target.value))}
              disabled={isRedirecting}
              aria-invalid={showCpfError}
              className={`w-full bg-[#0a0a0a] text-stone-100 text-xs rounded px-3.5 py-2.5 border focus:outline-none ${
                showCpfError ? 'border-red-500/70 focus:border-red-400' : 'border-[#94a288]/30 focus:border-[#94a288]'
              }`}
            />
            {showCpfError && <p className="text-[11px] text-red-300 mt-1">CPF inválido — confira os dígitos.</p>}
            {!cpfIsValid && !showCpfError && (
              <p className="text-[11px] text-stone-500 mt-1">
                {isPix ? 'O Pix exige o CPF real do pagador.' : 'Informe o CPF real do titular da assinatura.'}
              </p>
            )}
          </div>

          {/* Box de Segurança */}
          {isPix ? (
            <div className="p-3.5 bg-[#181818] rounded-xl border border-white/5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-stone-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pagamento via Pix — cobrança única deste ciclo de 30 dias</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Você será redirecionado para a página segura do <strong className="text-stone-200">Stripe</strong>, que
                mostra o QR code / código Pix copia e cola. O código vale por 1 hora.
              </p>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Pagamento único de <strong className="text-stone-200 font-mono">R$ {planAmount.toFixed(2)}</strong>.
                Perto do vencimento você (ou o admin) vai gerar um novo Pix para renovar —{' '}
                <strong className="text-stone-200">não há débito automático</strong>.
              </p>
            </div>
          ) : (
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
          )}

          {/* Botão Pagar */}
          <button
            type="button"
            onClick={handleGoToStripeCheckout}
            disabled={isRedirecting || !cpfIsValid}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-linear-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isRedirecting ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Abrindo Pagamento Seguro...</span>
              </>
            ) : (
              <>
                {isPix ? <QrCode className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>
                  {isPix
                    ? `Pagar com Pix (R$ ${planAmount.toFixed(2)})`
                    : `Ir para Pagamento Stripe (R$ ${planAmount.toFixed(2)})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
