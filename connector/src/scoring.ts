// 観測された観点を加点し、診断結果の文面を組み立てる。
// ここに書いた配点としきい値は公開用の見本。公開中のコネクターは、非公開の設定 SCORING_CONFIG があればそちらで採点する。
import { z } from "zod";
import { NEW_DOMAIN_DAYS, asciiLookalikeOf, checkDomain, nonJapaneseIdnLabels } from "./domain";
import { expandShortUrl } from "./shorturl";
import { classifySharedUrl, unwrapRedirect, userinfoDecoy } from "./urlkind";
import { PROTOCOL_VERSION } from "./protocol";

export const SIGNALS = {
  org_claim: { points: 10, label: "実在の組織を名乗っている", rule: "実在の組織を名乗っている" },
  login_mismatch_verified: { points: 40, label: "公式ページで確認したログイン先とドメインが一致しない", rule: "そのサービスのログイン先を組織の公式ページで確認し、実際のドメインが一致しない。evidence に確認した公式ページの URL を必ず書く。書けないときは false" },
  domain_differs_from_main: { points: 20, label: "組織の代表ドメインと異なるドメインへ誘導している", rule: "組織の代表ドメインと異なるドメインへ誘導している（ログイン先は未確認）" },
  org_in_subdomain: { points: 20, label: "組織名がサブドメインにあり、登録ドメインは別", rule: "組織名がサブドメインにあり、登録ドメインは別" },
  random_subdomain: { points: 20, label: "サブドメインに意味のない文字列や番号がある" },
  new_domain: { points: 20, label: "登録ドメインの登録日が新しい" },
  short_url: { points: 15, label: "短縮 URL が使われている", rule: "短縮 URL が使われている" },
  destination_unknown: { points: 15, label: "リンクやボタンの行き先を取得出来ず", rule: "リンクやボタンの行き先を取得出来ない（メールのボタン、展開できない短縮 URL など）" },
  input_credentials: { points: 20, label: "ID、パスワード、暗証番号の入力を求めている", rule: "ID、パスワード、暗証番号の入力を求めている" },
  input_card_or_account: { points: 20, label: "カード番号や口座情報の入力を求めている", rule: "カード番号や口座情報の入力を求めている" },
  input_id_document: { points: 20, label: "本人確認書類の画像を求めている", rule: "本人確認書類の画像を求めている" },
  authority_money_request: { points: 80, label: "警察や公的機関を名乗り、振込や資金の移動を求めている", rule: "警察、検察、官公庁などを名乗り、振込、送金、資金の移動を求めている" },
  money_transfer_request: { points: 40, label: "振込や送金、指定口座への資金の移動を求めている", rule: "振込、送金、指定口座への資金の移動を求めている" },
  sender_mismatch_verified: { points: 40, label: "差出人のドメインが、公式ページで確認した組織のドメインと一致しない", rule: "差出人アドレスのドメインを、名乗る組織の公式ページで確認したドメインと照合し、一致しない。evidence に確認した公式ページの URL を必ず書く。書けないときは false" },
  financial_credential_request: { points: 50, label: "金融機関を名乗るメールか SMS で、認証情報の入力や返信を求めている", rule: "金融機関を名乗るメールか SMS の本文そのものが、ID、パスワード、暗証番号、カード番号などの入力や返信を明記している。ログインへの誘導だけなら false にする" },
  tax_or_delivery_sms_link: { points: 50, label: "国税庁か配達業者を名乗る SMS にリンクがある", rule: "国税庁か配達業者の名称が見える SMS に、実際のリンクが見える" },
  offstore_app: { points: 60, label: "公式ストア以外からのアプリ導入へ誘導している", rule: "アプリの導入へ誘導するリンクの行き先が App Store や Google Play ではない" },
  app_install_request: { points: 20, label: "アプリの導入を求めている（入手先は不明）", rule: "アプリの導入を求めているが、リンクの行き先が見えない" },
  lure_to_login: { points: 20, label: "本文から確認やログインへ誘導している", rule: "本文から確認やログインへ誘導している" },
  lure_to_other_contact: { points: 20, label: "電話や LINE など別の連絡先へ誘導している", rule: "電話や LINE など別の連絡先へ誘導している" },
  group_invite_request: { points: 60, label: "LINE などのグループ作成や、招待用の QR コードやリンクの送付を求めている", rule: "メールや SMS で、LINE などのグループの作成や、招待用の QR コードやリンクの送付を求めている" },
  unusual_characters: { points: 15, label: "日本で一般的に使わない漢字や字形が混ざっている", rule: "日本で一般的に使わない漢字や字形（簡体字など）が本文に混ざっている。evidence にその文字を含む原文を書く。単なる誤字や変換ミスはfalse にする" },
  brand_misspelling: { points: 20, label: "組織名やロゴの綴りが正式な名前と違う" },
  unnatural_japanese: { points: 15, label: "日本語の語の使い方が不自然" },
  lookalike_domain: { points: 40, label: "URL のドメインに、見た目の似た別の文字が使われている" },
  url_userinfo_decoy: { points: 40, label: "URL の @ の前に、別のドメインに見える文字列を置いている" },
  urgency: { points: 15, label: "急がせる表現がある", rule: "期限、停止、制限など、急いで行動させる表現がある" },
  sms_foreign_mobile: { points: 80, label: "SMS の発信者が海外の携帯番号", rule: "SMS の発信者が海外の携帯番号" },
  sms_domestic_mobile: { points: 10, label: "SMS の発信者が国内の携帯番号", rule: "SMS の発信者が国内の携帯番号" },
  dmarc_fail: { points: 30, label: "メールヘッダーの DMARC が fail", rule: "メールヘッダーの DMARC が fail" },
} as const;

