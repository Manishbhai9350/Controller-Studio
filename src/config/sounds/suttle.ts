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
  ctx:      AudioContext | null;
  isOn:     boolean;
  lastX:    number;
  lastY:    number;
  lastTime: number;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function initSound(): void {
  const state: SoundState = {
    ctx:      null,
    isOn:     false,
    lastX:    0,
    lastY:    0,
    lastTime: 0,
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

  function triggerScrub(velocity: number): void {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;

    // Long, soft duration — doesn't snap on or off
    // Slow mouse = ~120ms, fast mouse = ~180ms
    const duration = 0.12 + velocity * 0.06;

    // ── Noise buffer ─────────────────────────────────────────────────────
    // Slightly longer than duration for a clean fade-out tail
    const bufLen = Math.ceil(ctx.sampleRate * (duration + 0.05));
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);

    // Approximate pink noise by averaging neighbouring white noise samples
    // Pink noise has more energy in low frequencies — inherently softer/warmer
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11; // scale down
    }

    const src: AudioBufferSourceNode = ctx.createBufferSource();
    src.buffer = buf;

    // ── Single warm bandpass — the whole sound lives here ────────────────
    // Wide Q (0.7) = very diffuse, not focused at all
    // Centre ~250 Hz = warm, papery, not scratchy
    const bp: BiquadFilterNode = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 220 + velocity * 60; // 220–280 Hz, barely shifts
    bp.Q.value = 0.7;                          // very wide — just a warm colour

    // Soft lowpass on top — rolls off anything above 800 Hz completely
    const lp: BiquadFilterNode = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.4; // gentle slope

    // ── Gain envelope — slow swell, long soft fade ────────────────────────
    // No snap, no click — just a whisper that appears and dissolves
    const vol = Math.min(velocity * 0.09, 0.07); // very quiet ceiling

    const gain: GainNode = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.035);         // 35ms soft swell
    gain.gain.setValueAtTime(vol, now + duration * 0.5);         // hold midpoint
    gain.gain.linearRampToValueAtTime(0, now + duration);        // linear fade out — softer than exponential

    src.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.02);
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
}