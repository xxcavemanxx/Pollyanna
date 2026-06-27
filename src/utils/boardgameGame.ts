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
  gameStatus: 'lobby' | 'playing' | 'ended';
  currentTurn: number;
}

export const PollyannaGame = {
  name: 'pollyanna',
  
  setup: (_context: any, setupData: any): BoardgameG => {
    const rules = setupData?.rules || DEFAULT_RULES;
    
    // Initialize G.players with 4 seats
    const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
    const players: Player[] = [];
    for (let i = 0; i < 4; i++) {
      players.push({
        id: `empty_${i}`,
        name: `Empty Seat`,
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
      currentTurn: 0
    };
  },

  moves: {
    updatePlayerInfo: (context: any, name: string, id: string) => {
      const G: BoardgameG = context.G;
      const playerID = parseInt(context.playerID, 10);
      if (!isNaN(playerID) && playerID >= 0 && playerID < 4) {
        G.players[playerID] = {
          id,
          name,
          color: G.players[playerID]?.color || ['green', 'yellow', 'red', 'blue'][playerID],
          playerIndex: playerID,
          isHost: playerID === 0,
          isBot: false
        };
      }
    },

    addBot: (context: any, difficulty: 'easy' | 'medium' | 'aggressive') => {
      const G: BoardgameG = context.G;
      const nextIndex = G.players.findIndex(p => p.id.startsWith('empty_') || !p.id);
      if (nextIndex === -1) return;
      
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
      const botName = `AI ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Bot`;
      const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      G.players[nextIndex] = {
        id: botId,
        name: botName,
        color: colors[nextIndex],
        playerIndex: nextIndex,
        isHost: false,
        isBot: true,
        botDifficulty: difficulty
      };
      G.history.push(`🤖 ${botName} added to seat ${nextIndex + 1}.`);
    },

    removePlayer: (context: any, playerIndex: number) => {
      const G: BoardgameG = context.G;
      if (playerIndex < 0 || playerIndex >= 4) return;
      const removedName = G.players[playerIndex]?.name || `Seat ${playerIndex + 1}`;
      
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
      G.players[playerIndex] = {
        id: `empty_${playerIndex}`,
        name: `Empty Seat`,
        color: colors[playerIndex],
        playerIndex,
        isHost: playerIndex === 0,
        isBot: false
      };
      G.history.push(`🚪 ${removedName} was removed from the lobby.`);
    },

    updateRoomRules: (context: any, updatedRules: GameRules) => {
      const G: BoardgameG = context.G;
      G.rules = updatedRules;
      G.history.push(`🔧 Rules updated.`);
    },

    startMatch: (context: any) => {
      const G: BoardgameG = context.G;
      G.gameStatus = 'playing';
      
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
      G.players.forEach((p, idx) => {
        if (p.id.startsWith('empty_') || !p.id) {
          G.players[idx] = {
            id: `bot_${Math.random().toString(36).substring(2, 9)}`,
            name: `AI Easy Bot`,
            color: colors[idx],
            playerIndex: idx,
            isHost: false,
            isBot: true,
            botDifficulty: 'easy'
          };
        }
      });

      G.pawns = createInitialPawns(G.players);
      G.currentTurn = 0;
      G.dice = [];
      G.remainingMoves = [];
      G.hasRolled = false;
      G.history.push("⚔️ The game has started! Good luck players!");
    },

    sendChatMessage: (context: any, messageText: string, senderName: string) => {
      const G: BoardgameG = context.G;
      G.history.push(`💬 [${senderName}]: ${messageText}`);
    },

    rollDice: (context: any) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;

      if (G.hasRolled || G.gameStatus !== 'playing') return;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;

      G.dice = [die1, die2];
      G.hasRolled = true;
      G.remainingMoves = [die1, die2];
      
      const activePlayer = G.players[ctx.playOrderPos];
      G.history.push(`🎲 ${activePlayer.name} rolled [${die1}, ${die2}] (Total: ${die1 + die2})`);

      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId);
      if (legalMoves.length === 0) {
        G.history.push(`🚫 No legal moves available for ${activePlayer.name}.`);
      }
    },

    skipTurn: (context: any) => {
      const G: BoardgameG = context.G;
      G.hasRolled = false;
      G.remainingMoves = [];
      context.events.endTurn();
    },

    movePawn: (context: any, pawnId: string, stepValue: number, useTurnout: boolean) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;

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
      first: () => 0,
      next: (context: any) => (context.ctx.playOrderPos + 1) % context.ctx.numPlayers,
    },
    onBegin: (context: any) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;
      const activePlayer = G.players[ctx.playOrderPos];
      G.dice = [];
      G.remainingMoves = [];
      G.hasRolled = false;
      G.lastMovedPawnId = null;
      if (G.gameStatus === 'playing') {
        G.history.push(`⏰ It is now ${activePlayer.name}'s turn.`);
      }
    }
  },

  endIf: (context: any) => {
    const G: BoardgameG = context.G;
    if (G.gameStatus !== 'playing') return;
    for (let pIdx = 0; pIdx < G.players.length; pIdx++) {
      const allHome = G.pawns
        .filter(p => p.playerIndex === G.players[pIdx].playerIndex)
        .every(p => p.isFinished);
      
      if (allHome) {
        G.gameStatus = 'ended';
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
