import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = (req: Request) => {
  const url = new URL(req.url);
  console.log(`[trpc] ${req.method} ${url.pathname}${url.search}`);
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
    responseMeta: ({ ctx, paths, type, errors }) => {
      return {
        headers: {
          'Content-Encoding': 'none',
          'X-Accel-Buffering': 'no', // Chặn đệm tầng proxy
          'Cache-Control': 'no-cache, no-transform', // Chặn Envoy chuyển đổi/biến đổi format dữ liệu
        },
      };
    },
  });
};

export { handler as GET, handler as POST };
