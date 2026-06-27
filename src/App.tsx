import { useState } from 'react';
import './App.css';
import { useAudio } from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { Auth } from './components/Auth';
import { BoardgameIOApp } from './components/BoardgameIOApp';
import { Leaderboard } from './components/Leaderboard';
import { DEFAULT_RULES } from './utils/gameLogic';

function App() {
  const [view, setView] = useState<'home' | 'bgio-game'>('home');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<string | null>(null);
  const [localPlayerIndex, setLocalPlayerIndex] = useState<number>(0);
  const [isLocal, setIsLocal] = useState<boolean>(false);
  const [offlineSetupData, setOfflineSetupData] = useState<any>(null);

  // Initialize self-contained Synthesizer Audio System
  const audioSystem = useAudio();

  // Initialize Game State Engine
  const {
    localPlayer,
    loading,
    createRoom,
    joinRoom,
    updateProfileName,
    generateNewGuestProfile
  } = useGameState();

  const handleCreateRoom = async () => {
    const res = await createRoom();
    if (res) {
      setRoomId(res.roomId);
      setCredentials(res.credentials);
      setLocalPlayerIndex(res.playerIndex);
      setIsLocal(false);
      setView('bgio-game');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    const res = await joinRoom(roomCodeInput);
    if (res) {
      setRoomId(res.roomId);
      setCredentials(res.credentials);
      setLocalPlayerIndex(res.playerIndex);
      setIsLocal(false);
      setView('bgio-game');
    }
  };

  // Immediate 1-Click Offline Game Setup against bots
  const handleQuickLocalPlay = () => {
    const pName = localPlayer?.name || 'Guest';
    const pId = localPlayer?.id || 'guest';
    setRoomId('local-room');
    setCredentials(null);
    setLocalPlayerIndex(0);
    setIsLocal(true);
    setOfflineSetupData({
      rules: DEFAULT_RULES,
      players: [
        { id: pId, name: pName, color: 'green', playerIndex: 0, isHost: true, isBot: false },
        { id: `empty_1`, name: `Empty Seat`, color: 'yellow', playerIndex: 1, isHost: false, isBot: false },
        { id: `empty_2`, name: `Empty Seat`, color: 'red', playerIndex: 2, isHost: false, isBot: false },
        { id: `empty_3`, name: `Empty Seat`, color: 'blue', playerIndex: 3, isHost: false, isBot: false }
      ]
    });
    setView('bgio-game');
  };

  return (
    <div className={`app-root ${view === 'bgio-game' ? 'game-mode' : ''}`}>
      {/* Premium Header */}
      {view !== 'bgio-game' && (
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
                  placeholder="Enter Room Code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
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

      {/* 4. BOARDGAME.IO GAMEPLAY MATCH VIEW */}
      {view === 'bgio-game' && roomId && !loading && (
        <BoardgameIOApp 
          roomId={roomId}
          credentials={credentials}
          localPlayerIndex={localPlayerIndex}
          isLocal={isLocal}
          offlineSetupData={offlineSetupData}
          audioSystem={audioSystem}
          onExit={() => {
            setView('home');
          }}
        />
      )}
    </div>
  );
}

export default App;
