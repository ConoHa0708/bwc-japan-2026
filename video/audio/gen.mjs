// BGM and sound effects, generated from code (no samples, no third-party audio).
// 使い方: node gen.mjs <outDir>   -> bgm.wav, sfx.wav (48 kHz, stereo, 179 s)
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? ".");
mkdirSync(outDir, { recursive: true });
const SR = 48000;
const TOTAL = 179;
const N = SR * TOTAL;

// ---------- helpers ----------
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function wav(path, L, R) {
  const buf = Buffer.alloc(44 + L.length * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + L.length * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(L.length * 4, 40);
  for (let i = 0; i < L.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
}
const add = (L, R, i, v, pan = 0) => {
  if (i < 0 || i >= L.length) return;
  L[i] += v * (1 - Math.max(0, pan));
  R[i] += v * (1 + Math.min(0, pan));
};

// ---------- music ----------
const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
// A minor: Am - F - C - G (root midi, chord tones)
const CHORDS = [
  [45, [57, 60, 64, 69]],
  [41, [57, 60, 65, 69]],
  [48, [55, 60, 64, 67]],
  [43, [55, 59, 62, 67]],
];
// Section energy over time (0..1 for each layer).
function energy(t) {
  const intro = t < 17.8, demo = t >= 17.8 && t < 144, arch = t >= 144 && t < 173.5, end = t >= 173.5;
  return {
    pad: end ? clamp01(1 - (t - 173.5) / 5.5) * 1.0 : 1,
    bass: intro ? 1 : demo ? 0.75 : arch ? 0.85 : 0,
    arp: intro ? 0.8 : demo ? 0.55 : arch ? 0.7 : 0,
    kick: intro ? (t > 2.0 ? 1 : 0) : demo ? 0.5 : arch ? (t > 146 ? 0.7 : 0.3) : 0,
    hat: intro ? 0.8 : demo ? 0.5 : arch ? 0.6 : 0,
  };
}

const ML = new Float32Array(N), MR = new Float32Array(N);

// Pad: soft additive tones, crossfaded per bar.
for (let bar = 0; bar * BAR < TOTAL; bar++) {
  const [, notes] = CHORDS[bar % 4];
  const t0 = bar * BAR;
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t0 + BAR + 0.6) * SR));
  for (const [k, n] of notes.entries()) {
    const f = hz(n - 12);
    const det = [0.997, 1.003];
    const pan = (k - 1.5) * 0.25;
    for (let i = s0; i < s1; i++) {
      const t = i / SR, lt = t - t0;
      const env = clamp01(lt / 0.8) * clamp01((BAR + 0.6 - lt) / 0.8);
      let v = 0;
      for (const d of det) for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * f * d * h * t) / Math.pow(h, 1.8);
      add(ML, MR, i, v * env * 0.018 * energy(t).pad, pan);
    }
  }
}

// Bass: root on beats 1 and 3.
for (let beat = 0; beat * BEAT < TOTAL; beat++) {
  if (beat % 2) continue;
  const bar = Math.floor(beat / 4);
  const f = hz(CHORDS[bar % 4][0]);
  const t0 = beat * BEAT;
  const s0 = Math.floor(t0 * SR), len = Math.floor(BEAT * 1.9 * SR);
  for (let j = 0; j < len && s0 + j < N; j++) {
    const lt = j / SR, t = t0 + lt;
    const env = clamp01(lt / 0.02) * Math.exp(-lt * 1.6);
    const v = Math.sin(2 * Math.PI * f * lt) + 0.25 * Math.sin(4 * Math.PI * f * lt);
    add(ML, MR, s0 + j, v * env * 0.09 * energy(t).bass);
  }
}

// Arpeggio: chord tones on eighth notes, quick decay.
for (let step = 0; step * BEAT / 2 < TOTAL; step++) {
  const t0 = step * BEAT / 2;
  const bar = Math.floor(t0 / BAR);
  const notes = CHORDS[bar % 4][1];
  const n = notes[[0, 2, 1, 3, 2, 1, 3, 2][step % 8]] + 12;
  const f = hz(n);
  const s0 = Math.floor(t0 * SR), len = Math.floor(0.45 * SR);
  const pan = step % 2 ? 0.35 : -0.35;
  for (let j = 0; j < len && s0 + j < N; j++) {
    const lt = j / SR, t = t0 + lt;
    const env = clamp01(lt / 0.004) * Math.exp(-lt * 9);
    const v = Math.sin(2 * Math.PI * f * lt) + 0.15 * Math.sin(6 * Math.PI * f * lt);
    add(ML, MR, s0 + j, v * env * 0.035 * energy(t).arp, pan);
  }
}

