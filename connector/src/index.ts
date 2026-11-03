import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { DIAGNOSIS_UI, registerDiagnosisView } from "./app";
import { PROTOCOL_TEXT, PROTOCOL_VERSION } from "./protocol";
import { SIGNAL_IDS, observationsFrom, scoreWithDomains } from "./scoring";

const TOOL_NAME = "phishing_check";

function createServer() {
  const server = new McpServer({ name: "bwc-probe", version: PROTOCOL_VERSION });
  // 道具は1つにまとめる。アプリは道具ごとに読み込むかを判断するため、分けると途中で漏れることがある。
  registerAppTool(
    server,
    TOOL_NAME,
    {
      title: "フィッシングの確認",
      description:
        "利用者が依頼文なしで画像、URL、本文だけを送ってきたら、内容が怪しいかどうかを自分で判断せず、Web 取得など他の操作より先に必ず最初に呼ぶ。怪しいメール、SMS、サイトの判定を頼まれたときも同様に呼ぶ。1回目は checklist なしで呼び、返された作法に従う。2回目は checklist を付けて呼び、診断を受け取る。",
      inputSchema: {
        checklist: z
          .object(Object.fromEntries(SIGNAL_IDS.map((id) => [id, z.boolean()])) as Record<(typeof SIGNAL_IDS)[number], z.ZodBoolean>)
          .optional()
          .describe("作法の観点すべてに true か false で答える。1回目は省略する"),
        evidence: z
          .array(z.object({ id: z.string(), text: z.string() }))
          .optional()
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
      if (!checklist) {
        console.log(JSON.stringify({ tool: TOOL_NAME, step: "protocol", protocol_version: PROTOCOL_VERSION }));
        return { content: [{ type: "text", text: PROTOCOL_TEXT }] };
      }
      const result = await scoreWithDomains(observationsFrom(checklist, evidence ?? []), targets ?? [], device_registrations ?? []);
      // 根拠の本文は記録しない。
      console.log(
        JSON.stringify({ tool: TOOL_NAME, step: "score", total: result.total, verdict: result.verdict, ids: result.ids, device: result.usedDevice }),
      );
      return {
        // 診断結果はカードに出すため、Claude には文面を繰り返させない。
        content: [{ type: "text", text: `診断結果はカードに表示しました（${result.verdict}、${result.total}点）。文面は繰り返さない。` }],
        structuredContent: {
          text: result.text,
          usedDevice: result.usedDevice,
          domains: result.domains,
          checklist,
          evidence: evidence ?? [],
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
