import express from "express";
import cors from "cors";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: ["https://chat.openai.com", "https://chatgpt.com"],
    credentials: false,
  })
);

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
  console.error("Missing NAVER_CLIENT_ID / NAVER_CLIENT_SECRET");
  process.exit(1);
}

const transports = new Map();

function makeServer() {
  const server = new McpServer({
    name: "naver-search-mcp",
    version: "1.0.0",
  });

  async function naverSearch(pathname, params) {
    const url = new URL(`https://openapi.naver.com${pathname}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Naver API error ${res.status}: ${text}`);
    }

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }

  server.tool(
    "search_news",
    "네이버 뉴스 검색",
    {
      query: z.string().min(1),
      display: z.number().int().min(1).max(100).optional(),
      start: z.number().int().min(1).max(1000).optional(),
      sort: z.enum(["sim", "date"]).optional(),
    },
    async ({ query, display = 10, start = 1, sort = "date" }) =>
      naverSearch("/v1/search/news.json", { query, display, start, sort })
  );

  server.tool(
    "search_blog",
    "네이버 블로그 검색",
    {
      query: z.string().min(1),
      display: z.number().int().min(1).max(100).optional(),
      start: z.number().int().min(1).max(1000).optional(),
      sort: z.enum(["sim", "date"]).optional(),
    },
    async ({ query, display = 10, start = 1, sort = "sim" }) =>
      naverSearch("/v1/search/blog.json", { query, display, start, sort })
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    sse: `${BASE_URL}/sse`,
    messages: `${BASE_URL}/messages`,
  });
});

app.get("/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
      transports.delete(transport.sessionId);
    });

    const server = makeServer();
    await server.connect(transport);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).send("Failed to open SSE transport");
  }
});

app.post("/messages", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || "");
    const transport = transports.get(sessionId);

    if (!transport) {
      return res.status(400).send("No transport found for sessionId");
    }

    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).send("Failed to handle MCP message");
  }
});

app.listen(PORT, () => {
  console.log(`Running on ${BASE_URL}`);
});
