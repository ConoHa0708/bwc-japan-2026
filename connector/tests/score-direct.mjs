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
  ["白", "URL からは詐欺と判断できる点は見つかりませんでした"],
  ["保留", "メールの画面の URL は"],
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
  // 以下は URL だけを共有されたとき（shared_url）。note はカードに出るはずの文の一部。
  {
    name: "Web メールの画面の URL",
    expect: "保留",
    hits: [],
    evidence: [],
    shared_url: "https://mail.google.com/mail/u/0/#inbox/FMfcgzQXJWDsKmPqRtVbNcLx",
    note: "原文（ソース）を共有してください",
  },
  {
    name: "誰でも作れるフォームの URL",
    expect: "白",
    hits: [],
    evidence: [],
    shared_url: "https://docs.google.com/forms/d/e/1FAIpQLSf-sample/viewform",
    note: "誰でもページやフォームを作って公開できるサービスです",
  },
  {
    name: "転送用の URL の中の行き先を調べる",
    expect: "グレー",
    hits: ["org_claim", "domain_differs_from_main"],
    evidence: [],
    shared_url: "https://www.google.com/url?q=https://login.sample-bank-verify.example/&sa=D",
    note: "転送用の URL でした",
  },
  {
    name: "確かめた公式ドメインの URL",
    expect: "白",
    hits: ["org_claim"],
    evidence: [],
    shared_url: "https://www.example.com/account",
    official_domains: ["example.com"],
    note: "確認した公式ドメイン example.com の URL です",
  },
  {
    name: "@ の前に別のドメインに見える文字列を置いた URL",
    expect: "黒",
    hits: ["org_claim", "lure_to_login"],
    evidence: [],
    targets: ["https://www.example.com%2Flogin@sample-login.example/"],
    note: "@ の前に、別のドメインに見える文字列",
  },
  {
    name: "メールアドレスは @ の前のおとりとして数えない",
    expect: "白",
    hits: [],
    evidence: [],
    targets: ["first.last@example.com"],
    noteAbsent: "@ の前に、別のドメインに見える文字列",
  },
  {
    name: "確認表の観点を入れ忘れても採点する（入れ忘れは false）",
    expect: "グレー",
    hits: ["org_claim", "lure_to_login", "destination_unknown", "urgency"],
    omit: ["input_credentials", "dmarc_fail"],
    evidence: [],
  },
  {
    name: "組織を名乗るメールの差出人が無料のメールサービス",
    expect: "黒",
    hits: ["org_claim", "lure_to_login", "destination_unknown", "urgency", "input_id_document"],
    evidence: [],
    sender_address: "sample.user@gmail.com",
    note: "誰でも作れるメールのアドレス",
  },
  {
    name: "組織を名乗らない無料のメールサービスの差出人",
    expect: "白",
    hits: [],
    evidence: [],
    sender_address: "サンプル <sample.user@gmail.com>",
    noteAbsent: "誰でも作れるメールのアドレス",
  },
  {
    name: "公式ページで確かめた差出人の不一致と重ねない",
    expect: "グレー",
    hits: ["org_claim", "sender_mismatch_verified"],
    evidence: [{ id: "sender_mismatch_verified", text: "公式 https://www.example.com/ で確認" }],
    sender_address: "sample.user@gmail.com",
    noteAbsent: "誰でも作れるメールのアドレス",
  },
  {
    name: "メールサービスの会社自身のドメイン",
    expect: "白",
    hits: ["org_claim"],
    evidence: [],
    official_domains: ["gmail.com"],
    sender_address: "sample.user@gmail.com",
    noteAbsent: "誰でも作れるメールのアドレス",
  },
  {
    name: "メールサービスのサブドメインからの送信",
    expect: "白",
    hits: ["org_claim"],
    evidence: [],
    sender_address: "notice@mail.yahoo.co.jp",
    noteAbsent: "誰でも作れるメールのアドレス",
  },
];

for (const c of CASES) {
  const checklist = Object.fromEntries(ALL.filter((id) => !c.omit?.includes(id)).map((id) => [id, c.hits.includes(id)]));
  const response = await fetch(URL_MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "score_observations",
        arguments: { checklist, evidence: c.evidence, targets: c.targets, official_domains: c.official_domains, shared_url: c.shared_url, sender_address: c.sender_address },
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
  const noteOk = (c.note === undefined || text.includes(c.note)) && (c.noteAbsent === undefined || !text.includes(c.noteAbsent));
  console.log(`${verdict === c.expect && lookalikeOk && noteOk ? "OK" : "NG"} ${c.name}（期待: ${c.expect}）`);
  for (const l of lines) console.log(`   ${l}`);
}
