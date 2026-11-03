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

export async function checkDomain(input: string, { rdap: useRdap = true } = {}) {
  const host = input.includes("://") ? new URL(input).hostname : input.split("/")[0];
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
