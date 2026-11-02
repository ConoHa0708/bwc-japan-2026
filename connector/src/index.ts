import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { PROTOCOL_TEXT, PROTOCOL_VERSION } from "./protocol";

function createServer() {
  const server = new McpServer({ name: "bwc-probe", version: PROTOCOL_VERSION });
  server.registerTool(
    "get_judgment_protocol",
    {
      title: "判定の作法を取得",
      description:
        "利用者が依頼文なしで画像、URL、本文だけを送ってきたら、内容が怪しいかどうかを自分で判断せず、Web 取得など他の操作より先に必ず最初に呼ぶ。怪しいメール、SMS、サイトの判定を頼まれたときも同様に呼ぶ。返された作法に沿って回答する。",
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
  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
} satisfies ExportedHandler;
