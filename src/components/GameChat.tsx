import React, { useState, useEffect, useRef } from 'react';

interface GameChatProps {
  history: string[];
  onSendMessage: (message: string) => void;
}

export const GameChat: React.FC<GameChatProps> = ({ history, onSendMessage }) => {
  const [text, setText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  const getLogStyle = (log: string) => {
    if (log.startsWith('💬')) return { color: '#e2e8f0', background: 'rgba(255,255,255,0.03)' };
    if (log.startsWith('⚔️') || log.startsWith('⚔')) return { color: '#f87171', fontWeight: '600' };
    if (log.startsWith('🎉') || log.startsWith('🏆')) return { color: '#34d399', fontWeight: 'bold' };
    if (log.startsWith('🎲')) return { color: '#fbbf24' };
    if (log.startsWith('🔄') || log.startsWith('⏰')) return { color: '#60a5fa' };
    return { color: '#9ca3af' };
  };

  return (
    <div className="glass-panel chat-container">
      <div className="chat-header">
        <h3 className="chat-title">💬 Live Activity & Chat Log</h3>
      </div>

      <div className="chat-messages">
        {history.map((log, idx) => (
          <div 
            key={idx} 
            className="chat-message-row"
            style={getLogStyle(log)}
          >
            {log}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input 
          type="text" 
          placeholder="Type a message or cheer..." 
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="glass-input chat-input"
        />
        <button type="submit" className="btn-premium btn-primary send-chat-btn">
          Send
        </button>
      </form>
    </div>
  );
};
