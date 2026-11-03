import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { registerDomainApp } from "./app";
import { PROTOCOL_TEXT, PROTOCOL_VERSION } from "./protocol";
import { SIGNAL_IDS, scoreWithDomains } from "./scoring";
import { expandShortUrl } from "./shorturl";

function createServer() {
  const server = new McpServer({ name: "bwc-probe", version: PROTOCOL_VERSION });
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
        source_url: z
          .string()
          .optional()
          .describe("利用者から渡された URL。なければ省略する"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ input_kind, lure_kind, source_url }) => {
      // 検証専用のログ。本番では source_url を記録しない。
      console.log(
        JSON.stringify({
          tool: "get_judgment_protocol",
          protocol_version: PROTOCOL_VERSION,
          input_kind,
          lure_kind,
          source_url: source_url ?? null,
        }),
      );
      return { content: [{ type: "text", text: PROTOCOL_TEXT }] };
    },
  );
  server.registerTool(
    "expand_short_url",
    {
      title: "短縮 URL の行き先を確認",
      description:
        "短縮 URL が見えたら、行き先のドメインを照合する前に呼ぶ。短縮サービスにだけ問い合わせ、転送先のサイトは開かない。",
      inputSchema: {
        url: z.string().describe("短縮 URL"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ url }) => {
      const result = await expandShortUrl(url);
      console.log(JSON.stringify({ tool: "expand_short_url", status: result.status, hops: result.hops }));
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );
  server.registerTool(
    "score_observations",
    {
      title: "観測を採点して診断",
      description:
        "作法に沿って観測した観点を送り、診断結果を受け取る。判定は自分で決めず、返された文面をそのまま利用者に示す。追加の情報を受け取ったら、すべての観点を送り直して再診断する。",
      inputSchema: {
        observations: z
          .array(
            z.object({
              id: z.enum(SIGNAL_IDS).describe("当てはまった観点"),
              evidence: z.string().describe("画面や本文に見えた根拠。原文のまま短く"),
            }),
          )
          .describe("当てはまった観点だけ。当てはまらない観点や確認できない観点は送らない"),
        targets: z
          .array(z.string())
          .optional()
          .describe("画面や本文に見えた URL やホスト名。サブドメインと登録日はコネクターが調べて加点する"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ observations, targets }) => {
      const result = await scoreWithDomains(observations, targets ?? []);
      // 根拠の本文は記録しない。
      console.log(JSON.stringify({ tool: "score_observations", total: result.total, verdict: result.verdict, ids: result.ids }));
      return { content: [{ type: "text", text: result.text }] };
    },
  );
  registerDomainApp(server);
  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
} satisfies ExportedHandler;
