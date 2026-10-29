import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/media.mjs';
import { assertProjectOutput } from './lib/project-paths.mjs';
import { GLIDE_LAYERS, GLIDE_CLICK, GLIDE_VOICES } from './lib/sfx-glide-tables.mjs';
import { SAMPLE_PREFIX, cc0Sample } from './lib/cc0-sounds.mjs';

const SR = 48000;




const makeRng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; };


const svf = () => { let lp = 0, bp = 0; return (x, fc, q) => {
  const f = 2 * Math.sin(Math.PI * Math.min(fc, SR * 0.45) / SR);
  const hp = x - lp - q * bp;
  bp += f * hp;
  lp += f * bp;
  return { lp, bp, hp };
}; };

const env = (n, len, attack, decay, curve = 2.2) => {
  const a = Math.max(1, attack * SR);
  if (n < a) return n / a;
  const d = (n - a) / Math.max(1, decay * SR);
  return Math.pow(Math.max(0, 1 - d), curve);
};



// ---- Grid Glide voices: sums of low sinusoidal partials under a piecewise-dB envelope -------------------
// The parameter tables and the layer model are described in lib/sfx-glide-tables.mjs.

const dbGain = (db) => Math.pow(10, db / 20);

// Linear interpolation clamped to the end values (numpy.interp): xs ascending, one value per knot.
const interp = (x, xs, ys) => {
  const last = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[last]) return ys[last];
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
  return (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]) * (x - xs[lo]) + ys[lo];
};

// One layer on a time grid of seconds relative to the reference frame: partials with their own phase, level,
// slow dB trim and gate, multiplied by the shared envelope (exactly zero outside its first and last knot).
const layerSignal = (spec, tau) => {
  const n = tau.length, out = new Float64Array(n);
  const kt = spec.env.map((knot) => knot[0]), kd = spec.env.map((knot) => knot[1]);
  for (const q of spec.parts) {
    const amp = dbGain(q.a), w = 2 * Math.PI * (q.f ?? 0);
    const tc = Math.max(q.tc ?? 0, 1e-3), span = Math.max(q.T ?? 0, 1e-3);
    for (let i = 0; i < n; i++) {
      const t = tau[i], tt = Math.max(t - spec.tau0, 0);
      let arg;
      if (q.kind === 'c') arg = w * t + q.ph;
      else if (q.kind === 'g') arg = 2 * Math.PI * (q.fb * tt + (q.fa - q.fb) * tc * (1 - Math.exp(-tt / tc))) + q.ph;
      else arg = 2 * Math.PI * (tt < span
        ? q.fa * tt + 0.5 * (q.fb - q.fa) * tt * tt / span
        : q.fa * span + 0.5 * (q.fb - q.fa) * span + q.fb * (tt - span)) + q.ph;
      let s = Math.sin(arg) * amp;
      if (q.gate) s *= Math.min(1, Math.max(0, (t - q.gate[0]) / Math.max(q.gate[1], 0.02)));
      if (q.mk) s *= dbGain(interp(t, spec.mk_t, q.mk));
      out[i] += s;
    }
  }
  const first = kt[0], last = kt[kt.length - 1];
  for (let i = 0; i < n; i++) {
    const t = tau[i];
    out[i] *= (t < first || t > last ? 0 : dbGain(interp(t, kt, kd))) * spec.scale;
  }
  return out;
};

// A layered voice: left = mid + side, right = mid - side, with a short fade-in on the hard onset.
// A voice without a side layer is mono and returns a single Float32Array.
const renderGlideVoice = (voice) => {
  const n = Math.round(voice.durS * SR), tau = new Float64Array(n);
  for (let i = 0; i < n; i++) tau[i] = i / SR - voice.refOffsetS;
  const mid = layerSignal(GLIDE_LAYERS[voice.mid], tau);
  const side = voice.side ? layerSignal(GLIDE_LAYERS[voice.side], tau) : new Float64Array(n);
  const fade = Math.round(voice.fadeInMs * 1e-3 * SR);
  if (fade > 0) {
    let start = 0;
    for (let i = 0; i < n; i++) if (Math.abs(mid[i]) + Math.abs(side[i]) > 1e-4) { start = i; break; }
    for (let k = 0; k < fade && start + k < n; k++) { mid[start + k] *= k / fade; side[start + k] *= k / fade; }
  }
  const left = new Float32Array(n), right = new Float32Array(n);
  for (let i = 0; i < n; i++) { left[i] = mid[i] + side[i]; right[i] = mid[i] - side[i]; }
  return voice.side ? { left, right } : left;
};

