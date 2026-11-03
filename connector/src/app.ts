// 診断結果に付けるカード。利用者の端末からレジストリの RDAP に問い合わせ、
// 取れた登録日で採点し直して表示する。対象のサイトには接続しない。
import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";

export const DIAGNOSIS_UI = "ui://bwc/diagnosis";
const APP_SDK = "https://unpkg.com/@modelcontextprotocol/ext-apps@2.1.0/dist/src/app-with-deps.js";

// カードから問い合わせてよい先。レジストリを増やすときはここに足す。
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
<html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>診断結果</title>
<style>
  body { margin: 0; padding: 12px; font-family: var(--font-sans, system-ui, sans-serif); font-size: 14px;
         color: var(--color-text-primary, inherit); background: transparent; }
  .note { color: var(--color-text-secondary, inherit); margin-bottom: 8px; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
</style></head>
<body>
<div id="note" class="note">この端末からドメインの登録日を確認しています…</div>
<pre id="result"></pre>
<script type="module">
  import { App } from "${APP_SDK}";
  const $ = (id) => document.getElementById(id);
  const app = new App({ name: "Diagnosis", version: "0.2.0" });
  let bootstrap = null;

  async function rdapBase(tld) {
    if (!bootstrap) {
      const data = await (await fetch("https://data.iana.org/rdap/dns.json")).json();
      bootstrap = new Map();
      for (const [tlds, urls] of data.services) for (const t of tlds) bootstrap.set(t, urls[0]);
    }
    return bootstrap.get(tld) ?? null;
  }

  async function registration(d) {
    try {
      const base = await rdapBase(d.tld);
      if (!base) return null;
      const res = await fetch(base.replace(/\\/$/, "") + "/domain/" + d.registered_domain, { headers: { Accept: "application/rdap+json" } });
      if (!res.ok) return null;
      const date = (await res.json()).events?.find((e) => e.eventAction === "registration")?.eventDate;
      return date ? { domain: d.registered_domain, registration: date.slice(0, 10) } : null;
    } catch {
      return null;
    }
  }

  app.ontoolresult = async (result) => {
    const sc = result?.structuredContent;
    if (!sc) return;
    if (sc.usedDevice || !sc.domains?.length) {
      $("note").textContent = sc.usedDevice ? "この端末で確認した登録日を使った診断です" : "";
      $("result").textContent = sc.text;
      return;
    }
    const found = (await Promise.all(sc.domains.map(registration))).filter(Boolean);
    if (!found.length) {
      $("note").textContent = "この端末からも登録日は取得出来ず";
      $("result").textContent = sc.text;
      return;
    }
    const again = await app.callServerTool({
      name: "score_observations",
      arguments: { checklist: sc.checklist, evidence: sc.evidence, targets: sc.targets, device_registrations: found },
    });
    $("note").textContent = "この端末で確認した登録日で採点し直しました: " + found.map((f) => f.domain + " " + f.registration).join("、");
    $("result").textContent = again?.structuredContent?.text ?? sc.text;
  };
  await app.connect();
</script>
</body></html>`;

export function registerDiagnosisView(server: McpServer) {
  registerAppResource(server, "Diagnosis view", DIAGNOSIS_UI, { description: "端末で登録日を確認して表示する診断結果" }, async () => ({
    contents: [
      {
        uri: DIAGNOSIS_UI,
        mimeType: RESOURCE_MIME_TYPE,
        text: HTML,
        _meta: { ui: { csp: { resourceDomains: ["https://unpkg.com"], connectDomains: RDAP_ORIGINS } } },
      },
    ],
  }));
}
