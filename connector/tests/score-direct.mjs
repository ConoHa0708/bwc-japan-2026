// 採点の道具を直接呼び、配点と判定の決まりを確かめる（Claude を介さない）。
// 使い方: node tests/score-direct.mjs
const URL_MCP = "https://bwc-probe.taka-bwc-japan-2026.workers.dev/mcp";

const ALL = [
  "org_claim", "login_mismatch_verified", "domain_differs_from_main", "org_in_subdomain", "destination_unknown",
  "input_credentials", "input_card_or_account", "input_id_document", "authority_money_request", "money_transfer_request",
  "sender_mismatch_verified", "financial_credential_request", "tax_or_delivery_sms_link", "offstore_app",
  "app_install_request", "lure_to_login", "lure_to_other_contact", "unusual_characters", "urgency",
  "sms_foreign_mobile", "sms_domestic_mobile", "dmarc_fail",
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
      params: { name: "score_observations", arguments: { checklist, evidence: c.evidence } },
    }),
  });
  const body = await response.text();
  const json = JSON.parse(body.split("\n").find((l) => l.startsWith("data: ")).slice(6));
  const text = json.result?.structuredContent?.text ?? JSON.stringify(json.result ?? json.error);
  const lines = text.split("\n").filter((l) => /^【スコア|^【判断|^・(\+|合計)/.test(l));
  const verdict = text.match(/【判断】(黒|グレー|白)/)?.[1];
  console.log(`${verdict === c.expect ? "OK" : "NG"} ${c.name}（期待: ${c.expect}）`);
  for (const l of lines) console.log(`   ${l}`);
}