// Kick and hat.
let lp = 0;
for (let beat = 0; beat * BEAT < TOTAL; beat++) {
  const t0 = beat * BEAT;
  const s0 = Math.floor(t0 * SR);
  const ek = energy(t0).kick;
  if (ek > 0) {
    let ph = 0;
    for (let j = 0; j < 0.28 * SR && s0 + j < N; j++) {
      const lt = j / SR;
      const f = 45 + 75 * Math.exp(-lt * 30);
      ph += (2 * Math.PI * f) / SR;
      add(ML, MR, s0 + j, Math.sin(ph) * Math.exp(-lt * 11) * 0.22 * ek);
    }
  }
  const th = t0 + BEAT / 2, sh = Math.floor(th * SR), eh = energy(th).hat;
  if (eh > 0) {
    for (let j = 0; j < 0.06 * SR && sh + j < N; j++) {
      const n = rnd();
      lp += 0.25 * (n - lp);
      add(ML, MR, sh + j, (n - lp) * Math.exp(-(j / SR) * 70) * 0.05 * eh, 0.2);
    }
  }
}
// Global fade in/out.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = clamp01(t / 0.8) * clamp01((TOTAL - t) / 0.8);
  ML[i] *= g; MR[i] *= g;
}
wav(join(outDir, "bgm.wav"), ML, MR);

// ---------- sound effects ----------
const SL = new Float32Array(N), SRr = new Float32Array(N);
function whoosh(t, dur = 0.4, amp = 0.16) {
  const s0 = Math.floor(t * SR);
  let a = 0;
  for (let j = 0; j < dur * SR && s0 + j < N; j++) {
    const p = j / (dur * SR);
    const cut = 0.02 + 0.25 * Math.sin(Math.PI * p);
    a += cut * (rnd() - a);
    const env = Math.sin(Math.PI * p) ** 2;
    add(SL, SRr, s0 + j, a * env * amp * 3, -0.6 + 1.2 * p);
  }
}
function pop(t, amp = 0.07, f0 = 1050, f1 = 760) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let j = 0; j < 0.09 * SR && s0 + j < N; j++) {
    const lt = j / SR;
    const f = f1 + (f0 - f1) * Math.exp(-lt * 40);
    ph += (2 * Math.PI * f) / SR;
    add(SL, SRr, s0 + j, Math.sin(ph) * Math.exp(-lt * 38) * amp);
  }
}
function thud(t, amp = 0.28) {
  const s0 = Math.floor(t * SR);
  let ph = 0;
  for (let j = 0; j < 0.35 * SR && s0 + j < N; j++) {
    const lt = j / SR;
    const f = 38 + 70 * Math.exp(-lt * 18);
    ph += (2 * Math.PI * f) / SR;
    add(SL, SRr, s0 + j, (Math.sin(ph) * Math.exp(-lt * 9) + rnd() * Math.exp(-lt * 60) * 0.3) * amp);
  }
}

// Jingle wipes (yellow bands).
for (const t of [15.8, 49.7, 80.7, 125.5, 142.7, 162.8]) whoosh(t, 0.42, 0.11);
// Cards zooming out of the phone.
for (const t of [42.4, 72.9, 99.7, 120.9, 138.7]) whoosh(t, 0.3, 0.05);
// Yellow boxes.
for (const t of [42.9, 44.9, 47.8, 73.4, 75.2, 78.7, 100.2, 103.8, 122.4, 123.7, 139.2, 140.5]) pop(t);
// Opening: past-work boxes, hacker kick, title squash and kick-away.
for (const t of [3.22, 4.17, 5.13]) pop(t, 0.06);
thud(7.65, 0.22);
thud(12.72, 0.3);
whoosh(13.5, 0.5, 0.09);
// Diagram: card, new items, connector tag.
for (const t of [159.0, 164.6, 166.6, 169.5]) pop(t, 0.05, 900, 680);

wav(join(outDir, "sfx.wav"), SL, SRr);
console.log("wrote bgm.wav, sfx.wav to", outDir);
