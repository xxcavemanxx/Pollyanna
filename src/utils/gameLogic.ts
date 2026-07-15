import { 
  START_SPACES, 
  HOME_ENTRANCES, 
  TURNOUT_CONFIGS,
  type GameSpace
} from './boardLayout';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
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
  doubleCaptureEnabled: boolean; // Custom rule: allow double capture on blockade with doubles
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
  lastMovedPawnId?: string | null;
}

export const DEFAULT_RULES: GameRules = {
  entryRoll: 6,
  blockadesEnabled: true,
  captureBonus: 10,
  turnoutExtraLength: 3,
  turnTimeLimit: 0,
  doubleCaptureEnabled: false,
  useBgioEngine: true
};

export const PLAYER_COLORS: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'red', 'blue', 'yellow'];

export const colorToIndex = (color: 'green' | 'red' | 'blue' | 'yellow'): number => {
  switch (color) {
    case 'green': return 0;
    case 'red': return 1;
    case 'blue': return 2;
    case 'yellow': return 3;
    default: return 0;
  }
};

export const getPlayerColorIndexFromPawns = (pawns: PawnState[], playerIndex: number): number => {
  const pawn = pawns.find(p => p.playerIndex === playerIndex);
  return pawn ? colorToIndex(pawn.color) : playerIndex;
};

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
        space: { type: 'base', index: i, playerIndex: colorToIndex(player.color) },
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
    (space.type === 'broadway' || p.space.playerIndex === space.playerIndex)
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

// Check if a space is in the home path or the home entrance space on Broadway
export const isHomePathOrEntrance = (space: GameSpace, playerIndex: number): boolean => {
  if (space.type === 'homePath' && space.playerIndex === playerIndex) {
    return true;
  }
  if (space.type === 'broadway' && space.index === HOME_ENTRANCES[playerIndex]) {
    return true;
  }
  return false;
};