export type SignalId = keyof typeof SIGNALS;
// コネクターが自分で調べて加点する観点。Claude の確認表には含めない。
// short_url は一覧にない短縮サービスもあるため、Claude の確認表にも残し、コネクターの調べと合わせて数える。
const SERVER_SIGNALS = new Set<SignalId>(["random_subdomain", "new_domain", "lookalike_domain", "url_userinfo_decoy"]);
export const SIGNAL_IDS = (Object.keys(SIGNALS) as SignalId[]).filter(
  (id) => !SERVER_SIGNALS.has(id),
) as [SignalId, ...SignalId[]];

const MAX_SCORE = 100;

export type ScoringConfig = { points: Record<SignalId, number>; black_min: number; gray_min: number };

// 公開用の見本。SIGNALS の配点と、黒とグレーのしきい値。
export const SAMPLE_CONFIG: ScoringConfig = {
  points: Object.fromEntries(Object.entries(SIGNALS).map(([id, s]) => [id, s.points])) as Record<SignalId, number>,
  black_min: 60,
  gray_min: 30,
};

const configSchema = z.object({
  points: z.record(z.string(), z.number().int().min(0).max(MAX_SCORE)).optional(),
  black_min: z.number().int().min(1).max(MAX_SCORE),
  gray_min: z.number().int().min(1).max(MAX_SCORE),
});

// 非公開の設定（JSON）を読む。なければ、または読めなければ見本で採点する。書かれていない観点は見本の配点を使う。
export function loadScoringConfig(raw: string | undefined): ScoringConfig {
  if (!raw) return SAMPLE_CONFIG;
  try {
    const parsed = configSchema.parse(JSON.parse(raw));
    if (parsed.gray_min >= parsed.black_min) throw new Error("gray_min must be below black_min");
    const points = { ...SAMPLE_CONFIG.points };
    for (const [id, p] of Object.entries(parsed.points ?? {})) if (id in points) points[id as SignalId] = p;
    return { points, black_min: parsed.black_min, gray_min: parsed.gray_min };
  } catch {
    console.log(JSON.stringify({ scoring_config: "invalid, using sample" }));
    return SAMPLE_CONFIG;
  }
}

const ACTIONS = {
  黒: [
    "リンクやボタンは開かず、何も入力しないでください。",
    "確認は、公式アプリか普段お使いのブックマークから行ってください。",
    "すでに入力した場合は、その会社の窓口へ連絡し、パスワードを変更してください。",
    "お金の被害が出た場合は、警察のサイバー犯罪相談窓口へ相談してください。",
  ],
  グレー: [
    "リンクやボタンは開かず、何も入力しないでください。",
    "確認は、公式アプリか普段お使いのブックマークから行ってください。",
    "【確認したいこと】にお答えいただければ、もう一度診断します。",
  ],
  白: [
    "安全を保証するものではありません。",
    "メールの宛先など追加の情報を共有いただければ、もう一度診断します。",
  ],
} as const;

// URL だけを共有されて、怪しい点が見つからなかったときの対処方法。
const URL_ONLY_WHITE_ACTIONS = [
  "安全を保証するものではありません。",
  "メールや SMS で届いた URL なら、届いたメールの原文（ソース）や画面を共有いただければ、差出人や文面まで確かめて診断します。",
] as const;

