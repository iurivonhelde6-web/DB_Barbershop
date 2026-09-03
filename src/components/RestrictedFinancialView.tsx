import React from 'react';
import { Lock, ShieldCheck, Sparkles, ArrowLeft, Layers, UserCheck } from 'lucide-react';
import { UserAccount } from '../types';

interface RestrictedFinancialViewProps {
  currentUser: UserAccount | null;
  onOpenAdminLogin: () => void;
  onGoToPlans: () => void;
}

export const RestrictedFinancialView: React.FC<RestrictedFinancialViewProps> = ({
  currentUser,
  onOpenAdminLogin,
  onGoToPlans,
}) => {
  return (
    <div className="bg-[#0c0c0c] min-h-[70vh] text-[#e0e0e0] px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-[#151515] border border-amber-500/30 p-8 rounded-2xl shadow-2xl text-center space-y-6 relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-full bg-amber-950/40 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-widest border border-amber-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acesso Restrito ao Administrador
          </span>
          <h2 className="text-2xl font-serif italic text-white pt-1">
            Painel Financeiro &amp; Indicadores
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed pt-1">
            Olá, <strong className="text-white">{currentUser?.name || 'Cliente'}</strong>! O painel de faturamento mensal, margens por atendimento, comissões de barbeiros e projeção de receita são restritos à administração da <strong className="text-[#94a288]">Ded Black Barbershop</strong>.
          </p>
        </div>

        <div className="bg-[#0a0a0a] p-4 rounded-lg border border-white/5 text-left text-xs text-stone-300 space-y-2">
          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
            🔒 O que está protegido nesta área:
          </span>
          <ul className="space-y-1.5 text-stone-400 text-[11px] list-disc list-inside">
            <li>Faturamento mensal total e margens brutas</li>
            <li>Taxas de ocupação da equipe de barbeiros</li>
            <li>Projeção de receita recorrente (MRR)</li>
            <li>Repasse de comissões por colaborador</li>
          </ul>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onOpenAdminLogin}
            className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase text-xs tracking-wider transition shadow-lg flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Fazer Login como Administrador
          </button>

          <button
            onClick={onGoToPlans}
            className="w-full py-2.5 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 text-stone-300 font-bold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4 text-[#94a288]" />
            Ver Catálogo de Assinaturas
          </button>
        </div>
      </div>
    </div>
  );
};
