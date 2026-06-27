import { 
  START_SPACES, 
  HOME_ENTRANCES, 
  TURNOUT_CONFIGS,
  type GameSpace
} from './boardLayout';

export interface Player {
  id: string;
  name: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
  playerIndex: number;
  isHost: boolean;
  isBot: boolean;
  botDifficulty?: 'easy' | 'medium' | 'aggressive';
}

export interface GameRules {
  entryRoll: number;          // 0 = free, 5 = Parcheesi, 6 = standard
  blockadesEnabled: boolean;
  captureBonus: number;       // Custom capture bonus spaces (e.g. 10, 20)
  turnoutExtraLength: number; // Extra spaces in turnout (e.g. 3)
  turnTimeLimit: number;      // Seconds, 0 = unlimited
  useBgioEngine?: boolean;
}

export interface PawnState {
  id: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
  playerIndex: number;
  pawnIndex: number;
  space: GameSpace;
  stepsTraveled: number; // Count of spaces traveled from Start (Broadway = 0 to 57, HomePath = 58 to 63)
  isFinished: boolean;
}

export interface GameState {
  roomId: string;
  players: Player[];
  pawns: PawnState[];
  currentTurn: number; // Active playerIndex (0 to 3)
  dice: number[];      // Current dice values e.g. [5, 6]
  remainingMoves: number[]; // Moves left to execute in the current turn e.g. [5, 6] or [20]
  hasRolled: boolean;
  gameStatus: 'lobby' | 'playing' | 'ended';
  winnerId: string | null;
  history: string[];
  rules: GameRules;
}

export const DEFAULT_RULES: GameRules = {
  entryRoll: 6,
  blockadesEnabled: true,
  captureBonus: 10,
  turnoutExtraLength: 3,
  turnTimeLimit: 0,
  useBgioEngine: true
};

export const PLAYER_COLORS: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];

// Initialize 4 pawns for each player
export const createInitialPawns = (players: Player[]): PawnState[] => {
  const pawns: PawnState[] = [];
  players.forEach((player) => {
    for (let i = 0; i < 4; i++) {
      pawns.push({
        id: `${player.color}_${i}`,
        color: player.color,
        playerIndex: player.playerIndex,
        pawnIndex: i,
        space: { type: 'base', index: i, playerIndex: player.playerIndex },
        stepsTraveled: -1,
        isFinished: false
      });
    }
  });
  return pawns;
};

// Check if a space has a blockade (2 or more pawns of the same color)
export const isBlockade = (space: GameSpace, pawns: PawnState[], rules: GameRules): boolean => {
  if (!rules.blockadesEnabled) return false;
  if (space.type === 'base' || space.type === 'home') return false;

  const pawnsOnSpace = pawns.filter(p => 
    !p.isFinished &&
    p.space.type === space.type &&
    p.space.index === space.index &&
    p.space.playerIndex === space.playerIndex
  );

  if (pawnsOnSpace.length >= 2) {
    // Must be same color
    const firstColor = pawnsOnSpace[0].color;
    return pawnsOnSpace.every(p => p.color === firstColor);
  }

  return false;
};

// Single-step movement calculation
export const getNextSingleStep = (
  currentSpace: GameSpace,
  playerIndex: number,
  useTurnout: boolean, // Whether the player wants to enter their turnout (if at a split)
  rules: GameRules
): GameSpace | null => {
  // 1. If at Base: must enter the board (handled in high-level rules, not single-step)
  if (currentSpace.type === 'base') {
    return null; 
  }

  // 2. If at Home: cannot move further
  if (currentSpace.type === 'home') {
    return null;
  }

  // 3. If in Home Path:
  if (currentSpace.type === 'homePath') {
    if (currentSpace.index < 5) {
      return { type: 'homePath', index: currentSpace.index + 1, playerIndex };
    } else {
      return { type: 'home', index: 0, playerIndex };
    }
  }

  // 4. If in Turnout:
  if (currentSpace.type === 'turnout') {
    const config = TURNOUT_CONFIGS[currentSpace.playerIndex!];
    const stepsCount = Math.abs(config.mergeIndex - config.branchIndex) + rules.turnoutExtraLength;
    const maxTurnoutIndex = stepsCount - 2; // slice(1, -1) from turnout layout

    if (currentSpace.index < maxTurnoutIndex) {
      return { type: 'turnout', index: currentSpace.index + 1, playerIndex: currentSpace.playerIndex };
    } else {
      // Merges back to Broadway
      return { type: 'broadway', index: config.mergeIndex };
    }
  }

  // 5. If on Broadway:
  // Check if turning into Home Path
  if (currentSpace.index === HOME_ENTRANCES[playerIndex]) {
    return { type: 'homePath', index: 0, playerIndex };
  }

  // Check if entering a Turnout split
  // In Pollyanna, any player can choose to go into a turnout when they cross its branch point
  for (let pIdx = 0; pIdx < 4; pIdx++) {
    const config = TURNOUT_CONFIGS[pIdx];
    if (currentSpace.index === config.branchIndex && useTurnout) {
      return { type: 'turnout', index: 0, playerIndex: pIdx };
    }
  }

  // Standard Broadway step (counter-clockwise)
  return { type: 'broadway', index: (currentSpace.index - 1 + 60) % 60 };
};

