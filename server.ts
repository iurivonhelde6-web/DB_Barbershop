import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getApps as getAdminApps, initializeApp as initializeAdminApp, cert, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { PLANS_LIST } from './src/data/barberData';
import { registerStripeRoutes } from './stripe-routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ─── Firebase Client SDK (para uso no backend de rotas legadas) ───────────────
// ─── Firebase Client SDK (Backend Reflector) ──────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'dazzling-mercury-f6shk',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── Firebase Admin SDK (Apenas Autenticação) ─────────────────────────
const adminApp = getAdminApps().length > 0
  ? getAdminApp()
  : initializeAdminApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAdminAuth(adminApp);

// ─── IMPORTANTE: Stripe webhook precisa de raw body — registrar ANTES do json parser ──
// O express.raw é aplicado inline na rota do webhook dentro de registerStripeRoutes.
// Registramos as rotas Stripe aqui, antes de qualquer body-parser global.
registerStripeRoutes(app, db);

// ─── Body Parsers (aplicados APÓS as rotas que precisam de raw body) ──────────
app.use(express.json({ limit: '1mb' }));

// ─── Rate Limiter in-memory com limpeza periódica ────────────────────────────
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpa entradas expiradas a cada 5 minutos para evitar memory leak.
// OBS: em serverless (Vercel) cada invocação pode rodar numa instância nova,
// então esse setInterval só é útil de fato quando o processo fica de pé
// (rodando local ou fora da Vercel). Isso não quebra nada, só fica menos
// eficaz — o Map some quando a instância é reciclada de qualquer forma.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

const rateLimiterMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string || req.ip || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const windowMs = 60 * 1000; // janela de 1 minuto
  const maxRequests = 15;      // 15 requisições de IA por minuto por IP

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Limite de requisições excedido. Por favor, aguarde alguns instantes antes de enviar nova mensagem.',
      retryAfterSeconds: retryAfter,
    });
  }

  record.count += 1;
  next();
};

// ─── Auth Middlewares ─────────────────────────────────────────────────────────
const authCheckMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação obrigatório.' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(token);
    (req as any).firebaseUser = decoded;
    next();
  } catch (err) {
    console.warn('[Auth] Token Firebase inválido:', err instanceof Error ? err.message : err);
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
};

const requireAdminRole = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação obrigatório.', code: 'UNAUTHENTICATED' });
    }

    const decoded = (req as any).firebaseUser || await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length).trim());
    const userId = decoded.uid;
    const email = String(decoded.email || '').toLowerCase();
    const MASTER_ADMIN_EMAIL = String(process .env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'blackmmania@gmail.com').toLowerCase();

    let isAdmin = email === MASTER_ADMIN_EMAIL;
    let databaseRole = 'client';

    if (!isAdmin) {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (userSnap.exists()) {
    databaseRole = userSnap.data()?.role || 'client';
    isAdmin = databaseRole === 'admin';
  }
}

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Acesso negado: privilégios de administrador são necessários.',
        code: 'FORBIDDEN_NOT_ADMIN',
        currentRole: databaseRole,
      });
    }

    (req as any).authenticatedAdmin = { uid: userId, email: decoded.email || null, role: 'admin' };
    next();
  } catch (err) {
    console.error('[Admin Auth] Falha na validação:', err);
    return res.status(401).json({ error: 'Falha na validação da sessão administrativa.', code: 'UNAUTHENTICATED' });
  }
};

