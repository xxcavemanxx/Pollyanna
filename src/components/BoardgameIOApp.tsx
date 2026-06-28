import React, { useEffect, useRef } from 'react';
import { Client } from 'boardgame.io/react';
import { Local, SocketIO } from 'boardgame.io/multiplayer';
import { RandomBot } from 'boardgame.io/ai';
import { PollyannaGame, type BoardgameG } from '../utils/boardgameGame';
import { Board } from './Board';
import { Dice } from './Dice';
import { getLegalMoves } from '../utils/gameLogic';
import { GameLobby } from './GameLobby';
import { GameChat } from './GameChat';

interface BoardgameIOAppProps {
  roomId: string;
  credentials?: string | null;
  localPlayerIndex: number;
  isLocal: boolean;
  offlineSetupData?: any;
  audioSystem: any;
  onExit: () => void;
}

class DelayedRandomBot extends RandomBot {
  async play(state: any, playerID: string) {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return super.play(state, playerID);
  }
}

function getPlayerColorHex(colorName: string | undefined): string {
  switch (colorName) {
    case 'green': return '#10b981';
    case 'yellow': return '#f59e0b';
    case 'red': return '#ef4444';
    case 'blue': return '#3b82f6';
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
  audioSystem: any;
  onExit: () => void;
  matchID: string;
}> = ({ G, ctx, moves, playerID, audioSystem, onExit, matchID }) => {
  const activePlayerIndex = ctx.playOrderPos;
  const activePlayer = G.players[activePlayerIndex];
  const isLocalTurn = playerID === ctx.currentPlayer;

  const prevDiceRef = useRef<number[]>([]);
  const prevHistoryLenRef = useRef<number>(0);

  const profileSyncedRef = useRef<string | null>(null);
  const cleanName = (name: string | undefined) => name ? name.split('::')[0] : '';
  const cleanMsg = (msg: string | undefined) => msg ? msg.replace(/::[^\s:]+/g, '') : '';

  // Load player details from sessionStorage/localStorage and register with G.players
  useEffect(() => {
    const saved = sessionStorage.getItem('pollyanna_player_profile') || localStorage.getItem('pollyanna_player_profile');
    if (saved && playerID !== null && playerID !== undefined) {
      try {
        const profile = JSON.parse(saved);
        const syncKey = `${profile.id}-${profile.name}-${profile.avatar || ''}`;
        
        if (profileSyncedRef.current !== syncKey) {
          const mySeat = G.players[parseInt(playerID, 10)];
          if (!mySeat || mySeat.id !== profile.id || mySeat.name !== profile.name || mySeat.avatar !== profile.avatar) {
            moves.updatePlayerInfo(profile.name + '::' + (profile.avatar || '👤'), profile.id, profile.avatar);
            profileSyncedRef.current = syncKey;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [playerID, G.players, moves]);

  // Sync boardgame.io history with Synthesizer Audio system
  useEffect(() => {
    if (G.dice.length > 0 && JSON.stringify(G.dice) !== JSON.stringify(prevDiceRef.current)) {
      audioSystem.playRoll();
      prevDiceRef.current = G.dice;
    }

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
    if (ctx.gameover || G.gameStatus !== 'playing') return;
    const isLocalTurn = playerID === ctx.currentPlayer;
    if (isLocalTurn && G.hasRolled && G.remainingMoves.length > 0) {
      const legalMoves = getLegalMoves(activePlayer ? activePlayer.playerIndex : activePlayerIndex, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId);
      if (legalMoves.length === 0) {
        const timer = setTimeout(() => {
          moves.skipTurn();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [G.hasRolled, G.remainingMoves, ctx.currentPlayer, playerID, activePlayerIndex, G.pawns, G.rules, G.lastMovedPawnId, G.gameStatus, moves]);

  // Controller for AI Bots (host/local player runs moves on behalf of bots)
  useEffect(() => {
    if (G.gameStatus !== 'playing' || ctx.gameover) return;
    
    const isHost = playerID === '0';
    if (!isHost) return;

    const activePlayer = G.players[ctx.playOrderPos];
    if (activePlayer && activePlayer.isBot && ctx.currentPlayer === String(activePlayer.playerIndex)) {
      // 1. Bot needs to roll
      if (!G.hasRolled) {
        const timer = setTimeout(() => {
          moves.rollDice();
        }, 1500);
        return () => clearTimeout(timer);
      }
      
      // 2. Bot needs to make a move
      if (G.hasRolled && G.remainingMoves.length > 0) {
        const legalMoves = getLegalMoves(
          activePlayer.playerIndex,
          G.remainingMoves,
          G.pawns,
          G.rules,
          G.lastMovedPawnId
        );
        
        if (legalMoves.length > 0) {
          const timer = setTimeout(() => {
            const chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            moves.movePawn(chosenMove.pawnId, chosenMove.stepValue, chosenMove.useTurnout);
          }, 1500);
          return () => clearTimeout(timer);
        } else {
          const timer = setTimeout(() => {
            moves.skipTurn();
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [G.gameStatus, G.hasRolled, G.remainingMoves, G.pawns, G.rules, G.lastMovedPawnId, ctx.currentPlayer, ctx.playOrderPos, ctx.gameover, playerID, moves]);

  const [chatInput, setChatInput] = React.useState('');
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !playerID) return;
    const localPlayerProfile = G.players[parseInt(playerID, 10)];
    const senderName = localPlayerProfile ? cleanName(localPlayerProfile.name) : `Player ${playerID}`;
    moves.sendChatMessage(chatInput, senderName);
    setChatInput('');
  };

  // If in Lobby mode: render Lobby UI hooked up to boardgame.io moves!
  if (G.gameStatus === 'lobby') {
    const isHost = playerID === '0';
    const profileSaved = sessionStorage.getItem('pollyanna_player_profile') || localStorage.getItem('pollyanna_player_profile');
    const localProfile = profileSaved ? JSON.parse(profileSaved) : { id: 'guest', name: 'Guest' };
    
    // Filter empty seats for Lobby UI compatibility
    const nonEmptyPlayers = G.players.filter(p => !p.id.startsWith('empty_'));
    const mappedGameState = {
      ...G,
      players: nonEmptyPlayers
    };

    const displayRoomCode = matchID || 'LOCAL';

    return (
      <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to leave the lobby?")) {
                onExit();
              }
            }} 
            className="btn-premium"
          >
            ⬅️ Exit to Home
          </button>
          
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-muted)' }}>
            Room Lobby Code: <span style={{ color: '#10b981', fontWeight: 'bold', letterSpacing: '1px' }}>{displayRoomCode}</span>
          </h2>
        </div>

        <GameLobby 
          gameState={mappedGameState as any}
          localPlayerId={localProfile.id}
          isHost={isHost}
          onAddBot={(diff) => moves.addBot(diff)}
          onRemovePlayer={(pid) => {
            const idx = G.players.findIndex(p => p.id === pid);
            if (idx !== -1) moves.removePlayer(idx);
          }}
          onStartMatch={() => moves.startMatch()}
          onRulesUpdate={(rules) => moves.updateRoomRules(rules)}
          roomId={displayRoomCode}
          onChangePlayerColor={(playerIndex, newColor) => moves.changePlayerColor(playerIndex, newColor)}
        />

        <div style={{ marginTop: '2rem' }}>
          <GameChat 
            history={G.history}
            onSendMessage={(msg) => moves.sendChatMessage(msg, cleanName(localProfile.name))}
          />
        </div>
      </div>
    );
  }

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
              {cleanName(G.players.find(p => p.id === ctx.gameover.winner)?.name)} has won the match!
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
            <h3 className="sub-section-title" style={{ marginBottom: '0.25rem' }}>Active Player Turn</h3>
            <span 
              className="active-player-banner"
              style={{ color: getPlayerColorHex(activePlayer?.color) }}
            >
              {cleanName(activePlayer?.name)}
              {activePlayer ? (
                activePlayer.isBot ? ' 🤖' : ` ${activePlayer.name.includes('::') ? activePlayer.name.split('::')[1] : (activePlayer.avatar || '👤')}`
              ) : ''}
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
                if (window.confirm("Return to main menu? This will end the boardgame.io session.")) {
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
                     <span className="color-dot" style={{ backgroundColor: getPlayerColorHex(p.color) }} />
                     <span style={{ fontSize: '1.2rem' }}>
                       {p.name.includes('::') ? p.name.split('::')[1] : (p.avatar || (p.isBot ? '🤖' : '👤'))}
                     </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: activePlayerIndex === p.playerIndex ? 'bold' : 'normal' }}>
                      {cleanName(p.name)} {activePlayerIndex === p.playerIndex ? ' ⏰' : ''}
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
                {cleanMsg(msg)}
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

export const BoardgameIOApp: React.FC<BoardgameIOAppProps> = ({ 
  roomId, 
  credentials, 
  localPlayerIndex, 
  isLocal, 
  offlineSetupData, 
  audioSystem, 
  onExit 
}) => {
  const PollyannaClient = React.useMemo(() => {
    const BoardWrapper = (props: any) => (
      <BoardgameIOBoard 
        {...props} 
        audioSystem={audioSystem} 
        onExit={onExit} 
      />
    );

    if (isLocal) {
      const bots: Record<string, any> = {};
      offlineSetupData.players.forEach((p: any, idx: number) => {
        if (p.isBot) {
          bots[idx.toString()] = DelayedRandomBot;
        }
      });

      return Client({
        game: {
          ...PollyannaGame,
          setup: (ctx: any) => PollyannaGame.setup(ctx, offlineSetupData)
        } as any,
        board: BoardWrapper as any,
        numPlayers: offlineSetupData.players.length,
        debug: false,
        multiplayer: Local({ bots })
      });
    } else {
      const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER || (
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? 'http://localhost:8000'
          : window.location.origin
      );

      return Client({
        game: PollyannaGame,
        board: BoardWrapper as any,
        numPlayers: 4,
        debug: false,
        multiplayer: SocketIO({ server: serverUrl })
      });
    }
  }, [roomId, credentials, localPlayerIndex, isLocal, offlineSetupData, audioSystem, onExit]);

  return (
    <PollyannaClient 
      matchID={roomId}
      playerID={localPlayerIndex.toString()} 
      credentials={credentials || undefined}
    />
  );
};
