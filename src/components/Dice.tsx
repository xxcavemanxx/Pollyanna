import React, { useState, useEffect } from 'react';
import './Dice.css';

interface DiceProps {
  values: number[];
  isRolling: boolean;
  onRollClick?: () => void;
  disabled?: boolean;
}

export const Dice: React.FC<DiceProps> = ({ values, isRolling, onRollClick, disabled }) => {
  const [localRolling, setLocalRolling] = useState(false);

  const valuesString = values.join(',');

  useEffect(() => {
    if (isRolling) {
      setLocalRolling(true);
      const timer = setTimeout(() => setLocalRolling(false), 600);
      return () => clearTimeout(timer);
    } else {
      setLocalRolling(false);
    }
  }, [isRolling, valuesString]);

  // Rotations mapped to show face values [1-6] on front of the 3D cube
  const getFaceRotation = (val: number) => {
    switch (val) {
      case 1: return 'rotateX(0deg) rotateY(0deg)';
      case 2: return 'rotateX(-90deg) rotateY(0deg)';
      case 3: return 'rotateX(0deg) rotateY(90deg)';
      case 4: return 'rotateX(0deg) rotateY(-90deg)';
      case 5: return 'rotateX(90deg) rotateY(0deg)';
      case 6: return 'rotateX(180deg) rotateY(0deg)';
      default: return 'rotateX(0deg) rotateY(0deg)';
    }
  };

  const renderDots = (count: number) => {
    const dotsMap: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };
    
    const activeDots = dotsMap[count] || [];
    return (
      <div className="dice-dots-grid">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div 
            key={idx} 
            className={`dice-dot ${activeDots.includes(idx) ? 'active' : ''}`}
          />
        ))}
      </div>
    );
  };

  const diceVal1 = values[0] || 1;
  const diceVal2 = values[1] || 1;

  return (
    <div className="dice-container">
      <div className="dice-row">
        {/* Die 1 */}
        <div className="dice-scene">
          <div 
            className={`die-cube ${localRolling ? 'rolling' : ''}`}
            style={{ transform: localRolling ? undefined : getFaceRotation(diceVal1) }}
          >
            <div className="die-face front">{renderDots(1)}</div>
            <div className="die-face back">{renderDots(6)}</div>
            <div className="die-face right">{renderDots(3)}</div>
            <div className="die-face left">{renderDots(4)}</div>
            <div className="die-face top">{renderDots(5)}</div>
            <div className="die-face bottom">{renderDots(2)}</div>
          </div>
        </div>

        {/* Die 2 */}
        <div className="dice-scene">
          <div 
            className={`die-cube ${localRolling ? 'rolling' : ''}`}
            style={{ transform: localRolling ? undefined : getFaceRotation(diceVal2) }}
          >
            <div className="die-face front">{renderDots(1)}</div>
            <div className="die-face back">{renderDots(6)}</div>
            <div className="die-face right">{renderDots(3)}</div>
            <div className="die-face left">{renderDots(4)}</div>
            <div className="die-face top">{renderDots(5)}</div>
            <div className="die-face bottom">{renderDots(2)}</div>
          </div>
        </div>
      </div>

      {onRollClick && (
        <button 
          onClick={onRollClick}
          disabled={disabled || localRolling}
          className="btn-premium btn-primary roll-btn"
        >
          {localRolling ? 'Rolling...' : '🎲 Roll Dice'}
        </button>
      )}
    </div>
  );
};