function sanitizeServerInput(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

// ─── Payment Intent (Stripe direto) ──────────────────────────────────────────


app.post('/api/payment/create-intent', authCheckMiddleware, async (req, res) => {
  try {
    const { planName, planAmount, clientName, clientCpf, paymentMethod } = req.body || {};
    const amount = Number(planAmount);
    const cleanCpf = typeof clientCpf === 'string' ? clientCpf.replace(/\D/g, '') : '';

    if (!clientName || typeof clientName !== 'string' || clientName.trim().length < 3) {
      return res.status(400).json({ error: 'Nome do cliente inválido.' });
    }
    if (!/^\d{11}$/.test(cleanCpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor do plano inválido.' });
    }

    const validPlan = PLANS_LIST.find((p) => p.tierLabel === planName || p.serviceName === planName || p.id === planName);
    if (!validPlan || Math.abs(validPlan.totalPrice - amount) > 0.01) {
      return res.status(400).json({ error: 'Plano ou valor inválido.' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || (process.env.NODE_ENV === 'production' && !stripeKey.startsWith('sk_live_'))) {
      return res.status(503).json({ error: 'Gateway de pagamento não configurado para produção.' });
    }

    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeKey);

    if (paymentMethod !== 'CREDIT_CARD') {
      return res.status(501).json({ error: 'PIX ainda não está integrado a um PSP real. Não é permitido liberar pagamento por simulação.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'brl',
      payment_method_types: ['card'],
      description: `Assinatura Ded Black: ${validPlan.tierLabel}`,
      metadata: { planId: validPlan.id, clientName: clientName.trim(), clientCpf: cleanCpf },
    });

    return res.json({ success: true, transactionId: paymentIntent.id, clientSecret: paymentIntent.client_secret, status: paymentIntent.status });
  } catch (err) {
    console.error('Erro na criação de Payment Intent:', err);
    return res.status(500).json({ error: 'Erro ao processar transação de pagamento.' });
  }
});

app.post('/api/payment/verify-status', async (_req, res) => {
  return res.status(410).json({
    error: 'Endpoint descontinuado. O cliente não pode declarar um pagamento como concluído; a confirmação deve vir do gateway/webhook.',
  });
});





// ─── Admin Endpoints ──────────────────────────────────────────────────────────
app.post('/api/admin/verify-role', requireAdminRole, async (req, res) => {
  const adminContext = (req as any).authenticatedAdmin;
  res.json({
    status: 'success', verified: true, role: 'admin',
    message: 'Identidade e papel de administrador verificados e validados no banco de dados Firestore.',
    admin: adminContext,
  });
});

app.post('/api/admin/action', requireAdminRole, async (req, res) => {
  try {
    const { action } = req.body;
    if (!action) return res.status(400).json({ error: 'Ação administrativa não especificada.' });
    return res.json({ status: 'success', actionExecuted: action, verifiedByBackend: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao processar ação administrativa.' });
  }
});

// ─── Backup Service ───────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function exportFirestoreDataToJSON(): Promise<{
  success: boolean; filename?: string; backupPath?: string; timestamp?: string;
  subscribersCount?: number; appointmentsCount?: number; usersCount?: number; error?: string;
}> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const subscribersList: any[] = [];
    const appointmentsList: any[] = [];
    const usersList: any[] = [];

    // Usa Admin SDK para backup (bypassa regras Firestore, mais confiável no backend)
    // Busca os dados usando o Client SDK (db)
    try {
      const subSnap = await getDocs(collection(db, 'subscribers'));
      subSnap.forEach((d: any) => subscribersList.push({ id: d.id, ...d.data() }));
    } catch (e: any) { console.warn('Aviso ao consultar subscribers para backup:', e?.message); }

    try {
      const aptSnap = await getDocs(collection(db, 'appointments'));
      aptSnap.forEach((d: any) => appointmentsList.push({ id: d.id, ...d.data() }));
    } catch (e: any) { console.warn('Aviso ao consultar appointments para backup:', e?.message); }

    try {
      const usrSnap = await getDocs(collection(db, 'users'));
      usrSnap.forEach((d: any) => usersList.push({ id: d.id, ...d.data() }));
    } catch (e: any) { console.warn('Aviso ao consultar users para backup:', e?.message); }

    const now = new Date();
    const timestampStr = now.toISOString();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `backup_db_barbershop_${dateFormatted}.json`;
    const fullPath = path.join(BACKUP_DIR, filename);
    const latestPath = path.join(BACKUP_DIR, 'latest-backup.json');

    const backupPayload = {
      app: 'Ded Black Barbershop - Backup de Segurança Extra', backupTimestamp: timestampStr,
      generatedAtFormatted: now.toLocaleString('pt-BR'),
      counts: { subscribers: subscribersList.length, appointments: appointmentsList.length, users: usersList.length },
      subscribers: subscribersList, appointments: appointmentsList, users: usersList,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(fullPath, jsonString, 'utf-8');
    fs.writeFileSync(latestPath, jsonString, 'utf-8');
    console.log(`[Backup] Gerado: ${filename} | Assinantes: ${subscribersList.length} | Agendamentos: ${appointmentsList.length} | Usuários: ${usersList.length}`);

    // Manter no máximo 30 backups
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_db_barbershop_') && f.endsWith('.json'));
      if (files.length > 30) {
        files.sort().slice(0, files.length - 30).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
      }
    } catch (pruneErr) { console.warn('Aviso ao prunar backups:', pruneErr); }

    return { success: true, filename, backupPath: fullPath, timestamp: timestampStr, subscribersCount: subscribersList.length, appointmentsCount: appointmentsList.length, usersCount: usersList.length };
  } catch (err: any) {
    console.error('Erro ao executar rotina de backup:', err);
    return { success: false, error: err?.message || 'Erro ao gerar backup no servidor.' };
  }
}

// Backup periódico a cada hora.
// OBS: mesma ressalva do rate-limiter acima — em serverless isso só roda
// enquanto a instância da function ficar viva (nem sempre garantido). Pra um
// backup confiável em produção na Vercel, o ideal é migrar isso pra um
// Vercel Cron Job chamando /api/admin/backup/export periodicamente.
setInterval(() => {
  exportFirestoreDataToJSON().catch(err => console.error('Erro no backup periódico:', err));
}, 60 * 60 * 1000);

// Backup inicial 12s após o boot
setTimeout(() => {
  exportFirestoreDataToJSON().catch(err => console.error('Erro no backup inicial:', err));
}, 12000);

app.post('/api/admin/backup/export', requireAdminRole, async (_req, res) => {
  try {
    const result = await exportFirestoreDataToJSON();
    if (!result.success) return res.status(500).json({ error: result.error || 'Erro ao gerar cópia de segurança.' });
    return res.json({ status: 'success', message: 'Backup exportado com sucesso!', ...result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao disparar exportação de backup.' });
  }
});

app.get('/api/admin/backup/latest', requireAdminRole, async (_req, res) => {
  try {
    const latestPath = path.join(BACKUP_DIR, 'latest-backup.json');
    if (!fs.existsSync(latestPath)) {
      return res.json({ exists: false, message: 'Nenhum backup encontrado ainda. Você pode disparar um agora.' });
    }
    const fileContent = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
    const files = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json') && f !== 'latest-backup.json').reverse() : [];
    return res.json({ exists: true, backupTimestamp: fileContent.backupTimestamp, generatedAtFormatted: fileContent.generatedAtFormatted, counts: fileContent.counts, availableFiles: files.slice(0, 10) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao consultar status do último backup.' });
  }
});

app.get('/api/admin/backup/download', requireAdminRole, async (req, res) => {
  try {
    const requestedFile = req.query.file as string;
    let targetFileName = 'latest-backup.json';
    if (requestedFile) {
      const sanitized = path.basename(requestedFile);
      if (sanitized.endsWith('.json') && (sanitized.startsWith('backup_db_barbershop_') || sanitized === 'latest-backup.json')) {
        targetFileName = sanitized;
      }
    }
    const filePath = path.join(BACKUP_DIR, targetFileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo de backup não encontrado.' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${targetFileName}"`);
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao fazer download do arquivo de backup.' });
  }
});

// ─── AI Chat Endpoint ─────────────────────────────────────────────────────────
app.post('/api/chat', rateLimiterMiddleware, authCheckMiddleware, async (req, res) => {
  try {
    const { prompt, context, message } = req.body;
    const rawPrompt = prompt || message;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      return res.status(400).json({ error: 'Prompt é obrigatório e deve ser um texto válido.' });
    }

    const cleanPrompt = sanitizeServerInput(rawPrompt);
    if (cleanPrompt.length > 2000) {
      return res.status(400).json({ error: 'Sua mensagem excede o limite máximo de 2000 caracteres.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ reply: 'Olá! Sou o assistente da Barbearia Ded Black. O plano FLEX PREMIUM é o mais completo para quem busca total liberdade entre corte na tesoura, disfarce e barba! Se precisar simular economias ou conferir as regras de comissão, utilize nossos simuladores interativos nas abas acima.' });
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    const systemInstruction = `Você é o Consultor Especialista de Planos, Visagismo Masculino e Negócios da Barbearia Ded Black (D•B BARBERSHOP).
Você é educado, profissional, atencioso e especialista em visagismo de barba, tipos de rosto, estilos de corte, produtos da marca e regras do contrato/assinaturas (BASIC, PLUS, SELECT, FAMILY, FLEX PREMIUM).

Linha de Produtos Oficiais da Barbearia Ded Black:
1. Óleo Hidratante de Barba D•B (Nutrição com óleos nobres, brilho natural e perfume exclusivo).
2. Balm Alinhador de Barba D•B (Maciez, controle do frizz e hidratação da pele sob a barba).
3. Shampoo Especial de Barba D•B (Higienização profunda, refrescância e desobstrução dos poros).
4. Pomada Matte Estilizadora D•B (Fixação alta, efeito seco sem brilho para barba e cabelo).
5. Pente de Madeira Antiestático D•B (Remove o frizz e distribui os óleos naturais).

Guia de Visagismo de Barba por Tipo de Rosto:
- Rosto Redondo: Estilos alongados com laterais baixas/degradê e queixo marcado.
- Rosto Quadrado: Estilos arredondados ou suaves para suavizar as linhas da mandíbula.
- Rosto Oval: Altamente versátil! Fica excelente com Barba Full Beard, Lenhador, Stubble ou desenhada.
- Rosto Triangular: Estilos com volume nas laterais e queixo preenchido para equilibrar a parte inferior.
- Rosto Diamante: Barba com bom volume no queixo e mandíbula para suavizar maçãs proeminentes.

Informações de Planos & Regras da Ded Black:
- Planos disponíveis: BASIC MEMBER, PLUS MEMBER, SELECT MEMBER ⭐, FAMILY, FLEX PREMIUM ⚫.
- Principais Regras:
  1. Atendimentos não utilizados NÃO acumulam.
  2. Apresentação do Cartão de Controle obrigatória.
  3. Tolerância de atraso: máximo 10 minutos. Cancelamento com no mínimo 2h de antecedência.
  4. Atendimentos por qualquer barbeiro da equipe disponível.`;

    const userPrompt = context ? `Contexto: ${JSON.stringify(context)}\n\nPergunta: ${cleanPrompt}` : cleanPrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: { systemInstruction, temperature: 0.7 },
    });

    const replyText = response.text || 'Desculpe, não consegui processar a resposta no momento.';
    return res.json({ reply: replyText, status: 'success' });
  } catch (err: any) {
    console.error('Erro na chamada Gemini:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar assistente.', details: err.message });
  }
});

// Alias de compatibilidade
app.post('/api/gemini/assistant', rateLimiterMiddleware, authCheckMiddleware, async (req, res, next) => {
  req.url = '/api/chat';
  app(req, res, next);
});

// ─── Vite / Static (apenas fora da Vercel) ─────────────────────────────────────
// Na Vercel cada request é uma invocação serverless isolada: não existe processo
// de longa duração, e os arquivos estáticos (dist) já são servidos pela própria
// Vercel via vercel.json — então nunca chamamos .listen() nem montamos o Vite
// middleware/estático quando VERCEL está definido. Local (npm run dev) ou em
// qualquer outro host que rode Node "de verdade" (Render, Railway, VPS...),
// o comportamento continua idêntico ao original.
if (!process.env.VERCEL) {
  (async function start() {
    if (process.env.NODE_ENV !== 'production') {
      const isHmrDisabled = process.env.DISABLE_HMR === 'true';
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: isHmrDisabled ? false : { server } },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Ded Black App] Servidor rodando em http://localhost:${PORT}`);
    });
  })();
}

// Exportado como default: é isso que o @vercel/node usa como handler
// serverless (Express funciona como um (req, res) => void normal).
export default app;