// The click: damped rings after a silent lead, plus a very short seeded noise tick on the onset.
// makeRng is uniform in [-1, 1) with variance 1/3; scaling by sqrt(3) gives the unit variance the tick was fitted with.
const renderGlideClick = () => {
  const c = GLIDE_CLICK, n = Math.round(c.dur_s * SR), x = new Float64Array(n);
  for (const r of c.rings) {
    for (let i = 0; i < n; i++) {
      const td = i / SR - c.lead_s - r.delay_s;
      if (td < 0) continue;
      x[i] += r.a * Math.sin(2 * Math.PI * r.f * td + r.ph) * Math.exp(-td / r.tau_s) * Math.min(1, td / c.attack_s);
    }
  }
  const rng = makeRng(c.seed), unit = Math.sqrt(3);
  for (let i = 0; i < n; i++) {
    const z = rng() * unit, t = i / SR - c.lead_s;
    if (t >= 0) x[i] += c.noise_gain * z * Math.exp(-t / c.noise_tau_s);
  }
  return Float32Array.from(x);
};

// ---- One-shot voices: soft wind ------------------------------------------------------------------------------------
// airRise is pulled toward the camera and stops abruptly as the next world arrives. airPass is a stereo fly-by that
// peaks a little after its middle. Both are filtered noise under a pink-noise body: seeded, so they never change.
const airVoice = (shape, dur, seed, lo, hi) => {
  const n = Math.round(dur * SR), left = new Float32Array(n), right = new Float32Array(n), rng = makeRng(seed), a = svf(), b = svf(), low = svf();
  let pink = 0, peak = 1e-9;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    pink = 0.97 * pink + 0.03 * rng() * 6;
    let env, fc, pan;
    if (shape === 'rise') {
      env = Math.pow(p, 1.8) * Math.min(1, (n - i) / (0.012 * SR));
      fc = lo * Math.pow(hi / lo, Math.pow(p, 1.4));
      pan = 0.3 * Math.tanh((p - 0.5) * 3);
    } else {
      const q = p < 0.55 ? p / 0.55 : 1 - (p - 0.55) / 0.45;
      env = Math.pow(Math.sin(Math.max(0, q) * Math.PI / 2) ** 2, 1.4);
      fc = (lo + (hi - lo) * Math.sin(Math.max(0, q) * Math.PI / 2) ** 2) * (1 + 0.35 * Math.tanh((0.55 - p) * 6));
      pan = Math.tanh((p - 0.55) * 4) * 0.6;
    }
    const x = (a(rng(), fc, 0.7).bp * 0.8 + b(pink, fc * 0.5, 0.9).bp * 0.5 + low(pink, 140 + 160 * env, 0.6).lp * 0.9) * env;
    const angle = (pan + 1) * Math.PI / 4;
    left[i] = x * Math.cos(angle) * Math.SQRT2; right[i] = x * Math.sin(angle) * Math.SQRT2;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  for (let i = 0; i < n; i++) { left[i] *= 0.9 / peak; right[i] *= 0.9 / peak; }
  return { left, right };
};

// These voices take no options, so each is rendered once and shared. Treat the result as read-only.
const once = (make) => { let value; return () => (value ??= make()); };

