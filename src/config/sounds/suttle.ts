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
  variant:   'smooth' | 'silky' | 'crisp' | 'gritty' | 'textured' | 'velvety';
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function initSound(): void {
  const state: SoundState = {
    ctx:       null,
    isOn:      false,
    lastX:     0,
    lastY:     0,
    lastTime:  0,
    variant:   'smooth',
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

  // ── Main trigger dispatcher ────────────────────────────────────────────────
  function triggerScrub(velocity: number): void {
    switch (state.variant) {
      case 'silky':
        triggerScrubSilky(velocity);
        break;
      case 'crisp':
        triggerScrubCrisp(velocity);
        break;
      case 'gritty':
        triggerScrubGritty(velocity);
        break;
      case 'textured':
        triggerScrubTextured(velocity);
        break;
      case 'velvety':
        triggerScrubVelvety(velocity);
        break;
      case 'smooth':
      default:
        triggerScrubSmooth(velocity);
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
    if (vel > 0.12) triggerScrub(vel);

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
  });

  // ── Sound variant selector ─────────────────────────────────────────────────
  const variantContainer = document.getElementById('sound-variants') as HTMLDivElement | null;
  if (variantContainer) {
    variantContainer.innerHTML = '';
    const variants: Array<'smooth' | 'silky' | 'crisp' | 'gritty' | 'textured' | 'velvety'> = [
      'smooth',
      'silky',
      'crisp',
      'gritty',
      'textured',
      'velvety',
    ];

    variants.forEach((variant) => {
      const btn = document.createElement('button');
      btn.textContent = variant.charAt(0).toUpperCase() + variant.slice(1);
      btn.classList.add('variant-btn');
      if (variant === state.variant) btn.classList.add('active');

      btn.addEventListener('click', (): void => {
        state.variant = variant;
        document.querySelectorAll('.variant-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });

      variantContainer.appendChild(btn);
    });
  }
}