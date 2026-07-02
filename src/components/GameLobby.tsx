import React, { useState } from 'react';
import type { GameState, GameRules } from '../utils/gameLogic';
import { GameChat } from './GameChat';

interface GameLobbyProps {
  gameState: GameState;
  localPlayerId: string;
  isHost: boolean;
  onAddBot: (difficulty: 'easy' | 'medium' | 'aggressive') => void;
  onRemovePlayer: (playerId: string) => void;
  onStartMatch: () => void;
  onRulesUpdate: (rules: GameRules) => void;
  roomId: string;
  onChangePlayerColor?: (playerIndex: number, newColor: 'green' | 'yellow' | 'red' | 'blue') => void;
  chatHistory: string[];
  onSendChatMessage: (message: string) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  gameState,
  localPlayerId,
  isHost,
  onAddBot,
  onRemovePlayer,
  onStartMatch,
  onRulesUpdate,
  roomId,
  onChangePlayerColor,
  chatHistory,
  onSendChatMessage
}) => {
  const [entryRoll, setEntryRoll] = useState(gameState.rules.entryRoll);
  const [doubleCaptureEnabled, setDoubleCaptureEnabled] = useState(gameState.rules.doubleCaptureEnabled || false);
  const [captureBonus, setCaptureBonus] = useState(gameState.rules.captureBonus);
  const [turnTimeLimit, setTurnTimeLimit] = useState(gameState.rules.turnTimeLimit);
  
  const [activeTab, setActiveTab] = useState<'rules' | 'timer'>('rules');

  const handleApplyRules = (e: React.FormEvent) => {
    e.preventDefault();
    onRulesUpdate({
      entryRoll: Number(entryRoll),
      blockadesEnabled: true,
      captureBonus: Number(captureBonus),
      turnoutExtraLength: gameState.rules.turnoutExtraLength,
      turnTimeLimit: Number(turnTimeLimit),
      doubleCaptureEnabled,
      useBgioEngine: true
    });
    alert("⚡ Rules updated successfully!");
  };

  const getPlayerColorBadge = (color: string) => {
    switch (color) {
      case 'green': return '#10b981';
      case 'yellow': return '#f59e0b';
      case 'red': return '#ef4444';
      case 'blue': return '#3b82f6';
      default: return '#9ca3af';
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!roomId || roomId === 'LOCAL') return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-grid">
        
        {/* Left Side: Players List */}
        <div className="glass-panel lobby-panel players-panel">
          <div className="panel-header">
            <h2 className="panel-title">👥 Player Room Lobby</h2>
            <p className="panel-subtitle">
              Room Code:{' '}
              <span 
                className="highlight-code" 
                onClick={handleCopyCode}
                style={{ 
                  cursor: roomId !== 'LOCAL' ? 'pointer' : 'default',
                  position: 'relative',
                  userSelect: 'all'
                }}
                title={roomId !== 'LOCAL' ? 'Click to copy room code' : undefined}
              >
                {roomId}
                {copied && (
                  <span style={{
                    position: 'absolute',
                    bottom: '125%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(16, 185, 129, 0.95)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    fontWeight: 'normal',
                    zIndex: 10
                  }}>
                    Copied!
                  </span>
                )}
              </span>
            </p>
          </div>
          
          <div className="players-list">
            {gameState.players.map((player) => (
              <div key={player.id} className="player-row glass-card">
                <div className="player-info">
                  {isHost && onChangePlayerColor ? (
                    <select
                      value={player.color}
                      onChange={(e) => onChangePlayerColor(player.playerIndex, e.target.value as any)}
                      className="glass-input color-selector"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: getPlayerColorBadge(player.color),
                        border: `1px solid ${getPlayerColorBadge(player.color)}`,
                        borderRadius: '6px',
                        padding: '2px 8px',
                        marginRight: '10px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        outline: 'none'
                      }}
                    >
                      <option value="green" style={{ color: '#10b981', backgroundColor: '#1e293b' }}>Green</option>
                      <option value="yellow" style={{ color: '#f59e0b', backgroundColor: '#1e293b' }}>Yellow</option>
                      <option value="red" style={{ color: '#ef4444', backgroundColor: '#1e293b' }}>Red</option>
                      <option value="blue" style={{ color: '#3b82f6', backgroundColor: '#1e293b' }}>Blue</option>
                    </select>
                  ) : (
                    <span 
                      className="color-dot" 
                      style={{ backgroundColor: getPlayerColorBadge(player.color) }}
                    />
                  )}
                  <span style={{ marginRight: '6px', fontSize: '1.25rem' }}>
                    {player.name.includes('::') ? player.name.split('::')[1] : (player.avatar || (player.isBot ? '🤖' : '👤'))}
                  </span>
                  <span className="player-name">
                    {player.name.includes('::') ? player.name.split('::')[0] : player.name} {player.id === localPlayerId ? ' (You)' : ''}
                    {player.isHost ? ' 👑' : ''}
                    {player.isBot ? ' 🤖' : ''}
                  </span>
                </div>

                {isHost && player.id !== localPlayerId && (
                  <button 
                    onClick={() => onRemovePlayer(player.id)}
                    className="kick-btn"
                    title="Remove Player / Bot"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {gameState.players.length < 4 && (
              <div className="empty-slots">
                {Array.from({ length: 4 - gameState.players.length }).map((_, idx) => (
                  <div key={idx} className="player-row empty-row">
                    <span className="color-dot empty-dot" />
                    <span className="empty-text">Waiting for player...</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isHost && gameState.players.length < 4 && (
            <div className="bot-addition">
              <h3 className="sub-section-title">🤖 Add AI Bots</h3>
              <div className="bot-buttons">
                <button onClick={() => onAddBot('easy')} className="btn-premium btn-bot-easy">🌱 Easy Bot</button>
                <button onClick={() => onAddBot('medium')} className="btn-premium btn-bot-medium">🧠 Medium Bot</button>
                <button onClick={() => onAddBot('aggressive')} className="btn-premium btn-bot-hard">🔥 Aggressive Bot</button>
              </div>
            </div>
          )}

          <div className="lobby-actions">
            {isHost ? (
              <button 
                onClick={onStartMatch}
                disabled={gameState.players.length < 2}
                className="btn-premium btn-primary start-match-btn"
              >
                ⚔️ Start Game Match ({gameState.players.length}/4)
              </button>
            ) : (
              <div className="waiting-indicator">
                <div className="spinner"></div>
                <p>Waiting for Host to start the match...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Customizable Rules Settings Panel */}
        <div className="glass-panel lobby-panel rules-panel">
          <div className="panel-header">
            <h2 className="panel-title">⚙️ Game Rules Customizer</h2>
            <p className="panel-subtitle">Configure specific custom rules and timer settings</p>
          </div>

          {/* Modern Tab Bar */}
          <div className="rules-tabs-bar">
            <button 
              type="button"
              className={`rules-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              🎮 Game Setup
            </button>
            <button 
              type="button"
              className={`rules-tab-btn ${activeTab === 'timer' ? 'active' : ''}`}
              onClick={() => setActiveTab('timer')}
            >
              ⏰ Match Timer
            </button>
          </div>

          <form onSubmit={handleApplyRules} className="rules-form">
            {activeTab === 'rules' && (
              <>
                <div className="form-group">
                  <label>🎲 Pawn Entry Roll Value</label>
                  <div className="input-with-hint">
                    <input 
                      type="number" 
                      min="0" 
                      max="12" 
                      value={entryRoll} 
                      onChange={(e) => setEntryRoll(Number(e.target.value))}
                      disabled={!isHost}
                      className="glass-input" 
                    />
                    <span className="input-hint">(Pollyanna standard: 6. Free entry: 0)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>⚔️ Capture Bonus Spaces</label>
                  <div className="input-with-hint">
                    <input 
                      type="number" 
                      min="0" 
                      max="40" 
                      value={captureBonus} 
                      onChange={(e) => setCaptureBonus(Number(e.target.value))}
                      disabled={!isHost}
                      className="glass-input" 
                    />
                    <span className="input-hint">(Steps awarded for capturing opponent pawns)</span>
                  </div>
                </div>

                <div className="form-group row-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={doubleCaptureEnabled} 
                      onChange={(e) => setDoubleCaptureEnabled(e.target.checked)}
                      disabled={!isHost}
                    />
                    <span>Allow "Double Capture" on Blockades</span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'timer' && (
              <div className="form-group">
                <label>⏰ Turn Time Limit (Seconds)</label>
                <div className="input-with-hint">
                  <input 
                    type="number" 
                    min="0" 
                    max="300" 
                    value={turnTimeLimit} 
                    onChange={(e) => setTurnTimeLimit(Number(e.target.value))}
                    disabled={!isHost}
                    className="glass-input" 
                  />
                  <span className="input-hint">(0 for unlimited, or select custom limit)</span>
                </div>
              </div>
            )}

            {isHost && (
              <button type="submit" className="btn-premium btn-apply-rules">
                💾 Save & Apply Rule Changes
              </button>
            )}
          </form>
        </div>

        {/* Third Column: Room Chat */}
        <GameChat history={chatHistory} onSendMessage={onSendChatMessage} />

      </div>
    </div>
  );
};
