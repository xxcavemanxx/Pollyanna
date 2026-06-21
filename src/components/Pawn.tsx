import React from 'react';

interface PawnProps {
  color: 'green' | 'yellow' | 'red' | 'blue';
  x: number;
  y: number;
  isSelectable: boolean;
  onClick?: () => void;
  isPulsing?: boolean;
}

export const Pawn: React.FC<PawnProps> = ({ 
  color, 
  x, 
  y, 
  isSelectable, 
  onClick,
  isPulsing = false
}) => {
  
  // Custom linear gradients for rich wooden/marble feel
  const getGradientColors = () => {
    switch (color) {
      case 'green':
        return { light: '#34d399', dark: '#065f46', highlight: '#a7f3d0' };
      case 'yellow':
        return { light: '#fbbf24', dark: '#92400e', highlight: '#fde68a' };
      case 'red':
        return { light: '#f87171', dark: '#991b1b', highlight: '#fecaca' };
      case 'blue':
        return { light: '#60a5fa', dark: '#1e40af', highlight: '#dbeafe' };
    }
  };

  const colors = getGradientColors();
  const gradientId = `pawn-grad-${color}-${x}-${y}`;

  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      onClick={isSelectable ? onClick : undefined}
      style={{ 
        cursor: isSelectable ? 'pointer' : 'default',
        transition: 'transform 0.18s cubic-bezier(0.25, 1, 0.5, 1)' 
      }}
      className={isPulsing ? 'active-pawn-hop' : ''}
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={colors.highlight} />
          <stop offset="40%" stopColor={colors.light} />
          <stop offset="100%" stopColor={colors.dark} />
        </radialGradient>
        
        {/* Soft shadow filter */}
        <filter id="pawn-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="5" stdDeviation="3" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Selectable Ring Aura */}
      {isSelectable && (
        <ellipse 
          cx="0" 
          cy="12" 
          rx="18" 
          ry="7" 
          fill="none" 
          stroke="#38bdf8" 
          strokeWidth="2.5" 
          strokeDasharray="4 2"
          className="pulsing-aura"
        >
          <animate 
            attributeName="stroke-dashoffset" 
            values="0;12" 
            dur="1.5s" 
            repeatCount="indefinite" 
          />
        </ellipse>
      )}

      {/* Tactile Shadow */}
      <ellipse 
        cx="0" 
        cy="12" 
        rx="15" 
        ry="6" 
        fill="rgba(0, 0, 0, 0.45)" 
      />

      {/* Base Footing */}
      <ellipse 
        cx="0" 
        cy="10" 
        rx="12" 
        ry="4" 
        fill={`url(#${gradientId})`} 
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.5"
      />

      {/* Body Cone/Skirt */}
      <path 
        d="M -5 -10 C -12 2, -12 8, -12 10 L 12 10 C 12 8, 12 2, 5 -10 Z" 
        fill={`url(#${gradientId})`}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.5"
      />

      {/* Middle Collar */}
      <ellipse 
        cx="0" 
        cy="-10" 
        rx="7" 
        ry="2.5" 
        fill={`url(#${gradientId})`}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.5"
      />

      {/* Top Head Bulb */}
      <circle 
        cx="0" 
        cy="-18" 
        r="8" 
        fill={`url(#${gradientId})`}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.5"
      />

      {/* Glowing Dot on Head Bulb if active */}
      {isSelectable && (
        <circle 
          cx="-2.5" 
          cy="-20.5" 
          r="1.5" 
          fill="#ffffff" 
          opacity="0.8" 
        />
      )}
    </g>
  );
};
