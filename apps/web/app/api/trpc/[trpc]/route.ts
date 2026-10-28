import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Some Envoy paths hold a response until 16KB is buffered, then forward the rest.
// An SSE comment of that size is ignored by EventSource and fills the buffer up front.
const FLUSH_BYTES = 16 * 1024;

function sseFlushPadding() {
  const line = `: ${" ".repeat(2048)}\n`;
  let padding = "";
  while (Buffer.byteLength(padding) < FLUSH_BYTES) padding += line;
  return `${padding}\n`;
}

const handler = async (req: Request) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) return response;

  const encoder = new TextEncoder();
  const padding = encoder.encode(sseFlushPadding());
  const reader = response.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(padding);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: response.status,
    headers: response.headers,
  });
};

export { handler as GET, handler as POST };
