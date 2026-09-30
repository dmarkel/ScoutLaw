// All sound is synthesized with the Web Audio API — no audio files needed.
// The theme is an original big-band game-show tune (not the TV theme).
(function () {
  let ctx, master, musicBus, sfxBus, noiseBuf;
  let musicGain = null;      // per-song gain so a song can be faded/stopped
  let loopTimer = null;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx.resume();
  }

  function noise(t, dur, out) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  function env(g, t, a, peak, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  // ---------- Instruments ----------

  function brass(out, t, note, dur, vel = 0.2) {
    const f = midi(note);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(5200, f * 7), t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(Math.min(2800, f * 4), t + Math.max(0.1, dur));
    [-7, 0, 7].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.detune.value = cents;
      o.frequency.setValueAtTime(f * 0.94, t);           // brassy scoop up
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
    env(g, t, 0.025, vel, dur + 0.06, Math.min(0.08, dur * 0.5));
    lp.connect(g).connect(out);
  }

  function chord(out, t, notes, dur, vel = 0.1) {
    notes.forEach((n) => brass(out, t, n, dur, vel));
  }

  function bass(out, t, note, dur) {
    const f = midi(note);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(lp).connect(g);
    env(g, t, 0.01, 0.38, dur, 0.05);
    g.connect(out);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function kick(out, t, vel = 0.9) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.32);
  }

  function snare(out, t, vel = 0.4) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    noise(t, 0.18, hp);
    hp.connect(g).connect(out);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 190;
    og.gain.setValueAtTime(vel * 0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.1);
  }

  function hat(out, t, vel = 0.08) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    noise(t, 0.06, hp);
    hp.connect(g).connect(out);
  }

  function crash(out, t, vel = 0.35, len = 2) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    noise(t, len, hp);
    hp.connect(g).connect(out);
  }

  // ---------- Original theme ----------
  // Notes are MIDI numbers, times are in beats. Key of F major.
  const F4 = 65;
  const deg = (s) => F4 + s;               // scale offset from F4
  const CH = {
    F: [53, 57, 60, 65],   // F3 A3 C4 F4
    Bb: [53, 58, 62, 65],  // F3 Bb3 D4 F4
    C: [55, 60, 64, 67],   // G3 C4 E4 G4
    Dm: [57, 62, 65, 69],
    Gm: [55, 58, 62, 67],
    C7: [55, 58, 64, 67]
  };
  const ROOT = { F: 41, Bb: 46, C: 48, Dm: 50, Gm: 43, C7: 48 };

  // Melody bars (each item: [beat, scaleOffset, beats])
  const MELODY = [
    [[0, 7, 0.5], [0.5, 4, 0.5], [1, 7, 0.5], [1.5, 12, 1.5], [3, 11, 0.5], [3.5, 9, 0.5]],
    [[0, 7, 1.5], [1.5, 4, 0.5], [2, 5, 0.5], [2.5, 7, 1.5]],
    [[0, 9, 0.5], [0.5, 9, 0.5], [1, 12, 1], [2, 9, 0.5], [2.5, 5, 0.5], [3, 9, 1]],
    [[0, 7, 0.5], [0.5, 11, 0.5], [1, 14, 1.5], [2.5, 12, 0.5], [3, 11, 0.5], [3.5, 9, 0.5]],
    [[0, 7, 0.5], [0.5, 4, 0.5], [1, 7, 0.5], [1.5, 12, 1.5], [3, 16, 1]],
    [[0, 16, 0.5], [0.5, 14, 0.5], [1, 12, 0.5], [1.5, 9, 1.5], [3, 12, 1]],
    [[0, 14, 1], [1, 12, 0.5], [1.5, 9, 0.5], [2, 11, 0.5], [2.5, 14, 0.5], [3, 17, 1]],
    [[0, 16, 0.5], [0.5, 12, 0.5], [1, 19, 1], [2, 16, 0.5], [2.5, 12, 1.5]]
  ];
  const CHORDS = [["F"], ["F"], ["Bb"], ["C"], ["F"], ["Dm"], ["Gm", "C7"], ["F"]];

  function drumBar(out, t, spb, fill = false) {
    for (let b = 0; b < 4; b++) {
      const bt = t + b * spb;
      if (b === 0 || b === 2) kick(out, bt);
      if (b === 2) kick(out, bt + spb * 0.5, 0.5);
      if (b === 1 || b === 3) snare(out, bt);
      hat(out, bt, 0.09);
      hat(out, bt + spb * 0.5, 0.05);
    }
    if (fill) {
      for (let i = 0; i < 4; i++) snare(out, t + spb * (3 + i * 0.25), 0.18 + i * 0.07);
    }
  }

  function playBar(out, t, spb, i) {
    const mel = MELODY[i];
    const chs = CHORDS[i];
    mel.forEach(([b, s, len]) => {
      brass(out, t + b * spb, deg(s), len * spb * 0.92, 0.2);
      brass(out, t + b * spb, deg(s) - 12, len * spb * 0.92, 0.09);
    });
    chs.forEach((c, ci) => {
      const off = ci * 2;          // two chords per bar when listed
      const span = 4 / chs.length;
      // offbeat "hits" from the band
      for (let h = 0.5; h < span; h += 2) {
        chord(out, t + (off + h + 1) * spb, CH[c], spb * 0.35, 0.05);
      }
      // walking bass: root, fifth, octave, fifth
      const r = ROOT[c];
      const walk = span === 4 ? [r, r + 7, r + 12, r + 7] : [r, r + 7];
      walk.forEach((n, k) => bass(out, t + (off + k) * spb, n, spb * 0.9));
    });
    drumBar(out, t, spb, i === MELODY.length - 1);
  }

  function newMusicGain(level) {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(musicBus);
    return g;
  }

  // Full intro version: fanfare + melody + big ending. Returns length in seconds.
  function playTheme() {
    stopMusic(0.05);
    const out = (musicGain = newMusicGain(1));
    const spb = 60 / 150;
    let t = ctx.currentTime + 0.08;

    // Fanfare bar 1: ta-ta TAAA
    chord(out, t, CH.F.map((n) => n + 12), spb * 0.3, 0.09);
    chord(out, t + spb * 0.5, CH.F.map((n) => n + 12), spb * 0.3, 0.09);
    chord(out, t + spb * 1.5, CH.F.map((n) => n + 12), spb * 2.4, 0.1);
    bass(out, t, 41, spb * 0.4); bass(out, t + spb * 0.5, 41, spb * 0.4); bass(out, t + spb * 1.5, 41, spb * 2.3);
    kick(out, t); kick(out, t + spb * 0.5); kick(out, t + spb * 1.5); crash(out, t + spb * 1.5, 0.3);
    t += spb * 4;
    // Fanfare bar 2: Bb hits, then C with snare roll
    chord(out, t, CH.Bb.map((n) => n + 12), spb * 0.3, 0.09);
    chord(out, t + spb * 0.75, CH.Bb.map((n) => n + 12), spb * 0.3, 0.09);
    chord(out, t + spb * 1.5, CH.C.map((n) => n + 12), spb * 2.4, 0.1);
    bass(out, t, 46, spb * 0.4); bass(out, t + spb * 0.75, 46, spb * 0.4); bass(out, t + spb * 1.5, 48, spb * 2.3);
    kick(out, t); kick(out, t + spb * 0.75);
    for (let i = 0; i < 10; i++) snare(out, t + spb * (1.5 + i * 0.25), 0.08 + i * 0.03);
    t += spb * 4;

    for (let i = 0; i < MELODY.length; i++) {
      playBar(out, t, spb, i);
      t += spb * 4;
    }
    // Big finish
    chord(out, t, [53, 57, 60, 65, 69, 72, 77], spb * 3, 0.1);
    brass(out, t, 77, spb * 3, 0.14);
    bass(out, t, 29, spb * 3);
    kick(out, t); crash(out, t, 0.45, 3);
    return t + spb * 3 - ctx.currentTime;
  }

  // Quieter looping bed (melody section only).
  function startLoop() {
    stopMusic(0.05);
    const out = (musicGain = newMusicGain(0.45));
    const spb = 60 / 150;
    const barLen = spb * 4;
    let t = ctx.currentTime + 0.1;
    const schedule = () => {
      for (let i = 0; i < MELODY.length; i++) playBar(out, t + i * barLen, spb, i);
      t += barLen * MELODY.length;
      const wait = (t - ctx.currentTime - 1) * 1000;
      loopTimer = setTimeout(() => { if (musicGain === out) schedule(); }, wait);
    };
    schedule();
  }

  function stopMusic(fade = 0.8) {
    clearTimeout(loopTimer);
    if (!musicGain) return;
    const g = musicGain;
    musicGain = null;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => g.disconnect(), fade * 1000 + 200);
  }

  const isMusicPlaying = () => !!musicGain;

  // ---------- Sound effects ----------

  // The "ding" when an answer is revealed.
  function ding(when = 0) {
    const t = ctx.currentTime + when;
    [[1, 0.35], [2.01, 0.12], [3.02, 0.08], [4.17, 0.05]].forEach(([mult, v]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1046.5 * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / mult + 0.2);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 2);
    });
  }

  // Wooden flip "clack" + whoosh for the slot turning over.
  function flip() {
    const t = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    const g = ctx.createGain();
    env(g, t, 0.1, 0.35, 0.35, 0.2);
    noise(t, 0.4, bp);
    bp.connect(g).connect(sfxBus);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.setValueAtTime(900, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.33);
    og.gain.setValueAtTime(0.3, t + 0.28);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(og).connect(sfxBus);
    o.start(t + 0.28);
    o.stop(t + 0.4);
  }

  // The wrong-answer buzzer.
  function buzzer() {
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    env(g, t, 0.01, 0.35, 1.0, 0.08);
    [98, 103.5, 196].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.05);
    });
    lp.connect(g).connect(sfxBus);
  }

  function whoosh(when = 0, up = true) {
    const t = ctx.currentTime + when;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(up ? 300 : 3000, t);
    bp.frequency.exponentialRampToValueAtTime(up ? 3500 : 300, t + 0.45);
    const g = ctx.createGain();
    env(g, t, 0.2, 0.3, 0.5, 0.25);
    noise(t, 0.55, bp);
    bp.connect(g).connect(sfxBus);
  }

  // Short sparkle arpeggio (used for each word in the finale).
  function sparkle(when = 0, base = 84) {
    const t = ctx.currentTime + when;
    [0, 4, 7, 12].forEach((s, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = midi(base + s);
      g.gain.setValueAtTime(0.0001, t + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.045 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.35);
      o.connect(g).connect(sfxBus);
      o.start(t + i * 0.045);
      o.stop(t + i * 0.045 + 0.4);
    });
  }

  // ---------- Studio audience ----------

  function applause(when = 0, dur = 3.2, level = 1) {
    const t0 = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.9 * level, t0 + 0.35);
    out.gain.setValueAtTime(0.9 * level, t0 + dur * 0.45);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(sfxBus);

    // steady wash of many far-away hands
    const bed = ctx.createBiquadFilter();
    bed.type = "bandpass";
    bed.frequency.value = 1500;
    bed.Q.value = 0.6;
    const bedG = ctx.createGain();
    bedG.gain.value = 0.12;
    noise(t0, dur, bed);
    bed.connect(bedG).connect(out);

    // individual claps
    const claps = Math.floor(dur * 70);
    for (let i = 0; i < claps; i++) {
      const t = t0 + Math.random() * dur;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 700 + Math.random() * 2200;
      bp.Q.value = 1 + Math.random();
      const g = ctx.createGain();
      const v = 0.15 + Math.random() * 0.35;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
      noise(t, 0.08, bp);
      bp.connect(g).connect(out);
    }
  }

  const VOWELS = { oo: [320, 800], oh: [520, 900], ah: [760, 1150], ay: [500, 1800], ee: [290, 2200] };

  // One crowd voice: a buzzing tone shaped by two vowel formants.
  function voice(out, t, dur, f0, f1, vowelA, vowelB, level) {
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(f0, t);
    src.frequency.linearRampToValueAtTime(f1, t + dur * 0.8);
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 5 + Math.random() * 2;
    vibG.gain.value = f0 * 0.02;
    vib.connect(vibG).connect(src.frequency);

    const g = ctx.createGain();
    env(g, t, dur * 0.25, level, dur, dur * 0.4);
    const [a1, a2] = VOWELS[vowelA];
    const [b1, b2] = VOWELS[vowelB];
    [[a1, b1, 1], [a2, b2, 0.5]].forEach(([fa, fb, amp]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 7;
      bp.frequency.setValueAtTime(fa, t);
      bp.frequency.linearRampToValueAtTime(fb, t + dur * 0.7);
      const ag = ctx.createGain();
      ag.gain.value = amp;
      src.connect(bp).connect(ag).connect(g);
    });
    g.connect(out);
    src.start(t); vib.start(t);
    src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  function crowd({ when = 0, count = 18, dur = 1.4, rise = 1.25, vA = "oo", vB = "ah", spread = 0.35, level = 0.5 }) {
    const t0 = ctx.currentTime + when;
    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(sfxBus);
    for (let i = 0; i < count; i++) {
      const kid = Math.random() < 0.55;
      const f0 = kid ? 260 + Math.random() * 180 : 110 + Math.random() * 90;
      const st = t0 + Math.random() * spread;
      const d = dur * (0.75 + Math.random() * 0.5);
      voice(out, st, d, f0, f0 * rise * (0.9 + Math.random() * 0.2), vA, vB, 0.25);
    }
  }

  // "Woooo!" + applause for a correct answer.
  function cheer() {
    crowd({ when: 0.05, count: 20, dur: 1.2, rise: 1.45, vA: "oo", vB: "ah", spread: 0.4, level: 0.55 });
    crowd({ when: 0.6, count: 12, dur: 0.8, rise: 1.2, vA: "ay", vB: "ah", spread: 0.8, level: 0.35 });
    applause(0.1, 3.4, 1);
  }

  // "Awwww" for a wrong answer.
  function aww() {
    crowd({ when: 0.25, count: 20, dur: 1.5, rise: 0.72, vA: "ah", vB: "oo", spread: 0.25, level: 0.5 });
  }

  // "Ooooh" of anticipation.
  function ooh() {
    crowd({ when: 0, count: 18, dur: 1.1, rise: 1.15, vA: "oo", vB: "oh", spread: 0.2, level: 0.45 });
  }

  window.Sound = {
    init, playTheme, startLoop, stopMusic, isMusicPlaying,
    ding, flip, buzzer, whoosh, sparkle, applause, cheer, aww, ooh
  };
})();
