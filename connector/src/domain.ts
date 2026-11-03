// ホスト名を登録ドメインとサブドメインに分け、レジストリの RDAP で登録日を調べる。
// 問い合わせるのは IANA とレジストリだけで、対象のサイトには接続しない。
import { parse } from "tldts";

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
export const NEW_DOMAIN_DAYS = 180;
const HEADERS = {
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/rdap+json, application/json",
  "User-Agent": "bwc-probe/0.1 (RDAP lookup)",
};

let bootstrap: Map<string, string> | null = null;

async function rdapBase(tld: string): Promise<string | null> {
  if (!bootstrap) {
    const response = await fetch(BOOTSTRAP_URL, { headers: HEADERS });
    const data = (await response.json()) as { services: [string[], string[]][] };
    bootstrap = new Map();
    for (const [tlds, urls] of data.services) for (const t of tlds) bootstrap.set(t, urls[0]);
  }
  return bootstrap.get(tld) ?? null;
}

// 4桁以上の数字の連続、または母音のない8文字以上の英字を含むラベルを、意味のない文字列とみなす。
function randomLabels(subdomain: string): string[] {
  return subdomain
    .split(".")
    .filter((label) => /\d{4,}/.test(label) || /[bcdfghjklmnpqrstvwxz]{8,}/i.test(label));
}

// 見た目の似た英数字の並びを1つの形にそろえる。両方をそろえて一致すれば、似せた綴りとみなす。
const LOOKALIKE_SEQUENCES: [RegExp, string][] = [
  [/rn/g, "m"],
  [/vv/g, "w"],
  [/cl/g, "d"],
  [/0/g, "o"],
  [/[1i]/g, "l"],
];

function skeleton(label: string) {
  return LOOKALIKE_SEQUENCES.reduce((s, [from, to]) => s.replace(from, to), label.toLowerCase());
}

// 登録ドメインの TLD を除いた部分が、公式ドメインと綴りは違うのに似せた形では一致するなら、その公式ドメインを返す。
export function asciiLookalikeOf(host: string, officials: string[]): string | null {
  const label = parse(host, { allowPrivateDomains: true }).domainWithoutSuffix?.toLowerCase();
  if (!label) return null;
  for (const official of officials) {
    const parsed = parse(official.includes("://") ? official : `http://${official}`, { allowPrivateDomains: true });
    const target = parsed.domainWithoutSuffix?.toLowerCase();
    if (target && target !== label && skeleton(target) === skeleton(label)) return parsed.domain!;
  }
  return null;
}

// xn-- の表記を元の文字に戻す（RFC 3492）。
function decodePunycode(input: string): string {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const adapt = (delta: number, count: number, first: boolean) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / count);
    let k = 0;
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  };
  const cut = input.lastIndexOf("-");
  const output = cut > 0 ? [...input.slice(0, cut)].map((c) => c.codePointAt(0)!) : [];
  let n = 128, bias = 72, i = 0;
  for (let pos = cut > 0 ? cut + 1 : 0; pos < input.length; ) {
    const oldI = i;
    for (let w = 1, k = base; ; k += base) {
      const c = input.charCodeAt(pos++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) throw new Error("invalid punycode");
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    bias = adapt(i - oldI, output.length + 1, oldI === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

// 英数字以外の文字を使ったラベルのうち、日本語の文字だけでないものを返す。
// 日本語だけのドメインは似せ文字として数えない（見た目で判定しない）。
export function nonJapaneseIdnLabels(host: string): string[] {
  return host
    .split(".")
    .filter((label) => /^xn--/i.test(label))
    .map((label) => {
      try {
        return decodePunycode(label.slice(4).toLowerCase());
      } catch {
        return label;
      }
    })
    .filter((label) => /[^\x00-\x7F]/.test(label) && !/^[\x00-\x7F\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々]+$/u.test(label));
}

export async function checkDomain(input: string, { rdap: useRdap = true } = {}) {
  // URL として読み直し、英数字以外の文字を使ったドメインを xn-- の表記にそろえる。
  const host = new URL(input.includes("://") ? input : `http://${input}`).hostname;
  const parsed = parse(host, { allowPrivateDomains: true });
  const registered = parsed.domain;
  const subdomain = parsed.subdomain ?? "";
  const random = randomLabels(subdomain);
  const base = {
    host: parsed.hostname ?? host,
    registered_domain: registered ?? "取得出来ず",
    subdomain: subdomain || "なし",
    random_subdomain: random.length > 0,
    random_labels: random,
  };
  if (!registered || !parsed.publicSuffix) return { ...base, registration: "取得出来ず", reason: "parse_failed" };
  if (!useRdap) return { ...base, registration: "取得出来ず", reason: "skipped", tld: parsed.publicSuffix.split(".").pop()! };

  const tld = parsed.publicSuffix.split(".").pop()!;
  let rdap: string | null;
  try {
    rdap = await rdapBase(tld);
  } catch {
    return { ...base, registration: "取得出来ず", reason: "bootstrap_failed" };
  }
  if (!rdap) return { ...base, registration: "取得出来ず", reason: `no_rdap_for_${tld}` };

  try {
    const response = await fetch(`${rdap.replace(/\/$/, "")}/domain/${registered}`, { headers: HEADERS });
    if (!response.ok) return { ...base, registration: "取得出来ず", reason: `rdap_${response.status}` };
    const data = (await response.json()) as { events?: { eventAction: string; eventDate: string }[] };
    const date = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
    if (!date) return { ...base, registration: "取得出来ず", reason: "no_registration_event" };
    const ageDays = Math.floor((Date.now() - Date.parse(date)) / 86_400_000);
    return {
      ...base,
      registration: date.slice(0, 10),
      age_days: ageDays,
      new_domain: ageDays <= NEW_DOMAIN_DAYS,
      new_domain_threshold_days: NEW_DOMAIN_DAYS,
    };
  } catch {
    return { ...base, registration: "取得出来ず", reason: "rdap_failed" };
  }
}
