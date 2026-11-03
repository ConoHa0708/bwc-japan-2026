// 観測された観点を加点し、診断結果の文面を組み立てる。
// 配点は期間中に新しく決めた仮の値。運用の配点は後で非公開の設定に移す。
import { PROTOCOL_VERSION } from "./protocol";

export const SIGNALS = {
  org_claim: { points: 10, label: "実在の組織を名乗っている" },
  login_mismatch_verified: { points: 40, label: "公式ページで確認したログイン先とドメインが一致しない" },
  domain_differs_from_main: { points: 10, label: "組織の代表ドメインと異なるドメインへ誘導している" },
  org_in_subdomain: { points: 20, label: "組織名がサブドメインにあり、登録ドメインは別" },
  short_url: { points: 15, label: "短縮 URL が使われている" },
  destination_unknown: { points: 15, label: "リンクやボタンの行き先を取得出来ず" },
  input_credentials: { points: 30, label: "ID、パスワード、暗証番号の入力を求めている" },
  input_card_or_account: { points: 30, label: "カード番号や口座情報の入力を求めている" },
  input_id_document: { points: 20, label: "本人確認書類の画像を求めている" },
  financial_credential_request: { points: 50, label: "金融機関を名乗るメールか SMS で、認証情報の入力や返信を求めている" },
  tax_or_delivery_sms_link: { points: 50, label: "国税庁か配達業者を名乗る SMS にリンクがある" },
  offstore_app: { points: 60, label: "公式ストア以外からのアプリ導入へ誘導している" },
  app_install_request: { points: 20, label: "アプリの導入を求めている（入手先は不明）" },
  lure_to_login: { points: 20, label: "本文から確認やログインへ誘導している" },
  lure_to_other_contact: { points: 15, label: "電話や LINE など別の連絡先へ誘導している" },
  urgency: { points: 15, label: "急がせる表現がある" },
  sms_foreign_mobile: { points: 80, label: "SMS の発信者が海外の携帯番号" },
  sms_domestic_mobile: { points: 10, label: "SMS の発信者が国内の携帯番号" },
  dmarc_fail: { points: 30, label: "メールヘッダーの DMARC が fail" },
} as const;

export type SignalId = keyof typeof SIGNALS;
export const SIGNAL_IDS = Object.keys(SIGNALS) as [SignalId, ...SignalId[]];

const BLACK_MIN = 80;
const GRAY_MIN = 20;

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

export type Observation = { id: SignalId; evidence: string };

export function score(observations: Observation[]) {
  const seen = new Map<SignalId, string>();
  for (const o of observations) if (!seen.has(o.id)) seen.set(o.id, o.evidence.trim().slice(0, 200));
  const details = [...seen].map(([id, evidence]) => ({ id, ...SIGNALS[id], evidence }));
  details.sort((a, b) => b.points - a.points);
  const total = details.reduce((sum, d) => sum + d.points, 0);
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
    ...ACTIONS[verdict].map((a) => `・${a}`),
    "",
    `作法 v${PROTOCOL_VERSION} で確認`,
  ];
  return { total, verdict, ids: details.map((d) => d.id), text: lines.join("\n") };
}
