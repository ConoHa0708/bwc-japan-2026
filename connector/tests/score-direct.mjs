// 採点の道具を直接呼び、配点と判定の決まりを確かめる（Claude を介さない）。
// 使い方: node tests/score-direct.mjs（手元の wrangler dev で試すときは BWC_MCP_URL=http://localhost:8788/mcp）
const URL_MCP = process.env.BWC_MCP_URL ?? "https://bwc-probe.taka-bwc-japan-2026.workers.dev/mcp";

const ALL = [
  "org_claim", "login_mismatch_verified", "domain_differs_from_main", "org_in_subdomain", "short_url", "destination_unknown",
  "input_credentials", "input_card_or_account", "input_id_document", "authority_money_request", "money_transfer_request",
  "sender_mismatch_verified", "financial_credential_request", "tax_or_delivery_sms_link", "offstore_app",
  "app_install_request", "lure_to_login", "lure_to_other_contact", "group_invite_request", "unusual_characters", "brand_misspelling",
  "unnatural_japanese", "urgency",
  "sms_foreign_mobile", "sms_domestic_mobile", "dmarc_fail",
];

const LEADS = [
  ["黒", "フィッシング詐欺の疑い大"],
  ["グレー", "詐欺となる根拠が"],
  ["白", "現時点で詐欺と判断できる内容は"],
];

const CASES = [
  {
    name: "弱い観点だけ（誘導、行き先不明、期限、名乗り）",
    expect: "グレー",
    hits: ["org_claim", "lure_to_login", "destination_unknown", "urgency"],
    evidence: [],
  },
  {
    name: "ログイン先の不一致と代表ドメインの重複",
    expect: "黒",
    hits: ["org_claim", "login_mismatch_verified", "domain_differs_from_main", "input_credentials"],
    evidence: [{ id: "login_mismatch_verified", text: "公式 https://www.example.com/ で確認" }],
  },
  {
    name: "公式 URL のない差出人の不一致",
    expect: "グレー",
    hits: ["org_claim", "sender_mismatch_verified", "lure_to_login"],
    evidence: [{ id: "sender_mismatch_verified", text: "公式と異なる" }],
  },
  {
    name: "英数字だけの似せた綴り（rn → m）",
    expect: "黒",
    hits: ["org_claim", "input_credentials"],
    evidence: [],
    targets: ["https://www.exarnple.com/login"],
    official_domains: ["example.com"],
    lookalike: true,
  },
  {
    name: "公式と同じ綴りで TLD だけ違う（似せ文字ではない）",
    expect: "白",
    hits: ["org_claim"],
    evidence: [],
    targets: ["https://www.example.net/"],
    official_domains: ["example.com"],
    lookalike: false,
  },
  {
    name: "日本語だけのドメイン（似せ文字ではない）",
    expect: "白",
    hits: ["org_claim"],
    evidence: [],
    targets: ["https://例え.jp/"],
    lookalike: false,
  },
  {
    name: "英字にキリル文字が混ざるドメイン",
    expect: "黒",
    hits: ["org_claim", "input_credentials"],
    evidence: [],
    targets: ["https://exаmple.com/"],
    lookalike: true,
  },
];

for (const c of CASES) {
  const checklist = Object.fromEntries(ALL.map((id) => [id, c.hits.includes(id)]));
  const response = await fetch(URL_MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "score_observations",
        arguments: { checklist, evidence: c.evidence, targets: c.targets, official_domains: c.official_domains },
      },
    }),
  });
  const body = await response.text();
  const json = JSON.parse(body.split("\n").find((l) => l.startsWith("data: ")).slice(6));
  const text = json.result?.structuredContent?.text ?? JSON.stringify(json.result ?? json.error);
  const lines = text.split("\n").filter((l) => /^【スコア|^【判断|^・(\+|合計)/.test(l));
  // カードには区分を出さないため、判定文から区分を読み取る。
  const verdict = LEADS.find(([, lead]) => text.includes(`【判断】${lead}`))?.[0];
  const lookalikeOk = c.lookalike === undefined || text.includes("見た目の似た別の文字") === c.lookalike;
  console.log(`${verdict === c.expect && lookalikeOk ? "OK" : "NG"} ${c.name}（期待: ${c.expect}）`);
  for (const l of lines) console.log(`   ${l}`);
}
