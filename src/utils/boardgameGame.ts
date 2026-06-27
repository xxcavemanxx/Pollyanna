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
}

export const PollyannaGame = {
  name: 'pollyanna',
  
  setup: (_context: any, setupData: any): BoardgameG => {
    const rules = setupData?.rules || DEFAULT_RULES;
    const players: Player[] = setupData?.players || [
      { id: '0', name: 'Player 1', color: 'green', playerIndex: 0, isHost: true, isBot: false },
      { id: '1', name: 'Player 2', color: 'yellow', playerIndex: 1, isHost: false, isBot: false },
      { id: '2', name: 'Player 3', color: 'red', playerIndex: 2, isHost: false, isBot: false },
      { id: '3', name: 'Player 4', color: 'blue', playerIndex: 3, isHost: false, isBot: false }
    ];

    return {
      pawns: createInitialPawns(players),
      dice: [],
      remainingMoves: [],
      hasRolled: false,
      history: ['Game initialized using boardgame.io!'],
      rules,
      players
    };
  },

  moves: {
    rollDice: (context: any) => {
      const G: BoardgameG = context.G;
      const ctx = context.ctx;

      if (G.hasRolled) return;

      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;

      G.dice = [die1, die2];
      G.hasRolled = true;
      G.remainingMoves = [die1, die2];
      
      const activePlayer = G.players[ctx.playOrderPos];
      G.history.push(`🎲 ${activePlayer.name} rolled [${die1}, ${die2}] (Total: ${die1 + die2})`);

      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules);
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

      if (!G.hasRolled) return;

      const activePlayer = G.players[ctx.playOrderPos];
      const legalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules);
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
        rules: G.rules
      };

      const updatedState = makeMove(tempState, pawnId, stepValue, useTurnout);
      
      G.pawns = updatedState.pawns;
      G.remainingMoves = updatedState.remainingMoves;
      G.history = updatedState.history;

      const remainingLegalMoves = getLegalMoves(activePlayer.playerIndex, G.remainingMoves, G.pawns, G.rules);
      if (G.remainingMoves.length === 0 || remainingLegalMoves.length === 0) {
        if (G.remainingMoves.length > 0 && remainingLegalMoves.length === 0) {
          G.history.push(`🚫 No legal moves left for ${G.players[ctx.playOrderPos].name}.`);
        }

        const rolledDoubles = G.dice.length === 2 && G.dice[0] === G.dice[1];
        if (rolledDoubles && G.remainingMoves.length === 0) {
          G.hasRolled = false;
          G.remainingMoves = [];
          G.history.push(`🔄 Doubles! ${G.players[ctx.playOrderPos].name} gets another roll!`);
        } else {
          G.hasRolled = false;
          G.remainingMoves = [];
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
      G.history.push(`⏰ It is now ${activePlayer.name}'s turn.`);
    }
  },

  endIf: (context: any) => {
    const G: BoardgameG = context.G;
    for (let pIdx = 0; pIdx < G.players.length; pIdx++) {
      const allHome = G.pawns
        .filter(p => p.playerIndex === G.players[pIdx].playerIndex)
        .every(p => p.isFinished);
      
      if (allHome) {
        return { winner: G.players[pIdx].id };
      }
    }
  },

  ai: {
    enumerate: (G: BoardgameG, ctx: any) => {
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
