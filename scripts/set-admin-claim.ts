/**
 * Define (ou remove) o custom claim `admin` de uma conta do Firebase Auth.
 *
 * O papel de administrador do D•B passou a vir exclusivamente deste claim — ele é
 * assinado pelo Firebase, verificado nas regras do Firestore (request.auth.token.admin)
 * e no backend, e não pode ser forjado pelo navegador.
 *
 * Uso:
 *   npm run set-admin -- email@dominio.com          # concede admin
 *   npm run set-admin -- email@dominio.com --revoke # revoga admin
 *
 * Requer a credencial de serviço na variável FIREBASE_SERVICE_ACCOUNT_JSON
 * (o mesmo JSON que o server.ts já consome).
 */
import 'dotenv/config';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function buildCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return cert(JSON.parse(raw));
    } catch (err) {
      console.error('[set-admin] FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido:', err);
      process.exit(1);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();

  console.error(
    '[set-admin] Nenhuma credencial encontrada.\n' +
      '  Defina FIREBASE_SERVICE_ACCOUNT_JSON (conteúdo do JSON da conta de serviço)\n' +
      '  ou GOOGLE_APPLICATION_CREDENTIALS (caminho do arquivo) antes de rodar.'
  );
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes('--revoke');
  const email = args.find((arg) => !arg.startsWith('--'));

  if (!email) {
    console.error('Uso: npm run set-admin -- email@dominio.com [--revoke]');
    process.exit(1);
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: buildCredential() });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(
      `[set-admin] Nenhuma conta encontrada para "${email}".\n` +
        '  A pessoa precisa fazer login no app pelo menos uma vez antes de receber o papel.'
    );
    process.exit(1);
  }

  const existingClaims = user.customClaims || {};
  const nextClaims = { ...existingClaims, admin: revoke ? false : true };

  await auth.setCustomUserClaims(user.uid, nextClaims);
  await db.collection('users').doc(user.uid).set(
    { role: revoke ? 'client' : 'admin', roleUpdatedAt: new Date().toISOString() },
    { merge: true }
  );
  // Invalida os refresh tokens para que o novo papel valha na próxima sessão
  await auth.revokeRefreshTokens(user.uid);

  console.log(
    `[set-admin] ${revoke ? 'Admin REVOGADO de' : 'Admin concedido a'} ${email} (uid ${user.uid}).\n` +
      '  A pessoa precisa sair e entrar de novo no app para o novo token valer.'
  );
}

main().catch((err) => {
  console.error('[set-admin] Falha:', err);
  process.exit(1);
});
