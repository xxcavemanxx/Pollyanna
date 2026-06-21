import React, { useEffect, useState } from 'react';

interface Stats {
  wins: number;
  gamesPlayed: number;
  captures: number;
  blockades: number;
}

export const Leaderboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ wins: 0, gamesPlayed: 0, captures: 0, blockades: 0 });

  useEffect(() => {
    const savedStats = localStorage.getItem('pollyanna_lifetime_stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        // use default
      }
    }
  }, []);

  const mockLeaderboard = [
    { rank: 1, name: '🧙‍♂️ Galdor the Roller', wins: 48, captures: 312 },
    { rank: 2, name: '🦄 StarWalker', wins: 39, captures: 245 },
    { rank: 3, name: '🦖 RexRoller', wins: 31, captures: 189 },
    { rank: 4, name: '🥷 ShadowPawn', wins: 22, captures: 130 },
  ];

  return (
    <div className="glass-panel leaderboard-container">
      <div className="leaderboard-header">
        <h3 className="leaderboard-title">🏆 Hall of Fame & Lifetime Stats</h3>
      </div>

      <div className="stats-dashboard">
        <div className="stat-card glass-card">
          <span className="stat-val">{stats.wins}</span>
          <span className="stat-label">Wins 🏆</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-val">{stats.gamesPlayed}</span>
          <span className="stat-label">Matches 🏁</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-val">{stats.captures}</span>
          <span className="stat-label">Captures ⚔️</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-val">{stats.blockades}</span>
          <span className="stat-label">Blocks 🛡️</span>
        </div>
      </div>

      <div className="global-leaderboard">
        <h4 className="leaderboard-subtitle">🌍 Global Top Rollers</h4>
        <div className="leaderboard-list">
          {mockLeaderboard.map((lead) => (
            <div key={lead.rank} className="leaderboard-row glass-card">
              <span className={`rank-badge rank-${lead.rank}`}>#{lead.rank}</span>
              <span className="rank-name">{lead.name}</span>
              <div className="rank-stats">
                <span className="rank-wins">{lead.wins} W</span>
                <span className="rank-caps">{lead.captures} ⚔️</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Leaderboard;
