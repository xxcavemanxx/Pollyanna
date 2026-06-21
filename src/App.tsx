import { useState, useEffect } from 'react';
import './App.css';
import { useAudio } from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { Board } from './components/Board';
import { BoardgameIOApp } from './components/BoardgameIOApp';
import { Dice } from './components/Dice';
import { GameLobby } from './components/GameLobby';
import { GameChat } from './components/GameChat';
import { Auth } from './components/Auth';
import { Leaderboard } from './components/Leaderboard';
import { DEFAULT_RULES } from './utils/gameLogic';

function App() {
  const [view, setView] = useState<'home' | 'lobby' | 'game' | 'bgio-game'>('home');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  // Initialize self-contained Synthesizer Audio System
  const audioSystem = useAudio();

  // Initialize Game State Engine (hooked into Firebase Firestore & Local Offline simulation fallbacks)
  const {
    gameState,
    localPlayer,
    isLobbyCreator,
    loading,
    createRoom,
    joinRoom,
    addBot,
    removePlayer,
    startMatch,
    executeRoll,
    executeMove,
    restartToLobby,
    sendChatMessage,
    updateProfileName,
    generateNewGuestProfile,
    updateRoomRules
  } = useGameState(audioSystem);

  // Sync state transitions (e.g. if room starts playing)
  useEffect(() => {
    if (gameState) {
      if (gameState.gameStatus === 'playing') {
        if (gameState.rules.useBgioEngine) {
          setView('bgio-game');
        } else {
          setView('game');
        }
      } else if (gameState.gameStatus === 'lobby') {
        setView('lobby');
      }
    }
  }, [gameState?.gameStatus, gameState?.rules?.useBgioEngine]);

  const handleCreateRoom = async () => {
    const code = await createRoom();
    if (code) {
      setView('lobby');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    const ok = await joinRoom(roomCodeInput);
    if (ok) {
      setView('lobby');
    } else {
      alert("❌ Could not connect to room. Double check the code!");
    }
  };

  // Immediate 1-Click Offline Game Setup against 3 bots!
  const handleQuickLocalPlay = async () => {
    const code = await createRoom(DEFAULT_RULES);
    if (code) {
      // Small timeout to allow state to create, then populate bots
      setTimeout(() => {
        addBot('medium');
        addBot('aggressive');
        addBot('easy');
        setView('lobby');
      }, 500);
    }
  };

  // Wait! Let's examine if we need to modify useGameState.ts to export updateRules, or if we did it.
  // Oh, we defined `onRulesUpdate: (rules: GameRules) => void` in GameLobby, but in useGameState we didn't export it.
  // Let's check what we did. We can add `updateRules` to useGameState.ts easily!
  // Let's view `useGameState.ts` and add `updateRules`.
  // Wait, let's read the lines of `useGameState.ts` where we export the functions (around line 350-400).
  // Let's do a fast search or look at the end of the file.
  // The file has 420 lines. Let's check the end of the file.
  // Let's read lines 380 to 415 in `useGameState.ts` to locate the export block.

  return (
    <div className={`app-root ${view === 'game' || view === 'bgio-game' ? 'game-mode' : ''}`}>
      {/* Premium Header */}
      {view !== 'game' && view !== 'bgio-game' && (
        <header className="main-title-header">
          <h1>POLLYANNA</h1>
          <p>Tactical Board Championship</p>
        </header>
      )}

      {/* Loading overlay spinner */}
      {loading && (
        <div className="glass-panel waiting-indicator" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
          <span>Synchronizing room details...</span>
        </div>
      )}

      {/* 1. HOME VIEW */}
      {view === 'home' && !loading && (
        <div className="home-container">
          
          {/* Action Columns */}
          <div className="glass-panel home-actions-card">
            <div>
              <h2 className="home-section-title">🎮 Battle Station</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create a multiplayer room or join friends online</p>
            </div>

            <div className="action-block">
              <button 
                onClick={handleCreateRoom}
                className="btn-premium btn-primary btn-large"
              >
                🏠 Create Multiplayer Room
              </button>
            </div>

            <div className="action-block">
              <form onSubmit={handleJoinRoom} className="action-row">
                <input 
                  type="text" 
                  placeholder="Enter 6-Letter Room Code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="glass-input" 
                />
                <button type="submit" className="btn-premium">
                  ⚡ Join Room
                </button>
              </form>
            </div>

            <div className="action-block" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
              <h3 className="sub-section-title">Solo Play Fallback</h3>
              <button 
                onClick={handleQuickLocalPlay}
                className="btn-premium btn-large"
                style={{ border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56,189,248,0.04)' }}
              >
                🤖 Quick Match vs 3 AI Bots (Offline)
              </button>
            </div>
          </div>

          {/* Profile & Leaderboard Columns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Auth 
              profile={localPlayer}
              onUpdateName={updateProfileName}
              onUpdateAvatar={(av) => {
                if (localPlayer) {
                  const updated = { ...localPlayer, avatar: av };
                  localStorage.setItem('pollyanna_player_profile', JSON.stringify(updated));
                  generateNewGuestProfile(); // Reloads profile state
                }
              }}
            />
            
            <Leaderboard />
          </div>

        </div>
      )}

      {/* 2. LOBBY VIEW */}
      {view === 'lobby' && gameState && !loading && (
        <div className="lobby-container">
          <div style={{ marginBottom: '1.5rem' }}>
            <button 
              onClick={() => {
                setView('home');
                // Clean up listeners is handled automatically
              }} 
              className="btn-premium"
            >
              ⬅️ Exit Lobby to Home
            </button>
          </div>

          <GameLobby 
            gameState={gameState}
            localPlayerId={localPlayer?.id || ''}
            isHost={isLobbyCreator}
            onAddBot={addBot}
            onRemovePlayer={removePlayer}
            onStartMatch={startMatch}
            onRulesUpdate={updateRoomRules}
            roomId={gameState.roomId}
          />

          <div style={{ marginTop: '2rem' }}>
            <GameChat 
              history={gameState.history}
              onSendMessage={sendChatMessage}
            />
          </div>
        </div>
      )}

      {/* 3. GAMEPLAY MATCH VIEW */}
      {view === 'game' && gameState && !loading && (
        <div className="game-screen-layout">
          
          {/* Main Board Visualizer */}
          <div className="board-column">
            <Board 
              gameState={gameState}
              localPlayerId={localPlayer?.id || ''}
              onMoveExecute={executeMove}
            />
          </div>

          {/* Interactive Player Dashboard & controls */}
          <div className="dashboard-column">
            
            {/* Turn Card Status */}
            <div className="glass-panel active-turn-card">
              <div>
                <h3 className="sub-section-title" style={{ marginBottom: '0.25rem' }}>Active Player Turn</h3>
                <span 
                  className="active-player-banner"
                  style={{ color: getPlayerColorHex(gameState.currentTurn) }}
                >
                  {gameState.players[gameState.currentTurn]?.name}
                  {gameState.players[gameState.currentTurn]?.isBot ? ' 🤖' : ' 👤'}
                </span>
              </div>

              {/* Dice Roller widget */}
              <Dice 
                values={gameState.dice}
                isRolling={gameState.hasRolled && gameState.dice.length > 0}
                onRollClick={
                  (gameState.players[gameState.currentTurn]?.id === localPlayer?.id && !gameState.hasRolled)
                    ? executeRoll 
                    : undefined
                }
                disabled={gameState.hasRolled}
              />

              {/* Status details */}
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
                {gameState.remainingMoves.length > 0 ? (
                  <p>Remaining Moves to resolve: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{gameState.remainingMoves.join(', ')}</span></p>
                ) : (
                  <p>{gameState.hasRolled ? 'Resolving turn...' : 'Waiting for roll...'}</p>
                )}
              </div>

              {/* Sound & Exit controls */}
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
                    if (window.confirm("Are you sure you want to forfeit this match and return to Home?")) {
                      restartToLobby();
                      setView('home');
                    }
                  }}
                  className="btn-premium btn-exit-game"
                >
                  🏳️ Exit Match
                </button>
              </div>
            </div>

            {/* List of active players inside the game card */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 className="sub-section-title" style={{ marginBottom: '0.75rem' }}>🏆 Scoreboard Pawns Finished</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gameState.players.map((p) => {
                  const finishedCount = gameState.pawns.filter(o => o.playerIndex === p.playerIndex && o.isFinished).length;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span className="color-dot" style={{ backgroundColor: getPlayerColorHex(p.playerIndex) }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: gameState.currentTurn === p.playerIndex ? 'bold' : 'normal' }}>
                          {p.name} {gameState.currentTurn === p.playerIndex ? ' ⏰' : ''}
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

            {/* Live Chat logging feed in gameplay */}
            <GameChat 
              history={gameState.history}
              onSendMessage={sendChatMessage}
            />

          </div>

        </div>
      )}

      {/* 4. BOARDGAME.IO GAMEPLAY MATCH VIEW */}
      {view === 'bgio-game' && gameState && !loading && (
        <BoardgameIOApp 
          setupData={{
            rules: gameState.rules,
            players: gameState.players
          }}
          localPlayerIndex={
            gameState.players.findIndex(p => p.id === localPlayer?.id) !== -1
              ? gameState.players.findIndex(p => p.id === localPlayer?.id)
              : 0
          }
          audioSystem={audioSystem}
          onExit={() => {
            restartToLobby();
            setView('lobby');
          }}
        />
      )}
    </div>
  );
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

export default App;
