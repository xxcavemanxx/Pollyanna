import { 
  DEFAULT_RULES, 
  createInitialPawns, 
  getLegalMoves, 
  makeMove, 
  type GameRules, 
  type PawnState, 
  type Player 
} from './gameLogic';

export interface BoardgameG {
  pawns: PawnState[];
  dice: number[];
  remainingMoves: number[];
  hasRolled: boolean;
  history: string[];
  rules: GameRules;
  players: Player[];
  lastMovedPawnId?: string | null;
  gameStatus: 'lobby' | 'rollingForFirstPlayer' | 'playing' | 'ended';
  currentTurn: number;
  rollForFirst?: {
    eligiblePlayerIndices: number[];
    rolls: Record<number, { dice: number[]; total: number }>;
    round: number;
    winner?: number;
  };
  consecutiveDoubles: number;
}

const isPlayerActionAllowed = (context: any, G: BoardgameG): boolean => {
  const playerID = context.playerID;
  const ctx = context.ctx;
  const activePlayer = G.players[ctx.playOrderPos];
  
  if (playerID === String(activePlayer.playerIndex)) {
    return true;
  }
  
  if (activePlayer.isBot && playerID === '0') {
    return true;
  }
  
  return false;
};

export const PollyannaGame = {
  name: 'pollyanna',
  
  setup: (_context: any, setupData: any): BoardgameG => {
    const rules = setupData?.rules || DEFAULT_RULES;
    
    // Initialize G.players with 4 seats
    const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'red', 'blue', 'yellow'];
    const players: Player[] = [];
    for (let i = 0; i < 4; i++) {
      players.push({
        id: `empty_${i}`,
        name: `Empty Seat`,
        avatar: '👤',
        color: colors[i],
        playerIndex: i,
        isHost: i === 0,
        isBot: false
      });
    }

    if (setupData?.players) {
      setupData.players.forEach((p: Player, idx: number) => {
        if (idx < 4) {
          players[idx] = { ...p };
        }
      });
    }

    return {
      pawns: [],
      dice: [],
      remainingMoves: [],
      hasRolled: false,
      history: ['Lobby initialized using boardgame.io!'],
      rules,
      players,
      lastMovedPawnId: null,
      gameStatus: 'lobby',
      currentTurn: 0,
      consecutiveDoubles: 0
    };
  },

  moves: {
    changePlayerColor: (context: any, playerIndex: number, newColor: 'green' | 'yellow' | 'red' | 'blue') => {
      if (context.playerID !== '0') return; // Only host (player '0') can change colors
      const G: BoardgameG = context.G;
      if (playerIndex < 0 || playerIndex >= 4) return;

      const oldColor = G.players[playerIndex].color;
      if (oldColor === newColor) return;

      // Swap colors to maintain uniqueness
      const swapIndex = G.players.findIndex(p => p.color === newColor);
      if (swapIndex !== -1) {
        G.players[swapIndex].color = oldColor;
      }
      G.players[playerIndex].color = newColor;

      G.history.push(`🎨 Color updated: Seat ${playerIndex + 1} is now ${newColor} (swapped with Seat ${swapIndex + 1})`);
    },

    updatePlayerInfo: (context: any, name: string, id: string, avatar?: string) => {
      const G: BoardgameG = context.G;
      const playerID = parseInt(context.playerID, 10);
      if (!isNaN(playerID) && playerID >= 0 && playerID < 4) {
        G.players[playerID] = {
          id,
          name,
          avatar: avatar || '👤',
          color: G.players[playerID]?.color || (['green', 'red', 'blue', 'yellow'][playerID] as 'green' | 'yellow' | 'red' | 'blue'),
          playerIndex: playerID,
          isHost: playerID === 0,
          isBot: false
        };
      }
    },

    addBot: (context: any, difficulty: 'easy' | 'medium' | 'aggressive') => {
      if (context.playerID !== '0') return;
      const G: BoardgameG = context.G;
      const isSeat0Filled = !G.players[0].id.startsWith('empty_');
      const isSeat1Filled = !G.players[1].id.startsWith('empty_');
      const isSeat2Filled = !G.players[2].id.startsWith('empty_');
      const isSeat3Filled = !G.players[3].id.startsWith('empty_');

      let nextIndex = -1;
      if (isSeat0Filled && !isSeat1Filled && !isSeat2Filled && !isSeat3Filled) {
        nextIndex = 2;
      } else {
        nextIndex = G.players.findIndex(p => p.id.startsWith('empty_') || !p.id);
      }
      if (nextIndex === -1) return;
      
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'red', 'blue', 'yellow'];
      const botName = `AI ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Bot`;
      const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      G.players[nextIndex] = {
        id: botId,
        name: botName,
        avatar: '🤖',
        color: colors[nextIndex],
        playerIndex: nextIndex,
        isHost: false,
        isBot: true,
        botDifficulty: difficulty
      };
      G.history.push(`🤖 ${botName} added to seat ${nextIndex + 1}.`);
    },

    removePlayer: (context: any, playerIndex: number) => {
      if (context.playerID !== '0') return;
      const G: BoardgameG = context.G;
      if (playerIndex < 0 || playerIndex >= 4) return;
      const removedName = G.players[playerIndex]?.name || `Seat ${playerIndex + 1}`;
      
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
      G.players[playerIndex] = {
        id: `empty_${playerIndex}`,
        name: `Empty Seat`,
        avatar: '👤',
        color: colors[playerIndex],
        playerIndex,
        isHost: playerIndex === 0,
        isBot: false
      };
      G.history.push(`🚪 ${removedName} was removed from the lobby.`);
    },

    updateRoomRules: (context: any, updatedRules: GameRules) => {
      if (context.playerID !== '0') return;
      const G: BoardgameG = context.G;
      G.rules = updatedRules;
      G.history.push(`🔧 Rules updated.`);
    },

    startMatch: (context: any) => {
      if (context.playerID !== '0') return;
      const G: BoardgameG = context.G;
      
      const nonEmpties = G.players.filter(p => !p.id.startsWith('empty_'));
      if (nonEmpties.length === 0) return;

      G.gameStatus = 'rollingForFirstPlayer';
      G.rollForFirst = {
        eligiblePlayerIndices: nonEmpties.map(p => p.playerIndex),
        rolls: {},
        round: 1
      };
      
      G.pawns = [];
      G.dice = [];
      G.remainingMoves = [];
      G.hasRolled = false;
      G.history.push("⚔️ Match starting! Let's roll to see who goes first!");
    },

    rollForFirstPlayer: (context: any, targetPlayerIndex?: number) => {
      const G: BoardgameG = context.G;
      const callerIDStr = context.playerID;
      const callerIndex = parseInt(callerIDStr, 10);
      
      let rollPlayerIndex = callerIndex;
      if (targetPlayerIndex !== undefined && callerIDStr === '0') {
        rollPlayerIndex = targetPlayerIndex;
      }

      if (G.gameStatus !== 'rollingForFirstPlayer' || !G.rollForFirst) return;
      if (!G.rollForFirst.eligiblePlayerIndices.includes(rollPlayerIndex)) return;
      if (G.rollForFirst.rolls[rollPlayerIndex] !== undefined) return;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;

      G.rollForFirst.rolls[rollPlayerIndex] = { dice: [die1, die2], total };
      const player = G.players[rollPlayerIndex];
      G.history.push(`🎲 ${player.name} rolled [${die1}, ${die2}] (Total: ${total}) for first turn.`);

      const allRolled = G.rollForFirst.eligiblePlayerIndices.every(
        idx => G.rollForFirst!.rolls[idx] !== undefined
      );

      if (allRolled) {
        let maxVal = -1;
        G.rollForFirst.eligiblePlayerIndices.forEach(idx => {
          const tot = G.rollForFirst!.rolls[idx].total;
          if (tot > maxVal) maxVal = tot;
        });

        const winners = G.rollForFirst.eligiblePlayerIndices.filter(
          idx => G.rollForFirst!.rolls[idx].total === maxVal
        );

        if (winners.length === 1) {
          const winnerIdx = winners[0];
          const winner = G.players[winnerIdx];
          G.history.push(`🏆 ${winner.name} goes first with a total roll of ${maxVal}!`);
          G.rollForFirst.winner = winnerIdx;
        } else {
          const winnerNames = winners.map(idx => G.players[idx].name).join(', ');
          G.history.push(`🤝 Tie between ${winnerNames} (Total: ${maxVal})! Rolling again...`);
          G.rollForFirst = {
            eligiblePlayerIndices: winners,
            rolls: {},
            round: G.rollForFirst.round + 1
          };
        }
      }
    },

    completeRollForFirst: (context: any) => {
      const G: BoardgameG = context.G;
      if (context.playerID !== '0') return;
      if (G.gameStatus !== 'rollingForFirstPlayer' || !G.rollForFirst || G.rollForFirst.winner === undefined) return;

      const winnerIdx = G.rollForFirst.winner;
      const nonEmpties = G.players.filter(p => !p.id.startsWith('empty_'));
      G.pawns = createInitialPawns(nonEmpties);
      G.currentTurn = winnerIdx;
      G.gameStatus = 'playing';
      G.rollForFirst = undefined;
      G.dice = [];
      G.remainingMoves = [];
      G.hasRolled = false;
      G.history.push("⚔️ The game has started! Good luck players!");
      context.events.endTurn({ next: String(winnerIdx) });
    },

    sendChatMessage: (context: any, messageText: string, senderName: string) => {
      const G: BoardgameG = context.G;
      G.history.push(`💬 [${senderName}]: ${messageText}`);
    },

    rollDice: (context: any) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;

      if (!isPlayerActionAllowed(context, G)) return;
      if (G.hasRolled || G.gameStatus !== 'playing') return;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;

      G.dice = [die1, die2];
      G.hasRolled = true;
      G.remainingMoves = [die1, die2];
      
      const activePlayer = G.players[ctx.playOrderPos];
      G.history.push(`🎲 ${activePlayer.name} rolled [${die1}, ${die2}] (Total: ${die1 + die2})`);

      const isDoubles = die1 === die2;
      if (isDoubles) {
        G.consecutiveDoubles = (G.consecutiveDoubles || 0) + 1;
        if (G.rules.tripleDoublesPenaltyEnabled && G.consecutiveDoubles === 3) {
          G.history.push(`🚨 Triple Doubles! ${activePlayer.name} rolled doubles 3 times in a row and forfeits their turn.`);
          G.hasRolled = false;
          G.remainingMoves = [];
          G.lastMovedPawnId = null;
          G.consecutiveDoubles = 0;
          context.events.endTurn();
          return;
        }
      } else {
        G.consecutiveDoubles = 0;
      }

      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId);
      if (legalMoves.length === 0) {
        G.history.push(`🚫 No legal moves available for ${activePlayer.name}.`);
      }
    },

    skipTurn: (context: any) => {
      const G: BoardgameG = context.G;
      if (!isPlayerActionAllowed(context, G)) return;
      G.hasRolled = false;
      G.remainingMoves = [];
      context.events.endTurn();
    },

    movePawn: (context: any, pawnId: string, stepValue: number, useTurnout: boolean) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;

      if (!isPlayerActionAllowed(context, G)) return;
      if (!G.hasRolled || G.gameStatus !== 'playing') return;

      const activePlayer = G.players[ctx.playOrderPos];
      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId);
      const valid = legalMoves.some(m => m.pawnId === pawnId && m.stepValue === stepValue && m.useTurnout === useTurnout);

      if (!valid) {
        console.warn("Invalid move attempted in boardgame.io:", pawnId, stepValue, useTurnout);
        return;
      }

      // Reconstruct temporary GameState object compatible with standard makeMove
      const tempState = {
        roomId: 'bgio-room',
        players: G.players,
        pawns: G.pawns,
        currentTurn: ctx.playOrderPos,
        dice: G.dice,
        remainingMoves: G.remainingMoves,
        hasRolled: G.hasRolled,
        gameStatus: 'playing' as const,
        winnerId: null,
        history: G.history,
        rules: G.rules,
        lastMovedPawnId: G.lastMovedPawnId
      };

      const updatedState = makeMove(tempState, pawnId, stepValue, useTurnout);
      
      G.pawns = updatedState.pawns;
      G.remainingMoves = updatedState.remainingMoves;
      G.history = updatedState.history;
      G.lastMovedPawnId = updatedState.lastMovedPawnId;

      const remainingLegalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId);
      if (G.remainingMoves.length === 0 || remainingLegalMoves.length === 0) {
        if (G.remainingMoves.length > 0 && remainingLegalMoves.length === 0) {
          G.history.push(`🚫 No legal moves left for ${G.players[ctx.playOrderPos].name}.`);
        }

        const rolledDoubles = G.dice.length === 2 && G.dice[0] === G.dice[1];
        if (rolledDoubles && G.remainingMoves.length === 0) {
          G.hasRolled = false;
          G.remainingMoves = [];
          G.lastMovedPawnId = null;
          G.history.push(`🔄 Doubles! ${G.players[ctx.playOrderPos].name} gets another roll!`);
        } else {
          G.hasRolled = false;
          G.remainingMoves = [];
          G.lastMovedPawnId = null;
          context.events.endTurn();
        }
      }
    }
  },

  turn: {
    order: {
      first: (context: any) => {
        const G: BoardgameG = context.G;
        return G.currentTurn !== undefined ? G.currentTurn : 0;
      },
      next: (context: any) => {
        const G: BoardgameG = context.G;
        const colorsOrder: ('green' | 'red' | 'blue' | 'yellow')[] = ['green', 'red', 'blue', 'yellow'];
        const physicalOrder = colorsOrder.map(color => G.players.findIndex(p => p.color === color));
        
        let currentIdx = physicalOrder.indexOf(context.ctx.playOrderPos);
        if (currentIdx === -1) currentIdx = 0;
        
        let nextIdx = (currentIdx + 1) % physicalOrder.length;
        // Skip empty seats
        for (let i = 0; i < 4; i++) {
          const nextPos = physicalOrder[nextIdx];
          const p = G.players[nextPos];
          if (p && !p.id.startsWith('empty_') && p.id !== '') {
            return nextPos;
          }
          nextIdx = (nextIdx + 1) % physicalOrder.length;
        }
        return physicalOrder[nextIdx];
      },
    },
    activePlayers: { all: 'play' },
    stages: {
      play: {}
    },
    onBegin: (context: any) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;
      const activePlayer = G.players[ctx.playOrderPos];
      G.dice = [];
      G.remainingMoves = [];
      G.hasRolled = false;
      G.lastMovedPawnId = null;
      G.currentTurn = ctx.playOrderPos;
      G.consecutiveDoubles = 0;
      if (G.gameStatus === 'playing') {
        G.history.push(`⏰ It is now ${activePlayer.name}'s turn.`);
      }
    }
  },

  endIf: (context: any) => {
    const G: BoardgameG = context.G;
    if (G.gameStatus !== 'playing') return;
    for (let pIdx = 0; pIdx < G.players.length; pIdx++) {
      if (G.players[pIdx].id.startsWith('empty_')) continue;
      
      const playerPawns = G.pawns.filter(p => p.playerIndex === G.players[pIdx].playerIndex);
      const allHome = playerPawns.length > 0 && playerPawns.every(p => p.isFinished);
      
      if (allHome) {
        return { winner: G.players[pIdx].id };
      }
    }
  },

  ai: {
    enumerate: (G: BoardgameG, ctx: any) => {
      if (G.gameStatus !== 'playing') return [];
      if (!G.hasRolled) {
        return [{ move: 'rollDice' }];
      }
      const activePlayer = G.players[ctx.playOrderPos];
      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules);
      if (legalMoves.length === 0) {
        return [{ move: 'skipTurn' }];
      }
      return legalMoves.map(m => ({
        move: 'movePawn',
        args: [m.pawnId, m.stepValue, m.useTurnout]
      }));
    }
  }
};
