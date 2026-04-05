/**
 * sound.ts — FluidSense Sound Engine
 *
 * Single system, pure Web Audio API — no external files:
 *   Cursor sound: paper scrub + frozen snow shimmer
 *   - Paper layer  (~200–800 Hz) : dry fibrous drag texture  — 75% mix
 *   - Ice layer    (~6–10 kHz)   : airy crystal shimmer       — 25% mix
 *   Both layers are velocity-sensitive:
 *     slow mouse  → soft paper drag, barely any ice
 *     fast mouse  → harder scrub, more shimmer, slightly longer tail
 *
 * Usage:
 *   import { initSound } from './sound';
 *   initSound();
 */

// Safari prefixed AudioContext
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SoundState {
  ctx:       AudioContext | null;
  isOn:      boolean;
  lastX:     number;
  lastY:     number;
  lastTime:  number;
  variant:   'smooth' | 'silky' | 'crisp' | 'gritty' | 'textured' | 'velvety' | 'paper' | 'cotton' | 'linen' | 'suede' | 'light-silk' | 'canvas' | 'whoosh-loop' | 'water-ink' | 'sparkle';
  loopSrcs:  AudioBufferSourceNode[];
  loopGains: GainNode[];
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function initSound(): void {
  const state: SoundState = {
    ctx:       null,
    isOn:      false,
    lastX:     0,
    lastY:     0,
    lastTime:  0,
    variant:   'cotton', // Default to cotton
    loopSrcs:  [],
    loopGains: [],
  };

  const btn = document.getElementById('sound-toggle') as HTMLButtonElement | null;
  const lbl = document.getElementById('snd-label')   as HTMLSpanElement   | null;

  if (!btn) {
    console.warn('[sound.ts] #sound-toggle not found in DOM');
    return;
  }

  // ── Lazy AudioContext init ────────────────────────────────────────────────
  // Created on first toggle click to satisfy browser autoplay policy.

  function getCtx(): AudioContext | null {
    if (state.ctx) return state.ctx;

    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) {
      console.warn('[sound.ts] Web Audio API not supported');
      return null;
    }

    state.ctx = new Ctor();
    return state.ctx;
  }

  // ── Paper scrub + ice shimmer ─────────────────────────────────────────────
  //
  //  velocity : 0–1 (normalised px/ms, already thresholded before call)
  //
  //  Paper layer:
  //    White noise → bandpass centred ~400 Hz, Q=4 (narrow dry band)
  //    → second bandpass centred ~750 Hz, Q=2 (adds paper "body")
  //    → gain envelope: fast attack, medium-short decay (~80–120 ms)
  //
  //  Ice/snow layer:
  //    Same noise buffer → highpass 5 kHz → bandpass ~8 kHz, Q=1.5
  //    → gain: much quieter, slightly longer tail (icy sustain)
  //    Volume scales with velocity² so it only appears on faster moves

    /**

  // ── Smooth Paper (default) ───────────────────────────────────────────────
  // Warm, gentle, slightly filtered
  function triggerScrubSmooth(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.12 + velocity * 0.06;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.05));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Pink noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 220 + velocity * 60;
    bp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.4;

    const vol = Math.min(velocity * 0.09, 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.035);
    gain.gain.setValueAtTime(vol, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // ── Silky Paper (very smooth, higher pitched) ────────────────────────────
  // Softer, more silk than paper
  function triggerScrubSilky(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.14 + velocity * 0.07;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.08));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Very pink noise (softer)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99900 * b0 + white * 0.0400000;
      b1 = 0.99400 * b1 + white * 0.0600000;
      b2 = 0.97000 * b2 + white * 0.1200000;
      data[i] = (b0 + b1 + b2 + white * 0.3) * 0.08;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Centered lower for that velvet feel
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180 + velocity * 40;
    bp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.3;

    const vol = Math.min(velocity * 0.08, 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.setValueAtTime(vol, now + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.03);
  }

  // ── Crisp Paper (more texture, sharper attack) ────────────────────────────
  // Higher frequencies, defined texture
  function triggerScrubCrisp(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.11 + velocity * 0.05;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.04));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Less filtered (more white)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99800 * b0 + white * 0.0800000;
      b1 = 0.99200 * b1 + white * 0.1000000;
      b2 = 0.96500 * b2 + white * 0.1800000;
      data[i] = (b0 + b1 + b2 + white * 0.6) * 0.12;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Slightly higher center
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 280 + velocity * 80;
    bp.Q.value = 0.9;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    lp.Q.value = 0.5;

    const vol = Math.min(velocity * 0.10, 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.025);
    gain.gain.setValueAtTime(vol, now + duration * 0.4);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.015);
  }

  // ── Gritty Paper (texture-rich, more abrasive) ────────────────────────────
  // Broader frequency range, more paper fibers
  function triggerScrubGritty(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.13 + velocity * 0.065;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.06));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Mix of white and pink for texture
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99880 * b0 + white * 0.0600000;
      b1 = 0.99330 * b1 + white * 0.0800000;
      b2 = 0.96900 * b2 + white * 0.1600000;
      data[i] = (b0 + b1 + b2 + white * 0.55) * 0.115;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Twin bandpass for more texture
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 250 + velocity * 70;
    bp1.Q.value = 1.2;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 500 + velocity * 120;
    bp2.Q.value = 0.8;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;

    const vol = Math.min(velocity * 0.095, 0.075);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.032);
    gain.gain.setValueAtTime(vol, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // ── Textured Paper (multi-layer, most organic) ────────────────────────────
  // Complex frequency response, feels most like real paper
  function triggerScrubTextured(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.15 + velocity * 0.07;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.07));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Rich pink noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Multiple bandpass stages for organic feel
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 200 + velocity * 50;
    bp1.Q.value = 0.6;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 450 + velocity * 100;
    bp2.Q.value = 0.7;

    const bp3 = ctx.createBiquadFilter();
    bp3.type = 'bandpass';
    bp3.frequency.value = 750;
    bp3.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    lp.Q.value = 0.5;

    const vol = Math.min(velocity * 0.088, 0.068);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.setValueAtTime(vol, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(bp3);
    bp3.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.025);
  }

  // ── Velvety Paper (very soft, barely there) ──────────────────────────────
  // Maximum softness, delicate
  function triggerScrubVelvety(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.16 + velocity * 0.08;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.1));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Ultra-soft pink noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99920 * b0 + white * 0.0300000;
      b1 = 0.99500 * b1 + white * 0.0500000;
      b2 = 0.97500 * b2 + white * 0.1000000;
      data[i] = (b0 + b1 + b2 + white * 0.25) * 0.06;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Very low center freq for maximum velvet
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 160 + velocity * 30;
    bp.Q.value = 0.4;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.2;

    const vol = Math.min(velocity * 0.07, 0.04);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.05);
    gain.gain.setValueAtTime(vol, now + duration * 0.65);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.04);
  }

  // ── Paper (true paper texture) ───────────────────────────────────────────
  // Balanced, dry paper-like scrub
  function triggerScrubPaper(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.12 + velocity * 0.06;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.05));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Mix of pink and white for paper texture
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.45) * 0.11;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 350 + velocity * 70;
    bp.Q.value = 0.8;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    lp.Q.value = 0.45;

    const vol = Math.min(velocity * 0.092, 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.033);
    gain.gain.setValueAtTime(vol, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  **/

  // ── Cotton (soft fabric texture) ──────────────────────────────────────────
  // Warm, soft, slightly damped like cotton
  function triggerScrubCotton(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.14 + velocity * 0.07;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.07));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Soft pink noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99905 * b0 + white * 0.0450000;
      b1 = 0.99400 * b1 + white * 0.0650000;
      b2 = 0.97200 * b2 + white * 0.1150000;
      data[i] = (b0 + b1 + b2 + white * 0.35) * 0.085;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 240 + velocity * 50;
    bp.Q.value = 0.65;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 750;
    lp.Q.value = 0.35;

    const vol = Math.min(velocity * 0.085, 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.04);
    gain.gain.setValueAtTime(vol, now + duration * 0.55);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.025);
  }

  /**

  // ── Linen (structured fabric texture) ─────────────────────────────────────
  // Crisp but warm, like linen fabric
  function triggerScrubLinen(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.13 + velocity * 0.062;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.055));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Pink-white mix for fabric texture
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99882 * b0 + white * 0.0620000;
      b1 = 0.99328 * b1 + white * 0.0850000;
      b2 = 0.96850 * b2 + white * 0.1650000;
      data[i] = (b0 + b1 + b2 + white * 0.52) * 0.112;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320 + velocity * 75;
    bp.Q.value = 0.85;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1050;
    lp.Q.value = 0.5;

    const vol = Math.min(velocity * 0.094, 0.073);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.031);
    gain.gain.setValueAtTime(vol, now + duration * 0.48);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.018);
  }

  // ── Suede (smooth fine texture) ──────────────────────────────────────────
  // Velvety but with fine grain, like suede
  function triggerScrubSuede(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.145 + velocity * 0.075;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.08));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Very smooth pink noise with slight white mix
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99912 * b0 + white * 0.0350000;
      b1 = 0.99450 * b1 + white * 0.0550000;
      b2 = 0.97400 * b2 + white * 0.1080000;
      data[i] = (b0 + b1 + b2 + white * 0.28) * 0.075;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 200 + velocity * 45;
    bp.Q.value = 0.55;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.3;

    const vol = Math.min(velocity * 0.082, 0.058);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.045);
    gain.gain.setValueAtTime(vol, now + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.032);
  }

  // ── Light Silk (lighter, airier silk) ────────────────────────────────────
  // Airier than silky, more presence in high frequencies
  function triggerScrubLightSilk(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.13 + velocity * 0.065;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.06));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Very pink noise (softer but airier)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99895 * b0 + white * 0.0450000;
      b1 = 0.99380 * b1 + white * 0.0680000;
      b2 = 0.96950 * b2 + white * 0.1350000;
      data[i] = (b0 + b1 + b2 + white * 0.4) * 0.09;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 210 + velocity * 55;
    bp.Q.value = 0.6;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 850;
    lp.Q.value = 0.38;

    const vol = Math.min(velocity * 0.087, 0.062);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.038);
    gain.gain.setValueAtTime(vol, now + duration * 0.57);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.028);
  }

  // ── Canvas (textured fabric) ────────────────────────────────────────────
  // Rough but musical, like canvas fabric
  function triggerScrubCanvas(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.125 + velocity * 0.064;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.052));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Rich texture mix
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99878 * b0 + white * 0.0680000;
      b1 = 0.99300 * b1 + white * 0.0920000;
      b2 = 0.96750 * b2 + white * 0.1750000;
      data[i] = (b0 + b1 + b2 + white * 0.58) * 0.117;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Twin bandpass for texture
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 280 + velocity * 65;
    bp1.Q.value = 1.1;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 560 + velocity * 110;
    bp2.Q.value = 0.75;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 0.55;

    const vol = Math.min(velocity * 0.098, 0.077);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.03);
    gain.gain.setValueAtTime(vol, now + duration * 0.49);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(bp1);
    bp1.connect(bp2);
    bp2.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.019);
  }

  **/

  // ═══════════════════════════════════════════════════════════════════════════
  // ── PREMIUM FLUID SOUNDSCAPE ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  function stopAllLoops(): void {
    state.loopSrcs.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // Already stopped
      }
    });
    state.loopSrcs = [];
    state.loopGains = [];
  }

  // ── Base Whoosh Loop ───────────────────────────────────────────────────────
  // Soft continuous airy whoosh, silk cloth swishing, gentle wind
  function startWhooshLoop(): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    stopAllLoops();

    const loopDuration = 3.2; // 3.2s loopable duration
    const bufLen = Math.ceil(ctx.sampleRate * loopDuration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Very soft pink noise for whoosh body
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const t = i / ctx.sampleRate;
      const white = Math.random() * 2 - 1;

      // Pink noise
      b0 = 0.99920 * b0 + white * 0.0350000;
      b1 = 0.99500 * b1 + white * 0.0450000;
      b2 = 0.97600 * b2 + white * 0.1050000;
      let pink = (b0 + b1 + b2 + white * 0.28) * 0.04;

      // Slow modulation for organic feel
      const mod = 0.5 + 0.5 * Math.sin((t * Math.PI) / 1.6);
      pink *= mod;

      data[i] = pink;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    // Gentle lowpass for silky feel
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.3;

    const gain = ctx.createGain();
    gain.gain.value = 0.36;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start();
    state.loopSrcs.push(src);
    state.loopGains.push(gain);
  }

  // ── Water / Ink Texture Loop ───────────────────────────────────────────────
  // Subtle liquid diffusion, ink spreading in water, underwater ambience
  function startWaterInkLoop(): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    stopAllLoops();

    const loopDuration = 4.8; // Longer, more subtle loop
    const bufLen = Math.ceil(ctx.sampleRate * loopDuration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Granular diffusion texture
    for (let i = 0; i < bufLen; i++) {
      const t = i / ctx.sampleRate;

      // Multiple layers of smooth random
      const grain1 = Math.sin(t * 0.5 + Math.random() * 0.3) * 0.02;
      const grain2 = Math.sin(t * 0.3 + Math.random() * 0.5) * 0.015;
      const grain3 = Math.sin(t * 0.2 + Math.random() * 0.7) * 0.01;

      // Very subtle white noise for texture
      const noise = (Math.random() * 2 - 1) * 0.003;

      data[i] = grain1 + grain2 + grain3 + noise;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    // Heavy highpass to remove low end, then subtle eq
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    hp.Q.value = 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000;
    lp.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.value = 0.24; // Very quiet

    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start();
    state.loopSrcs.push(src);
    state.loopGains.push(gain);
  }

  // ── Combined Whoosh + Water Loop ──────────────────────────────────────────
  // Plays both loops together for rich soundscape
  function startCombinedFluidLoop(): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    stopAllLoops();

    // Whoosh
    const whooshDuration = 3.2;
    const whooshLen = Math.ceil(ctx.sampleRate * whooshDuration);
    const whooshBuf = ctx.createBuffer(1, whooshLen, ctx.sampleRate);
    const whooshData = whooshBuf.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < whooshLen; i++) {
      const t = i / ctx.sampleRate;
      const white = Math.random() * 2 - 1;
      b0 = 0.99920 * b0 + white * 0.0350000;
      b1 = 0.99500 * b1 + white * 0.0450000;
      b2 = 0.97600 * b2 + white * 0.1050000;
      let pink = (b0 + b1 + b2 + white * 0.28) * 0.04;
      const mod = 0.5 + 0.5 * Math.sin((t * Math.PI) / 1.6);
      whooshData[i] = pink * mod;
    }

    // Water/Ink
    const waterDuration = 4.8;
    const waterLen = Math.ceil(ctx.sampleRate * waterDuration);
    const waterBuf = ctx.createBuffer(1, waterLen, ctx.sampleRate);
    const waterData = waterBuf.getChannelData(0);

    for (let i = 0; i < waterLen; i++) {
      const t = i / ctx.sampleRate;
      const grain1 = Math.sin(t * 0.5 + Math.random() * 0.3) * 0.02;
      const grain2 = Math.sin(t * 0.3 + Math.random() * 0.5) * 0.015;
      const grain3 = Math.sin(t * 0.2 + Math.random() * 0.7) * 0.01;
      const noise = (Math.random() * 2 - 1) * 0.003;
      waterData[i] = grain1 + grain2 + grain3 + noise;
    }

    // Whoosh chain
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = whooshBuf;
    whooshSrc.loop = true;

    const whooshLp = ctx.createBiquadFilter();
    whooshLp.type = 'lowpass';
    whooshLp.frequency.value = 600;
    whooshLp.Q.value = 0.3;

    const whooshGain = ctx.createGain();
    whooshGain.gain.value = 0.36;

    whooshSrc.connect(whooshLp);
    whooshLp.connect(whooshGain);
    whooshGain.connect(ctx.destination);

    // Water chain
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = waterBuf;
    waterSrc.loop = true;

    const waterHp = ctx.createBiquadFilter();
    waterHp.type = 'highpass';
    waterHp.frequency.value = 2000;
    waterHp.Q.value = 0.5;

    const waterLp = ctx.createBiquadFilter();
    waterLp.type = 'lowpass';
    waterLp.frequency.value = 8000;
    waterLp.Q.value = 0.4;

    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.24;

    waterSrc.connect(waterHp);
    waterHp.connect(waterLp);
    waterLp.connect(waterGain);
    waterGain.connect(ctx.destination);

    whooshSrc.start();
    waterSrc.start();

    state.loopSrcs.push(whooshSrc, waterSrc);
    state.loopGains.push(whooshGain, waterGain);
  }

  // ── Acceleration Sparkle (one-shot) ───────────────────────────────────────
  // Tiny airy shimmer sparkle, magical dust, soft chime particles
  function triggerSparkle(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const duration = 0.15 + velocity * 0.05;
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.03));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    // Smooth sine sweep + shimmer
    for (let i = 0; i < bufLen; i++) {
      const t = i / ctx.sampleRate;
      const norm = t / duration;

      // High-frequency sine sweep down (10k → 7k)
      const freq = 10000 - norm * 3000;
      const sweep = Math.sin((2 * Math.PI * freq * t) / ctx.sampleRate);

      // Ultra-subtle noise shimmer
      const shimmer = (Math.random() * 2 - 1) * 0.015;

      // Envelope: quick attack, smooth decay
      const env = Math.exp(-t * 4);

      data[i] = (sweep * 0.8 + shimmer * 0.2) * env * 0.08;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Highpass to emphasize shimmer
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    hp.Q.value = 2;

    const vol = Math.min(velocity * 0.18, 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.01);
  }



  // ── Main trigger dispatcher ────────────────────────────────────────────────
  function triggerScrub(velocity: number): void {
    switch (state.variant) {
      case 'cotton':
        triggerScrubCotton(velocity);
        break;
      default:
        triggerScrubCotton(velocity); // Default to cotton
    }
  }

  function handleFluidVariant(): void {
    switch (state.variant) {
      case 'whoosh-loop':
        startWhooshLoop();
        break;
      case 'water-ink':
        startWaterInkLoop();
        break;
      case 'sparkle':
        startCombinedFluidLoop();
        break;
    }
  }

  // ── Mouse velocity tracker ────────────────────────────────────────────────

  document.addEventListener('mousemove', (e: MouseEvent): void => {
    if (!state.isOn) return;

    const now  = performance.now();
    const dt   = Math.max(now - state.lastTime, 1);
    const dx   = e.clientX - state.lastX;
    const dy   = e.clientY - state.lastY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Normalise: scale factor tuned so a comfortable drag ≈ 0.4–0.7
    const vel = Math.min((dist / dt) * 10, 1);

    // Threshold — only fire on deliberate movement, not hover tremor
    if (vel > 0.12) {
      // For fluid variants: trigger sparkle on faster motion
      if (state.variant === 'whoosh-loop' || state.variant === 'water-ink' || state.variant === 'sparkle') {
        if (vel > 0.4) triggerSparkle(vel);
      } else {
        // For scrubbing variants
        triggerScrub(vel);
      }
    }

    state.lastX    = e.clientX;
    state.lastY    = e.clientY;
    state.lastTime = now;
  });

  // ── Toggle button ─────────────────────────────────────────────────────────

  btn.addEventListener('click', (): void => {
    // First click also initialises AudioContext (autoplay policy requirement)
    if (!state.ctx) getCtx();

    state.isOn = !state.isOn;
    btn.classList.toggle('active', state.isOn);
    if (lbl) lbl.textContent = state.isOn ? 'Sound On' : 'Sound';

    // Start or stop fluid loops
    if (state.isOn) {
      if (state.variant === 'whoosh-loop' || state.variant === 'water-ink' || state.variant === 'sparkle') {
        handleFluidVariant();
      }
    } else {
      stopAllLoops();
    }
  });

  // ── Sound variant selector ─────────────────────────────────────────────────
  const variantContainer = document.getElementById('sound-variants') as HTMLDivElement | null;
  if (variantContainer) {
    variantContainer.innerHTML = '';
    const variants: Array<'cotton'> = [
      'cotton',
    ];

    variants.forEach((variant) => {
      const btn = document.createElement('button');
      btn.textContent = variant.charAt(0).toUpperCase() + variant.slice(1).replace('-', ' ');
      btn.classList.add('variant-btn');
      if (variant === state.variant) btn.classList.add('active');

      btn.addEventListener('click', (): void => {
        // Stop any running loops before switching
        stopAllLoops();

        state.variant = variant;
        document.querySelectorAll('.variant-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Start fluid loops if sound is on
        if (state.isOn) {
          // if (variant === 'whoosh-loop' || variant === 'water-ink' || variant === 'sparkle') {
          //   handleFluidVariant();
          // }
        }
      });

      variantContainer.appendChild(btn);
    });
  }
}