// Calculate entire path for a move. Returns list of spaces traversed.
// Returns null if the move is invalid (e.g. blocked by blockade, single-track turnout rule, or goes past home)
export const calculatePath = (
  pawn: PawnState,
  steps: number,
  useTurnout: boolean,
  pawns: PawnState[],
  rules: GameRules
): GameSpace[] | null => {
  if (pawn.isFinished) return null;

  const path: GameSpace[] = [];
  let currentSpace = { ...pawn.space };

  // Entry from Base
  if (currentSpace.type === 'base') {
    // Starting a piece from Base costs the entry roll (uses it up completely)
    const startSpaceIndex = START_SPACES[pawn.playerIndex];
    const targetSpace: GameSpace = { type: 'broadway', index: startSpaceIndex };
    
    // Check if the starting space has a blockade of opponents
    if (isBlockade(targetSpace, pawns, rules)) {
      const blockadingPawn = pawns.find(p => p.space.type === 'broadway' && p.space.index === startSpaceIndex);
      if (blockadingPawn && blockadingPawn.playerIndex !== pawn.playerIndex) {
        return null; // Blocked by opponent blockade
      }
    }
    
    path.push(targetSpace);
    return path; // Moving out onto the board uses up the entire roll and places it on the start space.
  }

  // Regular step-by-step pathing
  for (let i = 0; i < steps; i++) {
    const isAtBranch = currentSpace.type === 'broadway' && 
      Object.values(TURNOUT_CONFIGS).some(config => currentSpace.index === config.branchIndex);
    const chooseTurnoutThisStep = isAtBranch && useTurnout;
    const nextSpace = getNextSingleStep(currentSpace, pawn.playerIndex, chooseTurnoutThisStep, rules);
    
    if (!nextSpace) {
      return null; // Went past Home or tried to move from Home
    }

    // Check blockade collision (cannot pass a blockade on any intermediate or final space)
    if (isBlockade(nextSpace, pawns, rules)) {
      // In Pollyanna, you can join your own blockade by landing exactly on it, but you cannot pass it.
      // So if this is NOT the last step, or if it is an opponent blockade, it is blocked.
      const blockadingPawn = pawns.find(p => 
        p.space.type === nextSpace.type && 
        p.space.index === nextSpace.index &&
        p.space.playerIndex === nextSpace.playerIndex
      );
      const isOwnBlockade = blockadingPawn?.playerIndex === pawn.playerIndex;
      
      const isLastStep = (i === steps - 1);
      if (!isLastStep || !isOwnBlockade) {
        return null; // Blocked!
      }
    }

    // Check Turnout Single-Track restriction:
    // "No piece may pass another while on a turnout. Only a single piece may occupy a turnout space."
    if (nextSpace.type === 'turnout') {
      const activePawnsInTurnout = pawns.filter(p => 
        !p.isFinished &&
        p.id !== pawn.id &&
        p.space.type === 'turnout' && 
        p.space.playerIndex === nextSpace.playerIndex
      );

      // If there's an intermediate pawn in our way inside the turnout
      const isLastStep = (i === steps - 1);
      const collisionPawn = activePawnsInTurnout.find(p => p.space.index === nextSpace.index);
      
      if (collisionPawn) {
        if (!isLastStep) {
          return null; // Cannot pass
        } else {
          // If it's the last step, we land on it. But turnout has single occupancy.
          return null; // Cannot occupy same space
        }
      }
    }

    path.push(nextSpace);
    currentSpace = nextSpace;
  }

  return path;
};

// Validate if a move is fully legal and return its target space if valid.
export const validateMove = (
  pawn: PawnState,
  steps: number,
  useTurnout: boolean,
  pawns: PawnState[],
  rules: GameRules,
  diceValues: number[]
): GameSpace | null => {
  // If pawn in Base:
  if (pawn.space.type === 'base') {
    // If free entry:
    if (rules.entryRoll === 0) {
      // Can enter with any die
      const path = calculatePath(pawn, steps, useTurnout, pawns, rules);
      return path ? path[path.length - 1] : null;
    }

    // Must roll the specific entry roll (e.g. 5 or 6) on one of the dice, or as a sum
    const isSingleDieMatch = diceValues.includes(rules.entryRoll);
    const isSumMatch = diceValues.reduce((a, b) => a + b, 0) === rules.entryRoll;
    
    if (steps === rules.entryRoll && (isSingleDieMatch || isSumMatch)) {
      const path = calculatePath(pawn, steps, useTurnout, pawns, rules);
      return path ? path[path.length - 1] : null;
    }
    
    return null;
  }

  // Regular piece move
  const path = calculatePath(pawn, steps, useTurnout, pawns, rules);
  return path ? path[path.length - 1] : null;
};

