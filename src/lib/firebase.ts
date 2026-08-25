import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  deleteDoc, 
  updateDoc, 
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { SubscriberCard, Appointment, UserAccount } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Leitura via variável de ambiente injetada pelo Vite no build
// NUNCA expor email de admin hardcoded no bundle do cliente
const ADMIN_EMAIL: string = (import.meta as any).env?.VITE_ADMIN_EMAIL || '';

// Authentication Functions
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function loginWithApple(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, appleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Gera headers de autenticação com Bearer Token, User ID e Email para chamadas ao backend
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-app-client-auth': 'ded-black-web-client',
  };

  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
      headers['x-user-id'] = currentUser.uid;
      headers['x-user-email'] = currentUser.email || '';
    } catch (err) {
      console.warn('Erro ao obter Token ID do usuário:', err);
    }
  }

  return headers;
}

/**
 * Chama o interceptor backend /api/admin/verify-role para validar identidade e papel 'admin' no Firestore
 */
export async function verifyBackendAdminRole(): Promise<{ verified: boolean; role?: string; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/admin/verify-role', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        verified: false,
        error: errData.error || 'Acesso negado pelo interceptor backend: Perfil não possui papel de administrador no banco de dados.',
      };
    }

    const data = await response.json();
    return { verified: true, role: data.role || 'admin' };
  } catch (err: any) {
    console.error('Erro ao comunicar com backend para validação de papel:', err);
    return { verified: false, error: 'Erro de conexão com servidor backend de segurança.' };
  }
}

