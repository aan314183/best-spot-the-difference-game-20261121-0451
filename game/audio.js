/* Lantern Lane — tiny sound kit.
   No audio files: every sound is a short WebAudio oscillator phrase,
   built fresh on each call so the game needs no network and no assets.
   Mute state lives here and is shared with game.js through the window. */

const SoundKit = (function () {
  let ctx = null;
  let muted = false;

  function audioContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startAt, dur, type, vol) {
    const ac = audioContext();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ac.currentTime + startAt);
    gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + startAt);
    osc.stop(ac.currentTime + startAt + dur + 0.05);
  }

  function playFind() {
    tone(660, 0, 0.12, 'sine', 0.22);
    tone(990, 0.09, 0.2, 'sine', 0.22);
    tone(1320, 0.18, 0.24, 'triangle', 0.14);
  }

  function playMiss() {
    tone(160, 0, 0.18, 'sawtooth', 0.1);
    tone(110, 0.1, 0.22, 'sawtooth', 0.1);
  }

  function playHint() {
    tone(520, 0, 0.1, 'sine', 0.14);
    tone(780, 0.08, 0.14, 'sine', 0.14);
  }

  function playTick() {
    tone(880, 0, 0.06, 'square', 0.06);
  }

  function playWin() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => tone(n, i * 0.12, 0.3, 'triangle', 0.18));
  }

  function playLose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => tone(n, i * 0.16, 0.3, 'triangle', 0.14));
  }

  return {
    playFind: playFind,
    playMiss: playMiss,
    playHint: playHint,
    playTick: playTick,
    playWin: playWin,
    playLose: playLose,
    isMuted: function () { return muted; },
    toggleMute: function () { muted = !muted; return muted; },
  };
})();
