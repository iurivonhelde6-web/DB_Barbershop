import React from 'react';
import { XCircle, ArrowRight } from 'lucide-react';

export const PaymentCancelledPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111111] border border-[#38472A]/60 rounded-2xl shadow-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-stone-800/60 border-2 border-stone-700 flex items-center justify-center text-stone-400">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-[#FDFDFD]">Pagamento Cancelado</h1>
        <p className="text-xs text-stone-400 leading-relaxed">
          Você saiu do checkout do Stripe antes de concluir o pagamento. Nenhum valor foi cobrado e nenhuma
          assinatura foi criada. Você pode tentar novamente quando quiser.
        </p>
        <a
          href="/"
          className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
        >
          <span>Voltar para o Ded Black</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
