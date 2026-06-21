import React, { useState, useEffect } from 'react';
import { 
  HOME_COORDS, 
  getSpaceCoordinate,
  getStackedPawnCoords
} from '../utils/boardLayout';
import { 
  getLegalMoves, 
  isBlockade,
  type GameState, 
  type LegalMove
} from '../utils/gameLogic';
import { Pawn } from './Pawn';

interface BoardProps {
  // Standard Props
  gameState?: GameState;
  localPlayerId?: string;
  onMoveExecute?: (pawnId: string, stepValue: number, useTurnout: boolean) => void;

  // boardgame.io Client Props
  G?: any;
  ctx?: any;
  moves?: any;
  playerID?: string | null;
}

export const Board: React.FC<BoardProps> = ({ 
  gameState, 
  localPlayerId, 
  onMoveExecute,
  G,
  ctx,
  moves,
  playerID
}) => {
  const [selectedPawnId, setSelectedPawnId] = useState<string | null>(null);
  const [animatingPawn, setAnimatingPawn] = useState<{
    pawnId: string;
    coords: { x: number; y: number }[];
    currentIndex: number;
  } | null>(null);

  let resolvedGameState: GameState;
  let resolvedLocalPlayerId: string;
  let resolvedOnMoveExecute: (pawnId: string, stepValue: number, useTurnout: boolean) => void;

  if (G && ctx && moves) {
    const currentTurn = parseInt(ctx.currentPlayer, 10);
    resolvedGameState = {
      roomId: 'bgio',
      players: G.players,
      pawns: G.pawns,
      currentTurn,
      dice: G.dice,
      remainingMoves: G.remainingMoves,
      hasRolled: G.hasRolled,
      gameStatus: ctx.gameover ? 'ended' : 'playing',
      winnerId: ctx.gameover ? (ctx.gameover.winner ?? null) : null,
      history: G.history,
      rules: G.rules
    };
    resolvedLocalPlayerId = playerID || '';
    resolvedOnMoveExecute = (pawnId, stepValue, useTurnout) => {
      moves.movePawn(pawnId, stepValue, useTurnout);
    };
  } else {
    resolvedGameState = gameState!;
    resolvedLocalPlayerId = localPlayerId!;
    resolvedOnMoveExecute = onMoveExecute!;
  }
  
  const currentTurnPlayer = resolvedGameState.players[resolvedGameState.currentTurn];
  const isLocalTurn = (G && ctx && moves)
    ? ctx.currentPlayer === playerID
    : (currentTurnPlayer && currentTurnPlayer.id === resolvedLocalPlayerId);

  useEffect(() => {
    setSelectedPawnId(null);
  }, [resolvedGameState.currentTurn, resolvedGameState.hasRolled]);

  useEffect(() => {
    if (!animatingPawn) return;
    
    if (animatingPawn.currentIndex < animatingPawn.coords.length - 1) {
      const timer = setTimeout(() => {
        setAnimatingPawn(prev => {
          if (!prev || prev.pawnId !== animatingPawn.pawnId) return prev;
          return {
            ...prev,
            currentIndex: prev.currentIndex + 1
          };
        });
      }, 180); // 180ms per track space step
      return () => clearTimeout(timer);
    } else {
      setAnimatingPawn(null);
    }
  }, [animatingPawn]);

  const rules = resolvedGameState.rules;
  const pawns = resolvedGameState.pawns;

  const legalMoves = (isLocalTurn && resolvedGameState.hasRolled) 
    ? getLegalMoves(resolvedGameState.currentTurn, resolvedGameState.remainingMoves, pawns, rules)
    : [];

  const handlePawnClick = (pawnId: string) => {
    if (!isLocalTurn) return;
    
    if (selectedPawnId === pawnId) {
      setSelectedPawnId(null);
    } else {
      setSelectedPawnId(pawnId);
    }
  };

  const handleTargetClick = (move: LegalMove) => {
    // 1. Calculate the step-by-step path coordinates for visual animation
    const pawn = pawns.find(p => p.id === move.pawnId)!;
    
    const pawnsOnSpace = pawns.filter(o => 
      !o.isFinished &&
      o.space.type === pawn.space.type &&
      o.space.index === pawn.space.index &&
      o.space.playerIndex === pawn.space.playerIndex
    );
    const indexOnSpace = pawnsOnSpace.findIndex(o => o.id === pawn.id);
    const totalOnSpace = pawnsOnSpace.length;
    const startCoord = getStackedPawnCoords(pawn.space, indexOnSpace, totalOnSpace, rules.turnoutExtraLength);

    // Compute the final target coordinates with proper stacking
    const targetPawnsOnSpace = pawns.filter(o => 
      !o.isFinished &&
      o.id !== pawn.id &&
      o.space.type === move.targetSpace.type &&
      o.space.index === move.targetSpace.index &&
      o.space.playerIndex === move.targetSpace.playerIndex
    );
    const targetTotalOnSpace = targetPawnsOnSpace.length + 1;
    const targetIndexOnSpace = targetPawnsOnSpace.length;
    const endCoord = getStackedPawnCoords(move.targetSpace, targetIndexOnSpace, targetTotalOnSpace, rules.turnoutExtraLength);

    const pathCoords = move.path.map((space, idx) => {
      if (idx === move.path.length - 1) {
        return endCoord;
      }
      return getSpaceCoordinate(space, rules.turnoutExtraLength);
    });

    setAnimatingPawn({
      pawnId: move.pawnId,
      coords: [startCoord, ...pathCoords],
      currentIndex: 0
    });

    // 2. Execute actual state changes in game engine
    resolvedOnMoveExecute(move.pawnId, move.stepValue, move.useTurnout);
    setSelectedPawnId(null);
  };

  const activePawnMoves = selectedPawnId 
    ? legalMoves.filter(m => m.pawnId === selectedPawnId)
    : [];

  const getPlayerColorHex = (idx: number) => {
    switch (idx) {
      case 0: return '#006837'; // Forest Green
      case 1: return '#eab308'; // Premium Vibrant Yellow
      case 2: return '#e31b23'; // Warm Red
      case 3: return '#0055c4'; // Royal Blue
      default: return '#9ca3af';
    }
  };

  return (
    <div className="board-wrapper">
      <svg 
        viewBox="0 0 800 800" 
        className="game-board-svg"
        style={{ 
          width: '100%', 
          height: '100%',
          maxWidth: '100%',
          backgroundColor: '#000000',
          borderRadius: '16px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          border: '4px solid #111'
        }}
      >
        <defs>
          {/* Subtle drop shadow filter for pawns */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="4" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Board Background Image */}
        <image href="/board.jpg" x="0" y="0" width="800" height="800" />

        {/* 11. Active Blockade Warning Visual glows */}
        {pawns.map((p, idx) => {
          if (p.isFinished) return null;
          
          const count = pawns.filter(o => 
            !o.isFinished &&
            o.space.type === p.space.type &&
            o.space.index === p.space.index &&
            o.space.playerIndex === p.space.playerIndex
          ).length;

          const isFirstPawn = pawns.findIndex(o => 
            !o.isFinished &&
            o.space.type === p.space.type &&
            o.space.index === p.space.index &&
            o.space.playerIndex === p.space.playerIndex
          ) === idx;

          if (count >= 2 && isFirstPawn && isBlockade(p.space, pawns, rules)) {
            const baseCoord = getSpaceCoordinate(p.space, rules.turnoutExtraLength);
            return (
              <circle 
                key={`blockade-warning-${idx}`}
                cx={baseCoord.x}
                cy={baseCoord.y}
                r="22"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                opacity="0.75"
              >
                <animate 
                  attributeName="r" 
                  values="17;24;17" 
                  dur="1.8s" 
                  repeatCount="indefinite" 
                />
                <animate 
                  attributeName="opacity" 
                  values="0.75;0.1;0.75" 
                  dur="1.8s" 
                  repeatCount="indefinite" 
                />
              </circle>
            );
          }
          return null;
        })}

        {/* 12. Glowing Target Indicators for Legal Moves */}
        {activePawnMoves.map((move, mIdx) => {
          const coord = getSpaceCoordinate(move.targetSpace, rules.turnoutExtraLength);
          return (
            <g 
              key={`target-indicator-${mIdx}`} 
              onClick={() => handleTargetClick(move)}
              style={{ cursor: 'pointer' }}
            >
              <circle 
                cx={coord.x} 
                cy={coord.y} 
                r="19" 
                fill="#0ea5e922" 
                stroke="#0ea5e9" 
                strokeWidth="3" 
                style={{ filter: 'drop-shadow(0 0 6px #0ea5e9)' }}
              >
                <animate 
                  attributeName="fill-opacity" 
                  values="0.1;0.4;0.1" 
                  dur="1.2s" 
                  repeatCount="indefinite" 
                />
              </circle>
              <circle 
                cx={coord.x} 
                cy={coord.y} 
                r="6.5" 
                fill="#0ea5e9" 
              />
              {/* Roll value badge */}
              <rect 
                x={coord.x - 10} 
                y={coord.y - 30} 
                width="20" 
                height="16" 
                rx="4" 
                fill="#0284c7" 
                stroke="#e0f2fe" 
                strokeWidth="1.2" 
              />
              <text 
                x={coord.x} 
                y={coord.y - 18} 
                textAnchor="middle" 
                fill="#ffffff" 
                fontSize="10" 
                fontWeight="900"
                fontFamily="monospace"
              >
                {move.stepValue}
              </text>
            </g>
          );
        })}

        {/* Symmetrical Crisp Black Outer Border */}
        <rect x="0" y="0" width="800" height="800" fill="none" stroke="#000000" strokeWidth="4" />

        {/* 13. Pawns */}
        {pawns.map((pawn) => {
          if (pawn.isFinished && pawn.space.type === 'home') {
            const pos = HOME_COORDS[pawn.playerIndex];
            return (
              <circle 
                key={`finished-pawn-${pawn.id}`}
                cx={pos.x + (pawn.pawnIndex % 2 === 0 ? -4 : 4)}
                cy={pos.y + (pawn.pawnIndex < 2 ? -4 : 4)}
                r="3.5"
                fill={getPlayerColorHex(pawn.playerIndex)}
                stroke="#ffffff"
                strokeWidth="1"
              />
            );
          }

          let x = 0;
          let y = 0;
          if (animatingPawn && animatingPawn.pawnId === pawn.id) {
            const currentCoord = animatingPawn.coords[animatingPawn.currentIndex];
            x = currentCoord.x;
            y = currentCoord.y;
          } else {
            const pawnsOnSpace = pawns.filter(o => 
              !o.isFinished &&
              o.space.type === pawn.space.type &&
              o.space.index === pawn.space.index &&
              o.space.playerIndex === pawn.space.playerIndex
            );
            
            const indexOnSpace = pawnsOnSpace.findIndex(o => o.id === pawn.id);
            const totalOnSpace = pawnsOnSpace.length;

            const coords = getStackedPawnCoords(pawn.space, indexOnSpace, totalOnSpace, rules.turnoutExtraLength);
            x = coords.x;
            y = coords.y;
          }

          const isSelectable = legalMoves.some(m => m.pawnId === pawn.id);
          const isPulsing = selectedPawnId === pawn.id;

          return (
            <Pawn 
              key={`pawn-${pawn.id}`}
              color={pawn.color}
              x={x}
              y={y}
              isSelectable={isSelectable}
              isPulsing={isPulsing}
              onClick={() => handlePawnClick(pawn.id)}
            />
          );
        })}
      </svg>
    </div>
  );
};
