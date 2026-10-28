"use client";

import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { useEffect, useState, type FormEvent } from "react";
import type { AppRouter } from "@/server/router";

type Mode = "direct" | "broken" | "fixed";

type Timings = {
  waitingMs: number | null;
  downloadMs: number | null;
  elapsedMs: number | null;
  chunks: number;
};

const emptyTimings: Timings = {
  waitingMs: null,
  downloadMs: null,
  elapsedMs: null,
  chunks: 0,
};

function modeForPort(port: string): Mode {
  if (port === "8080") return "broken";
  if (port === "8081") return "fixed";
  return "direct";
}

const modeCopy: Record<Mode, { title: string; body: string }> = {
  direct: {
    title: "Direct to Next.js",
    body: "No Envoy on this hop. Waiting for server response stays small, then the content downloads for about 25 seconds as tokens arrive.",
  },
  broken: {
    title: "Broken Envoy — response buffered",
    body: "Envoy holds the reply until it is finished. Waiting for server response lasts about 25 seconds, then the content download is immediate and the whole reply appears at once.",
  },
  fixed: {
    title: "Fixed Envoy — response streamed",
    body: "Envoy forwards each chunk. Waiting for server response stays small, and the content download lasts about 25 seconds.",
  },
};

function formatMs(value: number | null) {
  return value === null ? "—" : `${value} ms`;
}

export default function HomePage() {
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState<Mode>("direct");
  const [draft, setDraft] = useState("Keep talking until the stream finishes.");
  const [userText, setUserText] = useState("");
  const [assistant, setAssistant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [timings, setTimings] = useState<Timings>(emptyTimings);

  useEffect(() => {
    setOrigin(window.location.origin);
    setMode(modeForPort(window.location.port));
  }, []);

  useEffect(() => {
    if (!pending) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      setTimings((current) => ({
        ...current,
        elapsedMs: Math.round(performance.now() - started),
      }));
    }, 200);
    return () => window.clearInterval(id);
  }, [pending]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;

    const started = performance.now();
    setPending(true);
    setError(null);
    setUserText(message);
    setAssistant("");
    setTimings({ ...emptyTimings, elapsedMs: 0 });

    const client = createTRPCClient<AppRouter>({
      links: [
        httpBatchStreamLink({
          url: `${window.location.origin}/api/trpc`,
          fetch: async (input, init) => {
            const response = await fetch(input, init);
            setTimings((current) => ({
              ...current,
              waitingMs: Math.round(performance.now() - started),
            }));
            return response;
          },
        }),
      ],
    });

    try {
      const stream = await client.chat.mutate({ message });
      let chunks = 0;
      for await (const delta of stream) {
        chunks += 1;
        const now = Math.round(performance.now() - started);
        setAssistant((current) => current + delta);
        setTimings((current) => ({
          ...current,
          elapsedMs: now,
          chunks,
        }));
      }
      const end = Math.round(performance.now() - started);
      setTimings((current) => ({
        ...current,
        elapsedMs: end,
        downloadMs:
          current.waitingMs === null ? null : Math.max(0, end - current.waitingMs),
      }));
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      const end = Math.round(performance.now() - started);
      setError(text);
      setTimings((current) => ({
        ...current,
        elapsedMs: end,
        downloadMs:
          current.waitingMs === null ? null : Math.max(0, end - current.waitingMs),
      }));
    } finally {
      setPending(false);
    }
  }

  const waitingMs =
    timings.waitingMs ?? (pending ? timings.elapsedMs : null);
  const downloadMs =
    timings.downloadMs ??
    (timings.waitingMs === null || timings.elapsedMs === null
      ? null
      : Math.max(0, timings.elapsedMs - timings.waitingMs));

  const copy = modeCopy[mode];

  return (
    <main>
      <h1>Streaming chat</h1>
      <p className="lede">
        The browser calls tRPC. tRPC calls an OpenAI-compatible model with the
        AI SDK and yields each text delta. {origin || "This page"} is the hop
        under test.
      </p>

      <section className={`banner ${mode}`}>
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </section>

      <ul className="stats">
        <li>
          <span>Waiting for server response</span>
          <strong>{formatMs(waitingMs)}</strong>
        </li>
        <li>
          <span>Content download</span>
          <strong>{formatMs(downloadMs)}</strong>
        </li>
        <li>
          <span>Chunks</span>
          <strong>{timings.chunks}</strong>
        </li>
      </ul>

      <div className="thread">
        {userText ? (
          <article className="bubble user">
            <p>You</p>
            {userText}
          </article>
        ) : (
          <p className="note">Send a message to start a streamed reply.</p>
        )}
        {assistant ? (
          <article className="bubble">
            <p>Assistant</p>
            {assistant}
          </article>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={onSubmit}>
        <input
          aria-label="Message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pending}
        />
        <button type="submit" disabled={pending || draft.trim().length === 0}>
          {pending ? (timings.waitingMs === null ? "Waiting" : "Receiving") : "Send"}
        </button>
      </form>
      <p className="note">
        The bundled mock ignores the message and streams for about 25 seconds.
        Set AI_BASE_URL, AI_MODEL, and AI_API_KEY to call your own endpoint.
        Open the chat request in DevTools to compare Waiting for server response
        with Content download.
      </p>
    </main>
  );
}
