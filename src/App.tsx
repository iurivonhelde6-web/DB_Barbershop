/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PlansCatalog } from './components/PlansCatalog';
import { FinancialCalculator } from './components/FinancialCalculator';
import { AdminDashboard } from './components/AdminDashboard';
import { ControlCardValidation } from './components/ControlCardValidation';
import { ContractRules } from './components/ContractRules';
import { AiAssistant } from './components/AiAssistant';
import { LoginModal } from './components/LoginModal';
import { RestrictedFinancialView } from './components/RestrictedFinancialView';
import { ScheduleBookingModal } from './components/ScheduleBookingModal';
import { WhatsAppSupportModal } from './components/WhatsAppSupportModal';
import { RegisterClientModal } from './components/RegisterClientModal';
import { SplashScreen } from './components/SplashScreen';
import { AdminNotificationToast, AdminNotification } from './components/AdminNotificationToast';
import { MOCK_SUBSCRIBERS, INITIAL_APPOINTMENTS } from './data/barberData';
import { SubscriberCard, UserAccount, Appointment, ClientProfileData } from './types';
import { Scissors, ShieldCheck, Heart, MessageSquare } from 'lucide-react';
import { 
  auth, 
  ensureUserProfile, 
  subscribeToSubscribers, 
  subscribeToAppointments,
  addSubscriberToCloud,
  updateSubscriberInCloud,
  deleteSubscriberFromCloud,
  addAppointmentToCloud,
  deleteAppointmentFromCloud,
  logoutUser,
  saveClientProfile,
  markProfileSkipped
} from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

const SUBSCRIBERS_STORAGE_KEY = 'dedblack_subscribers_v2';
const APPOINTMENTS_STORAGE_KEY = 'dedblack_appointments_v2';

type AppPhase = 'splash' | 'login' | 'register' | 'app';

/**
 * Pede o preenchimento do perfil apenas no primeiro acesso: quem já informou o CPF
 * ou escolheu "pular por agora" entra direto no app.
 */
