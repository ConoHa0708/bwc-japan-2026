import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { DIAGNOSIS_UI, registerDiagnosisView } from "./app";
import { PROTOCOL_TEXT, PROTOCOL_VERSION } from "./protocol";
import { SIGNAL_IDS, observationsFrom, scoreWithDomains } from "./scoring";

function createServer() {
  const server = new McpServer({ name: "bwc-probe", version: PROTOCOL_VERSION });
  // 作法の取得は、アプリが最初に見つけやすいよう画面なしの道具のままにする。
  server.registerTool(
    "get_judgment_protocol",
    {
      title: "判定の作法を取得",
      description:
        "利用者が依頼文なしで画像、URL、本文だけを送ってきたら、内容が怪しいかどうかを自分で判断せず、Web 取得など他の操作より先に必ず最初に呼ぶ。怪しいメール、SMS、サイトの判定を頼まれたときも同様に呼ぶ。呼ぶか迷ったら呼ぶ。返された作法に沿って回答し、問題がないと自分で断定しない。",
      inputSchema: {
        input_kind: z
          .enum(["screenshot", "text", "url", "other"])
          .describe("利用者から渡されたものの種類"),
        lure_kind: z
          .enum(["url", "qr", "phone", "app", "other", "unknown"])
          .describe("誘導先の種類"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ input_kind, lure_kind }) => {
      console.log(JSON.stringify({ tool: "get_judgment_protocol", protocol_version: PROTOCOL_VERSION, input_kind, lure_kind }));
      return { content: [{ type: "text", text: PROTOCOL_TEXT }] };
    },
  );
  registerAppTool(
    server,
    "score_observations",
    {
      title: "観測を採点して診断",
      description: "作法の観点すべてを checklist で答え、診断を受け取る。診断結果はカードに表示される。",
      inputSchema: {
        checklist: z
          .object(Object.fromEntries(SIGNAL_IDS.map((id) => [id, z.boolean()])) as Record<(typeof SIGNAL_IDS)[number], z.ZodBoolean>)
          .describe("作法の観点すべてに true か false で答える。見えない、確かめられないものは false"),
        evidence: z
          .array(z.object({ id: z.string(), text: z.string() }))
          .describe("true にした観点の根拠。画面や本文の原文を短く"),
        targets: z
          .array(z.string())
          .optional()
          .describe("画面や本文に見えた URL やホスト名。短縮 URL、サブドメイン、登録日はコネクターが調べる"),
        device_registrations: z
          .array(z.object({ domain: z.string(), registration: z.string() }))
          .optional()
          .describe("診断カードが端末で確認した登録日。Claude は送らない"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
      _meta: { ui: { resourceUri: DIAGNOSIS_UI } },
    },
    async ({ checklist, evidence, targets, device_registrations }) => {
      const result = await scoreWithDomains(observationsFrom(checklist, evidence), targets ?? [], device_registrations ?? []);
      // 根拠の本文は記録しない。
      console.log(
        JSON.stringify({ tool: "score_observations", total: result.total, verdict: result.verdict, ids: result.ids, device: result.usedDevice }),
      );
      return {
        // 診断結果はカードに出すため、Claude には文面を繰り返させない。
        content: [{ type: "text", text: `診断結果はカードに表示しました（${result.verdict}、${result.total}点）。文面は繰り返さない。` }],
        structuredContent: {
          text: result.text,
          usedDevice: result.usedDevice,
          domains: result.domains,
          checklist,
          evidence,
          targets: targets ?? [],
        },
      };
    },
  );
  registerDiagnosisView(server);
  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
} satisfies ExportedHandler;
