// index.html을 프레임 단위로 캡처해 MP4로 인코딩한다.
//   node render.mjs                      전체 렌더 → out/exc-kinetic.mp4
//   node render.mjs --stills 3,15.5,82   지정 시각(초)의 PNG 스틸 → out/stills/
//   node render.mjs --from 20 --to 30    구간만 렌더(미리보기용, 오디오 제외)
// 환경 변수: CHROME_PATH(브라우저 실행 파일), WORKERS(동시 페이지 수, 기본 3)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i < 0 ? null : args[i + 1]; };
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render=1`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--font-render-hinting=none'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const meta = await page.evaluate(() => window.__meta);
  if (!meta.font) throw new Error('Pretendard 폰트를 불러오지 못했습니다. npm install 후 다시 실행하세요.');
  return { page, meta };
}
const logoNote = meta => console.log(meta.logo ? `엔딩 로고: ${meta.logo}` : '엔딩 로고 파일 없음(brand/) → 태그라인으로 렌더');
const grab = (page, t) => page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, t)
  .then(u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));

const stills = opt('stills');
if (stills) {
  const { page, meta } = await openPage();
  logoNote(meta);
  const dir = path.join(OUT, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    const f = path.join(dir, `t${s.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, await grab(page, s));
    console.log(f);
  }
} else {
  const workers = Number(process.env.WORKERS || 3);
  const pages = await Promise.all(Array.from({ length: workers }, openPage));
  const { FPS, DUR } = pages[0].meta;
  logoNote(pages[0].meta);
  const from = Number(opt('from') ?? 0), to = Number(opt('to') ?? DUR);
  const first = Math.round(from * FPS), last = Math.round(to * FPS);
  const full = from === 0 && to === DUR;
  const outFile = path.join(OUT, full ? 'exc-kinetic.mp4' : `preview_${from}-${to}.mp4`);
  const wav = path.join(ROOT, 'bgm.wav');
  const audio = full && fs.existsSync(wav);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(audio ? ['-i', wav] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    ...(audio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));

  // 여러 페이지에서 병렬로 그리고, 프레임 순서대로 ffmpeg에 넘긴다.
  const done = new Map();
  let next = first, write = first;
  const started = Date.now();
  const flush = async () => {
    while (done.has(write)) {
      const buf = done.get(write); done.delete(write);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      write++;
      if ((write - first) % 150 === 0) {
        const el = (Date.now() - started) / 1000, n = write - first, tot = last - first;
        console.log(`${n}/${tot} frames  ${el.toFixed(0)}s elapsed  ~${(el / n * (tot - n)).toFixed(0)}s left`);
      }
    }
  };
  let flushing = Promise.resolve();
  await Promise.all(pages.map(async ({ page }) => {
    while (true) {
      while (next - write > workers * 6) await new Promise(r => setTimeout(r, 5));
      const f = next++;
      if (f >= last) return;
      done.set(f, await grab(page, f / FPS));
      flushing = flushing.then(flush);
    }
  }));
  await flushing;
  ff.stdin.end();
  await ffDone;
  console.log(`완료: ${outFile} (${last - first} frames, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
}
await browser.close();
server.close();
