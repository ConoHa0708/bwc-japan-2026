// 公開中のコネクターに模擬文面を渡し、呼び出しと判定を一覧にする。
// 使い方: node tests/run-protocol.mjs [1件あたりの回数] [case id ...]
// 道具の呼び出しを強制し、作法の判定と回答の形だけを測る。
// 呼び出されるかどうかは Claude アプリの実機で確かめる。
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { diagnosisText } from "./diagnosis.mjs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = "bwc";
const TOOL = `mcp__${SERVER}__get_judgment_protocol`;
const URL_MCP = "https://bwc-probe.taka-bwc-japan-2026.workers.dev/mcp";
const CONCURRENCY = 3;
const TIMEOUT_MS = 180_000;

const LEADS = [
  ["黒", "フィッシング詐欺の疑い大、入力しないでください"],
  ["グレー", "詐欺となる根拠が"],
  ["白", "現時点で黒と判断できる内容は含まれていませんでした"],
  ["保留", "この URL だけでは判定できません"],
];

// 作法で禁じた推定や助言の表現。見つかった語を一覧に出す。
const BANNED = /たぶん|思われ|はず|可能性|典型|通常|一般的|よくある|実在しない|クリックしない|削除/g;

const here = dirname(fileURLToPath(import.meta.url));
const repeat = Number(process.argv[2] ?? 1);
const only = process.argv.slice(3);
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8")).filter(
  (c) => only.length === 0 || only.includes(c.id),
);

const work = mkdtempSync(join(tmpdir(), "bwc-protocol-"));
const config = join(work, "mcp.json");
writeFileSync(config, JSON.stringify({ mcpServers: { [SERVER]: { type: "http", url: URL_MCP } } }));

// Claude Code の中から実行しても、通常のターミナルと同じログインを使う。
// CLAUDE.md の口調などを混ぜず、道具も最初から読み込ませる。
const cleanEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(CLAUDE|ANTHROPIC_BASE_URL)/.test(key)),
  ),
  CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
  ENABLE_TOOL_SEARCH: "false",
  MCP_TIMEOUT: "30000",
};

const SYSTEM_PROMPT = `あなたは Claude です。利用者の最初のメッセージに対し、最初に必ず ${TOOL} を呼び、返された作法に従って日本語で回答してください。`;
const systemPromptFile = join(work, "system.txt");
writeFileSync(systemPromptFile, SYSTEM_PROMPT);

function runOnceRaw(testCase) {
  return new Promise((resolve) => {
    const args = [
      "-p",
      "--model", "sonnet",
      "--output-format", "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--setting-sources", "project",
      "--system-prompt-file", `"${systemPromptFile}"`,
      "--strict-mcp-config",
      "--mcp-config", `"${config}"`,
      "--allowedTools", `"${TOOL},mcp__${SERVER}__score_observations,mcp__${SERVER}__expand_short_url,WebSearch,WebFetch"`,
    ];
    const child = spawn("claude", args, { cwd: work, shell: true, env: cleanEnv });
    let out = "";
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => {
      clearTimeout(timer);
      resolve(parse(out));
    });
    child.stdin.end(testCase.text);
  });
}

function parse(out) {
  const tools = [];
  let answer = "";
  let connected = false;
  let diagnosis = "";
  for (const line of out.split(/\r?\n/)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use") tools.push(block.name);
      if (block.type === "tool_result") diagnosis = diagnosisText(block) || diagnosis;
    }
    if (event.type === "system" && event.subtype === "init") {
      connected = (event.mcp_servers ?? []).some((m) => m.name === SERVER && m.status === "connected");
    }
    if (event.type === "result") answer = event.result ?? "";
  }
  const shown = diagnosis || answer;
  const verdict = LEADS.find(([, lead]) => shown.includes(lead))?.[0] ?? "その他";
  return {
    connected,
    called: tools.includes(TOOL),
    fetched: tools.includes("WebFetch"),
    versioned: /作法 v[\d.]+ で確認/.test(shown),
    repeated: Boolean(diagnosis) && answer.includes("【スコアリング】"),
    diagnosis,
    verdict,
    chars: answer.length,
    banned: [...new Set(answer.match(BANNED) ?? [])],
    unsupportedMismatch: answer.includes("不一致") && !/https?:\/\/(?![^\s]*\.example)/.test(answer),
    tools,
    answer,
  };
}

// テスト環境ではコネクターの読み込みがときどき失敗するため、未接続ならやり直す。
async function runOnce(testCase) {
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    result = await runOnceRaw(testCase);
    if (result.connected) break;
  }
  return result;
}

const jobs = cases.flatMap((c) => Array.from({ length: repeat }, () => c));
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const testCase = jobs[next++];
    const result = await runOnce(testCase);
    results.push({ id: testCase.id, name: testCase.name, expected: testCase.expected, ...result });
    console.error(`${results.length}/${jobs.length} ${testCase.id}: ${result.verdict}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const rows = cases.map((c) => {
  const runs = results.filter((r) => r.id === c.id);
  const count = (fn) => `${runs.filter(fn).length}/${runs.length}`;
  return [
    c.name,
    c.expected.join("・"),
    count((r) => r.connected),
    runs.map((r) => r.verdict).join(" "),
    count((r) => c.expected.includes(r.verdict)),
    count((r) => r.called),
    count((r) => r.versioned),
    count((r) => r.fetched),
    Math.round(runs.reduce((a, r) => a + r.chars, 0) / runs.length),
    [...new Set(runs.flatMap((r) => r.banned))].join("、") || "-",
    count((r) => r.unsupportedMismatch),
    count((r) => r.repeated),
  ];
});
const header = ["件名", "期待", "接続", "判定", "一致", "呼び出し", "版表示", "取得", "平均文字数", "禁止語", "根拠なし不一致", "文面の重複"];
const table = [header, header.map(() => "---"), ...rows].map((r) => `| ${r.join(" | ")} |`).join("\n");
console.log(table);

const outDir = join(here, "results");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(join(outDir, `${stamp}.json`), JSON.stringify(results, null, 2));
writeFileSync(join(outDir, `${stamp}.md`), `${table}\n`);