const SOUNDS = {

  whoosh: (dur = 0.38, seed = 11, lo = 380, hi = 5200) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const fc = lo + (hi - lo) * Math.sin(p * Math.PI);
      const e = Math.sin(p * Math.PI) ** 1.6;
      out[i] = f(rng(), fc, 0.55).bp * e * 0.9;
    }
    return out;
  },

  whooshSoft: (seed = 23) => {
    const s = SOUNDS.whoosh(0.24, seed, 500, 3400);
    for (let i = 0; i < s.length; i++) s[i] *= 0.42;
    return s;
  },

  impact: (dur = 0.5, f0 = 130, f1 = 44, seed = 31) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const fr = f1 + (f0 - f1) * Math.pow(1 - p, 3);
      ph += (2 * Math.PI * fr) / SR;
      const body = Math.sin(ph) * env(i, n, 0.002, dur * 0.85, 1.9);
      const tick = f(rng(), 2600, 0.9).bp * env(i, n, 0.0005, 0.03, 3);
      out[i] = body * 0.9 + tick * 0.35;
    }
    return out;
  },

  pop: (freq = 760, dur = 0.11, seed = 41) => {
    const n = Math.round(dur * SR), out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      ph += (2 * Math.PI * (freq * (1 + 0.6 * (1 - p)))) / SR;
      out[i] = Math.sin(ph) * env(i, n, 0.001, dur, 3.4) * 0.55;
    }
    return out;
  },

  click: (dur = 0.055, seed = 53, fc = 3200) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) out[i] = f(rng(), fc, 0.7).bp * env(i, n, 0.0003, dur, 4) * 0.85;
    return out;
  },

  riser: (dur = 0.8, seed = 67) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n;
      out[i] = f(rng(), 300 + 4800 * Math.pow(p, 2.2), 0.5).bp * Math.pow(p, 1.5) * 0.6;
    }
    return out;
  },

  swipe: (dur = 0.26, seed = 71) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n;
      out[i] = f(rng(), 1800 - 1200 * p, 0.4).bp * Math.sin(p * Math.PI) ** 1.2 * 0.7;
    }
    return out;
  },

  paper: (dur = 0.3, seed = 83) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const crackle = Math.abs(rng()) > 0.86 ? rng() : rng() * 0.25;
      out[i] = f(crackle, 2400 + 1800 * p, 0.35).hp * Math.sin(p * Math.PI) ** 0.8 * 0.5;
    }
    return out;
  },

  chime: (dur = 0.7, seed = 97) => {
    const n = Math.round(dur * SR), out = new Float32Array(n);
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      a += (2 * Math.PI * 880) / SR;
      b += (2 * Math.PI * 1320) / SR;
      out[i] = (Math.sin(a) * 0.6 + Math.sin(b) * 0.4) * env(i, n, 0.004, dur, 2.6) * 0.4;
    }
    return out;
  },

  tick: (seed = 101) => SOUNDS.click(0.03, seed, 5200),

  keyTap: (dur = 0.045, seed = 131, fc = 3800) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const noise = f(rng(), fc, 0.8).bp * env(i, n, 0.0002, dur * 0.35, 3.2);
      ph += (2 * Math.PI * 210) / SR;
      const body = Math.sin(ph) * env(i, n, 0.0008, dur, 2.8);
      out[i] = noise * 0.7 + body * 0.25;
    }
    return out;
  },

  mouseClick: (dur = 0.06, seed = 149, fc = 4200) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), press = svf(), release = svf();
    const gap = Math.round(0.018 * SR);
    for (let i = 0; i < n; i++) {
      const a = press(rng(), fc, 0.75).bp * env(i, n, 0.0002, 0.012, 3.5);
      const b = i >= gap ? release(rng(), fc * 0.62, 0.8).bp * env(i - gap, n, 0.0002, 0.01, 3.5) * 0.55 : 0;
      out[i] = (a + b) * 0.9;
    }
    return out;
  },

  whooshShort: (dur = 0.2, seed = 163, f0 = 900, f1 = 4200) => {
    const n = Math.round(dur * SR), out = new Float32Array(n), rng = makeRng(seed), f = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const fc = f0 * Math.pow(f1 / f0, p);
      const e = p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) ** 1.4 : (1 - (p - 0.35) / 0.65) ** 2;
      out[i] = f(rng(), fc, 0.6).bp * e * 0.85;
    }
    return out;
  },

  // One-shot voices (stereo).
  airRise: (dur = 0.9, seed = 11, lo = 220, hi = 3200) => airVoice('rise', dur, seed, lo, hi),
  airPass: (dur = 0.9, seed = 21, lo = 260, hi = 2400) => airVoice('pass', dur, seed, lo, hi),

  // Grid Glide voices. subBoom and uiClick are mono; the others return { left, right }.
  subBoom: once(() => renderGlideVoice(GLIDE_VOICES.subBoom)),
  subThump: once(() => renderGlideVoice(GLIDE_VOICES.subThump)),
  subThud: once(() => renderGlideVoice(GLIDE_VOICES.subThud)),
  subSwellHit: once(() => renderGlideVoice(GLIDE_VOICES.subSwellHit)),
  uiClick: once(renderGlideClick),
};

