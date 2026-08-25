import React, { useState } from 'react';
import { UserAccount, SubscriberCard } from '../types';
import { PLANS_LIST, BARBERS_LIST } from '../data/barberData';
import { PaymentModal } from './PaymentModal';
import { DbLogo } from './DbLogo';
import { playPaymentAlert } from '../utils/soundAlert';
import {
  UserPlus,
  X,
  User,
  Calendar,
  FileText,
  MapPin,
  Phone,
  Scissors,
  CheckCircle2,
  CreditCard,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Lock
} from 'lucide-react';

interface RegisterClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSubscriber: (newSub: SubscriberCard) => void;
  onLoginAfterRegister?: (user: UserAccount) => void;
}

export const RegisterClientModal: React.FC<RegisterClientModalProps> = ({
  isOpen,
  onClose,
  onAddSubscriber,
  onLoginAfterRegister,
}) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<string>('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  
  // Address fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Rio de Janeiro / RJ');
  const [cep, setCep] = useState('');

  // Initial plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<string>(PLANS_LIST[0].id);
  const [selectedBarberId, setSelectedBarberId] = useState<string>(BARBERS_LIST[0].id);

  // States for UX
  const [errorMsg, setErrorMsg] = useState('');
  const [createdSub, setCreatedSub] = useState<SubscriberCard | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (!isOpen) return null;

  const selectedPlan = PLANS_LIST.find((p) => p.id === selectedPlanId) || PLANS_LIST[0];
  const selectedBarber = BARBERS_LIST.find((b) => b.id === selectedBarberId) || BARBERS_LIST[0];

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

  const handleSubmit = (e: React.FormEvent) => {
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
    setIsPaymentModalOpen(true);
  };

  const handleRegisterPaymentSuccess = (paymentData: {
    paidAmount: number;
    paymentMethod: 'PIX' | 'CREDIT_CARD';
    transactionId: string;
    paymentDate: string;
  }) => {
    const generatedCardCode = `DB-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullAddress = `${street.trim()}, nº ${number.trim()} - ${neighborhood.trim()} - ${city}${cep ? ` (CEP: ${cep})` : ''}`;

    const today = new Date();
    const startDateStr = today.toISOString().split('T')[0];
    const expDate = new Date(today);
    expDate.setDate(expDate.getDate() + 30);
    const expDateStr = expDate.toISOString().split('T')[0];

    const newSubscriberCard: SubscriberCard = {
      id: `sub-reg-${Date.now()}`,
      cardCode: generatedCardCode,
      clientName: fullName.trim(),
      cpf: cpf.trim(),
      age: parseInt(age),
      address: fullAddress,
      phone: phone || '(21) 99887-6655',
      planName: `${selectedPlan.tierLabel} (${selectedPlan.serviceName})`,
      serviceName: selectedPlan.serviceName,
      totalSessions: selectedPlan.numAtendimentos,
      usedSessions: 0,
      startDate: startDateStr,
      expirationDate: expDateStr,
      status: 'ACTIVE',
      barberPreferred: selectedBarber.name,
      qrCodeValue: `https://dedblackbarbershop.com.br/validar/${generatedCardCode}`,
      notes: `Cadastrado e quitado via Pagamento Integrado. Transação: ${paymentData.transactionId}`,
      paymentStatus: 'PAID',
      paidAmount: paymentData.paidAmount,
      expectedAmount: selectedPlan.totalPrice,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: paymentData.paymentDate,
      transactionId: paymentData.transactionId,
    };

    onAddSubscriber(newSubscriberCard);
    playPaymentAlert();
    setCreatedSub(newSubscriberCard);

    if (onLoginAfterRegister) {
      onLoginAfterRegister({
        id: newSubscriberCard.id,
        name: newSubscriberCard.clientName,
        email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@cliente.com`,
        role: 'client',
        cpf: newSubscriberCard.cpf,
        age: newSubscriberCard.age,
        address: newSubscriberCard.address,
        cardCode: newSubscriberCard.cardCode,
        planName: newSubscriberCard.planName,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#556b2f]/40 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden relative text-stone-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0a0a0a] px-6 py-4 border-b border-[#556b2f]/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <DbLogo className="w-10 h-10" />
            <div>
              <h3 className="text-lg font-serif font-bold text-white italic flex items-center gap-2">
                Cadastro de Novo Cliente D•B
              </h3>
              <p className="text-[11px] text-stone-400">
                Preencha os dados pessoais e de localização para gerar seu Cartão Digital
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleResetForm();
              onClose();
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SUCCESS VIEW */}
          {createdSub ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#556b2f]/20 border-2 border-[#556b2f] flex items-center justify-center text-[#556b2f] mx-auto animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#556b2f] block">
                  🎉 Cadastro Concluído com Sucesso!
                </span>
                <h4 className="text-2xl font-serif italic text-white mt-1">
                  Bem-vindo(a), {createdSub.clientName}!
                </h4>
                <p className="text-xs text-stone-300 mt-1 max-w-md mx-auto">
                  Seu cadastro foi realizado no sistema da Ded Black Barbershop e o seu Cartão Digital de Controle já está ativo.
                </p>
              </div>

              {/* Digital Card Preview */}
              <div className="bg-[#181818] border border-[#556b2f]/50 rounded-xl p-6 text-left max-w-md mx-auto shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                      CARTÃO DIGITAL D•B
                    </span>
                    <h5 className="text-base font-serif italic font-bold text-white">
                      {createdSub.clientName}
                    </h5>
                  </div>
                  <span className="font-mono font-bold text-sm bg-[#556b2f] text-black px-3 py-1 rounded">
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
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Plano Ativo</span>
                    <span className="text-[#556b2f] font-bold">{createdSub.planName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Barbeiro Pref.</span>
                    <span className="text-amber-400">{createdSub.barberPreferred}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    handleResetForm();
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-[#556b2f] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-lg w-full sm:w-auto"
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

              {/* Section 1: Personal Info */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#556b2f] flex items-center gap-1.5 border-b border-white/10 pb-1">
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f] font-mono"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Address */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#556b2f] flex items-center gap-1.5 border-b border-white/10 pb-1">
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
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
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Subscription & Preference */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#556b2f] flex items-center gap-1.5 border-b border-white/10 pb-1">
                  <Scissors className="w-3.5 h-3.5" />
                  3. Seleção Inicial de Plano &amp; Barbeiro
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Plano Escolhido
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                    >
                      {PLANS_LIST.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.tierLabel} - {plan.serviceName} (R$ {plan.totalPrice.toFixed(2)}/mês)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                      Barbeiro Preferencial
                    </label>
                    <select
                      value={selectedBarberId}
                      onChange={(e) => setSelectedBarberId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#556b2f]"
                    >
                      {BARBERS_LIST.map((barber) => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-lg bg-[#556b2f] hover:bg-[#68833a] text-black font-bold uppercase text-xs tracking-wider transition shadow-xl flex items-center justify-center gap-2 group"
                >
                  <Lock className="w-4 h-4 text-black group-hover:scale-110 transition-transform" />
                  <span>Avançar para Pagamento do Plano (R$ {selectedPlan.totalPrice.toFixed(2)})</span>
                </button>
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

      {/* Payment Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        planName={selectedPlan.tierLabel}
        serviceName={selectedPlan.serviceName}
        planAmount={selectedPlan.totalPrice}
        clientName={fullName.trim()}
        clientCpf={cpf.trim()}
        clientPhone={phone}
        onPaymentSuccess={(paymentData) => {
          setIsPaymentModalOpen(false);
          handleRegisterPaymentSuccess(paymentData);
        }}
      />
    </div>
  );
};
