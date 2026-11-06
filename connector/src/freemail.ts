// 誰でも無料でアドレスを作れるメールサービスのドメイン。組織からの連絡に使われることはない。
// 携帯電話会社のメール（docomo.ne.jp など）は、会社自身の連絡にも使われるため入れない。
// サブドメイン（mail.yahoo.co.jp など）はサービス自身の送信に使われるため、ドメインが完全に一致するものだけを見る。
const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.co.jp",
  "ymail.ne.jp",
  "yahoo.com",
  "outlook.com",
  "outlook.jp",
  "hotmail.com",
  "hotmail.co.jp",
  "live.com",
  "live.jp",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "gmx.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "qq.com",
  "163.com",
  "126.com",
  "naver.com",
]);

// 差出人のアドレスが無料のメールサービスのものなら、その @ 以降のドメインを返す。
export function freemailDomain(address: string): string | null {
  const match = address.trim().match(/@([^@\s>]+)\s*>?$/);
  if (!match) return null;
  const domain = match[1].toLowerCase().replace(/\.$/, "");
  return FREEMAIL_DOMAINS.has(domain) ? domain : null;
}
