import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~1 minuto de tentativas

type CheckStatus = 'checking' | 'confirmed' | 'timeout' | 'error';

interface SessionStatusResponse {
  activated: boolean;
  paymentStatus?: string;
  subscriber?: { cardCode?: string; planName?: string; totalSessions?: number } | null;
  error?: string;
}

/**
 * Tela de retorno do Stripe Checkout. Nunca confia apenas no redirecionamento:
 * consulta o backend (que por sua vez só reflete o que o webhook já confirmou)
 * até a assinatura aparecer realmente ativada, ou desiste após um tempo e
 * orienta o cliente a aguardar/contatar suporte.
 */
export const PaymentSuccessPage: React.FC = () => {
  const [status, setStatus] = useState<CheckStatus>('checking');
  const [subscriber, setSubscriber] = useState<SessionStatusResponse['subscriber']>(null);
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionId = new URLSearchParams(window.location.search).get('session_id') || '';

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    const poll = async (attemptNumber: number) => {
      try {
        const res = await fetch(`/api/stripe/checkout-session-status?session_id=${encodeURIComponent(sessionId)}`);
        const data: SessionStatusResponse = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setStatus('error');
          return;
        }

        if (data.activated) {
          setSubscriber(data.subscriber || null);
          setStatus('confirmed');
          return;
        }

        if (attemptNumber >= MAX_POLLS) {
          setStatus('timeout');
          return;
        }

        setAttempt(attemptNumber + 1);
        timerRef.current = setTimeout(() => poll(attemptNumber + 1), POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    poll(0);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111111] border border-[#38472A]/60 rounded-2xl shadow-2xl p-8 text-center space-y-5">
        {status === 'checking' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h1 className="text-xl font-black text-[#FDFDFD]">Processando pagamento...</h1>
            <p className="text-xs text-stone-400 leading-relaxed">
              Estamos confirmando com o Stripe que o pagamento foi aprovado. Isso costuma levar poucos segundos.
              (tentativa {attempt + 1})
            </p>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-[#FDFDFD]">Pagamento Confirmado!</h1>
            <p className="text-xs text-emerald-400 font-mono font-bold">Sua assinatura foi ativada com sucesso.</p>
            {subscriber?.cardCode && (
              <div className="bg-[#181818] p-4 rounded-xl border border-white/10 text-left space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-400">Código do Cartão:</span>
                  <span className="text-amber-400 font-bold">{subscriber.cardCode}</span>
                </div>
                {subscriber.planName && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Plano:</span>
                    <span className="text-stone-200">{subscriber.planName}</span>
                  </div>
                )}
              </div>
            )}
            <a
              href="/"
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>Voltar para o Ded Black</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-[#FDFDFD]">Ainda confirmando...</h1>
            <p className="text-xs text-stone-400 leading-relaxed">
              O Stripe pode levar um pouco mais para confirmar este pagamento. Sua carteirinha será ativada assim
              que a confirmação chegar — não é necessário pagar novamente. Se o valor foi debitado e a carteirinha
              não ativar em alguns minutos, entre em contato com o suporte.
            </p>
            <a
              href="/"
              className="w-full py-3 px-4 rounded-xl bg-[#202020] hover:bg-[#282828] text-stone-200 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>Voltar para o Ded Black</span>
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-[#FDFDFD]">Não foi possível confirmar</h1>
            <p className="text-xs text-stone-400 leading-relaxed">
              {sessionId
                ? 'Ocorreu um erro ao consultar o status do pagamento. Se o valor foi debitado, entre em contato com o suporte.'
                : 'Link de retorno inválido — nenhuma sessão de pagamento foi identificada.'}
            </p>
            <a
              href="/"
              className="w-full py-3 px-4 rounded-xl bg-[#202020] hover:bg-[#282828] text-stone-200 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>Voltar para o Ded Black</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
};
