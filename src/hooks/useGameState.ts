import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  db, 
  isFirebaseEnabled 
} from '../services/firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc
} from 'firebase/firestore';
import { 
  DEFAULT_RULES, 
  createInitialPawns, 
  type GameState, 
  type Player, 
  type GameRules
} from '../utils/gameLogic';

const LOCAL_STORAGE_PLAYER_KEY = 'pollyanna_player_profile';

export interface LocalProfile {
  id: string;
  name: string;
  avatar: string;
}

export const useGameState = (audioSystem: any) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<LocalProfile | null>(null);
  const [isLobbyCreator, setIsLobbyCreator] = useState(false);
  const [loading, setLoading] = useState(false);

  // Firestore listener cleanup ref
  const unsubscribeRef = useRef<(() => void) | null>(null);
  


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

  // Safe state updates (Firestore vs Local)
  const saveState = useCallback(async (updatedState: GameState) => {
    if (isFirebaseEnabled && updatedState.roomId) {
      try {
        const roomDocRef = doc(db, 'rooms', updatedState.roomId);
        await setDoc(roomDocRef, updatedState);
      } catch (e) {
        console.error("Firestore sync failed, updating local state only:", e);
        setGameState(updatedState);
      }
    } else {
      setGameState(updatedState);
    }
  }, []);



  // Create game room
  const createRoom = async (customRules: GameRules = DEFAULT_RULES) => {
    if (!localPlayer) return null;
    setLoading(true);
    
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const host: Player = {
      id: localPlayer.id,
      name: localPlayer.name,
      color: 'green',
      playerIndex: 0,
      isHost: true,
      isBot: false
    };

    const newGameState: GameState = {
      roomId,
      players: [host],
      pawns: [],
      currentTurn: 0,
      dice: [],
      remainingMoves: [],
      hasRolled: false,
      gameStatus: 'lobby',
      winnerId: null,
      history: [`Lobby created. Code: ${roomId}. Welcome, ${localPlayer.name}!`],
      rules: customRules
    };

    setIsLobbyCreator(true);
    await saveState(newGameState);
    subscribeToRoom(roomId);
    setLoading(false);
    return roomId;
  };

  // Join existing room
  const joinRoom = async (roomId: string): Promise<boolean> => {
    if (!localPlayer) return false;
    setLoading(true);
    roomId = roomId.toUpperCase();

    if (isFirebaseEnabled) {
      try {
        // We will fetch the room and join
        // In local mode or firestore, we subscribe first then add ourselves
        subscribeToRoom(roomId);
        
        // Wait briefly for snapshot to initialize
        await new Promise(resolve => setTimeout(resolve, 800));
        
        return true;
      } catch (e) {
        console.error(e);
        setLoading(false);
        return false;
      }
    } else {
      // Local mode fake join
      setLoading(false);
      alert("Note: Firebase is offline/disabled. Real-time multiplayer rooms are simulated locally on this tab. Open in standard Hotseat / Bot play.");
      return false;
    }
  };

  const addPlayerToLobby = useCallback((playerProfile: LocalProfile) => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    
    if (state.players.length >= 4) {
      alert("Lobby is full!");
      return;
    }

    if (state.players.some(p => p.id === playerProfile.id)) {
      return; // Already in lobby
    }

    const nextIndex = state.players.length;
    const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
    
    const newPlayer: Player = {
      id: playerProfile.id,
      name: playerProfile.name,
      color: colors[nextIndex],
      playerIndex: nextIndex,
      isHost: false,
      isBot: false
    };

    state.players.push(newPlayer);
    state.history.push(`👋 ${playerProfile.name} has joined the lobby!`);
    saveState(state);
  }, [gameState, saveState]);

  // Add AI Bot to lobby
  const addBot = (difficulty: 'easy' | 'medium' | 'aggressive') => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;

    if (state.players.length >= 4) {
      alert("Lobby is full!");
      return;
    }

    const nextIndex = state.players.length;
    const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
    
    const botName = `AI ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Bot`;
    const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;

    const bot: Player = {
      id: botId,
      name: botName,
      color: colors[nextIndex],
      playerIndex: nextIndex,
      isHost: false,
      isBot: true,
      botDifficulty: difficulty
    };

    state.players.push(bot);
    state.history.push(`🤖 ${botName} added to the room.`);
    saveState(state);
  };

  // Remove player or bot from lobby
  const removePlayer = (playerId: string) => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    const index = state.players.findIndex(p => p.id === playerId);
    
    if (index !== -1) {
      const removedName = state.players[index].name;
      state.players.splice(index, 1);
      
      // Re-assign colors and indexes for remaining players
      const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
      state.players.forEach((p, idx) => {
        p.playerIndex = idx;
        p.color = colors[idx];
      });

      state.history.push(`🚪 ${removedName} was removed from the lobby.`);
      saveState(state);
    }
  };

  // Start the match
  const startMatch = () => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;

    if (state.players.length < 2) {
      alert("Need at least 2 players to start!");
      return;
    }

    state.gameStatus = 'playing';

    // Re-align player colors/seats based on total player count for proper opposite seats
    const colors: ('green' | 'yellow' | 'red' | 'blue')[] = ['green', 'yellow', 'red', 'blue'];
    if (state.players.length === 2) {
      // Opposite sides: Player 0 is Green (0), Player 1 is Blue (3)
      state.players[0].color = 'green';
      state.players[0].playerIndex = 0;
      state.players[1].color = 'blue';
      state.players[1].playerIndex = 3;
    } else {
      state.players.forEach((p, idx) => {
        p.color = colors[idx];
        p.playerIndex = idx;
      });
    }

    state.pawns = createInitialPawns(state.players);
    state.currentTurn = 0;
    state.dice = [];
    state.remainingMoves = [];
    state.hasRolled = false;
    state.history.push("⚔️ The game has started! Good luck players!");
    
    // Play initial chime
    audioSystem.playSafety();
    saveState(state);
  };

  // Restart back to Lobby
  const restartToLobby = () => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    state.gameStatus = 'lobby';
    state.pawns = [];
    state.winnerId = null;
    state.dice = [];
    state.remainingMoves = [];
    state.hasRolled = false;
    state.history.push("🔄 Game reset back to Lobby.");
    saveState(state);
  };

  // Add chat message
  const sendChatMessage = (messageText: string) => {
    if (!gameState || !localPlayer) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    state.history.push(`💬 [${localPlayer.name}]: ${messageText}`);
    saveState(state);
  };

  // Update room rules config
  const updateRoomRules = (updatedRules: GameRules) => {
    if (!gameState) return;
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    state.rules = updatedRules;
    state.history.push(`🔧 Host updated rules: entryRoll=${updatedRules.entryRoll}, captures=+${updatedRules.captureBonus}, blockades=${updatedRules.blockadesEnabled}`);
    saveState(state);
  };

  // Subscribe to real-time Firestore room doc
  const subscribeToRoom = (roomId: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    if (isFirebaseEnabled) {
      const docRef = doc(db, 'rooms', roomId);
      unsubscribeRef.current = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GameState;
          setGameState(data);
          
          // Verify lobby host
          if (localPlayer && data.players.length > 0) {
            setIsLobbyCreator(data.players[0].id === localPlayer.id);
          }
        } else {
          console.warn("Room document deleted.");
          setGameState(null);
        }
        setLoading(false);
      });
    }
  };

  // Sync lobby client on load/refresh if guest joins
  useEffect(() => {
    if (gameState && localPlayer && gameState.gameStatus === 'lobby') {
      const inLobby = gameState.players.some(p => p.id === localPlayer.id);
      if (!inLobby && gameState.players.length < 4) {
        addPlayerToLobby(localPlayer);
      }
    }
  }, [gameState, localPlayer, addPlayerToLobby]);

  // Clean up snapshot listeners on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    gameState,
    localPlayer,
    isLobbyCreator,
    loading,
    createRoom,
    joinRoom,
    addBot,
    removePlayer,
    startMatch,
    restartToLobby,
    sendChatMessage,
    updateProfileName,
    generateNewGuestProfile,
    updateRoomRules
  };
};
