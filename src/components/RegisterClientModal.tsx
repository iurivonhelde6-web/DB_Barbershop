import React, { useState } from 'react';
import { SubscriberCard, UserAccount, ClientProfileData } from '../types';
import { DbLogo } from './DbLogo';
import { playPaymentAlert } from '../utils/soundAlert';
import {
  UserPlus,
  X,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface RegisterClientModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Cadastro de assinante pelo admin (usado apenas em variant="modal") */
  onAddSubscriber?: (newSub: SubscriberCard) => void;
  /** Usuário já autenticado, para pré-preencher o formulário (variant="page") */
  currentUser?: UserAccount | null;
  /** Salva os dados pessoais em users/{uid} (variant="page") */
  onCompleteProfile?: (profile: ClientProfileData) => void | Promise<void>;
  /** "Preencher depois" — entra no app sem completar o perfil (variant="page") */
  onSkip?: () => void;
  /** Sai da conta e volta para a tela de Login (variant="page") */
  onGoToLogin?: () => void;
  /** 'modal' (padrão) abre sobre o app; 'page' ocupa a tela inteira no fluxo de entrada */
  variant?: 'modal' | 'page';
}

export const RegisterClientModal: React.FC<RegisterClientModalProps> = ({
  isOpen,
  onClose,
  onAddSubscriber,
  currentUser,
  onCompleteProfile,
  onSkip,
  onGoToLogin,
  variant = 'modal',
}) => {
  const isPage = variant === 'page';

  const [fullName, setFullName] = useState(isPage ? currentUser?.name ?? '' : '');
  const [age, setAge] = useState<string>(isPage && currentUser?.age ? String(currentUser.age) : '');
  const [cpf, setCpf] = useState(isPage ? currentUser?.cpf ?? '' : '');
  const [phone, setPhone] = useState(isPage ? currentUser?.phone ?? '' : '');

  // Address fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Rio de Janeiro / RJ');
  const [cep, setCep] = useState('');

  // States for UX
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createdSub, setCreatedSub] = useState<SubscriberCard | null>(null);

  if (!isOpen) return null;

  // Mask CPF format
  const handleCpfChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 9) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
    } else if (raw.length > 6) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    } else if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    }
    setCpf(formatted);
  };

  // Mask Phone
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 6) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    setPhone(formatted);
  };

  // Mask CEP
  const handleCepChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setCep(formatted);
  };

  const handleResetForm = () => {
    setFullName('');
    setAge('');
    setCpf('');
    setPhone('');
    setStreet('');
    setNumber('');
    setNeighborhood('');
    setCity('Rio de Janeiro / RJ');
    setCep('');
    setErrorMsg('');
    setCreatedSub(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setErrorMsg('Por favor, digite o nome completo (nome e sobrenome).');
      return;
    }

    if (!age || parseInt(age) < 5 || parseInt(age) > 110) {
      setErrorMsg('Por favor, informe uma idade válida.');
      return;
    }

    if (!cpf || cpf.replace(/\D/g, '').length < 11) {
      setErrorMsg('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    if (!street.trim() || !number.trim() || !neighborhood.trim()) {
      setErrorMsg('Por favor, preencha o endereço completo (Rua, Número e Bairro).');
      return;
    }

    setErrorMsg('');

    const fullAddress = `${street.trim()}, nº ${number.trim()} - ${neighborhood.trim()} - ${city}${cep ? ` (CEP: ${cep})` : ''}`;

    // ─── Fluxo de entrada: grava o perfil do cliente JÁ AUTENTICADO em users/{uid} ───
    if (isPage) {
      if (!onCompleteProfile) return;
      setIsSaving(true);
      try {
        await onCompleteProfile({
          name: fullName.trim(),
          cpf: cpf.trim(),
          age: parseInt(age),
          address: fullAddress,
          phone: phone.trim(),
        });
        // Em caso de sucesso o App avança para o dashboard e desmonta esta tela
      } catch (err) {
        console.error('Erro ao salvar perfil do cliente:', err);
        setErrorMsg('Não foi possível salvar seus dados agora. Verifique sua conexão e tente novamente.');
        setIsSaving(false);
      }
      return;
    }

    // ─── Cadastro de assinante pelo admin (variant="modal") ─────────────────────
    const generatedCardCode = `DB-${Math.floor(1000 + Math.random() * 9000)}`;
    const today = new Date();
    const startDateStr = today.toISOString().split('T')[0];

    const newSubscriberCard: SubscriberCard = {
      id: `sub-reg-${Date.now()}`,
      cardCode: generatedCardCode,
      clientName: fullName.trim(),
      cpf: cpf.trim(),
      age: parseInt(age),
      address: fullAddress,
      phone: phone || '(21) 99887-6655',
      planName: 'Sem Plano Ativo',
      serviceName: 'Nenhum',
      totalSessions: 0,
      usedSessions: 0,
      startDate: startDateStr,
      expirationDate: startDateStr,
      status: 'ACTIVE',
      barberPreferred: 'A escolher',
      qrCodeValue: `https://dedblackbarbershop.com.br/validar/${generatedCardCode}`,
      notes: 'Cadastro realizado no app (sem contratação inicial de plano).',
      paymentStatus: 'PAID',
      paidAmount: 0,
      expectedAmount: 0,
      paymentMethod: 'CREDIT_CARD',
      paymentDate: startDateStr,
      transactionId: `REG-${Date.now()}`,
    };

    onAddSubscriber?.(newSubscriberCard);
    playPaymentAlert();
    setCreatedSub(newSubscriberCard);
  };

  const handleBackToLogin = () => {
    handleResetForm();
    onGoToLogin?.();
  };

  return (
    <div
      className={
        isPage
          ? 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#16210f_0%,#0b0b0b_55%,#000000_100%)] p-4 animate-in fade-in duration-300'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200'
      }
    >
      <div
        className={`bg-[#121212] w-full max-w-2xl overflow-hidden relative text-stone-100 max-h-[92vh] flex flex-col ${
          isPage
            ? 'border border-[#94a288]/25 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] my-auto'
            : 'border border-[#94a288]/40 rounded-xl shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="bg-[#0a0a0a] px-6 py-4 border-b border-[#94a288]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <DbLogo className="w-10 h-10" />
            <div>
              <h3 className="text-lg font-serif font-bold text-white italic flex items-center gap-2">
                {isPage ? 'Complete seu perfil D•B' : 'Cadastro de Novo Cliente D•B'}
              </h3>
              <p className="text-[11px] text-stone-400">
                {isPage
                  ? `Conectado como ${currentUser?.email || currentUser?.name || 'sua conta'}`
                  : 'Preencha os dados pessoais para criar sua conta no sistema'}
              </p>
            </div>
          </div>

          {isPage ? (
            onGoToLogin && (
              <button
                onClick={handleBackToLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 border border-white/10 text-[11px] font-bold uppercase tracking-wider transition"
                title="Sair desta conta e entrar com outra"
              >
                <LogOut className="w-3.5 h-3.5" />
                Trocar de conta
              </button>
            )
          ) : (
            <button
              onClick={() => {
                handleResetForm();
                onClose?.();
              }}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SUCCESS VIEW */}
          {createdSub ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#94a288]/20 border-2 border-[#94a288] flex items-center justify-center text-[#94a288] mx-auto animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#94a288] block">
                  🎉 Cadastro Concluído com Sucesso!
                </span>
                <h4 className="text-2xl font-serif italic text-white mt-1">
                  Bem-vindo(a), {createdSub.clientName}!
                </h4>
                <p className="text-xs text-stone-300 mt-1 max-w-md mx-auto">
                  Seu cadastro foi realizado na Ded Black Barbershop. Você já pode acessar seu painel e escolher um plano quando desejar.
                </p>
              </div>

              {/* Digital Card Preview */}
              <div className="bg-[#181818] border border-[#94a288]/50 rounded-xl p-6 text-left max-w-md mx-auto shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                      CARTÃO DIGITAL D•B
                    </span>
                    <h5 className="text-base font-serif italic font-bold text-white">
                      {createdSub.clientName}
                    </h5>
                  </div>
                  <span className="font-mono font-bold text-sm bg-[#94a288] text-black px-3 py-1 rounded">
                    {createdSub.cardCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">CPF</span>
                    <span className="font-mono text-white">{createdSub.cpf}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Idade</span>
                    <span className="text-white">{createdSub.age} anos</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Endereço</span>
                    <span className="text-stone-300 text-[11px] leading-tight block">{createdSub.address}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Status do Plano</span>
                    <span className="text-amber-400 font-bold">Nenhum plano assinado no momento</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    handleResetForm();
                    onClose?.();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-[#94a288] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-lg w-full sm:w-auto"
                >
                  Concluir e Ir para o Painel
                </button>
              </div>
            </div>
          ) : (
            /* REGISTRATION FORM */
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {isPage && (
                <div className="p-3 bg-[#0a0a0a] border border-[#94a288]/25 rounded-lg text-xs text-stone-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#94a288] shrink-0 mt-0.5" />
                  <span>
                    Seus dados são gravados com segurança na sua conta autenticada e só podem ser
                    lidos por você e pela administração da barbearia. Preencher agora é opcional —
                    você pode entrar no app e completar depois.
                  </span>
                </div>
              )}

              {/* Section 1: Personal Info */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#94a288] flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <User className="w-3.5 h-3.5" />
                  1. Dados Pessoais Obrigatórios
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Eduardo da Silva"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Idade *
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 28"
                      min="5"
                      max="110"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      CPF *
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288] font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Telefone / WhatsApp (Com DDD)
                    </label>
                    <input
                      type="text"
                      placeholder="(21) 99887-6655"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Address */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#94a288] flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  2. Endereço Completo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Rua / Avenida *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Av. Atlântica, Rua das Flores"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Número *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 500 ou Apt 102"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Bairro *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Copacabana, Tijuca, Centro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Cidade / UF
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      CEP (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="20000-000"
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#94a288] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 space-y-2.5">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 rounded-lg bg-[#94a288] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-xl flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 text-black animate-spin" />
                      <span>SALVANDO...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
                      <span>{isPage ? 'SALVAR E ENTRAR NO APP' : 'CONCLUIR CADASTRO'}</span>
                    </>
                  )}
                </button>

                {isPage && onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    disabled={isSaving}
                    className="w-full py-2.5 rounded-lg bg-transparent hover:bg-white/5 text-stone-400 hover:text-stone-200 border border-white/10 font-bold uppercase text-[11px] tracking-wider transition disabled:opacity-50"
                  >
                    Pular por agora
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0a0a0a] px-6 py-3 border-t border-white/5 text-[10px] text-stone-500 flex items-center justify-between shrink-0">
          <span>Ded Black Barbershop &bull; Cadastro Seguro de Clientes</span>
          <span className="font-mono">LGPD Compliance</span>
        </div>
      </div>
    </div>
  );
};