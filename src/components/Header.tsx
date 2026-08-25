import React from 'react';
import { Scissors, ShieldCheck, Sparkles, CreditCard, FileText, Bot, Layers, User, Lock, LogIn, Calendar, MessageSquare, UserPlus } from 'lucide-react';
import { UserAccount } from '../types';
import { DbLogo } from './DbLogo';

interface HeaderProps {
  activeTab: 'plans' | 'calculator' | 'checkin' | 'rules' | 'ai';
  setActiveTab: (tab: 'plans' | 'calculator' | 'checkin' | 'rules' | 'ai') => void;
  activeSubscribersCount: number;
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onOpenBooking: () => void;
  onOpenWhatsApp: () => void;
  onOpenRegister?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeSubscribersCount,
  currentUser,
  onOpenLogin,
  onOpenBooking,
  onOpenWhatsApp,
  onOpenRegister,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isClient = currentUser?.role === 'client';

  return (
    <header className="sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-[#556b2f]/30 text-stone-100">
      {/* Top Banner */}
      <div className="bg-[#0c0c0c] text-stone-300 text-[11px] py-1.5 px-3 sm:px-4 font-medium flex flex-wrap items-center justify-between gap-2 border-b border-[#556b2f]/20 uppercase tracking-widest max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#556b2f] animate-pulse shrink-0" />
          <span className="text-[10px] sm:text-[11px] truncate max-w-[180px] xs:max-w-none">
            DED BLACK BARBERSHOP &bull; DB CLUB
          </span>
        </div>

        {/* User Account Login & Register Status Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onOpenRegister && (
            <button
              onClick={onOpenRegister}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded bg-[#556b2f]/30 hover:bg-[#556b2f]/50 border border-[#556b2f]/60 text-[#556b2f] text-[10px] font-bold tracking-wider transition"
            >
              <UserPlus className="w-3 h-3 text-[#556b2f] shrink-0" />
              <span className="hidden xs:inline">Novo </span>
              <span>Cadastro</span>
            </button>
          )}

          <button
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#181818] hover:bg-[#222222] border border-[#556b2f]/40 text-[10px] font-bold tracking-wider text-stone-200 transition group"
          >
          {currentUser ? (
            <>
              <span className={isAdmin ? 'text-yellow-400' : 'text-[#556b2f]'}>
                {isAdmin ? '👑' : '👤'}
              </span>
              <span className="text-white font-mono truncate max-w-[100px] sm:max-w-none">
                {currentUser.name}
              </span>
              <span className="text-stone-400 group-hover:text-white transition text-[9px] hidden xs:inline">
                [Trocar]
              </span>
            </>
          ) : (
            <>
              <LogIn className="w-3 h-3 text-[#556b2f] shrink-0" />
              <span className="text-stone-300">Entrar</span>
            </>
          )}
        </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 sm:gap-4">
            <DbLogo className="w-14 h-14 sm:w-16 sm:h-16 hover:scale-105 transition-transform" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-serif italic tracking-widest text-white">
                  DED BLACK
                </h1>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#556b2f] text-black">
                  BARBERSHOP
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#556b2f] font-bold mt-0.5">
                DB CLUB
              </p>
            </div>
          </div>

          {/* Quick Stats Badge & Action - Desktop */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#151515] border border-[#556b2f]/30 text-xs">
              <div className="w-2 h-2 rounded-full bg-[#556b2f] animate-ping" />
              <span className="text-stone-400 text-[11px] uppercase tracking-wider">Assinantes Ativos:</span>
              <strong className="text-[#556b2f] font-bold">{activeSubscribersCount} Membros</strong>
            </div>

            <button
              onClick={onOpenWhatsApp}
              className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold uppercase text-[11px] tracking-wider transition-colors shadow-md border border-emerald-500/40"
              title="Falar com o barbeiro via WhatsApp"
            >
              <MessageSquare className="w-4 h-4 text-emerald-300" />
              WhatsApp
            </button>

            <button
              onClick={onOpenBooking}
              className="flex items-center gap-2 px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-[11px] tracking-widest transition-colors shadow-md"
            >
              <Calendar className="w-4 h-4 text-black" />
              Agendar Horário
            </button>

            <button
              onClick={() => setActiveTab('checkin')}
              className="flex items-center gap-2 px-4 py-2 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black font-bold uppercase text-[11px] tracking-widest transition-colors shadow-md"
            >
              <CreditCard className="w-4 h-4 text-black" />
              {isClient ? 'Meu Cartão Digital' : 'Validar Cartão'}
            </button>
          </div>
        </div>

        {/* Mobile Quick Actions Bar (Visible only on Mobile & Tablet < lg) */}
        <div className="flex lg:hidden items-center justify-between gap-2 py-2 border-t border-[#556b2f]/20 overflow-x-auto no-scrollbar">
          <button
            onClick={onOpenBooking}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-[10px] tracking-wider shadow-md transition"
          >
            <Calendar className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="truncate">Agendar</span>
          </button>

          <button
            onClick={onOpenWhatsApp}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold uppercase text-[10px] tracking-wider shadow-md border border-emerald-500/40 transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span className="truncate">WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('checkin')}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded bg-[#556b2f] hover:bg-[#6b863a] text-black font-bold uppercase text-[10px] tracking-wider shadow-md transition"
          >
            <CreditCard className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="truncate">{isClient ? 'Meu Cartão' : 'Validar'}</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-2.5 no-scrollbar border-t border-[#556b2f]/20">
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeTab === 'plans'
                ? 'bg-[#556b2f] text-black shadow-sm'
                : 'text-stone-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Assinaturas
          </button>

          {/* FINANCIAL CALCULATOR TAB - RESTRICTED OR LOCKED FOR CLIENTS */}
          {isAdmin ? (
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-[#556b2f] text-black shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-[#151515]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Calculadora &amp; KPIs
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveTab('calculator'); // Will trigger restricted view in App.tsx
              }}
              title="Acesso exclusivo ao Administrador"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Calculadora</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono">
                Admin
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('checkin')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeTab === 'checkin'
                ? 'bg-[#556b2f] text-black shadow-sm'
                : 'text-stone-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {isClient ? 'Meu Cartão & Saldo' : 'Check-in & Cartão'}
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeTab === 'rules'
                ? 'bg-[#556b2f] text-black shadow-sm'
                : 'text-stone-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Diretrizes &amp; Regras
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-[11px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-[#556b2f] text-black shadow-sm'
                : 'text-stone-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <Bot className="w-4 h-4" />
            IA Consultor
          </button>
        </nav>
      </div>
    </header>
  );
};

