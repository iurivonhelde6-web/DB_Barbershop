import React from 'react';

// Importa a imagem que está na mesma pasta (./)
import logoImg from './logo.svg';

interface DbLogoProps {
  className?: string;
  size?: number;
}

export const DbLogo: React.FC<DbLogoProps> = ({ className = 'w-12 h-12', size }) => {
  return (
    <img
      src={logoImg}
      alt="Logo Barbershop"
      className={`${className} rounded-full object-cover shrink-0 drop-shadow-md select-none`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
};