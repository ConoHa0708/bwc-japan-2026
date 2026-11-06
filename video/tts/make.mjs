// AivisSpeech Engine (VOICEVOX-compatible API on port 10101) で、台本の行を読み上げて 1 本の wav にする。
// 使い方: node make.mjs <styleId> <out.wav> [speed] [intonation]
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";

const [style, outArg, speed = "1.05", intonation = "1.0"] = process.argv.slice(2);
const out = resolve(outArg);
const API = "http://127.0.0.1:10101";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

// 読み間違えやすい言葉は、読み方で書く。
const READ = [
  ["詐欺ダメ.com", "サギダメドットコム"],
  ["Claude", "クロード"],
  ["9 万件", "きゅうまんけん"],
  ["LINE", "ライン"],
];
const say = (t) => READ.reduce((s, [a, b]) => s.split(a).join(b), t);

const LINES = [
  ["詐欺ダメ.com で、9 万件以上の詐欺サイトを検知してきました。", 0.35],
  ["でも、詐欺の最前線のスマホは、手つかずでした。", 0.35],
  ["そこで作ったのが、フィッシング詐欺検出コネクターです。", 0.3],
  ["4つの手口で、試します。", 0.3],
];

const work = join(dirname(out), "parts-" + style);
mkdirSync(work, { recursive: true });
const list = [];
for (const [i, [text, pause]] of LINES.entries()) {
  const q = await fetch(`${API}/audio_query?speaker=${style}&text=${encodeURIComponent(say(text))}`, { method: "POST" }).then((r) => r.json());
  q.speedScale = Number(speed);
  q.intonationScale = Number(intonation);
  q.prePhonemeLength = 0.05;
  q.postPhonemeLength = pause;
  q.outputSamplingRate = 48000;
  const res = await fetch(`${API}/synthesis?speaker=${style}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) throw new Error(`line ${i}: ${res.status} ${await res.text()}`);
  const f = join(work, `${i}.wav`);
  writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  list.push(`file '${f.replace(/\\/g, "/")}'`);
}
writeFileSync(join(work, "list.txt"), list.join("\n"));
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "list.txt"), "-c:a", "pcm_s16le", out]);
console.log("wrote", out);
