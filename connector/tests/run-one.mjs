// 1件だけ診断し、回答をそのまま表示する。画像と再診断にも対応する。
// 使い方:
//   node tests/run-one.mjs --text "本文"
//   node tests/run-one.mjs --image path/to/screenshot.png
//   node tests/run-one.mjs --image path/to/screenshot.png --answer "SMS で届きました"
// --answer を付けると、最初の診断の会話の続きで答えを送り、再診断を表示する。
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { diagnosisText } from "./diagnosis.mjs";

const SERVER = "bwc";
const URL_MCP = process.env.BWC_MCP_URL ?? "https://bwc-probe.taka-bwc-japan-2026.workers.dev/mcp";
const TOOLS = ["get_judgment_protocol", "score_observations"].map((t) => `mcp__${SERVER}__${t}`);

const { values } = parseArgs({
  options: { text: { type: "string" }, image: { type: "string" }, answer: { type: "string" } },
});
if (!values.text && !values.image) {
  console.error("--text か --image を指定してください");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "bwc-one-"));
const config = join(work, "mcp.json");
writeFileSync(config, JSON.stringify({ mcpServers: { [SERVER]: { type: "http", url: URL_MCP } } }));
const systemPromptFile = join(work, "system.txt");
writeFileSync(
  systemPromptFile,
  `あなたは Claude です。利用者が共有したものに対し、最初に必ず ${TOOLS[0]} を呼び、返された作法に従って日本語で回答してください。`,
);

// CLAUDE.md の口調などを混ぜず、通常のターミナルと同じログインを使う。
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CLAUDE|ANTHROPIC_BASE_URL)/.test(key))),
  CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
  ENABLE_TOOL_SEARCH: "false",
  MCP_TIMEOUT: "30000",
};

function run(prompt, sessionId) {
  const allowed = [...TOOLS, "WebSearch", "WebFetch", "Read"];
  const args = [
    "-p",
    "--model", "sonnet",
    "--output-format", "stream-json",
    "--verbose",
    "--setting-sources", "project",
    "--system-prompt-file", `"${systemPromptFile}"`,
    "--strict-mcp-config",
    "--mcp-config", `"${config}"`,
    "--allowedTools", `"${allowed.join(",")}"`,
  ];
  if (values.image) args.push("--add-dir", `"${resolve(values.image, "..")}"`);
  if (sessionId) args.push("--resume", sessionId);
  return new Promise((done) => {
    const child = spawn("claude", args, { cwd: work, shell: true, env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", () => {
      const result = { connected: false, tools: [], scores: [], diagnosis: "", answer: "", sessionId: null };
      for (const line of out.split(/\r?\n/)) {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        for (const block of event.message?.content ?? []) {
          if (block.type === "tool_use") {
            result.tools.push(block.name);
            if (block.name.endsWith("score_observations")) result.scores.push(block.input);
          }
          if (block.type === "tool_result") result.diagnosis = diagnosisText(block) || result.diagnosis;
        }
        if (event.type === "system" && event.subtype === "init") {
          result.connected = (event.mcp_servers ?? []).some((m) => m.name === SERVER && m.status === "connected");
        }
        if (event.type === "result") {
          result.answer = event.result ?? "";
          result.sessionId = event.session_id ?? null;
        }
      }
      if (result.tools.some((t) => t.startsWith(`mcp__${SERVER}__`))) result.connected = true;
      done(result);
    });
    child.stdin.end(prompt);
  });
}

// テスト環境ではコネクターの読み込みがときどき失敗するため、未接続ならやり直す。
async function runConnected(prompt, sessionId) {
  let r;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await run(prompt, sessionId);
    if (r.connected) break;
  }
  return r;
}

function show(title, r) {
  console.log(`===== ${title} =====`);
  console.log(`コネクター: ${r.connected ? "接続" : "未接続"}`);
  console.log(`呼び出した道具: ${r.tools.join(", ") || "なし"}`);
  for (const s of r.scores) {
    const items = Object.entries(s.checklist ?? {});
    const hits = items.filter(([, c]) => c === true).map(([id]) => id);
    console.log(`確認表: ${items.length} 項目に回答、当てはまり ${hits.join(", ") || "なし"}`);
  }
  if (r.diagnosis) console.log(`\n--- カードの診断 ---\n${r.diagnosis}`);
  console.log("\n--- Claude の回答 ---");
  console.log(r.answer);
  console.log("");
}

const first = await runConnected(
  values.image ? `この画像を共有します: ${resolve(values.image)}` : values.text,
);
show("診断", first);

if (values.answer && first.sessionId) {
  const second = await runConnected(values.answer, first.sessionId);
  show(`再診断（答え: ${values.answer}）`, second);
}