const render = (name, opts = {}) => {
  // `sample:<id>` plays a bundled CC0 recording from Sound-Kits/cc0 (lib/cc0-sounds.mjs); every other name is a synthesized voice.
  if (typeof name === 'string' && name.startsWith(SAMPLE_PREFIX)) return cc0Sample(name.slice(SAMPLE_PREFIX.length));
  switch (name) {
    case 'whoosh': return SOUNDS.whoosh(opts.dur ?? 0.38, opts.seed ?? 11, opts.lo ?? 380, opts.hi ?? 5200);
    case 'whooshSoft': return SOUNDS.whooshSoft(opts.seed ?? 23);
    case 'impact': return SOUNDS.impact(opts.dur ?? 0.5, opts.f0 ?? 130, opts.f1 ?? 44, opts.seed ?? 31);
    case 'pop': return SOUNDS.pop(opts.freq ?? 760, opts.dur ?? 0.11, opts.seed ?? 41);
    case 'click': return SOUNDS.click(opts.dur ?? 0.055, opts.seed ?? 53, opts.fc ?? 3200);
    case 'riser': return SOUNDS.riser(opts.dur ?? 0.8, opts.seed ?? 67);
    case 'swipe': return SOUNDS.swipe(opts.dur ?? 0.26, opts.seed ?? 71);
    case 'paper': return SOUNDS.paper(opts.dur ?? 0.3, opts.seed ?? 83);
    case 'chime': return SOUNDS.chime(opts.dur ?? 0.7, opts.seed ?? 97);
    case 'tick': return SOUNDS.tick(opts.seed ?? 101);
    case 'keyTap': return SOUNDS.keyTap(opts.dur ?? 0.045, opts.seed ?? 131, opts.fc ?? 3800);
    case 'mouseClick': return SOUNDS.mouseClick(opts.dur ?? 0.06, opts.seed ?? 149, opts.fc ?? 4200);
    case 'whooshShort': return SOUNDS.whooshShort(opts.dur ?? 0.2, opts.seed ?? 163, opts.f0 ?? 900, opts.f1 ?? 4200);
    case 'airRise': return SOUNDS.airRise(opts.dur ?? 0.9, opts.seed ?? 11, opts.lo ?? 220, opts.hi ?? 3200);
    case 'airPass': return SOUNDS.airPass(opts.dur ?? 0.9, opts.seed ?? 21, opts.lo ?? 260, opts.hi ?? 2400);
    case 'subBoom': return SOUNDS.subBoom();
    case 'subThump': return SOUNDS.subThump();
    case 'subThud': return SOUNDS.subThud();
    case 'subSwellHit': return SOUNDS.subSwellHit();
    case 'uiClick': return SOUNDS.uiClick();
    default: throw new Error('unknown sound ' + name);
  }
};




export const encodeWav = (L, R) => {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  return buf;
};

const writeWav = async (file, L, R) => { await fs.writeFile(file, encodeWav(L, R)); };




// A voice returns a mono Float32Array or { left, right }; the mixer works on stereo pairs.
export const toStereo = (voice) => (ArrayBuffer.isView(voice) ? { left: voice, right: voice } : voice);

export const mixHits = (hits, dur) => {
  const n = Math.round(dur * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  let placed = 0;
  for (const h of hits) {
    const { left, right } = toStereo(render(h.sound, h.opts ?? {}));
    const start = Math.round(h.t * SR);
    const gain = h.gain ?? 1;

    const pan = h.pan ?? 0;
    const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
    for (let i = 0; i < left.length; i++) {
      const k = start + i;
      if (k < 0 || k >= n) continue;
      L[k] += left[i] * gl;
      R[k] += right[i] * gr;
    }
    placed++;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak > 0.98) { const k = 0.98 / peak; for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k; } }
  return { L, R, placed, peak };
};

export const SAMPLE_RATE = SR;
export const SOUND_IDS = Object.freeze(Object.keys(SOUNDS));

export const renderSound = (name, opts = {}) => render(name, opts);




const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    const a = realpathSync(path.resolve(process.argv[1])), b = realpathSync(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
})();

if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (args.kit) {
    const dir = assertProjectOutput(path.resolve(args.kit));
    await fs.mkdir(dir, { recursive: true });
    for (const name of Object.keys(SOUNDS)) {
      const { left, right } = toStereo(render(name));
      await writeWav(path.join(dir, `${name}.wav`), left, right);
    }
    console.log(JSON.stringify({ ok: true, kit: dir, sounds: Object.keys(SOUNDS) }, null, 2));
    process.exit(0);
  }

  const out = assertProjectOutput(path.resolve(String(args.out)));
  const hits = JSON.parse(await fs.readFile(path.resolve(args.hits), 'utf8'));
  const dur = Number(args.dur);
  const { L, R, placed, peak } = mixHits(hits, dur);
  await writeWav(out, L, R);
  console.log(JSON.stringify({ ok: true, out, hits: placed, durSec: dur, peakBeforeNorm: +peak.toFixed(3) }, null, 2));
}
