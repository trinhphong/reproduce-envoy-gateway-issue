"use client";

import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";
import { useEffect, useState, type FormEvent } from "react";
import type { AppRouter } from "@/server/router";

type Mode = "direct" | "broken" | "fixed";

type Timings = {
  firstTokenMs: number | null;
  elapsedMs: number | null;
  chunks: number;
};

const emptyTimings: Timings = {
  firstTokenMs: null,
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
    body: "One SSE stream. The server writes a 16KB comment first, then each token as an event. The first token arrives in about half a second, and events continue for about 25 seconds.",
  },
  broken: {
    title: "Broken Envoy — 16KB flush",
    body: "Envoy holds the response until 16KB has arrived. The opening SSE comment fills that buffer, so the first token arrives in about half a second and events continue for about 25 seconds.",
  },
  fixed: {
    title: "Fixed Envoy — SSE forwarded",
    body: "Same SSE stream. Envoy forwards each chunk. The first token arrives in about half a second, and events continue for about 25 seconds.",
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
        httpSubscriptionLink({
          url: `${window.location.origin}/api/trpc`,
        }),
      ],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        client.chat.subscribe(
          { message },
          {
            onData(delta) {
              if (typeof delta !== "string" || delta.length === 0) return;
              const now = Math.round(performance.now() - started);
              setAssistant((current) => current + delta);
              setTimings((current) => ({
                ...current,
                elapsedMs: now,
                firstTokenMs: current.firstTokenMs ?? now,
                chunks: current.chunks + 1,
              }));
            },
            onError(cause) {
              reject(cause);
            },
            onComplete() {
              resolve();
            },
          },
        );
      });
      setTimings((current) => ({
        ...current,
        elapsedMs: Math.round(performance.now() - started),
      }));
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setError(text);
      setTimings((current) => ({
        ...current,
        elapsedMs: Math.round(performance.now() - started),
      }));
    } finally {
      setPending(false);
    }
  }

  const copy = modeCopy[mode];

  return (
    <main>
      <h1>Streaming chat</h1>
      <p className="lede">
        The browser opens one SSE stream. The first bytes are a 16KB comment so
        a gateway that waits for 16KB can flush, then each token arrives as an
        event. {origin || "This page"} is the hop under test.
      </p>

      <section className={`banner ${mode}`}>
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </section>

      <ul className="stats">
        <li>
          <span>Time to first token</span>
          <strong>{formatMs(timings.firstTokenMs)}</strong>
        </li>
        <li>
          <span>Elapsed</span>
          <strong>{formatMs(timings.elapsedMs)}</strong>
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
          {pending ? (timings.firstTokenMs === null ? "Waiting" : "Receiving") : "Send"}
        </button>
      </form>
      <p className="note">
        The bundled mock ignores the message and emits one token about every
        500 milliseconds for about 25 seconds. The opening comment is at least
        16KB so Envoy can leave its buffer and forward the events. Set
        AI_BASE_URL, AI_MODEL, and AI_API_KEY to call your own endpoint.
      </p>
    </main>
  );
}
