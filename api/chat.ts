declare var process: any;

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
    try {
    const { prompt } = await request.json();

    if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt não fornecido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    });
    }

    const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: `Você é o assistente virtual oficial da Barbearia Ded Black (D•B Barbershop).
Sua missão é conversar de forma amigável, acolhedora e prestativa com os clientes.
Tire dúvidas gerais sobre serviços, agendamentos, cortes, planos de assinatura e visagismo de barba.
Atenda o cliente de forma aberta, sem se limitar a apenas um plano, e sempre termine com uma pergunta gentil para manter a conversa fluida.`,
    });

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    });
} catch (error) {
    console.error('Erro na Vercel Function:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao consultar a IA' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
    });
}
}