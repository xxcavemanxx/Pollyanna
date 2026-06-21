import React, { useState } from 'react';
import type { LocalProfile } from '../hooks/useGameState';

interface AuthProps {
  profile: LocalProfile | null;
  onUpdateName: (name: string) => void;
  onUpdateAvatar: (avatar: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ profile, onUpdateName, onUpdateAvatar }) => {
  const [name, setName] = useState(profile?.name || '');
  const [isEditing, setIsEditing] = useState(false);

  const avatars = ['👤', '🦊', '🐯', '🐼', '🦁', '🐨', '🦖', '🦄', '🧙‍♂️', '🥷', '👽', '👑'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdateName(name);
    setIsEditing(false);
  };

  if (!profile) return null;

  return (
    <div className="glass-panel profile-widget">
      <div className="profile-details">
        <span 
          className="profile-avatar-display" 
          title="Click an avatar below to change"
        >
          {profile.avatar}
        </span>
        
        <div className="profile-text-info">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-edit-form">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="glass-input profile-edit-input"
                autoFocus 
              />
              <button type="submit" className="btn-premium btn-primary save-profile-btn">
                Save
              </button>
            </form>
          ) : (
            <div className="profile-name-row">
              <span className="profile-display-name">{profile.name}</span>
              <button 
                onClick={() => setIsEditing(true)} 
                className="edit-profile-pencil"
                title="Edit Name"
              >
                ✏️
              </button>
            </div>
          )}
          <span className="profile-status-badge">Guest Account</span>
        </div>
      </div>

      <div className="avatar-picker-section">
        <span className="picker-title">Select Avatar:</span>
        <div className="avatars-grid">
          {avatars.map((av) => (
            <button 
              key={av} 
              onClick={() => onUpdateAvatar(av)}
              className={`avatar-choice-btn ${profile.avatar === av ? 'active' : ''}`}
            >
              {av}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