// 観点に応じて対処方法に足す文。
const EXTRA_ACTIONS: Partial<Record<SignalId, string>> = {
  authority_money_request: "振り込まないでください。警察が現金の振り込みを求めることはありません（警視庁）。",
  money_transfer_request: "振り込みや送金はしないでください。",
  lure_to_other_contact: "表示された電話番号や連絡先には連絡しないでください。",
  group_invite_request: "グループの作成や、QR コードや招待リンクの送付はしないでください。",
  destination_unknown: "行き先を確かめられないリンクは開かないでください。",
  offstore_app: "アプリは入れないでください。",
  app_install_request: "アプリは入れないでください。",
};

function extraActions(ids: SignalId[]) {
  // 警察を名乗る振込要求があれば、一般の振込の文は重ねない。
  const skip = ids.includes("authority_money_request") ? new Set<SignalId>(["money_transfer_request"]) : new Set<SignalId>();
  return [...new Set(ids.filter((id) => !skip.has(id)).map((id) => EXTRA_ACTIONS[id]).filter((a): a is string => Boolean(a)))];
}

// グレーのときにカードへ出す質問。Claude は作法の候補から id を選ぶだけで、文はここで決める。
export const QUESTIONS = {
  sender_address: "差出人の名前を押すと表示されるメールアドレスを教えてください。",
  recipient: "メールの宛先（To）が、ご自身のメールアドレスかどうかを教えてください。",
  sms_sender: "SMS の送信元に表示されている電話番号か名前を教えてください。",
  address_bar: "画面の上のアドレス（URL）が写るように、もう一度写真を共有してください。",
  screen_rest: "画面の続き（下の部分）も写真で共有してください。",
  route: "このメッセージがどこから届いたか（メール、SMS、LINE など）を教えてください。",
} as const;
export type QuestionId = keyof typeof QUESTIONS;
export const QUESTION_IDS = Object.keys(QUESTIONS) as [QuestionId, ...QuestionId[]];
// 選ばれていないときに聞く質問。
const DEFAULT_QUESTION: QuestionId = "route";

export type Observation = { id: SignalId; evidence: string };
export type Checklist = Partial<Record<SignalId, boolean>>;

// 公式ページで確かめたことが前提の観点。根拠に URL がなければ加点しない。
const NEEDS_OFFICIAL_URL = new Set<SignalId>(["login_mismatch_verified", "sender_mismatch_verified"]);

