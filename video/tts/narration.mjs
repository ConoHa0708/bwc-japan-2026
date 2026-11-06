// 台本の各行を AivisSpeech で読み上げ、動画の秒数に置いて 1 本のナレーション音声にする。
// 使い方: node narration.mjs <outDir>
// 声: 阿井田 茂 Calm (ACML 1.0) を半音下げ（声質はそのまま）。
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "out");
const API = "http://127.0.0.1:10101";
const STYLE = 1310138977; // 阿井田 茂 Calm
const SPEED = 1.2;
const INTONATION = 0.3;
const PITCH = 0.944; // half a step down
const TOTAL = 179;
const BIN = process.env.FFBIN ?? "";
const ffmpeg = join(BIN, "ffmpeg");
const ffprobe = join(BIN, "ffprobe");

const READ = [
  ["詐欺ダメ.com", "サギダメドットコム"],
  ["Claude", "クロード"],
  ["9 万件", "きゅうまんけん"],
  ["LINE", "ライン"],
  ["60 点", "ろくじゅってん"],
  ["100 点", "ひゃくてん"],
  ["59 点", "ごじゅうきゅうてん"],
  ["15 点", "じゅうごてん"],
  ["26 の", "にじゅうろくの"],
  ["URL", "ユーアールエル"],
  ["4つ", "よっつ"],
];
const say = (t) => READ.reduce((s, [a, b]) => s.split(a).join(b), t);

// [start seconds in the final video, text]
const LINES = [
  [1.0, "詐欺ダメ.com で、9 万件以上の詐欺サイトを検知してきました。"],
  [5.0, "偽通販も、サポート詐欺も、ブラウザでは守ってきました。"],
  [8.9, "でも、詐欺の最前線のスマホは、手つかずでした。"],
  [12.3, "そこで作ったのが、フィッシング詐欺検出コネクターです。"],
  [16.1, "4つの手口で、試します。"],
  [18.2, "社長を名乗る、詐欺メールです。"],
  [20.2, "届いたメールを、開いてしまった場合の対応です。"],
  [23.1, "代表になりすまし、LINE グループを作らせる手口です。"],
  [27.4, "本文をコピーして、Claude アプリに貼るだけ。"],
  [31.4, "操作は、これだけです。"],
  [39.4, "判定の作法はコネクターが渡し、Claude アプリが観点に答えます。"],
  [44.9, "決め手は、LINE グループを作らせる手口。60 点で、詐欺の疑いが大きいと判定。"],
  [50.2, "警察を名乗るメールです。"],
  [52.0, "実際に出回っている文面です。"],
  [54.3, "これも、開いてしまった場合です。"],
  [57.4, "今度は、スクショで渡します。"],
  [60.4, "撮ったスクショを、そのまま Claude アプリへ。"],
  [64.2, "口座を凍結すると脅し、安全な口座への振り替えを迫ります。"],
  [69.4, "26 の観点で、点数を付けていきます。", { int: 0.5 }],
  [75.2, "安全な口座への振り込みを求めた時点で、100 点。警察が振り込みを求めることは、ありません。"],
  [81.2, "銀行を名乗るメールです。"],
  [83.0, "スクショと本文、両方で試します。"],
  [86.6, "左はスクショ、右は本文を貼り付けています。"],
  [90.6, "期限を切って、本人確認の手続きを求める文面です。"],
  [99.7, "決め手が見えないので、コネクターは 59 点で止め、差出人を聞いてきます。"],
  [104.4, "根拠がそろうまで、判定を保留します。", { int: 0.4 }],
  [107.9, "差出人の名前を押して、アドレスを確かめます。"],
  [112.0, "そのアドレスを、そのまま答えます。"],
  [115.6, "Claude アプリが、銀行の公式サイトで本物のドメインを確かめます。"],
  [121.9, "銀行の公式ドメインと違うので、100 点になりました。", { int: 0.4 }],
  [126.0, "最後は、家族からの LINE。"],
  [128.0, "リンクは、共有で渡せます。"],
  [130.6, "家族から届いた、買い物のお願いです。"],
  [136.0, "行き先は、本物の商品ページ。15 点で、詐欺の疑いは低いと判定。"],
  [141.3, "本物のリンクは、ちゃんと見分けます。"],
  [144.1, "仕組みです。"],
  [146.0, "Claude アプリは、メッセージを受け取り、"],
  [149.0, "コネクターから、判定の作法と 26 の観点を受け取ります。"],
  [152.9, "読み取り、公式サイトで確かめ、答えるだけ。"],
  [156.2, "採点と判定は、コネクターが行います。リンク先は開きません。", { int: 0.4 }],
  [160.3, "結果は、診断カードに。"],
  [162.9, "課題と、これから。"],
  [164.6, "詐欺の手口は、次々に変わります。"],
  [167.2, "新しい手口には、観点を足して追いかけます。"],
  [170.2, "詐欺ダメ.com ともつなぎ、偽通販サイトにも広げます。"],
  [173.8, "詐欺から守るために。すべての人に、Claude アプリを。"],
];

