import { useState, useEffect } from 'react';
import { LobbyClient } from 'boardgame.io/client';

const LOCAL_STORAGE_PLAYER_KEY = 'pollyanna_player_profile';

export interface LocalProfile {
  id: string;
  name: string;
  avatar: string;
}

const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : window.location.origin
);

export const lobbyClient = new LobbyClient({ server: serverUrl });

export const useGameState = () => {
  const [localPlayer, setLocalPlayer] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Load or generate local player profile (guest)
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_PLAYER_KEY);
    if (saved) {
      try {
        setLocalPlayer(JSON.parse(saved));
      } catch (e) {
        generateNewGuestProfile();
      }
    } else {
      generateNewGuestProfile();
    }
  }, []);

  const generateNewGuestProfile = () => {
    const randomId = 'guest_' + Math.random().toString(36).substring(2, 9);
    const names = ['Royal Pawn', 'Double Roller', 'Broadway Walker', 'Turnout Master', 'Blockade Boss', 'Pollyanna Fan'];
    const randomName = names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 900 + 100);
    const profile = { id: randomId, name: randomName, avatar: '👤' };
    localStorage.setItem(LOCAL_STORAGE_PLAYER_KEY, JSON.stringify(profile));
    setLocalPlayer(profile);
  };

  const updateProfileName = (newName: string) => {
    if (!localPlayer) return;
    const updated = { ...localPlayer, name: newName };
    localStorage.setItem(LOCAL_STORAGE_PLAYER_KEY, JSON.stringify(updated));
    setLocalPlayer(updated);
  };

  // Create game room
  const createRoom = async () => {
    if (!localPlayer) return null;
    setLoading(true);
    try {
      const matchRes = await lobbyClient.createMatch('pollyanna', { numPlayers: 4 });
      const joinRes = await lobbyClient.joinMatch('pollyanna', matchRes.matchID, {
        playerID: '0',
        playerName: localPlayer.name
      });
      setLoading(false);
      return {
        roomId: matchRes.matchID,
        credentials: joinRes.playerCredentials,
        playerIndex: 0
      };
    } catch (e) {
      console.error("Failed to create room:", e);
      setLoading(false);
      alert("Failed to create room. Make sure the multiplayer server is running!");
      return null;
    }
  };

  // Join existing room
  const joinRoom = async (roomId: string) => {
    if (!localPlayer) return null;
    setLoading(true);
    roomId = roomId.toUpperCase();
    try {
      const match = await lobbyClient.getMatch('pollyanna', roomId);
      // Find the first empty seat
      const seatIndex = match.players.findIndex(p => !p.name);
      if (seatIndex === -1) {
        alert("The room is full!");
        setLoading(false);
        return null;
      }

      const joinRes = await lobbyClient.joinMatch('pollyanna', roomId, {
        playerID: String(seatIndex),
        playerName: localPlayer.name
      });
      setLoading(false);
      return {
        roomId,
        credentials: joinRes.playerCredentials,
        playerIndex: seatIndex
      };
    } catch (e) {
      console.error("Failed to join room:", e);
      setLoading(false);
      alert("Room not found or server is offline.");
      return null;
    }
  };

  return {
    localPlayer,
    loading,
    createRoom,
    joinRoom,
    updateProfileName,
    generateNewGuestProfile
  };
};
