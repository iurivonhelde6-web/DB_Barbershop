import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Copy,
  Check,
  ShieldCheck,
  X,
  Sparkles,
  ArrowRight,
  Receipt,
  Building,
  Printer
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { SubscriberCard } from '../types';

// Inicializa o Stripe SDK do Frontend com a chave pública
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
      console.log('[Stripe Elements] Criando SetupIntent no servidor...');
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

      const setupData = await setupRes.json();

      if (!setupRes.ok || !setupData.clientSecret) {
        setErrorMessage(setupData.error || 'Erro ao preparar ambiente seguro de cartão.');
        setIsProcessing(false);
        return;
      }

      let paymentMethodId = `pm_mock_${Date.now()}`;
      let cardLast4 = '4242';
      let cardBrand = 'VISA';

      // ETAPA 2: Se o SDK do Stripe estiver ativo com chave real, confirma o SetupIntent no iframe isolado
      if (stripe && elements && !setupData.mockMode) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          setErrorMessage('Elemento de cartão do Stripe não encontrado.');
          setIsProcessing(false);
          return;
        }

        console.log('[Stripe Elements] Confirmando SetupIntent no iframe isolado do Stripe (PCI-DSS)...');
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
          console.error('[Stripe Elements Error]:', setupResult.error);
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

      // ETAPA 3: Enviar APENAS o PaymentMethod ID para o backend criar a Assinatura Recorrente
      console.log('[Stripe Subscriptions] Enviando PaymentMethod ID para ativação de assinatura recorrente...');
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

      const subData = await subRes.json();

      if (!subRes.ok || !subData.success) {
        setErrorMessage(subData.error || 'Falha ao processar assinatura recorrente no Stripe.');
        setIsProcessing(false);
        return;
      }

      if (subData.paymentClientSecret) {
        if (!stripe) {
          throw new Error('Stripe não foi inicializado no navegador.');
        }
        const paymentResult = await stripe.confirmCardPayment(subData.paymentClientSecret);
        if (paymentResult.error) {
          throw new Error(paymentResult.error.message || 'O pagamento inicial foi recusado.');
        }
        if (paymentResult.paymentIntent?.status !== 'succeeded') {
          throw new Error('O pagamento inicial ainda não foi confirmado.');
        }
      }

      const transactionId = subData.transactionId || `STRIPE-${subData.stripeSubscriptionId}`;
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
        method: `Cartão Recorrente Stripe Elements (${cardBrand} •••• ${cardLast4})`,
      });

      onPaymentSuccess(result);
    } catch (err: any) {
      console.error('[Stripe Process Error]:', err);
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
          placeholder="COMO IMPRESSO NO CARTÃO"
          className="w-full bg-[#181818] border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-mono placeholder:text-stone-600 uppercase"
          disabled={isProcessing}
        />
      </div>

      {/* Stripe Elements Card Input (Iframe Isolado PCI-DSS) */}
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

      {/* Destaque de Recorrência e Segurança */}
      <div className="p-3 bg-[#181818] rounded-xl border border-white/5 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-stone-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Assinatura Recorrente Mensal Automática</span>
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          Os dados do seu cartão são criptografados diretamente pelos servidores do Stripe. A cobrança no valor de{' '}
          <strong className="text-stone-200 font-mono">R$ {planAmount.toFixed(2)}</strong> será renovada a cada 30 dias com cancelamento simplificado.
        </p>
      </div>

      {/* Botão de Confirmação */}
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {isProcessing ? (
          <>
            <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
            <span>Processando via Stripe...</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span>Ativar Assinatura Recorrente (R$ {planAmount.toFixed(2)})</span>
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
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

  // PIX State
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixAmountInput, setPixAmountInput] = useState<string>(planAmount.toFixed(2));

  // Status & Feedback State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentCompleteData, setPaymentCompleteData] = useState<{
    transactionId: string;
    paymentDate: string;
    paidAmount: number;
    method: string;
  } | null>(null);

  if (!isOpen) return null;

  const pixCopyCode = `00020126580014BR.GOV.BCB.PIX0136dedblack@barbershop.com.br5204000053039865405${planAmount.toFixed(2).replace('.', '')}5802BR5920DED BLACK BARBERSHOP6009RIO DE JANEIRO62070503***63048A1F`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCopyCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const formattedPlanAmount = planAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const parsedPixAmount = parseFloat(pixAmountInput.replace(',', '.'));

  const handleProcessPixPayment = async () => {
    setErrorMessage('');

    if (isNaN(parsedPixAmount) || Math.abs(parsedPixAmount - planAmount) > 0.01) {
      setErrorMessage(
        `⚠️ O valor digitado (R$ ${isNaN(parsedPixAmount) ? '0,00' : parsedPixAmount.toFixed(2)}) é diferente do valor do plano escolhido (${formattedPlanAmount}). Para liberar a carteirinha, o pagamento deve ser no valor exato do plano.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const intentRes = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          planAmount: parsedPixAmount,
          clientName,
          clientCpf,
          paymentMethod: 'PIX',
        }),
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        setErrorMessage(intentData.error || 'PIX não está disponível neste momento.');
        setIsProcessing(false);
        return;
      }

      setErrorMessage('PIX ainda não está integrado a um provedor de pagamento real. Nenhum pagamento foi registrado.');
      setIsProcessing(false);
      return;
    } catch (err: any) {
      console.error('Erro na chamada da API de pagamento PIX:', err);
      setIsProcessing(false);
      setErrorMessage(err?.message || 'Não foi possível iniciar o pagamento PIX.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#111111] border border-[#38472A]/60 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
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
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Se o pagamento já tiver sido concluído com sucesso */}
        {paymentCompleteData ? (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-black text-[#FDFDFD] tracking-tight">
                Pagamento Confirmado!
              </h4>
              <p className="text-xs text-emerald-400 font-mono font-bold">
                Sua assinatura foi ativada com sucesso.
              </p>
            </div>

            {/* Recibo do Comprovante */}
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
                <span className="text-emerald-400 font-bold">
                  R$ {paymentCompleteData.paidAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Método:</span>
                <span className="text-stone-200">{paymentCompleteData.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Data / Hora:</span>
                <span className="text-stone-300">{paymentCompleteData.paymentDate}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-3 px-4 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
              >
                <span>Acessar Carteirinha</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Resumo do Plano Selecionado */}
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
                <span className="text-xl font-black text-amber-400 font-mono">
                  {formattedPlanAmount}
                </span>
              </div>
            </div>

            {/* Alternador de Método de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition cursor-pointer ${
                  paymentMethod === 'PIX'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-[#181818] text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>PIX (Instantâneo)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition cursor-pointer ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-[#181818] text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão Recorrente (Stripe)</span>
              </button>
            </div>

            {/* Mensagem de Erro, se houver */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5 shadow-md">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Conteúdo por Método Selecionado */}
            {paymentMethod === 'PIX' ? (
              <div className="space-y-4">
                {/* QR Code Simulado PIX */}
                <div className="bg-[#181818] p-5 rounded-2xl border border-stone-800 text-center space-y-3">
                  <div className="inline-block p-3 bg-white rounded-xl shadow-inner">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        pixCopyCode
                      )}`}
                      alt="QR Code PIX Ded Black"
                      className="w-40 h-40 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-stone-400 font-mono">
                    Escaneie o QR Code no seu aplicativo do banco para pagar{' '}
                    <strong className="text-amber-400">{formattedPlanAmount}</strong>
                  </p>
                </div>

                {/* Copia e Cola PIX */}
                <div className="space-y-1.5">
                  <label className="text-xs text-stone-300 font-medium flex items-center justify-between">
                    <span>Código PIX Copia e Cola</span>
                    {copiedPix && (
                      <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copiado!
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixCopyCode}
                      className="w-full bg-[#181818] border border-stone-800 rounded-xl px-3 py-2 text-stone-400 text-xs font-mono select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                {/* Confirmação de Valor Pago no PIX */}
                <div className="space-y-1.5 pt-2 border-t border-stone-800">
                  <label className="text-xs text-stone-300 font-medium">
                    Confirme o valor exato pago via PIX (R$)
                  </label>
                  <input
                    type="text"
                    value={pixAmountInput}
                    onChange={(e) => setPixAmountInput(e.target.value)}
                    placeholder="Ex: 120,00"
                    className="w-full bg-[#181818] border border-stone-800 rounded-xl px-3.5 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <p className="text-[11px] text-stone-500">
                    Sua carteirinha só será liberada se o valor pago for estritamente igual ao do plano.
                  </p>
                </div>

                {/* Botão Processar PIX */}
                <button
                  type="button"
                  onClick={handleProcessPixPayment}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                      <span>Validando PIX...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmar Pagamento PIX e Liberar Carteirinha</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Formulário Stripe Elements para Cartão de Crédito */
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};
