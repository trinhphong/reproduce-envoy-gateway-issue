import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= 60 ? flat : `${flat.slice(0, 60)}…`;
}

function errorSummary(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const extra = error as Error & {
    statusCode?: number;
    url?: string;
    cause?: unknown;
    lastError?: unknown;
  };
  const bits = [extra.message, extra.statusCode, extra.url].filter(
    (part) => part !== undefined && part !== "",
  );
  const cause = extra.lastError ?? extra.cause;
  if (cause instanceof Error && cause.message) bits.push(cause.message);
  if (cause && typeof cause === "object" && "code" in cause) {
    bits.push(String((cause as { code?: unknown }).code));
  }
  return bits.join(" ");
}

export const appRouter = router({
  chat: publicProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async function* ({ input }) {
      const baseURL = process.env.AI_BASE_URL;
      const modelId = process.env.AI_MODEL;
      if (!baseURL || !modelId) {
        throw new Error("Set AI_BASE_URL and AI_MODEL");
      }

      const started = Date.now();
      const elapsed = () => Date.now() - started;
      console.log(
        `[chat] start model=${modelId} base=${baseURL} message_bytes=${Buffer.byteLength(input.message)} message="${preview(input.message)}"`,
      );

      const provider = createOpenAICompatible({
        name: "chat",
        baseURL,
        apiKey: process.env.AI_API_KEY || "unused",
      });

      const result = streamText({
        model: provider.chatModel(modelId),
        prompt: input.message,
      });

      const releaseAt = 16 * 1024;
      let chunks = 0;
      let bytes = 0;
      let released = false;
      try {
        for await (const part of result.fullStream) {
          if (part.type === "error") {
            throw part.error instanceof Error
              ? part.error
              : new Error(errorSummary(part.error));
          }
          if (part.type !== "text-delta") continue;
          chunks += 1;
          const size = Buffer.byteLength(part.text);
          bytes += size;
          if (!released && bytes >= releaseAt) {
            released = true;
            console.log(
              `[chat] ======== 16KB REACHED +${elapsed()}ms chunk=${chunks} total=${bytes} bytes ========`,
            );
          }
          console.log(
            `[chat] chunk ${chunks} +${elapsed()}ms bytes=${size} total=${bytes} text="${preview(part.text)}"`,
          );
          yield part.text;
        }
        console.log(`[chat] done chunks=${chunks} bytes=${bytes} +${elapsed()}ms`);
      } catch (error) {
        console.error(
          `[chat] error chunks=${chunks} bytes=${bytes} +${elapsed()}ms ${errorSummary(error)}`,
        );
        throw error;
      }
    }),
});

export type AppRouter = typeof appRouter;
