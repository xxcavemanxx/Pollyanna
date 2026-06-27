import React, { useEffect, useRef } from 'react';
import { Client } from 'boardgame.io/react';
import { Local } from 'boardgame.io/multiplayer';
import { RandomBot } from 'boardgame.io/ai';
import { PollyannaGame, type BoardgameG } from '../utils/boardgameGame';
import { Board } from './Board';
import { Dice } from './Dice';
import { getLegalMoves } from '../utils/gameLogic';

interface BoardgameIOAppProps {
  setupData: {
    rules: any;
    players: any[];
  };
  localPlayerIndex: number;
  audioSystem: any;
  onExit: () => void;
}

class DelayedRandomBot extends RandomBot {
  async play(state: any, playerID: string) {
    // Add natural 2200ms delay for pacing
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return super.play(state, playerID);
  }
}

// Inline helper for player colors hex
function getPlayerColorHex(playerIndex: number): string {
  switch (playerIndex) {
    case 0: return '#10b981'; // Green
    case 1: return '#f59e0b'; // Yellow
    case 2: return '#ef4444'; // Red
    case 3: return '#3b82f6'; // Blue
    default: return '#9ca3af';
  }
}

const BoardgameIOBoard: React.FC<{
  G: BoardgameG;
  ctx: any;
  moves: any;
  playerID: string | null;
  isActive: boolean;
  events: any;
  // Custom props passed through boardProps
  audioSystem: any;
  onExit: () => void;
}> = ({ G, ctx, moves, playerID, audioSystem, onExit }) => {
  
  const activePlayerIndex = ctx.playOrderPos;
  const activePlayer = G.players[activePlayerIndex];
  const isLocalTurn = playerID === ctx.currentPlayer;

  const prevDiceRef = useRef<number[]>([]);
  const prevHistoryLenRef = useRef<number>(0);

  // Sync boardgame.io history with Synthesizer Audio system
  useEffect(() => {
    // 1. Roll dice sound
    if (G.dice.length > 0 && JSON.stringify(G.dice) !== JSON.stringify(prevDiceRef.current)) {
      audioSystem.playRoll();
      prevDiceRef.current = G.dice;
    }

    // 2. Play game events sound
    if (G.history.length > prevHistoryLenRef.current) {
      if (prevHistoryLenRef.current > 0) {
        const newLogs = G.history.slice(prevHistoryLenRef.current);
        newLogs.forEach((log) => {
          if (log.includes("captured")) {
            audioSystem.playCapture();
          } else if (log.includes("reached Home")) {
            audioSystem.playHome();
          } else if (log.includes("WON")) {
            audioSystem.playWin();
          } else if (log.includes("turn")) {
            audioSystem.playTurn();
          } else if (log.includes("Doubles")) {
            audioSystem.playTurn();
          } else if (log.includes("rolled")) {
            // Roll handled separately
          } else {
            audioSystem.playStep();
          }
        });
      }
      prevHistoryLenRef.current = G.history.length;
    }
  }, [G.dice, G.history, audioSystem]);

  // Auto skip turn if there are no legal moves available, after a 1.5s delay to let dice animate
  useEffect(() => {
    if (ctx.gameover) return;
    const isLocalTurn = playerID === ctx.currentPlayer;
    if (isLocalTurn && G.hasRolled && G.remainingMoves.length > 0) {
      const legalMoves = getLegalMoves(activePlayer ? activePlayer.playerIndex : activePlayerIndex, G.remainingMoves, G.pawns, G.rules);
      if (legalMoves.length === 0) {
        const timer = setTimeout(() => {
          moves.skipTurn();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [G.hasRolled, G.remainingMoves, ctx.currentPlayer, playerID, activePlayerIndex, G.pawns, G.rules, moves]);

  // Chat message submission
  const [chatInput, setChatInput] = React.useState('');
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !playerID) return;
    const localPlayerProfile = G.players.find(p => p.id === playerID);
    const senderName = localPlayerProfile ? localPlayerProfile.name : `Player ${playerID}`;
    G.history.push(`💬 [${senderName}]: ${chatInput}`);
    setChatInput('');
  };

  return (
    <div className="game-screen-layout">
      {/* Winner Overlay Modal */}
      {ctx.gameover && (
        <div className="glass-panel winner-overlay-modal" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderRadius: '16px', background: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h1 style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem', textShadow: '0 0 10px rgba(16,185,129,0.3)' }}>🏆 Victory! 🏆</h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--text-bright)' }}>
              {G.players.find(p => p.id === ctx.gameover.winner)?.name} has won the match!
            </p>
            <button 
              onClick={() => onExit()} 
              className="btn-premium btn-primary btn-large"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Left Column: Pollyanna Board */}
      <div className="board-column">
        <Board G={G} ctx={ctx} moves={moves} playerID={playerID} />
      </div>

      {/* Right Column: Dashboard Controls */}
      <div className="dashboard-column">
        {/* Active Turn and Dice roller */}
        <div className="glass-panel active-turn-card">
          <div>
            <h3 className="sub-section-title" style={{ marginBottom: '0.25rem' }}>Active Player Turn (boardgame.io)</h3>
            <span 
              className="active-player-banner"
              style={{ color: getPlayerColorHex(activePlayer?.playerIndex) }}
            >
              {activePlayer?.name}
              {activePlayer?.isBot ? ' 🤖' : ' 👤'}
            </span>
          </div>

          <Dice 
            values={G.dice}
            isRolling={G.hasRolled && G.dice.length > 0}
            onRollClick={
              (isLocalTurn && !G.hasRolled && !activePlayer?.isBot)
                ? () => moves.rollDice()
                : undefined
            }
            disabled={G.hasRolled || !isLocalTurn || activePlayer?.isBot}
          />

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
            {G.remainingMoves.length > 0 ? (
              <p>Remaining Moves: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{G.remainingMoves.join(', ')}</span></p>
            ) : (
              <p>{G.hasRolled ? 'Resolving...' : 'Roll required...'}</p>
            )}
          </div>

          {/* Controls */}
          <div className="action-row-game">
            <button 
              onClick={audioSystem.toggleMute}
              className="btn-premium"
              style={{ minWidth: '100px' }}
            >
              {audioSystem.muted ? '🔇 Unmute' : '🔊 Mute SFX'}
            </button>

            <button 
              onClick={() => {
                if (window.confirm("Return to main lobby? This will end the boardgame.io session.")) {
                  onExit();
                }
              }}
              className="btn-premium btn-exit-game"
            >
              🏳️ Exit Match
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 className="sub-section-title" style={{ marginBottom: '0.75rem' }}>🏆 Scoreboard (Pawns Home)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {G.players.map((p) => {
              const finishedCount = G.pawns.filter(o => o.playerIndex === p.playerIndex && o.isFinished).length;
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                     <span className="color-dot" style={{ backgroundColor: getPlayerColorHex(p.playerIndex) }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: activePlayerIndex === p.playerIndex ? 'bold' : 'normal' }}>
                      {p.name} {activePlayerIndex === p.playerIndex ? ' ⏰' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10b981' }}>
                    {finishedCount} / 4 Home
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Game History / Chat Feed */}
        <div className="glass-panel chat-container-card" style={{ display: 'flex', flexDirection: 'column', height: '320px' }}>
          <h3 className="sub-section-title" style={{ marginBottom: '0.5rem' }}>💬 Game Feed</h3>
          
          <div className="chat-history-scroll" style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {G.history.map((msg, index) => (
              <div 
                key={index} 
                className="chat-message-bubble"
                style={{ 
                  padding: '0.4rem 0.6rem', 
                  borderRadius: '6px', 
                  fontSize: '0.85rem', 
                  background: msg.startsWith('💬') ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                  borderLeft: msg.startsWith('💬') ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.08)'
                }}
              >
                {msg}
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="Send message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="glass-input" 
              style={{ flexGrow: 1, padding: '0.45rem' }}
            />
            <button type="submit" className="btn-premium" style={{ padding: '0.45rem 1rem' }}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const BoardgameIOApp: React.FC<BoardgameIOAppProps> = ({ setupData, localPlayerIndex, audioSystem, onExit }) => {
  const PollyannaClient = React.useMemo(() => {
    const BoardWrapper = (props: any) => (
      <BoardgameIOBoard 
        {...props} 
        audioSystem={audioSystem} 
        onExit={onExit} 
      />
    );

    const bots: Record<string, any> = {};
    setupData.players.forEach((p, idx) => {
      if (p.isBot) {
        bots[idx.toString()] = DelayedRandomBot;
      }
    });

    return Client({
      game: {
        ...PollyannaGame,
        setup: (ctx: any) => PollyannaGame.setup(ctx, setupData)
      } as any,
      board: BoardWrapper as any,
      numPlayers: setupData.players.length,
      debug: false,
      multiplayer: Local({ bots })
    });
  }, [setupData, audioSystem, onExit]);

  return (
    <PollyannaClient 
      playerID={localPlayerIndex.toString()} 
    />
  );
};