// Gather all legal moves for a player given their remaining rolled values
export interface LegalMove {
  pawnId: string;
  stepValue: number; // The die value used e.g. 4
  targetSpace: GameSpace;
  useTurnout: boolean;
  path: GameSpace[];
}

export const getLegalMoves = (
  playerIndex: number,
  remainingMoves: number[],
  pawns: PawnState[],
  rules: GameRules
): LegalMove[] => {
  const playerPawns = pawns.filter(p => p.playerIndex === playerIndex && !p.isFinished);
  const legalMoves: LegalMove[] = [];

  // Dedup moves to check
  const movesToCheck = Array.from(new Set(remainingMoves));

  playerPawns.forEach(pawn => {
    movesToCheck.forEach(stepValue => {
      // Check standard Broadway path
      const pathStandard = calculatePath(pawn, stepValue, false, pawns, rules);
      
      // If base, we must respect the entryRoll condition
      let isAllowed = true;
      if (pawn.space.type === 'base') {
        if (rules.entryRoll !== 0 && stepValue !== rules.entryRoll) {
          isAllowed = false;
        }
      }

      if (pathStandard && isAllowed) {
        legalMoves.push({
          pawnId: pawn.id,
          stepValue,
          targetSpace: pathStandard[pathStandard.length - 1],
          useTurnout: false,
          path: pathStandard
        });
      }

      // Check if turnout path is a possibility (only relevant if they are approaching or at a turnout split)
      const canChooseTurnout = pawn.space.type === 'broadway' && 
        Object.values(TURNOUT_CONFIGS).some(config => {
          // Are we at or behind a turnout split?
          const distToSplit = (pawn.space.index - config.branchIndex + 60) % 60;
          return distToSplit >= 0 && distToSplit < stepValue;
        });

      if (canChooseTurnout) {
        const pathTurnout = calculatePath(pawn, stepValue, true, pawns, rules);
        if (pathTurnout) {
          // Avoid duplicate landing space if turnout merges immediately or doesn't change landing spot
          const targetStandard = pathStandard ? pathStandard[pathStandard.length - 1] : null;
          const targetTurnout = pathTurnout[pathTurnout.length - 1];
          
          const isSameTarget = targetStandard && 
            targetStandard.type === targetTurnout.type && 
            targetStandard.index === targetTurnout.index &&
            targetStandard.playerIndex === targetTurnout.playerIndex;

          if (!isSameTarget) {
            legalMoves.push({
              pawnId: pawn.id,
              stepValue,
              targetSpace: targetTurnout,
              useTurnout: true,
              path: pathTurnout
            });
          }
        }
      }
    });

    // If pawn is in base, also check if we can combine two remaining moves to enter
    if (pawn.space.type === 'base' && rules.entryRoll !== 0) {
      let hasCombination = false;
      for (let i = 0; i < remainingMoves.length; i++) {
        for (let j = i + 1; j < remainingMoves.length; j++) {
          if (remainingMoves[i] + remainingMoves[j] === rules.entryRoll) {
            hasCombination = true;
            break;
          }
        }
        if (hasCombination) break;
      }

      if (hasCombination) {
        const pathStandard = calculatePath(pawn, rules.entryRoll, false, pawns, rules);
        if (pathStandard) {
          const alreadyExists = legalMoves.some(m => m.pawnId === pawn.id && m.stepValue === rules.entryRoll);
          if (!alreadyExists) {
            legalMoves.push({
              pawnId: pawn.id,
              stepValue: rules.entryRoll,
              targetSpace: pathStandard[pathStandard.length - 1],
              useTurnout: false,
              path: pathStandard
            });
          }
        }
      }
    }
  });

  // Mandatory entry roll restriction:
  // "When rolling a six and a piece isn't out yet, you must move that piece onto the first space for that player."
  // If there's any pawn in base, and the entryRoll value (default 6) is in remainingMoves,
  // we filter the legal moves to ONLY those where a pawn in base moves out using that entryRoll.
  const entryVal = rules.entryRoll === 0 ? 6 : rules.entryRoll;
  const hasPawnInBase = pawns.some(p => p.playerIndex === playerIndex && p.space.type === 'base' && !p.isFinished);
  const hasEntryRoll = remainingMoves.includes(entryVal) || (() => {
    for (let i = 0; i < remainingMoves.length; i++) {
      for (let j = i + 1; j < remainingMoves.length; j++) {
        if (remainingMoves[i] + remainingMoves[j] === entryVal) {
          return true;
        }
      }
    }
    return false;
  })();

  if (hasPawnInBase && hasEntryRoll) {
    const entryMoves = legalMoves.filter(m => {
      const p = pawns.find(p => p.id === m.pawnId);
      return p && p.space.type === 'base' && m.stepValue === entryVal;
    });
    if (entryMoves.length > 0) {
      return entryMoves;
    }
  }

  return legalMoves;
};

