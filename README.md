# Envoy streaming chat demo

The browser calls a Next.js tRPC chat procedure. That procedure calls an OpenAI-compatible model with the Vercel AI SDK and streams each text delta back. Envoy sits between the browser and Next.js.

The bundled mock writes response headers immediately, then one token every 500ms for about 25 seconds. The app itself streams. The broken gateway buffers that response and releases it only when the reply is finished.

## Run

```bash
docker compose up --build
```

## Compare

- http://localhost:3000 — direct to Next.js. Waiting for server response is a few milliseconds. Content download lasts about 25 seconds while tokens arrive.
- http://localhost:8080 — broken Envoy. It buffers the upstream body before sending response headers. Waiting for server response lasts about 25 seconds, then content download finishes immediately and the whole reply appears at once.
- http://localhost:8081 — fixed Envoy. No response buffer. Same timings as the direct hop.

In Chrome DevTools, open the `chat?batch=1` request and look at the Timing tab.

## Model

Copy `.env.example` to `.env` and set `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. Compose reads that file. Without it, the app uses the mock at `http://mock-llm:8088/v1`.