// Calculate entire path for a move. Returns list of spaces traversed.
// Returns null if the move is invalid (e.g. blocked by blockade, single-track turnout rule, or goes past home)
export const calculatePath = (
  pawn: PawnState,
  steps: number,
  useTurnout: boolean,
  pawns: PawnState[],
  rules: GameRules,
  lastMovedPawnId?: string | null,
  remainingMoves?: number[]
): GameSpace[] | null => {
  if (pawn.isFinished) return null;

  // Pawn in home path can only be moved when the roll is the exact amount to land on home.
  // Exception: if the pawn is the lastMovedPawnId (i.e. it just entered this turn), it can continue moving.
  if (pawn.space.type === 'homePath' && pawn.id !== lastMovedPawnId) {
    if (steps !== 6 - pawn.space.index) {
      return null;
    }
  }

  const path: GameSpace[] = [];
  let currentSpace = { ...pawn.space };

  // Entry from Base
  if (currentSpace.type === 'base') {
    // Starting a piece from Base costs the entry roll (uses it up completely)
    const startSpaceIndex = START_SPACES[colorToIndex(pawn.color)];
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
    const nextSpace = getNextSingleStep(currentSpace, colorToIndex(pawn.color), chooseTurnoutThisStep, rules);
    
    if (!nextSpace) {
      return null; // Went past Home or tried to move from Home
    }

    // Pawns in home path cannot be passed or share a space (with the exception of the home entrance)
    if (nextSpace.type === 'homePath') {
      const isOccupied = pawns.some(p =>
        !p.isFinished &&
        p.id !== pawn.id &&
        p.space.type === 'homePath' &&
        p.space.index === nextSpace.index &&
        p.space.playerIndex === colorToIndex(pawn.color)
      );
      if (isOccupied) {
        return null; // Blocked: cannot pass or land on another pawn in the home path
      }
    }

    // Check if landing on an opponent's safety space
    const isLastStep = (i === steps - 1);
    if (isLastStep) {
      const opponentPawn = pawns.find(p => 
        !p.isFinished &&
        p.playerIndex !== pawn.playerIndex &&
        p.space.type === nextSpace.type &&
        p.space.index === nextSpace.index &&
        (nextSpace.type === 'broadway' || p.space.playerIndex === nextSpace.playerIndex)
      );
      if (opponentPawn && isSafeSpace(nextSpace, colorToIndex(opponentPawn.color))) {
        return null; // Cannot stop/land on opponent's safety space when occupied
      }
    }

    // Check blockade collision (cannot pass a blockade on any intermediate or final space)
    if (isBlockade(nextSpace, pawns, rules)) {
      // In Pollyanna, you can join your own blockade by landing exactly on it, but you cannot pass it.
      // So if this is NOT the last step, or if it is an opponent blockade, it is blocked.
      const blockadingPawn = pawns.find(p => 
        p.space.type === nextSpace.type && 
        p.space.index === nextSpace.index &&
        (nextSpace.type === 'broadway' || p.space.playerIndex === nextSpace.playerIndex)
      );
      const isOwnBlockade = blockadingPawn?.playerIndex === pawn.playerIndex;
      
      const isLastStepForBlockade = (i === steps - 1);
      
      let doubleCaptureAllowed = false;
      if (
        rules.doubleCaptureEnabled &&
        isLastStepForBlockade &&
        blockadingPawn &&
        !isOwnBlockade &&
        !isSafeSpace(nextSpace, colorToIndex(blockadingPawn.color)) &&
        isBlockade(pawn.space, pawns, rules) &&
        remainingMoves &&
        remainingMoves.filter(m => m === steps).length >= 2
      ) {
        doubleCaptureAllowed = true;
      }

      if (!isLastStepForBlockade || (!isOwnBlockade && !doubleCaptureAllowed)) {
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
      const path = calculatePath(pawn, steps, useTurnout, pawns, rules, null, diceValues);
      return path ? path[path.length - 1] : null;
    }

    // Must roll the specific entry roll (e.g. 5 or 6) on one of the dice, or as a sum
    const isSingleDieMatch = diceValues.includes(rules.entryRoll);
    const isSumMatch = diceValues.reduce((a, b) => a + b, 0) === rules.entryRoll;
    
    if (steps === rules.entryRoll && (isSingleDieMatch || isSumMatch)) {
      const path = calculatePath(pawn, steps, useTurnout, pawns, rules, null, diceValues);
      return path ? path[path.length - 1] : null;
    }
    
    return null;
  }

  // Regular piece move
  const path = calculatePath(pawn, steps, useTurnout, pawns, rules, null, diceValues);
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
  rules: GameRules,
  lastMovedPawnId?: string | null
): LegalMove[] => {
  const colorIndex = getPlayerColorIndexFromPawns(pawns, playerIndex);
  const playerPawns = pawns.filter(p => p.playerIndex === playerIndex && !p.isFinished);
  const legalMoves: LegalMove[] = [];

  // Dedup moves to check
  const movesToCheck = Array.from(new Set(remainingMoves));

  playerPawns.forEach(pawn => {
    movesToCheck.forEach(stepValue => {
      // Check standard Broadway path
      const pathStandard = calculatePath(pawn, stepValue, false, pawns, rules, lastMovedPawnId, remainingMoves);
      
      // If base, we must respect the entryRoll condition
      let isAllowed = true;
      if (pawn.space.type === 'base') {
        if (rules.entryRoll !== 0 && stepValue !== rules.entryRoll) {
          isAllowed = false;
        }
      }

      // Check starting area vs home path priority: if the move lands on home, starts in home path/entrance,
      // is for the entry roll, and there is a pawn in base, it is disallowed.
      if (pathStandard && pathStandard[pathStandard.length - 1].type === 'home' && isHomePathOrEntrance(pawn.space, colorIndex)) {
        if (rules.entryRoll > 0 && stepValue === rules.entryRoll) {
          const hasPawnInBase = pawns.some(p => p.playerIndex === playerIndex && p.space.type === 'base' && !p.isFinished);
          if (hasPawnInBase) {
            isAllowed = false; // Must move base pawn out first
          }
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
        const pathTurnout = calculatePath(pawn, stepValue, true, pawns, rules, lastMovedPawnId, remainingMoves);
        if (pathTurnout) {
          let isTurnoutAllowed = true;
          if (pathTurnout[pathTurnout.length - 1].type === 'home' && isHomePathOrEntrance(pawn.space, colorIndex)) {
            if (rules.entryRoll > 0 && stepValue === rules.entryRoll) {
              const hasPawnInBase = pawns.some(p => p.playerIndex === playerIndex && p.space.type === 'base' && !p.isFinished);
              if (hasPawnInBase) {
                isTurnoutAllowed = false;
              }
            }
          }

          if (isTurnoutAllowed) {
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
        const pathStandard = calculatePath(pawn, rules.entryRoll, false, pawns, rules, lastMovedPawnId);
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

    // Check combined moves: If the sum of both dice is valid,
    // allow the player to move the pawn directly by that sum.
    if (!pawn.isFinished && (pawn.space.type !== 'base' || rules.entryRoll === 0) && remainingMoves.length >= 2) {
      const sumsToCheck: { sum: number; components: [number, number] }[] = [];
      for (let i = 0; i < remainingMoves.length; i++) {
        for (let j = i + 1; j < remainingMoves.length; j++) {
          const sum = remainingMoves[i] + remainingMoves[j];
          if (!sumsToCheck.some(s => s.sum === sum)) {
            sumsToCheck.push({ sum, components: [remainingMoves[i], remainingMoves[j]] });
          }
        }
      }

      sumsToCheck.forEach(({ sum, components }) => {
        const pathStandard = calculatePath(pawn, sum, false, pawns, rules, lastMovedPawnId);
        if (pathStandard) {
          // Priority rule: if the move lands on home and uses the entry roll, and there is a pawn in base, disallow it
          let isAllowed = true;
          if (pathStandard[pathStandard.length - 1].type === 'home' && isHomePathOrEntrance(pawn.space, colorIndex)) {
            if (rules.entryRoll > 0 && (components[0] === rules.entryRoll || components[1] === rules.entryRoll)) {
              const hasPawnInBase = pawns.some(p => p.playerIndex === playerIndex && p.space.type === 'base' && !p.isFinished);
              if (hasPawnInBase) {
                isAllowed = false;
              }
            }
          }

          if (isAllowed) {
            const alreadyExists = legalMoves.some(m => m.pawnId === pawn.id && m.stepValue === sum && !m.useTurnout);
            if (!alreadyExists) {
              legalMoves.push({
                pawnId: pawn.id,
                stepValue: sum,
                targetSpace: pathStandard[pathStandard.length - 1],
                useTurnout: false,
                path: pathStandard
              });
            }
          }
        }

        const canChooseTurnout = pawn.space.type === 'broadway' && 
          Object.values(TURNOUT_CONFIGS).some(config => {
            const distToSplit = (pawn.space.index - config.branchIndex + 60) % 60;
            return distToSplit >= 0 && distToSplit < sum;
          });

        if (canChooseTurnout) {
          const pathTurnout = calculatePath(pawn, sum, true, pawns, rules, lastMovedPawnId);
          if (pathTurnout) {
            let isAllowed = true;
            if (pathTurnout[pathTurnout.length - 1].type === 'home' && isHomePathOrEntrance(pawn.space, colorIndex)) {
              if (rules.entryRoll > 0 && (components[0] === rules.entryRoll || components[1] === rules.entryRoll)) {
                const hasPawnInBase = pawns.some(p => p.playerIndex === playerIndex && p.space.type === 'base' && !p.isFinished);
                if (hasPawnInBase) {
                  isAllowed = false;
                }
              }
            }

            if (isAllowed) {
              const targetStandard = pathStandard ? pathStandard[pathStandard.length - 1] : null;
              const targetTurnout = pathTurnout[pathTurnout.length - 1];
              
              const isSameTarget = targetStandard && 
                targetStandard.type === targetTurnout.type && 
                targetStandard.index === targetTurnout.index &&
                targetStandard.playerIndex === targetTurnout.playerIndex;

              if (!isSameTarget) {
                const alreadyExists = legalMoves.some(m => m.pawnId === pawn.id && m.stepValue === sum && m.useTurnout);
                if (!alreadyExists) {
                  legalMoves.push({
                    pawnId: pawn.id,
                    stepValue: sum,
                    targetSpace: targetTurnout,
                    useTurnout: true,
                    path: pathTurnout
                  });
                }
              }
            }
          }
        }
      });
    }
  });

  // Mandatory home move restriction:
  // "When a pawn in the home path/entrance can be moved onto the home space, the player MUST move that pawn onto the home space."
  const homeMoves = legalMoves.filter(m => {
    if (m.targetSpace.type !== 'home') return false;
    const p = pawns.find(p => p.id === m.pawnId);
    return p && isHomePathOrEntrance(p.space, colorIndex);
  });

  if (homeMoves.length > 0) {
    return homeMoves;
  }

  // Mandatory entry roll restriction:
  // "When rolling a six and a piece isn't out yet, you must move that piece onto the first space for that player."
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
export const isSafeSpace = (space: GameSpace, playerIndex?: number): boolean => {
  if (space.type === 'turnout') return true;
  if (space.type === 'homePath' || space.type === 'home') return true;
  
  if (space.type === 'broadway') {
    if (playerIndex !== undefined) {
      return START_SPACES[playerIndex] === space.index || HOME_ENTRANCES[playerIndex] === space.index;
    }
    // Fallback if playerIndex is not provided:
    return Object.values(START_SPACES).includes(space.index) || Object.values(HOME_ENTRANCES).includes(space.index);
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
  state.lastMovedPawnId = pawnId;
  const pawnIndex = state.pawns.findIndex(p => p.id === pawnId);
  if (pawnIndex === -1) return state;

  const pawn = state.pawns[pawnIndex];
  const rules = state.rules;

  // Calculate full path to apply stepsTraveled and landing
  const path = calculatePath(pawn, stepValue, useTurnout, state.pawns, rules, state.lastMovedPawnId, state.remainingMoves);
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
  if (!pawn.isFinished) {
    // Find all opponent pawns on the landing space
    const opponentPawns = state.pawns.filter(p => 
      !p.isFinished &&
      p.playerIndex !== pawn.playerIndex &&
      p.space.type === targetSpace.type &&
      p.space.index === targetSpace.index &&
      (targetSpace.type === 'broadway' || p.space.playerIndex === targetSpace.playerIndex)
    );

    if (opponentPawns.length > 0) {
      // Capture if opponent is not on their own safety space
      const firstOpp = opponentPawns[0];
      if (!isSafeSpace(targetSpace, colorToIndex(firstOpp.color))) {
        const activePlayerForCapture = state.players.find(p => p.playerIndex === pawn.playerIndex);
        const activePlayerName = activePlayerForCapture ? activePlayerForCapture.name : `Player ${pawn.playerIndex + 1}`;
        
        opponentPawns.forEach(oppPawn => {
          const oppPlayer = state.players.find(p => p.playerIndex === oppPawn.playerIndex);
          const oppPlayerName = oppPlayer ? oppPlayer.name : `Player ${oppPawn.playerIndex + 1}`;
          
          // Capture! Send back to start base
          oppPawn.space = { type: 'base', index: oppPawn.pawnIndex, playerIndex: oppPawn.playerIndex };
          oppPawn.stepsTraveled = -1;
          oppPawn.isFinished = false;

          state.history.push(`⚔️ ${activePlayerName} captured ${oppPlayerName}'s piece!`);
        });

        // Award capture bonus move if rules specify a bonus
        if (rules.captureBonus > 0) {
          state.remainingMoves.push(rules.captureBonus);
          state.history.push(`✨ ${activePlayerName} gets a +${rules.captureBonus} space capture bonus!`);
        }
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
  const activePlayerForWin = state.players.find(p => p.playerIndex === pawn.playerIndex) || state.players[state.currentTurn];
  const allHome = state.pawns
    .filter(p => p.playerIndex === activePlayerForWin.playerIndex)
    .every(p => p.isFinished);

  if (allHome) {
    state.gameStatus = 'ended';
    state.winnerId = activePlayerForWin.id;
    state.history.push(`🏆🏆🏆 Player ${activePlayerForWin.name} has WON the game! 🏆🏆🏆`);
  }

  return state;
};
