// 観測された観点を加点し、診断結果の文面を組み立てる。
// 配点は期間中に新しく決めた仮の値。運用の配点は後で非公開の設定に移す。
import { PROTOCOL_VERSION } from "./protocol";

export const SIGNALS = {
  org_claim: { points: 10, label: "実在の組織を名乗っている" },
  login_mismatch_verified: { points: 40, label: "公式ページで確認したログイン先とドメインが一致しない" },
  domain_differs_from_main: { points: 20, label: "組織の代表ドメインと異なるドメインへ誘導している" },
  org_in_subdomain: { points: 20, label: "組織名がサブドメインにあり、登録ドメインは別" },
  short_url: { points: 15, label: "短縮 URL が使われている" },
  destination_unknown: { points: 15, label: "リンクやボタンの行き先を取得出来ず" },
  input_credentials: { points: 20, label: "ID、パスワード、暗証番号の入力を求めている" },
  input_card_or_account: { points: 20, label: "カード番号や口座情報の入力を求めている" },
  input_id_document: { points: 20, label: "本人確認書類の画像を求めている" },
  authority_money_request: { points: 80, label: "警察や公的機関を名乗り、振込や資金の移動を求めている" },
  money_transfer_request: { points: 40, label: "振込や送金、指定口座への資金の移動を求めている" },
  sender_mismatch_verified: { points: 40, label: "差出人のドメインが、公式ページで確認した組織のドメインと一致しない" },
  financial_credential_request: { points: 50, label: "金融機関を名乗るメールか SMS で、認証情報の入力や返信を求めている" },
  tax_or_delivery_sms_link: { points: 50, label: "国税庁か配達業者を名乗る SMS にリンクがある" },
  offstore_app: { points: 60, label: "公式ストア以外からのアプリ導入へ誘導している" },
  app_install_request: { points: 20, label: "アプリの導入を求めている（入手先は不明）" },
  lure_to_login: { points: 20, label: "本文から確認やログインへ誘導している" },
  lure_to_other_contact: { points: 20, label: "電話や LINE など別の連絡先へ誘導している" },
  unusual_characters: { points: 15, label: "日本で一般的に使わない漢字や字形が混ざっている" },
  urgency: { points: 15, label: "急がせる表現がある" },
  sms_foreign_mobile: { points: 80, label: "SMS の発信者が海外の携帯番号" },
  sms_domestic_mobile: { points: 10, label: "SMS の発信者が国内の携帯番号" },
  dmarc_fail: { points: 30, label: "メールヘッダーの DMARC が fail" },
} as const;

export type SignalId = keyof typeof SIGNALS;
export const SIGNAL_IDS = Object.keys(SIGNALS) as [SignalId, ...SignalId[]];

const MAX_SCORE = 100;
const BLACK_MIN = 60;
const GRAY_MIN = 30;

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
    "下の質問にお答えいただければ、もう一度診断します。",
  ],
  白: [
    "安全を保証するものではありません。",
    "メールの宛先など追加の情報を共有いただければ、もう一度診断します。",
  ],
} as const;

// 観点に応じて対処方法に足す文。
const EXTRA_ACTIONS: Partial<Record<SignalId, string>> = {
  authority_money_request: "振り込まないでください。警察が現金の振り込みを求めることはありません（警視庁）。",
  money_transfer_request: "振り込みや送金はしないでください。",
  lure_to_other_contact: "表示された電話番号や連絡先には連絡しないでください。",
  offstore_app: "アプリは入れないでください。",
  app_install_request: "アプリは入れないでください。",
};

function extraActions(ids: SignalId[]) {
  // 警察を名乗る振込要求があれば、一般の振込の文は重ねない。
  const skip = ids.includes("authority_money_request") ? new Set<SignalId>(["money_transfer_request"]) : new Set<SignalId>();
  return [...new Set(ids.filter((id) => !skip.has(id)).map((id) => EXTRA_ACTIONS[id]).filter((a): a is string => Boolean(a)))];
}

export type Observation = { id: SignalId; evidence: string };

export function score(observations: Observation[]) {
  const seen = new Map<SignalId, string>();
  for (const o of observations) if (!seen.has(o.id)) seen.set(o.id, o.evidence.trim().slice(0, 200));
  const details = [...seen].map(([id, evidence]) => ({ id, ...SIGNALS[id], evidence }));
  details.sort((a, b) => b.points - a.points);
  const total = Math.min(MAX_SCORE, details.reduce((sum, d) => sum + d.points, 0));
  const verdict = total >= BLACK_MIN ? "黒" : total >= GRAY_MIN ? "グレー" : "白";

  const headline =
    verdict === "黒"
      ? "フィッシング詐欺の疑い大、入力しないでください"
      : verdict === "グレー"
        ? details.length >= 2
          ? "詐欺となる根拠が複数確認されています。アクセスはお控えください"
          : "詐欺となる根拠が確認されています。アクセスはお控えください"
        : "現時点で黒と判断できる内容は含まれていませんでした";

  const lines = [
    `【スコアリング】${total}点`,
    "",
    `【判断】${verdict}：${headline}`,
    "",
    "【スコアリングの詳細】",
    ...(details.length
      ? details.map((d) => `・+${d.points} ${d.label}${d.evidence ? `：${d.evidence}` : ""}`)
      : ["・加点なし"]),
    "",
    "【対処方法】",
    ...(verdict === "白" ? [] : extraActions(details.map((d) => d.id)).map((a) => `・${a}`)),
    ...ACTIONS[verdict].map((a) => `・${a}`),
    "",
    `作法 v${PROTOCOL_VERSION} で確認`,
  ];
  return { total, verdict, ids: details.map((d) => d.id), text: lines.join("\n") };
}