export function observationsFrom(checklist: Checklist, evidence: { id: string; text: string }[] = []): Observation[] {
  const texts = new Map<string, string>(evidence.map((e) => [e.id, e.text]));
  return SIGNAL_IDS.flatMap((id) => {
    if (!checklist[id]) return [];
    const text = texts.get(id) ?? "";
    if (NEEDS_OFFICIAL_URL.has(id) && !/https?:\/\//.test(text)) return [];
    return [{ id, evidence: text }];
  });
}

// 偽物であることを示す観点。誘導、期限、名乗りなど正規の連絡にもある観点だけでは黒にしない。
const DECISIVE = new Set<SignalId>([
  "login_mismatch_verified",
  "sender_mismatch_verified",
  "domain_differs_from_main",
  "org_in_subdomain",
  "random_subdomain",
  "new_domain",
  "authority_money_request",
  "money_transfer_request",
  "financial_credential_request",
  "tax_or_delivery_sms_link",
  "offstore_app",
  "group_invite_request",
  "sms_foreign_mobile",
  "dmarc_fail",
  "brand_misspelling",
  "unnatural_japanese",
  "lookalike_domain",
  "url_userinfo_decoy",
]);

// 同じ事実を重ねて数えないよう、上位の観点があれば下位の観点を外す。
const SUPERSEDED_BY: Partial<Record<SignalId, SignalId>> = {
  domain_differs_from_main: "login_mismatch_verified",
  lure_to_other_contact: "group_invite_request",
  app_install_request: "offstore_app",
  money_transfer_request: "authority_money_request",
};

// URL だけを共有されたときの扱い。notes は【URL について】に出す事実で、点数には使わない。
export type ScoreOptions = { urlOnly?: boolean; notes?: string[] };

export function score(
  observations: Observation[],
  config: ScoringConfig = SAMPLE_CONFIG,
  question?: QuestionId,
  { urlOnly = false, notes = [] }: ScoreOptions = {},
) {
  const { black_min: BLACK_MIN, gray_min: GRAY_MIN } = config;
  const seen = new Map<SignalId, string>();
  for (const o of observations) if (!seen.has(o.id)) seen.set(o.id, o.evidence.trim().slice(0, 200));
  for (const [id, by] of Object.entries(SUPERSEDED_BY) as [SignalId, SignalId][]) if (seen.has(by)) seen.delete(id);
  const details = [...seen].map(([id, evidence]) => ({ id, ...SIGNALS[id], points: config.points[id], evidence }));
  details.sort((a, b) => b.points - a.points);
  const sum = Math.min(MAX_SCORE, details.reduce((acc, d) => acc + d.points, 0));
  const decisive = details.some((d) => DECISIVE.has(d.id));
  // 偽物の証拠がなければ、合計が高くてもグレーの上限で止める。
  const total = decisive ? sum : Math.min(sum, BLACK_MIN - 1);
  const verdict = total >= BLACK_MIN ? "黒" : total >= GRAY_MIN ? "グレー" : "白";
  const capped = !decisive && sum >= BLACK_MIN;

  const headline =
    verdict === "黒"
      ? "フィッシング詐欺の疑い大、入力しないでください"
      : verdict === "グレー"
        ? details.length >= 2
          ? "詐欺となる根拠が複数確認されています。アクセスはお控えください"
          : "詐欺となる根拠が確認されています。アクセスはお控えください"
        : urlOnly
          ? // ページの中身は見ていないため、URL だけのときは白と言い切らない。
            "URL からは詐欺と判断できる点は見つかりませんでした。ページの中身は確かめていません"
          : "現時点で詐欺と判断できる内容は含まれていませんでした";

  const lines = [
    `【スコアリング】${total}点`,
    "",
    // 黒、グレー、白の区分は決めつけに見えるため、カードには出さず判定文だけを出す。
    `【判断】${headline}`,
    "",
    "【スコアリングの詳細】",
    ...(details.length
      ? details.map((d) => `・+${d.points} ${d.label}${d.evidence ? `：${d.evidence}` : ""}`)
      : ["・加点なし"]),
    ...(capped ? [`・合計は${sum}点ですが、偽物であることを示す根拠が見えないため、${BLACK_MIN - 1}点で止めています`] : []),
    "",
    ...(notes.length ? ["【URL について】", ...notes.map((n) => `・${n}`), ""] : []),
    // 質問は Claude の回答に任せると出たり出なかったりしたため、グレーのときはカードに必ず出す。
    ...(verdict === "グレー" ? ["【確認したいこと】", QUESTIONS[question ?? DEFAULT_QUESTION], ""] : []),
    "【対処方法】",
    ...(verdict === "白" ? [] : extraActions(details.map((d) => d.id)).map((a) => `・${a}`)),
    ...(verdict === "白" && urlOnly ? URL_ONLY_WHITE_ACTIONS : ACTIONS[verdict]).map((a) => `・${a}`),
    "",
    `作法 v${PROTOCOL_VERSION} で確認`,
  ];
  return { total, verdict, ids: details.map((d) => d.id), text: lines.join("\n") };
}

// 見えた URL やホスト名を調べ、ランダムなサブドメインと新しい登録を観点に加えてから採点する。
// 端末で取れた登録日があればそれを使い、なければサーバーから RDAP で調べる。
export type DeviceRegistration = { domain: string; registration: string };

export async function scoreWithDomains(
  observations: Observation[],
  targets: string[],
  device: DeviceRegistration[] = [],
  officials: string[] = [],
  config: ScoringConfig = SAMPLE_CONFIG,
  question?: QuestionId,
  sharedUrl?: string,
) {
  const notes: string[] = [];
  if (sharedUrl) {
    // URL だけを共有されたときは、まずその URL がどんな場所かを見分ける。
    const unwrapped = unwrapRedirect(sharedUrl);
    const kind = classifySharedUrl(unwrapped.url, officials);
    if (kind?.kind === "webmail") return { ...webmailResult(), domains: [], usedDevice: false };
    if (unwrapped.via.length) notes.push(`転送用の URL でした（${unwrapped.via.join(" → ")}）。中に入っていた行き先を、開かずに調べました：${unwrapped.url.slice(0, 200)}`);
    if (kind?.kind === "shared_host") {
      notes.push(`${kind.host} は、誰でもページやフォームを作って公開できるサービスです。ドメインが本物でも、中身は第三者が作れます。パスワードやカード番号は入力しないでください。`);
    }
    if (kind?.kind === "official") notes.push(`${kind.host} は、確認した公式ドメイン ${kind.official} の URL です。安全を保証するものではありません。`);
    if (!targets.includes(sharedUrl)) targets = [sharedUrl, ...targets];
  }
  const extra: Observation[] = [];
  const domains: { registered_domain: string; tld: string }[] = [];
  const fromDevice = new Map(
    device.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.registration)).map((r) => [r.domain.toLowerCase(), r.registration]),
  );
  for (const given of targets.slice(0, 5)) {
    // 転送用の URL は、中に入っている行き先を文字列から取り出して調べる。
    const original = unwrapRedirect(given).url;
    const decoy = userinfoDecoy(original);
    if (decoy) extra.push({ id: "url_userinfo_decoy", evidence: `${decoy.shown}@…（実際の行き先は ${decoy.host}）` });
    // 短縮 URL は短縮サービスにだけ問い合わせて行き先を読む。行き先のサイトは開かない。
    let target = original;
    const expanded = await expandShortUrl(/^https?:\/\//.test(original) ? original : `https://${original}`).catch(() => null);
    if (expanded && expanded.status === "expanded") {
      extra.push({ id: "short_url", evidence: `${original} → ${expanded.final_url}` });
      target = expanded.final_url;
    } else if (expanded && expanded.status === "failed" && expanded.reason !== "invalid_url") {
      // 一覧の短縮サービスだが、最初の問い合わせから行き先を読めなかったときも短縮 URL として数える。
      extra.push({ id: "short_url", evidence: original });
      extra.push({ id: "destination_unknown", evidence: `${original}（短縮 URL の行き先を取得出来ず）` });
      continue;
    }
    let info: Awaited<ReturnType<typeof checkDomain>>;
    try {
      info = await checkDomain(target, { rdap: false });
    } catch {
      continue;
    }
    if (info.registered_domain === "取得出来ず") continue;
    if ("tld" in info && info.tld) domains.push({ registered_domain: info.registered_domain, tld: info.tld });
    if (info.random_subdomain) {
      extra.push({ id: "random_subdomain", evidence: `${info.host}（${info.random_labels.join("、")}）` });
    }
    // 英数字以外の文字（飾りつきのラテン文字など）を使ったドメインは、変換後に xn-- で始まる部分を持つ。
    // 日本語の文字だけのものは数えない。英数字だけの似せ方（rn → m など）は、確かめた公式ドメインと比べる。
    const lookalikeOf = asciiLookalikeOf(info.host, officials);
    if (nonJapaneseIdnLabels(info.host).length > 0) {
      extra.push({ id: "lookalike_domain", evidence: `${original}（実際の表記: ${info.host}）` });
    } else if (lookalikeOf) {
      extra.push({ id: "lookalike_domain", evidence: `${info.registered_domain}（公式の ${lookalikeOf} に似せた綴り）` });
    }
    let registration = fromDevice.get(info.registered_domain.toLowerCase());
    let where = "端末で確認";
    if (!registration) {
      const server = await checkDomain(target).catch(() => null);
      if (server && "age_days" in server) {
        registration = server.registration;
        where = "コネクターで確認";
      }
    }
    if (registration) {
      const ageDays = Math.floor((Date.now() - Date.parse(registration)) / 86_400_000);
      if (ageDays <= NEW_DOMAIN_DAYS) {
        extra.push({ id: "new_domain", evidence: `${info.registered_domain}：${registration} 登録（${ageDays}日前、${where}）` });
      }
    }
  }
  const filtered = observations.filter((o) => !SERVER_SIGNALS.has(o.id));
  // Claude が短縮 URL と申告したのに、一覧の短縮サービスとして調べられなかったものは、行き先を開かずに不明として数える。
  const reported = filtered.find((o) => o.id === "short_url");
  if (reported && !extra.some((o) => o.id === "short_url")) {
    extra.push({ id: "destination_unknown", evidence: `${reported.evidence}（一覧にない短縮サービスのため、行き先を確かめていません）` });
  }
  // 同じ観点は先に来た根拠を使うため、行き先まで読めたコネクターの根拠を先に置く。
  return {
    ...score([...extra, ...filtered], config, question, { urlOnly: Boolean(sharedUrl), notes }),
    domains,
    usedDevice: fromDevice.size > 0,
  };
}

// Web メールの画面の URL は、本人のログインがないと開けないため採点せず、メールの原文の共有を案内する。
export const WEBMAIL_HEADLINE = "メールの画面の URL は、ご本人のログインが要るため、外からは開けません";

function webmailResult() {
  const lines = [
    `【判断】${WEBMAIL_HEADLINE}`,
    "",
    "【確認したいこと】",
    "届いたメールの原文（ソース）を共有してください。メールの画面のメニューにある「ソースを表示」「原文を表示」などで表示できます。",
    "",
    "【対処方法】",
    "・メールの中のリンクやボタンは開かず、何も入力しないでください。",
    "・原文を共有いただければ、差出人やリンクの行き先まで確かめて診断します。",
    "",
    `作法 v${PROTOCOL_VERSION} で確認`,
  ];
  return { total: 0, verdict: "保留" as const, ids: [] as SignalId[], text: lines.join("\n") };
}

