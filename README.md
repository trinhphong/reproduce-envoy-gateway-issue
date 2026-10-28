# Envoy streaming chat demo

The browser opens one tRPC SSE subscription. That subscription calls an OpenAI-compatible model with the Vercel AI SDK and sends each text delta as an SSE event. Envoy sits between the browser and Next.js.

The bundled mock writes one token every 500ms for about 25 seconds. The whole reply is only a few hundred bytes. A gateway that waits until 16KB is buffered therefore holds the stream until it ends, and the reply appears all at once.

The app writes an SSE comment of at least 16KB before the first event. EventSource ignores that comment. Once 16KB has arrived, Envoy can flush and forward each later event while generation continues.

## Run

```bash
docker compose up --build
```

## Compare

- http://localhost:3000 — direct to Next.js. First token in about half a second, then events for about 25 seconds.
- http://localhost:8080 — broken Envoy. It holds upstream bytes until the buffer reaches 16KB or the stream ends. The opening comment fills that buffer, so the first token still arrives in about half a second.
- http://localhost:8081 — fixed Envoy. No response hold. Same SSE stream.

## Model

Copy `.env.example` to `.env` and set `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. Compose reads that file. Without it, the app uses the mock at `http://mock-llm:8088/v1`.
