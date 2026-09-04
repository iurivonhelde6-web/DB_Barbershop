import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  X,
  ArrowRight,
  Building
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { SubscriberCard } from '../types';

// Inicializa o Stripe SDK do Frontend com a chave pública do arquivo .env
const stripePublicKey = (import.meta as any).env?.VITE_STRIPE_PUBLIC_KEY as string | undefined;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

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

// Subcomponente de Formulário de Cartão via Stripe Elements
const StripeCardForm: React.FC<{
  planName: string;
  planAmount: number;
  clientName: string;
  clientCpf: string;
  clientPhone?: string;
  subscriberCard?: SubscriberCard | null;
  setIsProcessing: (val: boolean) => void;
  setErrorMessage: (msg: string) => void;
  setPaymentCompleteData: (data: {
    transactionId: string;
    paymentDate: string;
    paidAmount: number;
    method: string;
  }) => void;
  onPaymentSuccess: (data: {
    paidAmount: number;
    paymentMethod: 'PIX' | 'CREDIT_CARD';
    transactionId: string;
    paymentDate: string;
  }) => void;
  isProcessing: boolean;
}> = ({
  planName,
  planAmount,
  clientName,
  clientCpf,
  clientPhone,
  subscriberCard,
  setIsProcessing,
  setErrorMessage,
  setPaymentCompleteData,
  onPaymentSuccess,
  isProcessing,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardHolder, setCardHolder] = useState(clientName || '');

  // Validação: Se a chave pública do Stripe não estiver configurada
  if (!stripePublicKey) {
    return (
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Configuração Pendente do Stripe</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-300/80">
          A chave pública <code>VITE_STRIPE_PUBLIC_KEY</code> não foi encontrada no seu arquivo <code>.env</code> ou na Vercel. Adicione a chave para ativar os pagamentos via Cartão de Crédito.
        </p>
      </div>
    );
  }

  const handleProcessStripePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!cardHolder.trim()) {
      setErrorMessage('Por favor, informe o nome do titular como impresso no cartão.');
      return;
    }

    setIsProcessing(true);

    try {
      // ETAPA 1: Solicitar clientSecret do SetupIntent ao backend
      const setupRes = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientCpf,
          planName,
          clientEmail: subscriberCard?.email || `${clientCpf.replace(/\D/g, '')}@dedblack.com.br`,
        }),
      });

      let setupData: any;
      try {
        setupData = await setupRes.json();
      } catch {
        throw new Error('Servidor indisponível ou rota /api/stripe/setup-intent não encontrada.');
      }

      if (!setupRes.ok || !setupData.clientSecret) {
        setErrorMessage(setupData.error || 'Erro ao preparar ambiente seguro de cartão.');
        setIsProcessing(false);
        return;
      }

      let paymentMethodId = `pm_mock_${Date.now()}`;
      let cardLast4 = '4242';
      let cardBrand = 'VISA';

      // ETAPA 2: Confirmar o cartão através do SDK da Stripe
      if (stripe && elements && !setupData.mockMode) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          setErrorMessage('Elemento de cartão do Stripe não foi carregado corretamente.');
          setIsProcessing(false);
          return;
        }

        const setupResult = await stripe.confirmCardSetup(setupData.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: cardHolder,
              email: subscriberCard?.email || `${clientCpf.replace(/\D/g, '')}@dedblack.com.br`,
            },
          },
        });

        if (setupResult.error) {
          setErrorMessage(setupResult.error.message || 'Cartão recusado pelo emissor.');
          setIsProcessing(false);
          return;
        }

        if (setupResult.setupIntent && setupResult.setupIntent.payment_method) {
          paymentMethodId = typeof setupResult.setupIntent.payment_method === 'string'
            ? setupResult.setupIntent.payment_method
            : setupResult.setupIntent.payment_method.id;
        }
      }

      // ETAPA 3: Ativar a Assinatura Recorrente no Backend
      const subRes = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId,
          clientName,
          clientCpf,
          clientEmail: subscriberCard?.email || `${clientCpf.replace(/\D/g, '')}@dedblack.com.br`,
          clientPhone: clientPhone || subscriberCard?.phone || '',
          planName,
          planAmount,
          subscriberId: subscriberCard?.id,
          cardCode: subscriberCard?.cardCode,
        }),
      });

      let subData: any;
      try {
        subData = await subRes.json();
      } catch {
        throw new Error('Falha na resposta do servidor de assinatura.');
      }

      if (!subRes.ok || !subData.success) {
        setErrorMessage(subData.error || 'Falha ao processar assinatura recorrente no Stripe.');
        setIsProcessing(false);
        return;
      }

      if (subData.paymentClientSecret) {
        if (!stripe) {
          throw new Error('Stripe SDK não inicializado.');
        }
        const paymentResult = await stripe.confirmCardPayment(subData.paymentClientSecret);
        if (paymentResult.error) {
          throw new Error(paymentResult.error.message || 'O pagamento inicial foi recusado.');
        }
      }

      const transactionId = subData.transactionId || `STRIPE-${subData.stripeSubscriptionId || Date.now()}`;
      const nowStr = new Date().toLocaleString('pt-BR');

      cardLast4 = subData.cardLast4 || cardLast4;
      cardBrand = subData.cardBrand || cardBrand;

      const result = {
        paidAmount: planAmount,
        paymentMethod: 'CREDIT_CARD' as const,
        transactionId,
        paymentDate: nowStr,
      };

      setIsProcessing(false);
      setPaymentCompleteData({
        transactionId,
        paymentDate: nowStr,
        paidAmount: planAmount,
        method: `Cartão Recorrente Stripe (${cardBrand} •••• ${cardLast4})`,
      });

      onPaymentSuccess(result);
    } catch (err: any) {
      console.error('[Stripe Error]:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Não foi possível concluir o pagamento. Tente novamente.');
    }
  };

  return (
    <form onSubmit={handleProcessStripePayment} className="space-y-4">
      {/* Campo Titular do Cartão */}
      <div className="space-y-1">
        <label className="text-xs text-stone-300 font-medium">Nome no Cartão (Titular)</label>
        <input
          type="text"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
          placeholder="NOME COMO IMPRESSO NO CARTÃO"
          className="w-full bg-[#181818] border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-mono placeholder:text-stone-600 uppercase"
          disabled={isProcessing}
        />
      </div>

      {/* Inputs do Cartão via Stripe Elements */}
      <div className="space-y-1">
        <label className="text-xs text-stone-300 font-medium flex items-center justify-between">
          <span>Dados do Cartão de Crédito</span>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Protegido por Stripe PCI-DSS
          </span>
        </label>
        <div className="bg-[#181818] border border-stone-800 rounded-xl p-3.5 focus-within:border-amber-500 transition-all">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '14px',
                  color: '#FDFDFD',
                  fontFamily: 'monospace, sans-serif',
                  '::placeholder': { color: '#6B7280' },
                  iconColor: '#F59E0B',
                },
                invalid: {
                  color: '#EF4444',
                  iconColor: '#EF4444',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Box de Segurança */}
      <div className="p-3 bg-[#181818] rounded-xl border border-white/5 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-stone-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Assinatura Recorrente Mensal Automática</span>
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          Cobrança no valor de <strong className="text-stone-200 font-mono">R$ {planAmount.toFixed(2)}</strong> renovada a cada 30 dias diretamente pelo Stripe.
        </p>
      </div>

      {/* Botão Pagar */}
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
            <span>Processando Pagamento...</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span>Pagar e Ativar Assinatura (R$ {planAmount.toFixed(2)})</span>
          </>
        )}
      </button>
    </form>
  );
};

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
  onPaymentSuccess,
}) => {
  // Status State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentCompleteData, setPaymentCompleteData] = useState<{
    transactionId: string;
    paymentDate: string;
    paidAmount: number;
    method: string;
  } | null>(null);

  if (!isOpen) return null;

  const formattedPlanAmount = planAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#38472A]/60 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-[#38472A]/40 flex items-center justify-between bg-gradient-to-r from-[#182013] to-[#111111]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#FDFDFD] tracking-tight flex items-center gap-2">
                <span>Pagamento e Liberação</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] uppercase font-extrabold border border-amber-500/30">
                  Ded Black
                </span>
              </h3>
              <p className="text-xs text-[#A4A9A5]">Checkout Seguro • {planName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {paymentCompleteData ? (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-black text-[#FDFDFD]">Pagamento Confirmado!</h4>
              <p className="text-xs text-emerald-400 font-mono font-bold">Sua assinatura foi ativada com sucesso.</p>
            </div>

            <div className="bg-[#181818] p-4 rounded-xl border border-white/10 text-left space-y-2 font-mono text-xs">
              <div className="flex justify-between text-stone-400 border-b border-white/10 pb-2 mb-2">
                <span className="font-bold text-stone-200 uppercase">Comprovante de Transação</span>
                <span className="text-amber-400 font-bold">DED BLACK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">ID da Transação:</span>
                <span className="text-stone-200 font-bold">{paymentCompleteData.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Cliente:</span>
                <span className="text-stone-200">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Plano:</span>
                <span className="text-amber-300 font-bold">{planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Valor Pago:</span>
                <span className="text-emerald-400 font-bold">R$ {paymentCompleteData.paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Método:</span>
                <span className="text-stone-200">{paymentCompleteData.method}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>Acessar Carteirinha</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
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

            {/* Formulário de Cartão de Crédito Stripe Direto */}
            <Elements stripe={stripePromise}>
              <StripeCardForm
                planName={planName}
                planAmount={planAmount}
                clientName={clientName}
                clientCpf={clientCpf}
                clientPhone={clientPhone}
                subscriberCard={subscriberCard}
                setIsProcessing={setIsProcessing}
                setErrorMessage={setErrorMessage}
                setPaymentCompleteData={setPaymentCompleteData}
                onPaymentSuccess={onPaymentSuccess}
                isProcessing={isProcessing}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
};