function needsProfileCompletion(user: UserAccount | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return false;
  if (user.profileSkipped) return false;
  return !user.cpf || !user.address;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'plans' | 'calculator' | 'checkin' | 'rules' | 'ai'>('plans');

  // Fluxo obrigatório de entrada: Splash → Login → Cadastro (opcional) → App
  const [appPhase, setAppPhase] = useState<AppPhase>('splash');
  const [isSplashDone, setIsSplashDone] = useState(false);
  // Vira true na primeira resposta do Firebase Auth (com ou sem sessão salva)
  const [isAuthResolved, setIsAuthResolved] = useState(false);

  // Real-time Cloud Subscribers State
  const [subscribers, setSubscribers] = useState<SubscriberCard[]>([]);
  // Real-time Cloud Appointments State
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  
  // Real-time Sound & Admin Notification State
  const [activeNotification, setActiveNotification] = useState<AdminNotification | null>(null);

  // Login & Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Modal de conta (trocar de usuário / sair) aberto pelo Header, já dentro do app
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCurrentUser(null);
        setIsAuthResolved(true);
        return;
      }
      try {
        const profile = await ensureUserProfile(user);
        setCurrentUser(profile);
      } catch (e) {
        console.error('Erro ao sincronizar perfil do usuário:', e);
        setCurrentUser(null);
      } finally {
        setIsAuthResolved(true);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Splash → decide o destino assim que a animação acaba E o Auth responde
  useEffect(() => {
    if (appPhase !== 'splash') return;
    if (!isSplashDone || !isAuthResolved) return;
    // Sem sessão — ou com sessão cujo perfil não pôde ser carregado — volta ao login,
    // onde o cliente consegue tentar de novo em vez de ficar preso num app sem conta.
    if (!firebaseUser || !currentUser) {
      setAppPhase('login');
      return;
    }
    setAppPhase(needsProfileCompletion(currentUser) ? 'register' : 'app');
  }, [appPhase, isSplashDone, isAuthResolved, firebaseUser, currentUser]);

  // Login concluído → completa o perfil (1º acesso) ou entra direto no app
  useEffect(() => {
    if (appPhase !== 'login') return;
    if (!currentUser) return;
    setAppPhase(needsProfileCompletion(currentUser) ? 'register' : 'app');
  }, [appPhase, currentUser]);

  // Sessão encerrada depois do login → volta para a tela de login
  useEffect(() => {
    if (appPhase !== 'app' && appPhase !== 'register') return;
    if (isAuthResolved && !firebaseUser && !currentUser) {
      setIsAccountModalOpen(false);
      setAppPhase('login');
    }
  }, [appPhase, isAuthResolved, firebaseUser, currentUser]);

  // Subscribe to Firestore Realtime Data
  useEffect(() => {
    const unsubSubscribers = subscribeToSubscribers((cloudSubscribers) => {
      setSubscribers(cloudSubscribers);
    });

    const unsubAppointments = subscribeToAppointments((cloudAppointments) => {
      if (cloudAppointments && cloudAppointments.length > 0) {
        setAppointments(cloudAppointments);
      } else {
        setAppointments(INITIAL_APPOINTMENTS);
      }
    });

    return () => {
      unsubSubscribers();
      unsubAppointments();
    };
  }, [firebaseUser?.uid]);

  const activeSubscribersCount = subscribers.filter((s) => s.status === 'ACTIVE').length;

  const handleAddSubscriber = async (newSub: SubscriberCard) => {
    // Optimistic UI update
    setSubscribers((prev) => [newSub, ...prev.filter((s) => s.id !== newSub.id)]);

    // Trigger Admin Audio Sound Alert & Visual Notification Message
    setActiveNotification({
      id: `notif-${Date.now()}`,
      type: 'PAYMENT',
      title: '💰 NOVA ASSINATURA & PAGAMENTO CONFIRMADO!',
      clientName: newSub.clientName,
      clientPhone: newSub.phone,
      serviceOrPlan: `${newSub.planName} (${newSub.serviceName})`,
      dateOrPaymentDate: newSub.paymentDate || new Date().toLocaleDateString('pt-BR'),
      amount: newSub.paidAmount || 0,
      paymentMethod: newSub.paymentMethod || 'PIX / Cartão',
      cardCode: newSub.cardCode,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });

    // Save to Firestore real-time cloud database
    try {
      await addSubscriberToCloud({
        ...newSub,
        userUid: firebaseUser?.uid,
        email: firebaseUser?.email || newSub.email,
      });
    } catch (e) {
      console.error('Erro ao salvar no Firestore:', e);
    }
  };

  const handleUpdateSubscriber = async (updatedSub: SubscriberCard) => {
    // Optimistic UI update
    setSubscribers((prev) =>
      prev.map((s) => (s.id === updatedSub.id ? updatedSub : s))
    );
    try {
      await updateSubscriberInCloud(updatedSub.id, updatedSub);
    } catch (e) {
      console.error('Erro ao atualizar no Firestore:', e);
    }
  };

  const handleDeleteSubscriber = async (subId: string) => {
    // Optimistic UI update - delete immediately from local state
    setSubscribers((prev) => prev.filter((s) => s.id !== subId));
    try {
      await deleteSubscriberFromCloud(subId);
    } catch (e) {
      console.error('Erro ao deletar no Firestore:', e);
    }
  };

  const handleAddAppointment = async (newApt: Appointment) => {
    // Trigger Admin Audio Sound Alert & Visual Notification Message
    setActiveNotification({
      id: `notif-${Date.now()}`,
      type: 'APPOINTMENT',
      title: '🔔 NOVO AGENDAMENTO RECEBIDO!',
      clientName: newApt.clientName,
      clientPhone: newApt.clientPhone,
      serviceOrPlan: newApt.serviceName,
      barberName: newApt.barberName,
      dateOrPaymentDate: newApt.date,
      time: newApt.time,
      cardCode: newApt.cardCode,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    });

    try {
      await addAppointmentToCloud({
        ...newApt,
        userUid: firebaseUser?.uid,
      });
    } catch (e) {
      console.error('Erro ao agendar no Firestore:', e);
      setAppointments((prev) => [newApt, ...prev]);
    }
  };

  const handleCancelAppointment = async (aptId: string) => {
    try {
      await deleteAppointmentFromCloud(aptId);
    } catch (e) {
      console.error('Erro ao cancelar no Firestore:', e);
      setAppointments((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: 'CANCELLED' } : a))
      );
    }
  };

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error('Erro ao deslogar:', e);
    }
    setCurrentUser(null);
  };

  // Salva os dados pessoais no próprio documento do usuário autenticado
  const handleCompleteProfile = async (profile: ClientProfileData) => {
    if (!firebaseUser) throw new Error('Sessão expirada. Entre novamente para salvar seus dados.');
    await saveClientProfile(firebaseUser.uid, profile);
    setCurrentUser((prev) => (prev ? { ...prev, ...profile, profileSkipped: false } : prev));
    setAppPhase('app');
  };

  const handleSkipProfile = async () => {
    setAppPhase('app');
    if (firebaseUser) {
      await markProfileSkipped(firebaseUser.uid);
      setCurrentUser((prev) => (prev ? { ...prev, profileSkipped: true } : prev));
    }
  };

  // ─── Fluxo de entrada obrigatório ───────────────────────────────────────────
  if (appPhase === 'splash') {
    return <SplashScreen onFinished={() => setIsSplashDone(true)} />;
  }

  if (appPhase === 'login') {
    // Sem `onOpenRegister`: no fluxo "login primeiro", a própria conta Google cria o
    // cadastro. A fase 'register' só existe autenticada (completar perfil), então um
    // atalho para ela aqui seria revertido na hora pelo efeito de sessão encerrada.
    return (
      <LoginModal
        variant="page"
        isOpen={true}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    );
  }

  if (appPhase === 'register') {
    return (
      <RegisterClientModal
        variant="page"
        isOpen={true}
        currentUser={currentUser}
        onCompleteProfile={handleCompleteProfile}
        onSkip={handleSkipProfile}
        onGoToLogin={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500 selection:text-stone-950 flex flex-col justify-between">
      <div>
        {/* Navigation Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeSubscribersCount={activeSubscribersCount}
          currentUser={currentUser}
          onOpenLogin={() => setIsAccountModalOpen(true)}
          onOpenBooking={() => setIsBookingModalOpen(true)}
          onOpenWhatsApp={() => setIsWhatsAppModalOpen(true)}
        />

        {/* Tab Views */}
        <main className="transition-all duration-300">
          {activeTab === 'plans' && (
            <PlansCatalog
              onAddSubscriber={handleAddSubscriber}
              onOpenCheckin={() => setActiveTab('checkin')}
              onOpenBooking={() => setIsBookingModalOpen(true)}
            />
          )}

          {activeTab === 'calculator' && (
            currentUser?.role === 'admin' ? (
              <AdminDashboard
                subscribers={subscribers}
                appointments={appointments}
                onOpenBooking={() => setIsBookingModalOpen(true)}
                onOpenCheckin={() => setActiveTab('checkin')}
                onOpenRegister={() => setIsRegisterModalOpen(true)}
                onDeleteAppointment={handleCancelAppointment}
              />
            ) : (
              <RestrictedFinancialView
                currentUser={currentUser}
                onOpenAdminLogin={() => setIsAccountModalOpen(true)}
                onGoToPlans={() => setActiveTab('plans')}
              />
            )
          )}

          {activeTab === 'checkin' && (
            <ControlCardValidation
              subscribers={subscribers}
              onUpdateSubscriber={handleUpdateSubscriber}
              onAddNewSubscriberClick={() => setIsRegisterModalOpen(true)}
              currentUser={currentUser}
              onDeleteSubscriber={handleDeleteSubscriber}
            />
          )}

          {activeTab === 'rules' && <ContractRules />}

          {activeTab === 'ai' && <AiAssistant />}
        </main>
      </div>

      {/* Admin Realtime Audio & Visual Notification Toast */}
      <AdminNotificationToast
        notification={activeNotification}
        onClose={() => setActiveNotification(null)}
      />

      {/* Account Modal: trocar de conta / sair (aberto pelo Header) */}
      <LoginModal
        variant="modal"
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* New Client Registration Modal */}
      <RegisterClientModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onAddSubscriber={handleAddSubscriber}
      />

      {/* Appointment Schedule Modal */}
      <ScheduleBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        currentUser={currentUser}
        appointments={appointments}
        onAddAppointment={handleAddAppointment}
        onCancelAppointment={handleCancelAppointment}
      />

      {/* WhatsApp Direct Support Modal */}
      <WhatsAppSupportModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Floating WhatsApp Quick Contact Button */}
      <button
        onClick={() => setIsWhatsAppModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 sm:px-4 sm:py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl border border-emerald-400/50 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 group"
        title="Atendimento via WhatsApp Oficial do Admin (+55 21 97002-7971)"
      >
        <MessageSquare className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider">
          WhatsApp Admin
        </span>
      </button>

      {/* Footer */}
      <footer className="bg-stone-950 border-t border-stone-800/80 py-8 text-stone-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3B4E38] text-emerald-300 flex items-center justify-center border border-emerald-500/30">
              <Scissors className="w-4 h-4 transform -rotate-45" />
            </div>
            <div>
              <p className="font-extrabold text-stone-200 font-serif tracking-wider">
                BARBEARIA DED BLACK &bull; D•B BARBERSHOP
              </p>
              <p className="text-[10px] text-stone-500">
                Sistema de Assinaturas &amp; Gestão de Atendimentos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-medium text-stone-400">
            <button
              onClick={() => setActiveTab('rules')}
              className="hover:text-emerald-400 transition"
            >
              Termos e Condições (14 Cláusulas)
            </button>
            <span>&bull;</span>
            <button
              onClick={() => setActiveTab('checkin')}
              className="hover:text-emerald-400 transition"
            >
              Validação de Cartão
            </button>
          </div>

          <div className="text-[10px] text-stone-500 text-center sm:text-right">
            &copy; {new Date().getFullYear()} D•B Barbershop. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