// Check if a space is safe
export const isSafeSpace = (space: GameSpace): boolean => {
  if (space.type === 'turnout') return true;
  if (space.type === 'homePath' || space.type === 'home') return true;
  
  // Start spaces are safe in Pollyanna
  if (space.type === 'broadway') {
    return Object.values(START_SPACES).includes(space.index);
  }
  
  return false;
};

// Apply a move to the game state, performing captures and advancing rules
export const makeMove = (
  gameState: GameState,
  pawnId: string,
  stepValue: number,
  useTurnout: boolean
): GameState => {
  const state = JSON.parse(JSON.stringify(gameState)) as GameState;
  const pawnIndex = state.pawns.findIndex(p => p.id === pawnId);
  if (pawnIndex === -1) return state;

  const pawn = state.pawns[pawnIndex];
  const rules = state.rules;

  // Calculate full path to apply stepsTraveled and landing
  const path = calculatePath(pawn, stepValue, useTurnout, state.pawns, rules);
  if (!path) return state;

  const targetSpace = path[path.length - 1];

  // Update pawn location
  pawn.space = targetSpace;
  if (pawn.stepsTraveled === -1) {
    pawn.stepsTraveled = 0; // Entered board
  } else {
    pawn.stepsTraveled += stepValue;
  }

  // Check if pawn reached Home
  if (targetSpace.type === 'home') {
    pawn.isFinished = true;
    pawn.stepsTraveled = 99; // finished marker
    state.history.push(`🎉 Player ${state.players[state.currentTurn].name}'s piece reached Home!`);
  }

  // Handle Capture checks on landing space
  if (!pawn.isFinished && !isSafeSpace(targetSpace)) {
    // Find any opponent pawns on the landing space
    const opponentPawnIndex = state.pawns.findIndex(p => 
      !p.isFinished &&
      p.playerIndex !== pawn.playerIndex &&
      p.space.type === targetSpace.type &&
      p.space.index === targetSpace.index &&
      p.space.playerIndex === targetSpace.playerIndex
    );

    if (opponentPawnIndex !== -1) {
      const oppPawn = state.pawns[opponentPawnIndex];
      const oppPlayer = state.players[oppPawn.playerIndex];
      
      // Capture! Send back to start base
      oppPawn.space = { type: 'base', index: oppPawn.pawnIndex, playerIndex: oppPawn.playerIndex };
      oppPawn.stepsTraveled = -1;
      oppPawn.isFinished = false;

      state.history.push(`⚔️ ${state.players[pawn.playerIndex].name} captured ${oppPlayer.name}'s piece!`);

      // Award capture bonus move if rules specify a bonus (User requested customizable numerical inputs)
      if (rules.captureBonus > 0) {
        state.remainingMoves.push(rules.captureBonus);
        state.history.push(`✨ ${state.players[pawn.playerIndex].name} gets a +${rules.captureBonus} space capture bonus!`);
      }
    }
  }

  // Deduct the stepValue from remainingMoves
  const moveIdx = state.remainingMoves.indexOf(stepValue);
  if (moveIdx !== -1) {
    state.remainingMoves.splice(moveIdx, 1);
  } else {
    // Check if we combined two moves to equal stepValue
    let combinedFound = false;
    for (let i = 0; i < state.remainingMoves.length; i++) {
      for (let j = i + 1; j < state.remainingMoves.length; j++) {
        if (state.remainingMoves[i] + state.remainingMoves[j] === stepValue) {
          state.remainingMoves.splice(j, 1);
          state.remainingMoves.splice(i, 1);
          combinedFound = true;
          break;
        }
      }
      if (combinedFound) break;
    }
  }

  // Check for game winner
  const activePlayer = state.players[state.currentTurn];
  const allHome = state.pawns
    .filter(p => p.playerIndex === activePlayer.playerIndex)
    .every(p => p.isFinished);

  if (allHome) {
    state.gameStatus = 'ended';
    state.winnerId = activePlayer.id;
    state.history.push(`🏆🏆🏆 Player ${activePlayer.name} has WON the game! 🏆🏆🏆`);
  }

  return state;
};
