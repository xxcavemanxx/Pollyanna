import { isSafeSpace, type LegalMove, type PawnState, type GameRules } from './gameLogic';

// Select the best move for an AI player
export const selectAIMove = (
  legalMoves: LegalMove[],
  pawns: PawnState[],
  playerIndex: number,
  difficulty: 'easy' | 'medium' | 'aggressive',
  rules: GameRules
): LegalMove | null => {
  if (legalMoves.length === 0) return null;

  // 1. Easy mode: select a completely random legal move
  if (difficulty === 'easy') {
    const rIdx = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[rIdx];
  }

  // 2. Medium and Aggressive modes: evaluate and score each move
  let bestMove: LegalMove | null = null;
  let bestScore = -Infinity;

  legalMoves.forEach((move) => {
    let score = 0;
    const pawn = pawns.find(p => p.id === move.pawnId)!;
    
    // Heuristic 1: Capture Opponent (Extremely High Value)
    const opponentOnTarget = pawns.find(p => 
      !p.isFinished &&
      p.playerIndex !== playerIndex &&
      p.space.type === move.targetSpace.type &&
      p.space.index === move.targetSpace.index &&
      p.space.playerIndex === move.targetSpace.playerIndex
    );
    
    if (opponentOnTarget && !isSafeSpace(move.targetSpace)) {
      score += difficulty === 'aggressive' ? 1200 : 1000;
    }

    // Heuristic 2: Reaching Home (Very High Value)
    if (move.targetSpace.type === 'home') {
      score += 900;
    }

    // Heuristic 3: Entering the board from Base (High Priority)
    if (pawn.space.type === 'base') {
      score += 600;
    }

    // Heuristic 4: Forming a blockade with own color (Strong tactical advantage)
    const friendlyOnTarget = pawns.find(p => 
      !p.isFinished &&
      p.id !== move.pawnId &&
      p.playerIndex === playerIndex &&
      p.space.type === move.targetSpace.type &&
      p.space.index === move.targetSpace.index &&
      p.space.playerIndex === move.targetSpace.playerIndex
    );
    
    if (friendlyOnTarget && rules.blockadesEnabled) {
      score += difficulty === 'aggressive' ? 450 : 300;
    }

    // Heuristic 5: Entering a safe space (Turnout or Safe spots)
    if (isSafeSpace(move.targetSpace)) {
      score += 150;
    }

    // Heuristic 6: Prioritize moving pieces that are already close to home
    if (pawn.stepsTraveled > 0) {
      score += pawn.stepsTraveled * 1.5; // Incentivize pushing leading pieces
    }

    // Heuristic 7: Avoid danger (penalize landing in capture range of opponent unless safe)
    if (!isSafeSpace(move.targetSpace)) {
      const threatCount = pawns.filter(p => 
        !p.isFinished &&
        p.playerIndex !== playerIndex &&
        p.space.type === 'broadway' && 
        move.targetSpace.type === 'broadway'
      ).reduce((acc, opp) => {
        // Distance from opponent to our landing spot
        const dist = (move.targetSpace.index - opp.space.index + 60) % 60;
        // If opponent is behind us and within rolling distance (1-12 spaces)
        if (dist > 0 && dist <= 12) {
          return acc + 1;
        }
        return acc;
      }, 0);

      score -= threatCount * 120; // Penalize risk
    }

    // Add a slight touch of randomness so the bot is dynamic
    score += Math.random() * 20;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });

  return bestMove;
};
