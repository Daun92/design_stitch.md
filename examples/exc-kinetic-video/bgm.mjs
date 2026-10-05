// 장면 큐에 맞춘 120 BPM 배경음을 합성해 bgm.wav(44.1kHz, 16bit, 스테레오)로 쓴다.
// 외부 음원 없이 코드로만 만든다. 큐 시각은 index.html의 장면 타이밍과 같다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100, DUR = 88, N = Math.ceil(SR * DUR);
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const D = bus(), M = bus(), X = bus(), S = bus(); // 드럼, 음악(사이드체인), 효과, 리버브 센드
const duck = new Float32Array(N).fill(1);
let seed = 1994;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const idx = t => Math.round(t * SR);
function put(b, i, l, r, send = 0) {
  if (i < 0 || i >= N) return;
  b.L[i] += l; b.R[i] += r;
  if (send) { S.L[i] += l * send; S.R[i] += r * send; }
}
const pan = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// ---------- 악기 ----------
function kick(t, amp = 0.9) {
  const i0 = idx(t); let ph = 0;
  for (let n = 0; n < SR * 0.45; n++) {
    const tt = n / SR, f = 46 + 110 * Math.exp(-tt * 32);
    ph += 2 * Math.PI * f / SR;
    const s = (Math.sin(ph) * Math.exp(-tt * 7.5) + rnd() * 0.25 * Math.exp(-tt * 400)) * amp;
    put(D, i0 + n, s, s);
  }
  for (let n = 0; n < SR * 0.4; n++) { const i = i0 + n; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.55 * Math.exp(-(n / SR) * 9)); }
}
function hat(t, amp = 0.08, open = false, p = 0.25) {
  const i0 = idx(t), [gl, gr] = pan(p); let a = 0, b = 0;
  for (let n = 0; n < SR * (open ? 0.3 : 0.08); n++) {
    const x = rnd(), y = x - a, z = y - b; a = x; b = y;
    const s = z * 0.5 * amp * Math.exp(-(n / SR) * (open ? 16 : 70));
    put(D, i0 + n, s * gl, s * gr);
  }
}
function clap(t, amp = 0.32) {
  const i0 = idx(t); let lp = 0;
  for (let n = 0; n < SR * 0.25; n++) {
    const tt = n / SR;
    const env = (tt < 0.03 ? Math.exp(-((tt * 1000) % 10) * 0.35) : Math.exp(-(tt - 0.03) * 22));
    const x = rnd(); lp += 0.35 * (x - lp);
    const s = (x - lp) * env * amp;
    put(D, i0 + n, s * 0.9, s, 0.25);
  }
}
function tick(t, amp = 0.25, f = 2200, p = 0) {
  const i0 = idx(t), [gl, gr] = pan(p);
  for (let n = 0; n < SR * 0.06; n++) {
    const tt = n / SR;
    const s = (Math.sin(2 * Math.PI * f * tt) + 0.5 * Math.sin(2 * Math.PI * f * 2.7 * tt)) * Math.exp(-tt * 95) * amp;
    put(X, i0 + n, s * gl, s * gr, 0.15);
  }
}
function bass(t, dur, m, amp = 0.3) {
  const i0 = idx(t), f = mtof(m); let ph = 0;
  for (let n = 0; n < SR * (dur + 0.08); n++) {
    const tt = n / SR; ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, tt / 0.008) * (tt > dur ? Math.exp(-(tt - dur) * 40) : 1) * Math.exp(-tt * 2.2);
    const s = (Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)) * env * amp;
    put(M, i0 + n, s, s);
  }
}
function pad(t, dur, notes, amp = 0.06) {
  const i0 = idx(t), rel = 1.4;
  for (const m of notes) {
    const f = mtof(m);
    for (const [ch, det] of [[0, 0.997], [1, 1.003]]) {
      let ph = rnd() * 6;
      const out = ch ? M.R : M.L, send = ch ? S.R : S.L;
      for (let n = 0; n < SR * (dur + rel); n++) {
        const tt = n / SR, i = i0 + n; if (i >= N) break;
        ph += 2 * Math.PI * f * det / SR;
        const env = Math.min(1, tt / 0.9) * (tt > dur ? Math.exp(-(tt - dur) * 3) : 1);
        const s = (Math.sin(ph) + 0.33 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph)) * env * amp;
        out[i] += s; send[i] += s * 0.5;
      }
    }
  }
}
function pluck(t, m, amp = 0.22, p = 0, decay = 5) {
  const i0 = idx(t), f = mtof(m), [gl, gr] = pan(p);
  for (let n = 0; n < SR * 1.2; n++) {
    const tt = n / SR;
    const env = Math.min(1, tt / 0.003) * Math.exp(-tt * decay);
    const s = (Math.sin(2 * Math.PI * f * tt) + 0.45 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt * 9) + 0.15 * Math.sin(6 * Math.PI * f * tt) * Math.exp(-tt * 14)) * env * amp;
    put(X, i0 + n, s * gl, s * gr, 0.35);
  }
}
function bell(t, m, amp = 0.18, p = 0) {
  const i0 = idx(t), f = mtof(m), [gl, gr] = pan(p);
  const parts = [[1, 1, 1.4], [2, 0.45, 2.2], [2.76, 0.3, 3], [5.4, 0.12, 5], [8.93, 0.05, 7]];
  for (let n = 0; n < SR * 3.2; n++) {
    const tt = n / SR; let s = 0;
    for (const [r, a, d] of parts) s += Math.sin(2 * Math.PI * f * r * tt) * a * Math.exp(-tt * d);
    s *= Math.min(1, tt / 0.002) * amp;
    put(X, i0 + n, s * gl, s * gr, 0.5);
  }
}
function riser(t0, t1, amp = 0.2) {
  const i0 = idx(t0), len = idx(t1) - i0; let lpL = 0, lpR = 0, ph = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len, fc = 300 + 9000 * p * p, k = 1 - Math.exp(-2 * Math.PI * fc / SR);
    lpL += k * (rnd() - lpL); lpR += k * (rnd() - lpR);
    ph += 2 * Math.PI * (180 + 700 * p * p) / SR;
    const a = amp * p * p;
    put(X, i0 + n, (lpL + 0.15 * Math.sin(ph)) * a, (lpR + 0.15 * Math.sin(ph)) * a, 0.2);
  }
}
function whoosh(t, dur, amp = 0.2, p0 = -0.6, p1 = 0.6) {
  const i0 = idx(t), len = Math.round(dur * SR); let lp = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len, env = Math.sin(Math.PI * p) ** 2, fc = 400 + 3500 * env;
    lp += (1 - Math.exp(-2 * Math.PI * fc / SR)) * (rnd() - lp);
    const [gl, gr] = pan(lerp(p0, p1, p));
    put(X, i0 + n, lp * env * amp * gl, lp * env * amp * gr, 0.2);
  }
}
function impact(t, amp = 0.7) {
  const i0 = idx(t); let ph = 0, lp = 0;
  for (let n = 0; n < SR * 1.6; n++) {
    const tt = n / SR, f = 32 + 40 * Math.exp(-tt * 6);
    ph += 2 * Math.PI * f / SR;
    lp += 0.2 * (rnd() - lp);
    const s = (Math.sin(ph) * Math.exp(-tt * 2.6) + lp * 1.6 * Math.exp(-tt * 14)) * amp;
    put(X, i0 + n, s, s, 0.3);
  }
}
function zing(t, amp = 0.12) {
  const i0 = idx(t); let ph = 0;
  for (let n = 0; n < SR * 0.45; n++) {
    const tt = n / SR; ph += 2 * Math.PI * (500 + 2600 * Math.min(1, tt / 0.35)) / SR;
    const s = Math.sin(ph) * Math.exp(-tt * 6) * amp;
    put(X, i0 + n, s * 0.8, s, 0.4);
  }
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 화성 ----------
const CH = {
  Am: { b: 33, p: [57, 60, 64] }, F: { b: 29, p: [53, 57, 60] },
  C: { b: 36, p: [55, 60, 64] }, G: { b: 31, p: [55, 59, 62] },
};
// [시작, 끝, 화음]
const PROG = [
  [0.3, 7.5, 'Am'],
  [7.5, 11.5, 'Am'], [11.5, 15.5, 'F'], [15.5, 20.0, 'C'],
  [21.0, 25.0, 'C'], [25.0, 29.0, 'F'],
  [29.0, 33.0, 'Am'], [33.0, 37.0, 'F'], [37.0, 41.0, 'C'], [41.0, 45.0, 'G'], [45.0, 47.0, 'Am'], [47.0, 49.0, 'F'], [49.0, 51.0, 'C'], [51.0, 52.3, 'G'],
  [52.3, 55.0, 'F'], [55.0, 57.0, 'G'], [57.0, 58.8, 'Am'], [58.8, 62.0, 'C'],
  [63.0, 65.0, 'Am'], [65.0, 67.0, 'F'], [67.0, 69.0, 'C'], [69.0, 71.0, 'G'], [71.0, 73.0, 'Am'], [73.0, 76.0, 'F'],
];
const chordAt = t => { for (const [a, b, c] of PROG) if (t >= a && t < b) return CH[c]; return null; };
const PAD_AMP = t => (t < 7.5 ? 0.035 : t < 21 ? 0.03 : t < 29 ? 0.04 : t < 52.3 ? 0.035 : t < 63 ? 0.045 : 0.035);
for (const [a, b, c] of PROG) pad(a, b - a, CH[c].p, PAD_AMP(a));

// 그루브: t0부터 박 단위로 킥·햇·클랩·베이스를 깐다.
function groove(t0, t1, o = {}) {
  const { kickEvery = 1, clapOn = true, hats = '8', bassOn = true, kAmp = 0.85, bAmp = 0.26 } = o;
  for (let b = 0, t = t0; t < t1 - 1e-6; b++, t = t0 + b * 0.5) {
    if (b % kickEvery === 0) kick(t, kAmp);
    if (clapOn && b % 4 % 2 === 1) clap(t);
    if (hats === '8' || hats === '16') hat(t + 0.25, 0.075);
    if (hats === '16') { hat(t + 0.125, 0.04, false, -0.3); hat(t + 0.375, 0.04, false, -0.3); }
    const ch = chordAt(t);
    if (bassOn && ch) { bass(t, 0.2, ch.b + 12, bAmp); bass(t + 0.25, 0.14, ch.b + 24, bAmp * 0.45); }
  }
}

// ---------- 큐 시트 ----------
// S0 진자 (0–7.5)
tick(1.0, 0.12, 2000, 0.3);
for (const s of [2, 3, 4, 5, 6, 7]) tick(s, 0.22, s % 2 ? 2400 : 1900, s % 2 ? 0.35 : -0.35);
pluck(1.5, 69, 0.2); pluck(3.5, 72, 0.16); pluck(4.5, 76, 0.16);
whoosh(6.7, 0.85, 0.28, 0.4, -0.2);
// S1 혼돈 (7.5–20)
impact(7.5, 0.45);
groove(7.5, 17.5, { hats: '8' });
groove(17.5, 20.0, { hats: '16', kAmp: 0.9 });
whoosh(8.45, 0.5, 0.18, 0.6, -0.6);
pluck(11.5, 64, 0.2, 0, 7); pluck(11.55, 57, 0.18, 0, 7);
impact(14.5, 0.35); impact(15.4, 0.35);
tick(17.5, 0.35, 3200, 0); whoosh(17.5, 0.35, 0.2, 0, 0);
riser(17.3, 20.0, 0.32);
// 20.0–21.0 정적(마스터 게이트)
// S2 정렬 (21–29)
impact(21.0, 0.8); zing(21.0);
whoosh(21.35, 0.9, 0.25, 0, 0);
[72, 74, 76, 79, 81, 84, 86].forEach((m, j) => pluck(22.6 + j * 0.06, m, 0.13, -0.6 + j * 0.2, 6));
groove(23.0, 28.0, { kickEvery: 2, clapOn: false, hats: '8', kAmp: 0.6, bAmp: 0.18 });
impact(25.4, 0.4); bell(25.4, 72, 0.12, -0.2); bell(25.42, 79, 0.08, 0.2);
riser(28.0, 29.0, 0.18);
// S3 고리 (29–52.3)
groove(29.0, 49.0, { hats: '8' });
[30.36, 30.73, 30.91, 31.0].forEach((t, j) => tick(t, 0.28 * (1 - j * 0.2), 1600, 0));
[76, 79, 81, 84, 86, 88].forEach((m, k) => bell(31 + k * 3, m, 0.14, -0.4 + k * 0.16));
groove(49.0, 51.5, { hats: '16', clapOn: true });
bell(49.0, 84, 0.12, -0.3); bell(49.0, 88, 0.1, 0); bell(49.0, 91, 0.08, 0.3);
riser(49.3, 51.5, 0.18);
whoosh(51.4, 0.9, 0.26, -0.4, 0.6);
// S4 모빌 (52.3–63)
groove(53.0, 61.8, { kickEvery: 2, clapOn: false, hats: '8', kAmp: 0.55, bAmp: 0.16 });
[[52.6, 57], [52.9, 53], [53.8, 60], [54.1, 64], [55.0, 62], [55.3, 67], [55.5, 71]].forEach(([t, m], j) => pluck(t, m, 0.2, j % 2 ? 0.4 : -0.4, 3.5));
pluck(55.8, 69, 0.12); pluck(56.6, 72, 0.12);
bell(58.8, 72, 0.13, -0.2); bell(58.8, 76, 0.1, 0.1); bell(58.8, 79, 0.08, 0.3);
whoosh(61.8, 1.1, 0.22, 0, 0);
// S5 증명 (63–74)
whoosh(62.95, 0.6, 0.25, 0.7, -0.5); impact(63.0, 0.5);
groove(63.0, 76.0, { hats: '8' });
for (let t = 63.4; t < 64.6; t += 0.045 + (t - 63.4) * 0.05) tick(t, 0.1, 2800, 0.2);
for (let t = 65.0; t < 66.7; t += 0.05 + (t - 65.0) * 0.04) tick(t, 0.1, 2600, -0.2);
impact(66.7, 0.3);
for (let t = 68.4; t < 69.9; t += 0.03 + Math.pow((t - 68.4) / 1.5, 2) * 0.12) tick(t, 0.1, 3000, 0);
impact(69.85, 0.5); bell(69.85, 84, 0.1);
pluck(71.0, 69, 0.15); pluck(71.8, 72, 0.15); pluck(72.6, 76, 0.15);
riser(73.6, 78.0, 0.38);
// S6 수렴 → 브랜드 (74–88)
impact(78.0, 0.9);
whoosh(78.35, 0.9, 0.18, -0.3, 0.3);
tick(79.6, 0.25, 1700, 0.5);
pad(80.0, 7.5, [48, 55, 64, 71], 0.04);
bass(80.0, 7.0, 36, 0.12);
impact(81.5, 0.75);
[72, 76, 79, 83, 86].forEach((m, j) => bell(81.5 + j * 0.03, m, 0.13 - j * 0.015, -0.4 + j * 0.2));
pluck(83.3, 84, 0.08, 0.3, 3);
bell(84.0, 91, 0.04, 0.4); bell(86.0, 91, 0.035, -0.4);

// ---------- 리버브(Schroeder) ----------
function reverb(inp, off) {
  const out = new Float32Array(N);
  for (const [d, g] of [[1557, 0.84], [1617, 0.83], [1491, 0.85], [1422, 0.84]]) {
    const dl = d + off, buf = new Float32Array(dl); let p = 0, lp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[p]; lp = lp * 0.25 + y * 0.75;
      buf[p] = inp[i] + lp * g; p = (p + 1) % dl; out[i] += y * 0.25;
    }
  }
  for (const d of [225, 556]) {
    const buf = new Float32Array(d + off); let p = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[p], y = -out[i] + b; buf[p] = out[i] + b * 0.5; p = (p + 1) % buf.length; out[i] = y;
    }
  }
  return out;
}
const RL = reverb(S.L, 0), RR = reverb(S.R, 23);

// ---------- 마스터 ----------
const L = new Float32Array(N), R = new Float32Array(N);
const gate = t => {
  if (t >= 19.98 && t < 21.0) return t < 20.0 ? 1 - (t - 19.98) / 0.02 : 0;
  return 1;
};
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, g = gate(t) * Math.min(1, t / 0.05) * (t > 86.5 ? Math.max(0, 1 - (t - 86.5) / 1.5) : 1);
  L[i] = (D.L[i] + M.L[i] * duck[i] + X.L[i] + RL[i] * 0.28) * g;
  R[i] = (D.R[i] + M.R[i] * duck[i] + X.R[i] + RR[i] * 0.28) * g;
  L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bgm.wav');
fs.writeFileSync(out, buf);
console.log(`bgm.wav ${DUR}s, peak ${peak.toFixed(3)} → normalized`);
