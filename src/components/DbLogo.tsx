import React from 'react';

interface DbLogoProps {
  className?: string;
  size?: number;
}

/**
 * Official Barbershop Ded Black Logo
 * Features concentric double rings, "DESDE 2001", "BARBERSHOP", 
 * and the iconic condensed "DB" monogram sliced diagonally by a straight razor.
 */
export const DbLogo: React.FC<DbLogoProps> = ({ className = 'w-12 h-12', size }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${className} shrink-0 drop-shadow-md select-none`}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Circle Background */}
      <circle cx="100" cy="100" r="96" fill="#121512" stroke="#3b4629" strokeWidth="2" />
      
      {/* Double Concentric Rings */}
      <circle cx="100" cy="100" r="92" stroke="#8a9a60" strokeWidth="2.2" fill="none" />
      <circle cx="100" cy="100" r="82" stroke="#8a9a60" strokeWidth="1.2" fill="none" opacity="0.85" />

      {/* Curved Text Paths */}
      <defs>
        {/* Top Arc Path */}
        <path id="dbArcTop" d="M 32,100 A 68,68 0 0,1 168,100" />
        {/* Bottom Arc Path */}
        <path id="dbArcBottom" d="M 168,100 A 68,68 0 0,1 32,100" />
      </defs>

      {/* "DESDE 2001" Text along Top Arc */}
      <text fill="#8a9a60" fontSize="11" fontWeight="bold" letterSpacing="3.5" textAnchor="middle" fontFamily="sans-serif">
        <textPath href="#dbArcTop" startOffset="50%">
          DESDE 2001
        </textPath>
      </text>

      {/* "BARBERSHOP" Text along Bottom Arc */}
      <text fill="#8a9a60" fontSize="11" fontWeight="bold" letterSpacing="4" textAnchor="middle" fontFamily="sans-serif">
        <textPath href="#dbArcBottom" startOffset="50%">
          BARBERSHOP
        </textPath>
      </text>

      {/* Side Decorative Dash Bullets */}
      <circle cx="34" cy="100" r="2.2" fill="#8a9a60" />
      <circle cx="166" cy="100" r="2.2" fill="#8a9a60" />

      {/* Central DB Monogram Group */}
      <g>
        {/* Letter 'D' Block */}
        <path
          d="M 56,60 L 78,60 C 93,60 101,68 101,84 L 101,116 C 101,132 93,140 78,140 L 56,140 Z 
             M 69,73 L 69,127 L 77,127 C 86,127 89,122 89,112 L 89,88 C 89,78 86,73 77,73 Z"
          fill="#8a9a60"
        />

        {/* Letter 'B' Block */}
        <path
          d="M 103,60 L 128,60 C 139,60 145,66 145,75 C 145,82 140,87 133,89 C 141,91 146,97 146,108 C 146,120 139,140 126,140 L 103,140 Z 
             M 116,73 L 116,92 L 126,92 C 131,92 133,89 133,83 C 133,77 131,73 126,73 Z 
             M 116,103 L 116,127 L 126,127 C 132,127 134,122 134,115 C 134,108 132,103 126,103 Z"
          fill="#8a9a60"
        />

        {/* Diagonal Straight Razor Cut Slicing through DB */}
        <polygon
          points="42,124 158,68 162,76 46,132"
          fill="#121512"
        />

        {/* Straight Razor Blade Metallic Accent Line & Handle */}
        <line x1="44" y1="128" x2="160" y2="72" stroke="#8a9a60" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="44" cy="128" r="3" fill="#8a9a60" />
      </g>
    </svg>
  );
};
