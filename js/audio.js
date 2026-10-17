'use strict';
const KitchenAudio = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  function init() {
    if (ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.75;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.error('WebAudio not supported');
    }
  }

  function playTone(freq, type, duration, vol=1) {
    if (!ctx || muted) return;
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

  function playNoise(duration, vol=1) {
    if (!ctx || muted) return;
    const bufferSize = ctx.sampleRate * duration;
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
    init();
    if (!ctx || muted) return;
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
    init();
    if (!ctx || muted) return;
    playNoise(0.1, 0.8);
    playTone(800, 'triangle', 0.1, 0.5);
  }

  function playMilkPour() {
    init();
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    
    // Add some noise for liquid sound
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start();
    noise.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  function playWhiskSwirl() {
    init();
    if (!ctx || muted) return;
    playNoise(0.3, 0.2);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  function playOvenDing() {
    init();
    if (!ctx || muted) return;
    playTone(1200, 'sine', 1.0, 1);
    playTone(2400, 'sine', 0.8, 0.3);
  }

  function playPipingSquish() {
    init();
    if (!ctx || muted) return;
    playNoise(0.2, 0.3);
    playTone(200, 'triangle', 0.2, 0.5);
  }

  function playCandyClink() {
    init();
    if (!ctx || muted) return;
    playTone(2000 + Math.random() * 500, 'sine', 0.1, 0.5);
  }

  function playCakeSlice() {
    init();
    if (!ctx || muted) return;
    playNoise(0.15, 0.6);
  }

  function playHappyChomp() {
    init();
    if (!ctx || muted) return;
    playNoise(0.1, 0.5);
    playTone(300, 'sawtooth', 0.1, 0.4);
    setTimeout(() => {
        playNoise(0.1, 0.4);
        playTone(250, 'sawtooth', 0.1, 0.4);
    }, 150);
  }

  function playKalimbaChime() {
    init();
    if (!ctx || muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  }

  return {
    init,
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
