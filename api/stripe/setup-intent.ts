import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // Ajuste para a versão correta da API do Stripe
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permite apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Cria a intenção de configuração de pagamento no Stripe
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
    });

    return res.status(200).json({ clientSecret: setupIntent.client_secret });
  } catch (error: any) {
    console.error('Erro no Stripe:', error);
    return res.status(500).json({ 
      error: error.message || 'Erro ao comunicar com o servidor de pagamento.' 
    });
  }
}