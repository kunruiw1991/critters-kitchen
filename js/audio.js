'use strict';
const KitchenAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let unlocked = false;

  function unlock() {
    unlocked = true;
    if (!ctx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        ctx = new AudioContext();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.75;
        masterGain.connect(ctx.destination);
      } catch (e) {
        return;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function ready() {
    return unlocked && ctx && ctx.state === 'running' && !muted;
  }

  function playTone(freq, type, duration, vol = 1) {
    if (!ready()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, vol = 1) {
    if (!ready()) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(masterGain);
    noise.start();
  }

  function playWoodChop() {
    if (!ready()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    playNoise(0.05, 0.5);
  }

  function playEggCrack() {
    if (!ready()) return;
    playNoise(0.1, 0.8);
    playTone(800, 'triangle', 0.1, 0.5);
  }

  function playMilkPour() {
    if (!ready()) return;
    playTone(480, 'sine', 0.35, 0.3);
    playNoise(0.35, 0.2);
  }

  function playWhiskSwirl() {
    if (!ready()) return;
    playNoise(0.22, 0.18);
    playTone(320, 'sine', 0.22, 0.18);
  }

  function playOvenDing() {
    if (!ready()) return;
    playTone(1200, 'sine', 0.9, 0.9);
    playTone(2400, 'sine', 0.7, 0.3);
  }

  function playPipingSquish() {
    if (!ready()) return;
    playNoise(0.16, 0.25);
    playTone(220, 'triangle', 0.16, 0.45);
  }

  function playCandyClink() {
    if (!ready()) return;
    playTone(2000 + Math.random() * 500, 'sine', 0.1, 0.45);
  }

  function playCakeSlice() {
    if (!ready()) return;
    playNoise(0.15, 0.55);
  }

  function playHappyChomp() {
    if (!ready()) return;
    playNoise(0.1, 0.45);
    playTone(300, 'sawtooth', 0.1, 0.38);
    setTimeout(() => {
      playNoise(0.1, 0.38);
      playTone(250, 'sawtooth', 0.1, 0.38);
    }, 150);
  }

  function playKalimbaChime() {
    if (!ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setValueAtTime(0.45, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.45);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.45);
    });
  }

  return {
    init: unlock,
    unlock,
    playWoodChop,
    playEggCrack,
    playMilkPour,
    playWhiskSwirl,
    playOvenDing,
    playPipingSquish,
    playCandyClink,
    playCakeSlice,
    playHappyChomp,
    playKalimbaChime,
    isMuted: () => muted,
    setMuted: m => { muted = !!m; }
  };
})();

if (typeof window !== 'undefined') {
  window.KitchenAudio = KitchenAudio;
  window.SoundFX = KitchenAudio;
}
