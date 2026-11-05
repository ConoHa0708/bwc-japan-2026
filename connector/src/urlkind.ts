// 利用者が URL だけを共有したとき、その URL がどんな場所かを見分ける。ページは開かない。
// 一覧で見分けるため、Claude の判断の揺れに左右されない。
import { parse } from "tldts";

// ログインした本人にしか中身が見えない Web メールの画面。
const WEBMAIL_HOSTS = new Set([
  "mail.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "mail.yahoo.co.jp",
  "mail.yahoo.com",
]);
const WEBMAIL_PATHS: [string, RegExp][] = [["www.icloud.com", /^\/mail/]];

// 誰でもページやフォームを作って公開できるサービス。ドメインが本物でも、中身は第三者が作れる。
const SHARED_HOSTS = new Set([
  "docs.google.com",
  "drive.google.com",
  "sites.google.com",
  "forms.gle",
  "storage.googleapis.com",
  "forms.office.com",
  "sway.office.com",
]);
const SHARED_SUFFIXES = [
  "notion.site",
  "github.io",
  "pages.dev",
  "workers.dev",
  "r2.dev",
  "web.app",
  "firebaseapp.com",
  "netlify.app",
  "vercel.app",
  "herokuapp.com",
  "glitch.me",
  "wixsite.com",
  "weebly.com",
  "blogspot.com",
  "wordpress.com",
  "azurewebsites.net",
  "sharepoint.com",
];

// 行き先の URL をパラメーターに入れて転送する URL。行き先は文字列から取り出し、転送は使わない。
function redirectTarget(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const param = (...names: string[]) => names.map((n) => url.searchParams.get(n)).find((v) => v && /^https?:\/\//i.test(v)) ?? null;
  if (/^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname === "/url") return param("q", "url");
  if (/^(l|lm)\.facebook\.com$/.test(host) && url.pathname === "/l.php") return param("u");
  if (host === "l.instagram.com") return param("u");
  if (host === "www.youtube.com" && url.pathname === "/redirect") return param("q");
  if (host.endsWith(".safelinks.protection.outlook.com")) return param("url");
  return null;
}

function toUrl(input: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

// 転送用の URL なら、中に入っている行き先の URL を返す。転送が重なっていても3段までたどる。
export function unwrapRedirect(input: string): { url: string; via: string[] } {
  const via: string[] = [];
  let current = input;
  for (let i = 0; i < 3; i++) {
    const url = toUrl(current);
    const next = url && redirectTarget(url);
    if (!next) break;
    via.push(url.hostname);
    current = next;
  }
  return { url: current, via };
}

// URL の @ の前（ユーザー名の部分）に、ドメインに見える文字列を置いて行き先をごまかしているかを見る。
// メールアドレスと区別するため、http:// か https:// で始まるものだけを調べる。
export function userinfoDecoy(input: string): { shown: string; host: string } | null {
  if (!/^https?:\/\//i.test(input)) return null;
  const url = toUrl(input);
  if (!url || (!url.username && !url.password)) return null;
  const shown = decodeURIComponent(`${url.username}${url.password ? `:${url.password}` : ""}`);
  if (!/[a-z0-9-]+\.[a-z]{2,}/i.test(shown)) return null;
  return { shown: shown.slice(0, 80), host: url.hostname };
}

export type SharedUrlKind =
  | { kind: "webmail"; host: string }
  | { kind: "shared_host"; host: string }
  | { kind: "official"; host: string; official: string }
  | { kind: "other"; host: string };

// 共有された URL の種類。転送用の URL は、先に行き先を取り出してから見分ける。
export function classifySharedUrl(input: string, officials: string[] = []): SharedUrlKind | null {
  const url = toUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (WEBMAIL_HOSTS.has(host) || WEBMAIL_PATHS.some(([h, p]) => h === host && p.test(url.pathname))) return { kind: "webmail", host };
  if (SHARED_HOSTS.has(host) || SHARED_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return { kind: "shared_host", host };
  const registered = parse(host, { allowPrivateDomains: true }).domain?.toLowerCase();
  for (const official of officials) {
    const o = parse(official.includes("://") ? official : `http://${official}`, { allowPrivateDomains: true }).domain?.toLowerCase();
    if (registered && o && registered === o) return { kind: "official", host, official: o };
  }
  return { kind: "other", host };
}
