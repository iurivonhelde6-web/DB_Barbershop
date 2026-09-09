import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DbLogo } from './DbLogo';

interface SplashScreenProps {
  /** Chamado quando toda a animação (incluindo o fade out) termina */
  onFinished: () => void;
  /** Caminho opcional de uma imagem para substituir o <DbLogo /> padrão */
  logoSrc?: string;
}

// Duração total da tela até começar o fade out (ms)
const HOLD_MS = 2300;
// Duração do fade out final (ms)
const FADE_OUT_MS = 600;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished, logoSrc }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const hasFinishedRef = useRef(false);

  // Mantém a callback atualizada sem reiniciar os timers a cada render do pai
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), HOLD_MS);
    const finishTimer = window.setTimeout(() => {
      if (hasFinishedRef.current) return;
      hasFinishedRef.current = true;
      onFinishedRef.current();
    }, HOLD_MS + FADE_OUT_MS);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isLeaving ? 0 : 1 }}
      transition={{ duration: isLeaving ? FADE_OUT_MS / 1000 : 0.5, ease: 'easeInOut' }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black text-stone-100"
    >
      {/* Fundo em gradiente escuro (preto → verde escuro da marca) */}
      <motion.div
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#1b2a18_0%,#0b0f0a_55%,#000000_100%)]"
      />

      {/* Brilho suave atrás do logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.35, scale: 1 }}
        transition={{ delay: 0.3, duration: 1.4, ease: 'easeOut' }}
        className="absolute w-[420px] h-[420px] rounded-full bg-[#94a288]/20 blur-[120px]"
      />

      {/* Conteúdo */}
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {/* Logo com fade + scale */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Ded Black Barbershop"
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover select-none drop-shadow-[0_0_35px_rgba(148,162,136,0.35)]"
            />
          ) : (
            <DbLogo className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-[0_0_35px_rgba(148,162,136,0.35)]" />
          )}
        </motion.div>

        {/* Nome da marca */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.7, ease: 'easeOut' }}
          className="space-y-1"
        >
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-[0.2em] text-white">
            DED BLACK
          </h1>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.45em] text-[#94a288] font-bold">
            Barbershop &bull; DB Club
          </p>
        </motion.div>

        {/* Frase de assinatura */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, duration: 0.8, ease: 'easeOut' }}
          className="max-w-xs text-xs sm:text-sm text-stone-400 leading-relaxed"
        >
          Estilo, precisão e tradição — o seu clube de assinatura na cadeira certa.
        </motion.p>
      </div>

      {/* Barra de progresso sutil */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute bottom-16 h-[2px] w-40 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ delay: 1.1, duration: (HOLD_MS - 1100) / 1000, ease: 'easeInOut' }}
          className="h-full bg-[#94a288]"
        />
      </motion.div>
    </motion.div>
  );
};
