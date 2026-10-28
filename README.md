# Envoy streaming chat demo

The browser calls a Next.js tRPC chat procedure. That procedure calls an OpenAI-compatible model with the Vercel AI SDK and streams each text delta back. Envoy sits between the browser and Next.js.

The bundled mock writes response headers immediately, then one chunk every 500ms until the reply is 100KB. The app itself streams. The broken gateway buffers that response until 16KB, then streams the rest.

## Run

```bash
docker compose up --build
```

## Compare

- http://localhost:3000 — direct to Next.js. Waiting for server response is a few milliseconds. Content download lasts while tokens arrive.
- http://localhost:8080 — broken Envoy. It buffers the upstream body until 16KB, then streams the rest. Waiting for server response lasts until that 16KB is ready. Content download is the remainder of the reply.
- http://localhost:8081 — fixed Envoy. No response buffer. Same timings as the direct hop.

In Chrome DevTools, open the `chat?batch=1` request and look at the Timing tab.

## Model

Copy `.env.example` to `.env` and set `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. Compose reads that file. Without it, the app uses the mock at `http://mock-llm:8088/v1`.
