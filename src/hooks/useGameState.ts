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
  getLegalMoves, 
  makeMove,
  type GameState, 
  type Player, 
  type GameRules
} from '../utils/gameLogic';
import { selectAIMove } from '../utils/ai';

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
  
  // Prevent duplicate bot executions using a lock
  const botExecutingRef = useRef<boolean>(false);

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

  // Check turn completion conditions (no legal moves, empty moves, doubles)
  const handleTurnCompletion = useCallback((state: GameState): GameState => {
    if (!state.hasRolled) return state;

    const legalMoves = getLegalMoves(state.currentTurn, state.remainingMoves, state.pawns, state.rules);

    if (state.remainingMoves.length === 0 || legalMoves.length === 0) {
      if (state.remainingMoves.length > 0 && legalMoves.length === 0) {
        state.history.push(`🚫 No legal moves available for ${state.players[state.currentTurn].name}.`);
      }

      // Check if doubles were rolled and all moves were used successfully
      const rolledDoubles = state.dice.length === 2 && state.dice[0] === state.dice[1];
      
      if (rolledDoubles && state.remainingMoves.length === 0 && state.gameStatus === 'playing') {
        state.hasRolled = false;
        state.remainingMoves = [];
        state.history.push(`🔄 Doubles! ${state.players[state.currentTurn].name} gets another roll!`);
      } else {
        state.hasRolled = false;
        state.remainingMoves = [];
        
        let nextTurn = (state.currentTurn + 1) % state.players.length;
        state.currentTurn = nextTurn;
        state.history.push(`⏰ It is now ${state.players[nextTurn].name}'s turn.`);
        
        // Play small turn notification chime
        audioSystem.playTurn();
      }
    }
    
    return state;
  }, [audioSystem]);

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

  // Roll the dice
  const executeRoll = useCallback(() => {
    if (!gameState || gameState.hasRolled || gameState.gameStatus !== 'playing') return;
    
    const state = JSON.parse(JSON.stringify(gameState)) as GameState;
    const activePlayer = state.players[state.currentTurn];

    // Roll two dice (1-6)
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;

    state.dice = [die1, die2];
    state.hasRolled = true;

    // Remaining moves is the individual dice values
    state.remainingMoves = [die1, die2];
    
    state.history.push(`🎲 ${activePlayer.name} rolled [${die1}, ${die2}] (Total: ${die1 + die2})`);
    
    // Audio trigger
    audioSystem.playRoll();

    // Check if player has any legal moves
    const legalMoves = getLegalMoves(state.currentTurn, state.remainingMoves, state.pawns, state.rules);
    
    if (legalMoves.length === 0) {
      // Automatically advance turn if no moves exist
      const finishedState = handleTurnCompletion(state);
      saveState(finishedState);
    } else {
      saveState(state);
    }
  }, [gameState, saveState, handleTurnCompletion, audioSystem]);

  // Execute a pawn movement
  const executeMove = useCallback((pawnId: string, stepValue: number, useTurnout: boolean) => {
    if (!gameState || !gameState.hasRolled || gameState.gameStatus !== 'playing') return;

    // Verify it is a legal move
    const legalMoves = getLegalMoves(gameState.currentTurn, gameState.remainingMoves, gameState.pawns, gameState.rules);
    const valid = legalMoves.some(m => m.pawnId === pawnId && m.stepValue === stepValue && m.useTurnout === useTurnout);

    if (!valid) {
      console.warn("Invalid move attempted:", pawnId, stepValue, useTurnout);
      return;
    }

    // Audio step tick
    audioSystem.playStep();

    let state = makeMove(gameState, pawnId, stepValue, useTurnout);
    
    // Play special chimes for capture or home
    const latestLog = state.history[state.history.length - 1];
    if (latestLog.includes("captured")) {
      audioSystem.playCapture();
    } else if (latestLog.includes("reached Home")) {
      audioSystem.playHome();
    } else if (latestLog.includes("WON")) {
      audioSystem.playWin();
    }

    // Process turn completion or next rolling state
    state = handleTurnCompletion(state);
    saveState(state);
  }, [gameState, saveState, handleTurnCompletion, audioSystem]);

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

  // Bot Auto-Play heart beat loop
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing' || botExecutingRef.current) return;

    const activePlayer = gameState.players[gameState.currentTurn];
    if (!activePlayer || !activePlayer.isBot) return;

    // Only the host (players[0]) executes bot logic in Firestore multiplayer to avoid racing
    const hostPlayer = gameState.players[0];
    if (isFirebaseEnabled && localPlayer && hostPlayer && hostPlayer.id !== localPlayer.id) {
      return; // Do not execute bot turn if you are not the host
    }

    // Run bot move sequence
    const triggerBotTurn = async () => {
      botExecutingRef.current = true;

      // 1. Roll the dice
      if (!gameState.hasRolled) {
        await new Promise(resolve => setTimeout(resolve, 1200)); // Natural bot thinking delay
        executeRoll();
        botExecutingRef.current = false;
        return;
      }

      // 2. Decide and make the move
      const legalMoves = getLegalMoves(gameState.currentTurn, gameState.remainingMoves, gameState.pawns, gameState.rules);
      
      if (legalMoves.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Natural pawn analysis delay
        const difficulty = activePlayer.botDifficulty || 'medium';
        const bestMove = selectAIMove(legalMoves, gameState.pawns, gameState.currentTurn, difficulty, gameState.rules);
        
        if (bestMove) {
          executeMove(bestMove.pawnId, bestMove.stepValue, bestMove.useTurnout);
        } else {
          // Fallback just in case
          executeMove(legalMoves[0].pawnId, legalMoves[0].stepValue, legalMoves[0].useTurnout);
        }
      }
      
      botExecutingRef.current = false;
    };

    triggerBotTurn();
  }, [gameState, executeRoll, executeMove, localPlayer]);

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
    executeRoll,
    executeMove,
    restartToLobby,
    sendChatMessage,
    updateProfileName,
    generateNewGuestProfile,
    updateRoomRules
  };
};