export async function ensureUserProfile(user: FirebaseUser): Promise<UserAccount> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  
  const isAdminUser = ADMIN_EMAIL ? user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() : false;

  if (!snap.exists()) {
    const newUserAccount: UserAccount = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Cliente D•B',
      email: user.email || '',
      role: isAdminUser ? 'admin' : 'client',
      cardCode: `DB-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    await setDoc(userRef, {
      ...newUserAccount,
      uid: user.uid,
      photoURL: user.photoURL || '',
      createdAt: new Date().toISOString(),
    });
    return newUserAccount;
  } else {
    const data = snap.data();
    if (isAdminUser && data.role !== 'admin') {
      await updateDoc(userRef, { role: 'admin' });
      data.role = 'admin';
    }
    return {
      id: user.uid,
      name: data.displayName || data.name || user.displayName || 'Cliente D•B',
      email: data.email || user.email || '',
      role: data.role || (isAdminUser ? 'admin' : 'client'),
      cardCode: data.cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
    };
  }
}

// ─── Listeners Realtime Firestore ─────────────────────────────────────────────

export function subscribeToSubscribers(callback: (subscribers: SubscriberCard[]) => void) {
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { callback([]); return; }

      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const isAdmin = (ADMIN_EMAIL && currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())
        || userSnap.data()?.role === 'admin';
      const colRef = collection(db, 'subscribers');
      const source = isAdmin ? colRef : query(colRef, where('userUid', '==', currentUser.uid));

      unsubscribe = onSnapshot(source, (snapshot) => {
        const list: SubscriberCard[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            cardCode: data.cardCode || '', clientName: data.clientName || '', cpf: data.cpf || '',
            phone: data.phone || '', planName: data.planName || '', serviceName: data.serviceName || '',
            totalSessions: Number(data.totalSessions) || 0, usedSessions: Number(data.usedSessions) || 0,
            expirationDate: data.expirationDate || '', startDate: data.startDate || '',
            status: data.status || 'ACTIVE', qrCodeValue: data.qrCodeValue || '', notes: data.notes || '',
            userUid: data.userUid || '', email: data.email || '', paymentStatus: data.paymentStatus || 'PAID',
            paidAmount: data.paidAmount != null ? Number(data.paidAmount) : undefined,
            expectedAmount: data.expectedAmount != null ? Number(data.expectedAmount) : undefined,
            paymentMethod: data.paymentMethod || undefined, paymentDate: data.paymentDate || undefined,
            transactionId: data.transactionId || undefined,
            stripeCustomerId: data.stripeCustomerId || data.stripe_customer_id || undefined,
            stripeSubscriptionId: data.stripeSubscriptionId || data.stripe_subscription_id || undefined,
            stripePriceId: data.stripePriceId || data.stripe_price_id || undefined,

            cardLast4: data.cardLast4 || data.card_last_four_digits || undefined,
            cardBrand: data.cardBrand || data.card_brand || undefined,
            paymentHistory: Array.isArray(data.paymentHistory) ? data.paymentHistory : [],
          });
        });
        callback(list);
      }, (err) => {
        console.warn('Aviso na subscrição de assinantes:', err?.message || err);
        callback([]);
      });
    } catch (err) {
      console.warn('Erro ao preparar subscrição de assinantes:', err);
      callback([]);
    }
  })();

  return () => unsubscribe?.();
}

export function subscribeToAppointments(callback: (appointments: Appointment[]) => void) {
  let unsubscribe: (() => void) | undefined;

  void (async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { callback([]); return; }

      const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
      const isAdmin = (ADMIN_EMAIL && currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())
        || userSnap.data()?.role === 'admin';
      const colRef = collection(db, 'appointments');
      const source = isAdmin ? colRef : query(colRef, where('userUid', '==', currentUser.uid));

      unsubscribe = onSnapshot(source, (snapshot) => {
        const list: Appointment[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id, clientName: data.clientName || '', clientPhone: data.clientPhone || '',
            barberId: data.barberId || '', barberName: data.barberName || '', serviceId: data.serviceId || '',
            serviceName: data.serviceName || '', date: data.date || '', time: data.time || '',
            createdAt: data.createdAt || new Date().toISOString(), status: data.status || 'CONFIRMED',
            notes: data.notes || '', userUid: data.userUid || '', cardCode: data.cardCode || '',
          });
        });
        callback(list);
      }, (err) => {
        console.warn('Aviso na subscrição de agendamentos:', err?.message || err);
        callback([]);
      });
    } catch (err) {
      console.warn('Erro ao preparar subscrição de agendamentos:', err);
      callback([]);
    }
  })();

  return () => unsubscribe?.();
}

// ─── Firestore Error Handling ─────────────────────────────────────────────────
export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete',
  LIST = 'list', GET = 'get', WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null; email?: string | null; emailVerified?: boolean | null;
    isAnonymous?: boolean | null; tenantId?: string | null;
    providerInfo?: { providerId?: string | null; email?: string | null; }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid, email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified, isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({ providerId: provider.providerId, email: provider.email })) || [],
    },
    operationType, path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ─── Funções Firestore ────────────────────────────────────────────────────────
export async function addSubscriberToCloud(sub: Omit<SubscriberCard, 'id'> & { id?: string }): Promise<string> {
  const docRef = doc(collection(db, 'subscribers'));
  const id = sub.id || docRef.id;
  const targetRef = doc(db, 'subscribers', id);
  try {
    await setDoc(targetRef, { ...sub, id, updatedAt: new Date().toISOString() });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscribers/${id}`);
    return id;
  }
}

export async function updateSubscriberInCloud(id: string, updates: Partial<SubscriberCard>): Promise<void> {
  const docRef = doc(db, 'subscribers', id);
  try {
    await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscribers/${id}`);
  }
}

export async function deleteSubscriberFromCloud(id: string): Promise<void> {
  const docRef = doc(db, 'subscribers', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subscribers/${id}`);
  }
}

export async function addAppointmentToCloud(appointment: Omit<Appointment, 'id'> & { id?: string }): Promise<string> {
  const docRef = doc(collection(db, 'appointments'));
  const id = appointment.id || docRef.id;
  const targetRef = doc(db, 'appointments', id);
  try {
    await setDoc(targetRef, { ...appointment, id, createdAt: new Date().toISOString() });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `appointments/${id}`);
    return id;
  }
}

export async function deleteAppointmentFromCloud(id: string): Promise<void> {
  const docRef = doc(db, 'appointments', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
  }
}
