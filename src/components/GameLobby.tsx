import React, { useState } from 'react';
import type { GameState, GameRules } from '../utils/gameLogic';

interface GameLobbyProps {
  gameState: GameState;
  localPlayerId: string;
  isHost: boolean;
  onAddBot: (difficulty: 'easy' | 'medium' | 'aggressive') => void;
  onRemovePlayer: (playerId: string) => void;
  onStartMatch: () => void;
  onRulesUpdate: (rules: GameRules) => void;
  roomId: string;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  gameState,
  localPlayerId,
  isHost,
  onAddBot,
  onRemovePlayer,
  onStartMatch,
  onRulesUpdate,
  roomId
}) => {
  const [entryRoll, setEntryRoll] = useState(gameState.rules.entryRoll);
  const [blockadesEnabled, setBlockadesEnabled] = useState(gameState.rules.blockadesEnabled);
  const [captureBonus, setCaptureBonus] = useState(gameState.rules.captureBonus);
  const [turnoutExtraLength, setTurnoutExtraLength] = useState(gameState.rules.turnoutExtraLength);
  const [turnTimeLimit, setTurnTimeLimit] = useState(gameState.rules.turnTimeLimit);
  const handleApplyRules = (e: React.FormEvent) => {
    e.preventDefault();
    onRulesUpdate({
      entryRoll: Number(entryRoll),
      blockadesEnabled,
      captureBonus: Number(captureBonus),
      turnoutExtraLength: Number(turnoutExtraLength),
      turnTimeLimit: Number(turnTimeLimit),
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

  return (
    <div className="lobby-container">
      <div className="lobby-grid">
        
        {/* Left Side: Players List */}
        <div className="glass-panel lobby-panel players-panel">
          <div className="panel-header">
            <h2 className="panel-title">👥 Player Room Lobby</h2>
            <p className="panel-subtitle">Room Code: <span className="highlight-code">{roomId}</span></p>
          </div>
          
          <div className="players-list">
            {gameState.players.map((player) => (
              <div key={player.id} className="player-row glass-card">
                <div className="player-info">
                  <span 
                    className="color-dot" 
                    style={{ backgroundColor: getPlayerColorBadge(player.color) }}
                  />
                  <span className="player-name">
                    {player.name} {player.id === localPlayerId ? ' (You)' : ''}
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
            <p className="panel-subtitle">Configure specific custom numeric limits</p>
          </div>

          <form onSubmit={handleApplyRules} className="rules-form">
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
                <span className="input-hint">(Standard Pollyanna: 6. Parcheesi: 5. Free entry: 0)</span>
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
                <span className="input-hint">(Extra steps awarded on capturing an opponent pawn)</span>
              </div>
            </div>

            <div className="form-group">
              <label>↩️ Turnout Extra Path Length</label>
              <div className="input-with-hint">
                <input 
                  type="number" 
                  min="0" 
                  max="10" 
                  value={turnoutExtraLength} 
                  onChange={(e) => setTurnoutExtraLength(Number(e.target.value))}
                  disabled={!isHost}
                  className="glass-input" 
                />
                <span className="input-hint">(Additional spaces inside safe turnouts. Standard: +3)</span>
              </div>
            </div>

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
                <span className="input-hint">(0 for unlimited, or input custom limits in seconds)</span>
              </div>
            </div>

            <div className="form-group row-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={blockadesEnabled} 
                  onChange={(e) => setBlockadesEnabled(e.target.checked)}
                  disabled={!isHost}
                />
                <span>Enable Double Pawn Blockades</span>
              </label>
            </div>



            {isHost && (
              <button type="submit" className="btn-premium btn-apply-rules">
                💾 Save & Apply Rule Changes
              </button>
            )}
          </form>
        </div>

      </div>
    </div>
  );
};
