import React, { useEffect, useRef } from 'react';
import { Client } from 'boardgame.io/react';
import { Local, SocketIO } from 'boardgame.io/multiplayer';
import { RandomBot } from 'boardgame.io/ai';
import { PollyannaGame, type BoardgameG } from '../utils/boardgameGame';
import { Board } from './Board';
import { Dice } from './Dice';
import { getLegalMoves } from '../utils/gameLogic';
import { GameLobby } from './GameLobby';

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
  const localPlayerIndex = playerID !== null ? parseInt(playerID, 10) : -1;


  const prevDiceRef = useRef<number[]>([]);
  const prevHistoryLenRef = useRef<number>(0);

  const profileSyncedRef = useRef<string | null>(null);
  const chatHistoryContainerRef = useRef<HTMLDivElement | null>(null);
  const cleanName = (name: string | undefined) => name ? name.split('::')[0] : '';
  const cleanMsg = (msg: string | undefined) => msg ? msg.replace(/::[^\s:]+/g, '') : '';

  // Auto scroll chat/game feed to bottom on new messages (container-level only, to avoid scrolling parent sidebar)
  useEffect(() => {
    if (chatHistoryContainerRef.current) {
      chatHistoryContainerRef.current.scrollTo({
        top: chatHistoryContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [G.history.length]);

  // Load player details from sessionStorage/localStorage and register with G.players
  useEffect(() => {
    const saved = sessionStorage.getItem('pollyanna_player_profile') || localStorage.getItem('pollyanna_player_profile');
    if (saved && playerID !== null && playerID !== undefined) {
      try {
        const profile = JSON.parse(saved);
        const syncKey = `${profile.id}-${profile.name}-${profile.avatar || ''}`;
        
        if (profileSyncedRef.current !== syncKey) {
          const mySeat = G.players[parseInt(playerID, 10)];
          if (mySeat) {
            const cleanMySeatName = cleanName(mySeat.name);
            if (mySeat.id !== profile.id || cleanMySeatName !== profile.name || mySeat.avatar !== profile.avatar) {
              moves.updatePlayerInfo(profile.name + '::' + (profile.avatar || '👤'), profile.id, profile.avatar);
              profileSyncedRef.current = syncKey;
            } else {
              // Mark as synced if the state matches the profile already
              profileSyncedRef.current = syncKey;
            }
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

  // Controller for AI Bots rolling to determine who goes first
  useEffect(() => {
    if (G.gameStatus !== 'rollingForFirstPlayer' || !G.rollForFirst) return;

    const isHost = playerID === '0';
    if (!isHost) return;

    // Find any bot that is eligible and hasn't rolled yet
    const eligibleBots = G.rollForFirst.eligiblePlayerIndices.filter(idx => {
      const p = G.players[idx];
      return p && p.isBot && G.rollForFirst!.rolls[idx] === undefined;
    });

    if (eligibleBots.length > 0) {
      const botIdx = eligibleBots[0];
      const timer = setTimeout(() => {
        moves.rollForFirstPlayer(botIdx);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [G.gameStatus, G.rollForFirst, G.players, playerID, moves]);

  // Transition timer once winner is chosen
  useEffect(() => {
    if (G.gameStatus !== 'rollingForFirstPlayer' || !G.rollForFirst || G.rollForFirst.winner === undefined) return;

    const isHost = playerID === '0';
    if (!isHost) return;

    const timer = setTimeout(() => {
      moves.completeRollForFirst();
    }, 4000); // Show results for 4 seconds before starting match
    return () => clearTimeout(timer);
  }, [G.gameStatus, G.rollForFirst, playerID, moves]);

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
      <div className="lobby-screen-wrapper">
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
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
          chatHistory={G.history}
          onSendChatMessage={(msg) => moves.sendChatMessage(msg, cleanName(localProfile.name))}
        />
      </div>
    );
  }

  if (G.gameStatus === 'rollingForFirstPlayer' && G.rollForFirst) {
    const isEligible = G.rollForFirst.eligiblePlayerIndices.includes(localPlayerIndex);
    const hasRolled = G.rollForFirst.rolls[localPlayerIndex] !== undefined;
    const myRoll = G.rollForFirst.rolls[localPlayerIndex];
    const winnerIdx = G.rollForFirst.winner;
    const isWinnerChosen = winnerIdx !== undefined;

    const handleRoll = () => {
      moves.rollForFirstPlayer();
    };

    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', background: 'rgba(20, 20, 20, 0.95)' }}>
          <h2 style={{ textAlign: 'center', margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#10b981', textShadow: '0 0 10px rgba(16,185,129,0.3)' }}>
            Determine Turn Order
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem' }}>
            {isWinnerChosen 
              ? `🏆 ${cleanName(G.players[winnerIdx].name)} goes first! Starting match...`
              : G.rollForFirst.round > 1 
                ? `Round ${G.rollForFirst.round}: Tie-breaker roll between tied players!` 
                : "Each player rolls the dice. The highest total goes first!"
            }
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {G.players.map((p, idx) => {
              if (p.id.startsWith('empty_')) return null;
              
              const isPlayerEligible = G.rollForFirst!.eligiblePlayerIndices.includes(idx);
              const playerRoll = G.rollForFirst!.rolls[idx];
              
              let statusText = "";
              let statusStyle: React.CSSProperties = { color: 'var(--text-muted)' };
              
              if (isWinnerChosen && idx === winnerIdx) {
                statusText = `Winner! Rolled: ${playerRoll.dice.join(', ')} (Total: ${playerRoll.total})`;
                statusStyle = { color: '#10b981', fontWeight: 'bold' };
              } else if (!isPlayerEligible) {
                statusText = "Spectating / Eliminated";
                statusStyle = { color: '#ef4444', opacity: 0.6 };
              } else if (playerRoll) {
                statusText = `Rolled: ${playerRoll.dice.join(', ')} (Total: ${playerRoll.total})`;
                statusStyle = { color: '#60a5fa', fontWeight: '500' };
              } else {
                statusText = "Waiting to roll...";
                statusStyle = { color: '#f59e0b' };
              }

              return (
                <div 
                  key={p.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '1.25rem', 
                    borderRadius: '12px', 
                    border: (isWinnerChosen && idx === winnerIdx) ? '2px solid #10b981' : isPlayerEligible ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255,255,255,0.02)',
                    background: (isWinnerChosen && idx === winnerIdx) ? 'rgba(16,185,129,0.05)' : isPlayerEligible ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="color-dot" style={{ backgroundColor: getPlayerColorHex(p.color) }} />
                    <span style={{ fontSize: '1.25rem' }}>{p.avatar || '👤'}</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{cleanName(p.name)}</span>
                  </div>
                  
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {p.isBot ? "🤖 AI Bot" : idx === localPlayerIndex ? "👤 You" : "👤 Player"}
                  </div>

                  <div style={{ ...statusStyle, fontSize: '0.95rem', marginTop: '0.5rem' }}>
                    {statusText}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            {isWinnerChosen ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.3)', width: '100%', maxWidth: '500px' }}>
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                  🎉 {cleanName(G.players[winnerIdx].name)} won the roll-off!
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Rolling results: {G.players.filter(p => !p.id.startsWith('empty_')).map(p => `${cleanName(p.name)} (${G.rollForFirst!.rolls[p.playerIndex]?.total || 0})`).join(', ')}
                </p>
              </div>
            ) : isEligible ? (
              <Dice 
                values={myRoll ? myRoll.dice : []} 
                isRolling={myRoll !== undefined} 
                onRollClick={!hasRolled ? handleRoll : undefined} 
                disabled={hasRolled}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', width: '100%', maxWidth: '400px' }}>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>
                  Waiting for other players to roll...
                </p>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <h3 className="sub-section-title" style={{ marginBottom: '0.75rem' }}>💬 Log Feed</h3>
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              {G.history.slice(-8).map((msg, index) => (
                <div key={index} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {cleanMsg(msg)}
                </div>
              ))}
            </div>
          </div>
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
              style={{ color: getPlayerColorHex(activePlayer?.color), display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {activePlayer ? (
                activePlayer.isBot ? '🤖' : `${activePlayer.name.includes('::') ? activePlayer.name.split('::')[1] : (activePlayer.avatar || '👤')}`
              ) : ''}{' '}
              {cleanName(activePlayer?.name)}
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
        <div className="glass-panel chat-container-card">
          <h3 className="sub-section-title" style={{ marginBottom: '0.5rem' }}>💬 Game Feed</h3>
          
          <div 
            ref={chatHistoryContainerRef}
            className="chat-history-scroll" 
            style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
          >
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
