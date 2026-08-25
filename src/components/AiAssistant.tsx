import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { Bot, Send, Sparkles, User, RefreshCw, Scissors, Compass, ShieldAlert } from 'lucide-react';
import { sanitizeText } from '../utils/sanitize';
import { getAuthHeaders } from '../lib/firebase';

export const AiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Olá! Sou o Consultor Especialista em Visagismo, Barba e Planos da Barbearia Ded Black (D•B Barbershop). Como posso ajudar você hoje com recomendações de planos, dicas de estilo de barba para o seu tipo de rosto ou produtos da nossa marca?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFaceShape, setSelectedFaceShape] = useState<string>('');

  const faceShapes = [
    { id: 'redondo', label: 'Rosto Redondo', desc: 'Aproximadamente mesma largura e comprimento, traços suaves' },
    { id: 'quadrado', label: 'Rosto Quadrado', desc: 'Mandíbula bem marcada e alinhada com as têmporas' },
    { id: 'oval', label: 'Rosto Oval', desc: 'Ligeiramente mais longo do que largo, proporções equilibradas' },
    { id: 'triangular', label: 'Rosto Triangular', desc: 'Mandíbula mais larga e testa mais estreita' },
    { id: 'diamante', label: 'Rosto Diamante', desc: 'Maçãs do rosto bem destacadas, queixo e testa afunilados' },
  ];

  const quickPrompts = [
    '💈 Dicas de barba para o meu tipo de rosto',
    'Qual o plano mais recomendado para quem corta a cada 10 dias e faz barba?',
    'Como funciona a comissão do barbeiro e o lucro da casa no Disfarce Tesoura?',
    'Quem tem plano de Corte Simples pode trocar por Disfarce Tesoura?',
    'Por que o FLEX PREMIUM é a melhor escolha para clientes exigentes?',
  ];

  const handleSelectFaceShape = (shapeLabel: string) => {
    setSelectedFaceShape(shapeLabel);
    const customPrompt = `Gostaria de Dicas de Barba! Meu formato de rosto é ${shapeLabel}. Quais estilos de barba (corte, desenho e comprimento) combinam melhor com a minha estrutura facial e quais produtos da marca Barbearia Ded Black devo usar para manter a barba impecável?`;
    handleSendMessage(customPrompt);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawPromptText = textToSend || inputPrompt;
    const cleanPrompt = sanitizeText(rawPromptText);
    if (!cleanPrompt.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prompt: cleanPrompt }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ast-ratelimit-${Date.now()}`,
            sender: 'assistant',
            text: sanitizeText(data.error || 'Muitas requisições enviadas em pouco tempo. Por favor, aguarde alguns segundos antes de tentar novamente.'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      if (response.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ast-auth-${Date.now()}`,
            sender: 'assistant',
            text: sanitizeText(data.error || 'Acesso não autorizado para consulta da IA.'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: sanitizeText(data.reply || 'Desculpe, ocorreu uma falha na resposta da consulta.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ast-err-${Date.now()}`,
          sender: 'assistant',
          text: sanitizeText('O plano FLEX PREMIUM é o mais completo! Para trocas de serviço ou regras de tolerância, consulte nosso guia rápido na aba Regras.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0c0c0c] min-h-screen text-[#e0e0e0] max-w-4xl mx-auto px-4 py-8 space-y-6 pb-16">
      {/* Header */}
      <div className="border-b border-[#556b2f]/30 pb-5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#556b2f]/20 text-[#556b2f] text-[10px] font-bold uppercase tracking-[0.3em] mb-2 border border-[#556b2f]/40">
          <Bot className="w-3.5 h-3.5 text-[#556b2f]" />
          Inteligência Artificial Ded Black
        </span>
        <h2 className="text-3xl font-serif italic text-white">
          Consultor de Planos &amp; Dicas de Barba (Gemini)
        </h2>
        <p className="text-xs sm:text-sm text-stone-400 mt-1 opacity-80">
          Análise de visagismo de barba por tipo de rosto, recomendação de produtos oficiais da marca Ded Black e orientação sobre planos de assinatura.
        </p>
      </div>

      {/* Beard & Face Shape Visagism Section */}
      <div className="bg-[#151515] p-5 rounded-lg border border-[#556b2f]/40 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <span className="text-xs font-bold text-[#556b2f] uppercase tracking-wider flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#556b2f]" />
            💈 Dicas de Barba: Análise por Tipo de Rosto
          </span>
          <span className="text-[10px] bg-[#0a0a0a] text-stone-400 px-2.5 py-1 rounded border border-white/5 font-mono">
            IA Visagismo Ded Black
          </span>
        </div>
        <p className="text-xs text-stone-300">
          Selecione o seu formato de rosto abaixo para receber estilos de barba sob medida e recomendação de produtos da marca D•B:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
          {faceShapes.map((shape) => (
            <button
              key={shape.id}
              onClick={() => handleSelectFaceShape(shape.label)}
              className={`p-2.5 rounded border text-left transition flex flex-col justify-between ${
                selectedFaceShape === shape.label
                  ? 'bg-[#556b2f]/20 border-[#556b2f] text-white shadow-lg'
                  : 'bg-[#0a0a0a] border-white/10 hover:border-[#556b2f]/50 text-stone-300 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold text-[#556b2f] flex items-center gap-1 mb-1">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>{shape.label}</span>
              </div>
              <span className="text-[10px] text-stone-400 line-clamp-2 leading-tight">
                {shape.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Quick Questions */}
      <div>
        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">
          Perguntas Frequentes Sugeridas:
        </label>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="text-left text-xs bg-[#151515] hover:bg-[#556b2f]/20 text-stone-300 hover:text-white px-3.5 py-2 rounded border border-white/5 hover:border-[#556b2f]/40 transition"
            >
              💡 {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-[#151515] rounded border border-[#556b2f]/20 shadow-2xl flex flex-col h-[520px] overflow-hidden">
        {/* Chat Messages Stream */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isAst = msg.sender === 'assistant';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isAst ? 'justify-start' : 'justify-end'}`}
              >
                {isAst && (
                  <div className="w-8 h-8 rounded bg-[#0a0a0a] text-[#556b2f] border border-[#556b2f]/40 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-md ${
                    isAst
                      ? 'bg-[#0a0a0a] text-stone-200 border border-white/5'
                      : 'bg-[#556b2f] text-black font-semibold'
                  }`}
                >
                  <p>{sanitizeText(msg.text)}</p>
                  <span
                    className={`text-[10px] block mt-2 text-right ${
                      isAst ? 'text-stone-500 font-mono' : 'text-black/70 font-mono'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {!isAst && (
                  <div className="w-8 h-8 rounded bg-[#202020] text-stone-200 flex items-center justify-center shrink-0 mt-1 border border-white/10">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-[#556b2f] text-xs font-semibold p-2 uppercase tracking-wider">
              <RefreshCw className="w-4 h-4 animate-spin text-[#556b2f]" />
              <span>Consultor Ded Black analisando e gerando recomendações...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-[#0a0a0a] border-t border-white/5 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Digite sua dúvida ou informe seu tipo de rosto..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-[#151515] text-stone-100 text-xs sm:text-sm rounded px-4 py-3 border border-[#556b2f]/30 focus:outline-none focus:border-[#556b2f]"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="px-5 py-3 rounded bg-[#556b2f] hover:bg-[#6b863a] disabled:opacity-50 text-black text-[10px] font-bold uppercase tracking-widest transition flex items-center gap-2 shadow-lg"
          >
            <Send className="w-4 h-4 text-black" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
