// 試作: 利用者の端末の上でレジストリの RDAP に問い合わせ、ドメインの登録日を表示する画面。
// 対象のサイトには接続しない。問い合わせ先は IANA とレジストリだけ。
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { parse } from "tldts";
import { z } from "zod";

const UI_URI = "ui://bwc/domain-check";
const APP_SDK = "https://unpkg.com/@modelcontextprotocol/ext-apps@2.1.0/dist/src/app-with-deps.js";

// 画面から問い合わせてよい先。レジストリを増やすときはここに足す。
const RDAP_ORIGINS = [
  "https://data.iana.org",
  "https://rdap.verisign.com",
  "https://tld-rdap.verisign.com",
  "https://rdap.gmoregistry.net",
  "https://rdap.centralnic.com",
  "https://rdap.publicinterestregistry.org",
  "https://rdap.identitydigital.services",
  "https://rdap.radix.host",
  "https://rdap.zdnsgtld.com",
];

const HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>ドメインの登録日</title>
<style>
  body { margin: 0; padding: 12px; font-family: var(--font-sans, system-ui, sans-serif); font-size: 14px;
         color: var(--color-text-primary, inherit); background: transparent; }
  .row { padding: 8px 0; border-bottom: 0.5px solid var(--color-border-tertiary, #ccc); }
  .host { font-weight: 600; word-break: break-all; }
  .meta { color: var(--color-text-secondary, inherit); }
  .new { color: var(--color-text-danger, #a33); font-weight: 600; }
</style></head>
<body>
<div id="title">端末からレジストリに問い合わせています…</div>
<div id="list"></div>
<script type="module">
  import { App } from "${APP_SDK}";
  const $ = (id) => document.getElementById(id);
  const app = new App({ name: "Domain registration", version: "0.1.0" });
  let bootstrap = null;

  async function rdapBase(tld) {
    if (!bootstrap) {
      const data = await (await fetch("https://data.iana.org/rdap/dns.json")).json();
      bootstrap = new Map();
      for (const [tlds, urls] of data.services) for (const t of tlds) bootstrap.set(t, urls[0]);
    }
    return bootstrap.get(tld) ?? null;
  }

  async function lookup(d) {
    const base = await rdapBase(d.tld);
    if (!base) return { ...d, registration: "取得出来ず", reason: "RDAP なし" };
    try {
      const res = await fetch(base.replace(/\\/$/, "") + "/domain/" + d.registered_domain, { headers: { Accept: "application/rdap+json" } });
      if (!res.ok) return { ...d, registration: "取得出来ず", reason: "応答 " + res.status };
      const data = await res.json();
      const date = data.events?.find((e) => e.eventAction === "registration")?.eventDate;
      if (!date) return { ...d, registration: "取得出来ず", reason: "登録日なし" };
      const age = Math.floor((Date.now() - Date.parse(date)) / 86400000);
      return { ...d, registration: date.slice(0, 10), age };
    } catch (e) {
      return { ...d, registration: "取得出来ず", reason: String(e?.message ?? e) };
    }
  }

  async function show(result) {
    const domains = result?.structuredContent?.domains ?? [];
    if (!domains.length) { $("title").textContent = "調べるドメインがありません"; return; }
    const rows = await Promise.all(domains.map(lookup));
    $("title").textContent = "ドメインの登録日（この端末から問い合わせ）";
    $("list").replaceChildren(...rows.map((r) => {
      const el = document.createElement("div");
      el.className = "row";
      const age = r.age === undefined ? "" : "（" + r.age + "日前）";
      el.innerHTML = '<div class="host"></div><div class="meta"></div>';
      el.querySelector(".host").textContent = r.registered_domain;
      const meta = el.querySelector(".meta");
      meta.textContent = r.registration === "取得出来ず" ? "登録日: 取得出来ず（" + r.reason + "）" : "登録日: " + r.registration + age;
      if (r.age !== undefined && r.age <= 180) meta.className = "meta new";
      return el;
    }));
  }

  app.ontoolresult = show;
  await app.connect();
</script>
</body></html>`;

export function registerDomainApp(server: McpServer) {
  registerAppTool(
    server,
    "show_domain_registration",
    {
      title: "ドメインの登録日を端末で確認",
      description:
        "URL やドメインが見えたら呼ぶ。利用者の端末からレジストリに問い合わせ、登録日を画面に表示する。対象のサイトには接続しない。",
      inputSchema: {
        targets: z.array(z.string()).describe("画面や本文に見えた URL かホスト名"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
      _meta: { ui: { resourceUri: UI_URI } },
    },
    async ({ targets }) => {
      const domains = targets.slice(0, 5).flatMap((t) => {
        const host = t.includes("://") ? (() => { try { return new URL(t).hostname; } catch { return t; } })() : t.split("/")[0];
        const p = parse(host, { allowPrivateDomains: true });
        return p.domain && p.publicSuffix ? [{ host, registered_domain: p.domain, tld: p.publicSuffix.split(".").pop()! }] : [];
      });
      return {
        content: [{ type: "text", text: `端末で登録日を確認する画面を表示します: ${domains.map((d) => d.registered_domain).join(", ") || "なし"}` }],
        structuredContent: { domains },
      };
    },
  );

  registerAppResource(server, "Domain registration view", UI_URI, { description: "端末からドメインの登録日を問い合わせる画面" }, async () => ({
    contents: [
      {
        uri: UI_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: HTML,
        _meta: { ui: { csp: { resourceDomains: ["https://unpkg.com"], connectDomains: RDAP_ORIGINS } } },
      },
    ],
  }));
}
