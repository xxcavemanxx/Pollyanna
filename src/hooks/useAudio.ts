import { useState, useCallback } from 'react';

export const useAudio = () => {
  const [muted, setMuted] = useState(false);

  const toggleMute = () => {
    setMuted(m => !m);
  };

  const getAudioContext = (): AudioContext => {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  };

  // 1. Synthesize Dice Roll (fast rattling rumble)
  const playRoll = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Let's create multiple rattle ticks
      const duration = 0.5;
      const ticks = 8;
      
      for (let i = 0; i < ticks; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        // Alternating pitch to simulate dice bouncing
        osc.frequency.setValueAtTime(80 + Math.random() * 60, now + (i * (duration / ticks)));
        
        gain.gain.setValueAtTime(0.15, now + (i * (duration / ticks)));
        gain.gain.exponentialRampToValueAtTime(0.01, now + ((i + 0.8) * (duration / ticks)));
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + (i * (duration / ticks)));
        osc.stop(now + ((i + 1) * (duration / ticks)));
      }
    } catch (e) {
      console.warn("Web Audio failed:", e);
    }
  }, [muted]);

  // 2. Synthesize Pawn Step (crisp, pleasant wooden tick)
  const playStep = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08); // Quick drop
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  // 3. Synthesize Capture (dramatic crash/explosion and slide)
  const playCapture = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      // Retro crash noise
      const bufferSize = ctx.sampleRate * 0.3; // 0.3 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      // Filter for noise to make it feel robust but soft
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 500;
      
      // Tone slide alongside noise
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      
      const gainNoise = ctx.createGain();
      gainNoise.gain.setValueAtTime(0.15, now);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      const gainOsc = ctx.createGain();
      gainOsc.gain.setValueAtTime(0.08, now);
      gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      noise.connect(filter);
      filter.connect(gainNoise);
      gainNoise.connect(ctx.destination);
      
      osc.connect(gainOsc);
      gainOsc.connect(ctx.destination);
      
      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.32);
      osc.stop(now + 0.32);
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  // 4. Synthesize Entering Safe Space (beautiful perfect-fifth chime)
  const playSafety = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const frequencies = [440, 659.25]; // A4 and E5 (harmonic perfect fifth)
      
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        
        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + idx * 0.05);
        osc.stop(now + 0.45);
      });
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  // 5. Synthesize Landing Home (arpeggiated major chord scale up)
  const playHome = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 major arpeggio
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);
        
        gain.gain.setValueAtTime(0.15, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(now + index * 0.08);
        osc.stop(now + 0.6);
      });
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  // 6. Synthesize Turn Notification (gentle wood block ping)
  const playTurn = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  // 7. Synthesize Winning Fanfare (triumphant chord sequence)
  const playWin = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const chords = [
        [261.63, 329.63, 392.00], // C major
        [349.23, 440.00, 523.25], // F major
        [392.00, 493.88, 587.33], // G major
        [523.25, 659.25, 783.99, 1046.50] // C major triumphant arpeggio up
      ];
      
      chords.forEach((chord, chordIdx) => {
        const timeOffset = chordIdx * 0.25;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + timeOffset);
          
          gain.gain.setValueAtTime(0.08, now + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.5);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + timeOffset);
          osc.stop(now + timeOffset + 0.52);
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }, [muted]);

  return {
    muted,
    toggleMute,
    playRoll,
    playStep,
    playCapture,
    playSafety,
    playHome,
    playTurn,
    playWin
  };
};
