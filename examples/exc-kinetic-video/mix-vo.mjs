// vo_sync.json의 배치표대로 내레이션 클립을 영상 타임라인에 놓고, 배경음을 덕킹해 섞는다.
//   node mix-vo.mjs   →  out/vo-track.wav, out/bgm-ducked.wav, out/vo-clips/*.wav, out/mix.wav, out/exc-kinetic-vo.mp4
//   node mix-vo.mjs --accent split  →  같은 믹스를 out/exc-kinetic-split.mp4(C안)에 합쳐 out/exc-kinetic-split-vo.mp4
// 필요: out/exc-kinetic.mp4와 bgm.wav(npm run render), vo/ 안의 블록 테이크(vo_sync.json의 sources)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const ai = process.argv.indexOf('--accent'), SUF = ai < 0 ? '' : `-${process.argv[ai + 1]}`;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vo_sync.json'), 'utf8'));
const M = cfg.mix, SR = M.sample_rate, DUR = 88, N = Math.round(SR * DUR);
const db2g = db => Math.pow(10, db / 20);

function ff(args, input) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}\n${r.stderr.toString().slice(-800)}`);
  return r;
}
function decode(file, ch) {
  const r = ff(['-i', file, '-f', 'f32le', '-ac', String(ch), '-ar', String(SR), 'pipe:1']);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
}
function lufs(samples, ch) {
  const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const err = ff(['-f', 'f32le', '-ar', String(SR), '-ac', String(ch), '-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'], buf).stderr.toString();
  const m = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : NaN;
}
function writeWav(file, chans) {
  const ch = chans.length, n = chans[0].length, buf = Buffer.alloc(44 + n * ch * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * ch * 4, 28); buf.writeUInt16LE(ch * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * ch * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) buf.writeFloatLE(chans[c][i], 44 + (i * ch + c) * 4);
  fs.writeFileSync(file, buf);
}

fs.mkdirSync(path.join(OUT, 'vo-clips'), { recursive: true });

// 1) 소스 블록을 같은 기준 음량으로 맞춘다(블록마다 stability가 달라 음량이 조금씩 다르다).
const src = {};
for (const [key, s] of Object.entries(cfg.sources)) {
  const x = decode(path.join(ROOT, s.file), 1);
  const I = lufs(x, 1);
  src[key] = { x, gain: db2g(M.source_ref_lufs - I), I };
  console.log(`source ${key}: ${s.file}  ${I.toFixed(1)} LUFS → ${M.source_ref_lufs} LUFS`);
}

// 2) 클립을 잘라 발화 시작(in)이 at에 오도록 놓는다.
const vo = new Float32Array(N);
const spans = [];
for (const c of cfg.clips) {
  const s = src[c.src];
  const a = Math.round((c.in - M.preroll) * SR), b = Math.round((c.out + M.tail) * SR);
  const d0 = Math.round((c.at - M.preroll) * SR), len = b - a;
  const fi = Math.round(M.fade_in * SR), fo = Math.round(M.fade_out * SR);
  const clip = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let g = s.gain;
    if (i < fi) g *= i / fi;
    if (i > len - fo) g *= (len - i) / fo;
    clip[i] = (s.x[a + i] || 0) * g;
    if (d0 + i >= 0 && d0 + i < N) vo[d0 + i] += clip[i];
  }
  spans.push({ id: c.id, from: c.at - M.preroll, to: c.at - M.preroll + len / SR });
  writeWav(path.join(OUT, 'vo-clips', `${c.id}_${c.at.toFixed(2)}s.wav`), [clip]);
}
for (let i = 1; i < spans.length; i++) {
  const gap = spans[i].from - spans[i - 1].to;
  if (gap < 0) console.warn(`WARN overlap ${spans[i - 1].id} → ${spans[i].id}: ${gap.toFixed(3)}s`);
}

// 3) 내레이션 전체 음량을 목표로 맞춘다.
const voI = lufs(vo, 1), voG = db2g(M.vo_target_lufs - voI);
for (let i = 0; i < N; i++) vo[i] *= voG;
console.log(`vo track ${voI.toFixed(1)} → ${M.vo_target_lufs} LUFS`);
writeWav(path.join(OUT, 'vo-track.wav'), [vo]);

// 4) 배경음 덕킹 곡선(10ms 프레임, dB 영역에서 어택/릴리스 평활).
const bgm = decode(path.join(ROOT, 'bgm.wav'), 2);
const hop = Math.round(SR * 0.01), F = Math.ceil(N / hop) + 1;
const target = new Float32Array(F);
for (const s of spans) {
  const f0 = Math.floor((s.from - M.duck_lead) * 100), f1 = Math.ceil((s.to + 0.05) * 100);
  for (let f = Math.max(0, f0); f < Math.min(F, f1); f++) target[f] = M.duck_db;
}
for (const e of M.extra_duck) for (let f = Math.floor(e.from * 100); f < Math.ceil(e.to * 100); f++) if (f >= 0 && f < F) target[f] += e.db;
const curve = new Float32Array(F);
const ka = 1 - Math.exp(-0.01 / M.duck_attack), kr = 1 - Math.exp(-0.01 / M.duck_release);
let cur = 0;
for (let f = 0; f < F; f++) { const k = target[f] < cur ? ka : kr; cur += (target[f] - cur) * k; curve[f] = cur; }

const L = new Float32Array(N), R = new Float32Array(N), BL = new Float32Array(N), BR = new Float32Array(N), base = db2g(M.bgm_gain_db);
for (let i = 0; i < N; i++) {
  const fpos = i / hop, f = Math.floor(fpos), t = fpos - f;
  const dB = curve[f] + ((curve[f + 1] ?? curve[f]) - curve[f]) * t;
  const g = base * db2g(dB);
  BL[i] = (bgm[2 * i] || 0) * g; BR[i] = (bgm[2 * i + 1] || 0) * g;
  L[i] = vo[i] + BL[i];
  R[i] = vo[i] + BR[i];
}
writeWav(path.join(OUT, 'bgm-ducked.wav'), [BL, BR]);
const raw = path.join(OUT, 'mix_raw.wav');
writeWav(raw, [L, R]);

// 5) 최종 라우드니스(2패스 loudnorm) → 영상과 합치기
const p1 = ff(['-i', raw, '-af', `loudnorm=I=${M.target_lufs}:TP=${M.true_peak}:LRA=11:print_format=json`, '-f', 'null', '-']).stderr.toString();
const js = JSON.parse(p1.slice(p1.lastIndexOf('{'), p1.lastIndexOf('}') + 1));
const mix = path.join(OUT, 'mix.wav');
ff(['-y', '-i', raw, '-af', `loudnorm=I=${M.target_lufs}:TP=${M.true_peak}:LRA=11:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true:print_format=summary`, '-ar', String(SR), '-c:a', 'pcm_s24le', mix]);
const video = path.join(OUT, `exc-kinetic${SUF}.mp4`), final = path.join(OUT, `exc-kinetic${SUF}-vo.mp4`);
ff(['-y', '-i', video, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
fs.unlinkSync(raw);
console.log(`완료: ${final}`);