mkdirSync(outDir, { recursive: true });
// Synthesis differs slightly on every run. A line whose take was approved by ear is locked here and reused as is.
const HERE = fileURLToPath(new URL(".", import.meta.url));
const TAKES = { "操作は、これだけです。": "takes/sousa_koredake.wav" };
const parts = [];
const used = new Set();
for (const [i, [start, text, opt]] of LINES.entries()) {
  const raw = join(outDir, `raw_${String(i).padStart(2, "0")}.wav`);
  const low = join(outDir, `line_${String(i).padStart(2, "0")}.wav`);
  const intn = Math.min(opt?.int ?? INTONATION, INTONATION);
  const key = createHash("sha1").update([STYLE, SPEED, intn, PITCH, say(text)].join("|")).digest("hex").slice(0, 16);
  const cached = TAKES[text] ? join(HERE, TAKES[text]) : join(HERE, "takes", "auto", key + ".wav");
  used.add(cached);
  if (existsSync(cached)) {
    copyFileSync(cached, low);
    const dur0 = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", low]).toString());
    parts.push({ i, start, dur: dur0, file: low, text });
    continue;
  }
  const q = await fetch(`${API}/audio_query?speaker=${STYLE}&text=${encodeURIComponent(say(text))}`, { method: "POST" }).then((r) => r.json());
  q.speedScale = SPEED;
  q.intonationScale = Math.min(opt?.int ?? INTONATION, INTONATION); // lower = steadier, less emotional
  q.prePhonemeLength = 0.02;
  q.postPhonemeLength = 0.05;
  q.outputSamplingRate = 48000;
  const res = await fetch(`${API}/synthesis?speaker=${STYLE}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) throw new Error(`line ${i}: ${res.status} ${await res.text()}`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  mkdirSync(join(HERE, "takes", "auto"), { recursive: true });
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", raw, "-af", `rubberband=pitch=${PITCH}:formant=preserved:pitchq=quality`, "-ar", "48000", "-ac", "1", low]);
  copyFileSync(low, cached);
  const dur = Number(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", low]).toString());
  parts.push({ i, start, dur, file: low, text });
}

// Drop cached takes that no line uses any more.
const autoDir = join(HERE, "takes", "auto");
if (existsSync(autoDir)) for (const f of readdirSync(autoDir)) if (!used.has(join(autoDir, f))) unlinkSync(join(autoDir, f));

// Report lines that run into the next one.
for (let k = 0; k < parts.length; k++) {
  const p = parts[k];
  const next = parts[k + 1]?.start ?? TOTAL;
  const over = p.start + p.dur - next;
  console.log(`${String(p.start).padStart(6)}s  ${p.dur.toFixed(2)}s  ${over > 0 ? "OVER " + over.toFixed(2) + "s" : "ok"}  ${p.text}`);
}
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const header = ["# ナレーション 秒ごとの台本（自動生成）", "", "| 開始 | 終了 | 長さ | ナレーション |", "|---|---|---|---|"];
const rows = parts.map((p) => `| ${fmt(p.start)} | ${fmt(p.start + p.dur)} | ${p.dur.toFixed(1)}秒 | ${p.text} |`);
writeFileSync(join(outDir, "..", "..", "narration_timeline.md"), [...header, ...rows, ""].join("\n"));
writeFileSync(join(outDir, "timing.json"), JSON.stringify(parts.map(({ i, start, dur, text }) => ({ i, start, dur, text })), null, 2));

// Mix: each line delayed to its start time.
const inputs = parts.flatMap((p) => ["-i", p.file]);
const chains = parts.map((p, k) => `[${k}:a]adelay=${Math.round(p.start * 1000)}|${Math.round(p.start * 1000)}[a${k}]`).join(";");
const mix = parts.map((_, k) => `[a${k}]`).join("") + `amix=inputs=${parts.length}:normalize=0,apad=whole_dur=${TOTAL},atrim=0:${TOTAL}[out]`;
execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${chains};${mix}`, "-map", "[out]", "-ar", "48000", "-ac", "2", join(outDir, "narration.wav")]);
console.log("wrote", join(outDir, "narration.wav"));
