import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { loginWithGoogle, loginWithApple } from '../lib/firebase';
import { DbLogo } from './DbLogo';
import {
  ShieldCheck,
  User,
  X,
  Lock,
  CheckCircle2,
  Sparkles,
  Scissors,
  LogOut,
  ArrowRight,
  AlertCircle,
  UserPlus,
  Smartphone
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLogin: (user: UserAccount) => void;
  onLogout: () => void;
  onOpenRegister?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  onOpenRegister,
}) => {
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('client');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoadingAuth(true);
    setErrorMessage('');
    try {
      const fbUser = await loginWithGoogle();
      const isAdminUser = fbUser.email?.toLowerCase() === ((import.meta as any).env?.VITE_ADMIN_EMAIL || '').toLowerCase();
      onLogin({
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Cliente D•B',
        email: fbUser.email || '',
        role: isAdminUser ? 'admin' : 'client',
        avatarUrl: fbUser.photoURL || undefined,
        planName: isAdminUser ? 'Gestão Completa D•B (Admin)' : 'Assinante D•B',
      });
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setErrorMessage('A janela de login do Google foi fechada antes de concluir o acesso.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setErrorMessage('');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMessage('O navegador bloqueou o popup de login. Por favor, permita popups para este site.');
      } else {
        console.warn('Alerta na autenticação Google:', err);
        setErrorMessage(err.message || 'Falha ao autenticar com a conta Google. Tente novamente.');
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoadingAuth(true);
    setErrorMessage('');
    try {
      const fbUser = await loginWithApple();
      const isAdminUser = fbUser.email?.toLowerCase() === ((import.meta as any).env?.VITE_ADMIN_EMAIL || '').toLowerCase();
      onLogin({
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Cliente Apple',
        email: fbUser.email || '',
        role: isAdminUser ? 'admin' : 'client',
        avatarUrl: fbUser.photoURL || undefined,
        planName: isAdminUser ? 'Gestão Completa D•B (Admin)' : 'Assinante D•B',
      });
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setErrorMessage('A janela de login da Apple foi fechada antes de concluir o acesso.');
      } else {
        // Friendly message for Apple auth preview limitation
        setErrorMessage(
          'Não foi possível concluir a autenticação Apple. Tente novamente ou use o login do Google.'
        );
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#556b2f]/40 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden relative text-stone-100">
        {/* Header */}
        <div className="bg-[#0a0a0a] px-6 py-5 border-b border-[#556b2f]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DbLogo className="w-10 h-10" />
            <div>
              <h3 className="text-lg font-serif font-bold text-white italic">
                Autenticação Ded Black Barbershop
              </h3>
              <p className="text-[11px] text-stone-400">
                Acesse com sua Conta Google, Apple ou Perfil de Gestor
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

        {/* Current User Logged In Info */}
        {currentUser && (
          <div className="p-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                  currentUser.role === 'admin'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                    : 'bg-[#556b2f]/20 text-[#556b2f] border border-[#556b2f]/40'
                }`}
              >
                {currentUser.role === 'admin' ? '👑' : '👤'}
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  {currentUser.name}
                  <span
                    className={`text-[9px] uppercase px-2 py-0.5 rounded font-bold ${
                      currentUser.role === 'admin'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-[#556b2f] text-black'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'Administrador' : 'Cliente'}
                  </span>
                </p>
                <p className="text-[10px] text-stone-400">{currentUser.email || currentUser.planName}</p>
              </div>
            </div>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-500/30 text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        )}

        {/* Tabs for Login Type */}
        <div className="grid grid-cols-2 p-3 bg-[#0c0c0c] border-b border-white/5 gap-2">
          <button
            onClick={() => {
              setSelectedRoleTab('client');
              setErrorMessage('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition ${
              selectedRoleTab === 'client'
                ? 'bg-[#556b2f] text-black shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            Área do Cliente
          </button>

          <button
            onClick={() => {
              setSelectedRoleTab('admin');
              setErrorMessage('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition ${
              selectedRoleTab === 'admin'
                ? 'bg-yellow-500 text-black shadow-md'
                : 'text-stone-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Administrador
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CLIENT LOGIN TAB */}
          {selectedRoleTab === 'client' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#0a0a0a] rounded border border-white/5 text-xs text-stone-300 space-y-1">
                <span className="text-[#556b2f] font-bold block uppercase tracking-wider text-[10px]">
                  📌 Autenticação de Clientes:
                </span>
                <p className="text-stone-400">
                  Faça login para visualizar seu Cartão Digital, saldo de atendmentos em tempo real e agendamentos persistidos na nuvem.
                </p>
              </div>

              {/* Primary OAuth Buttons: Google & Apple */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block">
                  Escolha o método de entrada:
                </label>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  disabled={isLoadingAuth}
                  onClick={handleGoogleLogin}
                  className="w-full py-3 px-4 rounded-lg bg-white hover:bg-stone-200 text-stone-900 font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-3 border border-stone-300 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com o Google</span>
                </button>

                {/* Apple / iPhone Sign In Button */}
                <button
                  type="button"
                  disabled={isLoadingAuth}
                  onClick={handleAppleLogin}
                  className="w-full py-3 px-4 rounded-lg bg-[#000000] hover:bg-[#1a1a1a] text-white font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-3 border border-white/20 disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  <span>Entrar com a Apple / iPhone</span>
                </button>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded text-xs text-stone-300">
                Para acessar seus dados sincronizados com segurança, use uma conta Google ou Apple. O acesso por nome/CPF sem autenticação foi desativado para evitar impersonação.
              </div>

              {onOpenRegister && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="w-full py-2 rounded bg-[#181818] hover:bg-[#222222] text-[#556b2f] border border-[#556b2f]/40 font-bold uppercase text-[11px] tracking-wider transition flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Novo por aqui? Fazer cadastro completo
                </button>
              )}
            </div>
          )}

          {/* ADMIN LOGIN TAB */}
          {selectedRoleTab === 'admin' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#0a0a0a] rounded border border-yellow-500/20 text-xs text-stone-300 space-y-1">
                <span className="text-yellow-400 font-bold block uppercase tracking-wider text-[10px]">
                  👑 Painel de Administração D•B:
                </span>
                <p className="text-stone-400">
                  Os dados do administrador ficam totalmente isolados. Clientes nunca visualizam relatórios financeiros, controle de comissões nem cartões de outros membros.
                </p>
              </div>

              {/* Admin Google Sign-In */}
              <button
                type="button"
                disabled={isLoadingAuth}
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/50 hover:bg-yellow-500/20 text-yellow-400 font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span>Entrar com Conta Google do Admin</span>
              </button>

              <div className="p-3 bg-yellow-950/20 border border-yellow-500/20 rounded text-xs text-stone-300">
                O acesso administrativo exige autenticação Google/Apple válida e autorização de administrador no Firebase. Não existe senha padrão ou credencial hardcoded no navegador.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0a0a0a] px-6 py-3 border-t border-white/5 text-[10px] text-stone-500 flex items-center justify-between">
          <span>Ded Black Barbershop &bull; Autenticação Google / Apple</span>
          <span className="font-mono text-emerald-400">Nuvem Firestore Ativa</span>
        </div>
      </div>
    </div>
  );
};

