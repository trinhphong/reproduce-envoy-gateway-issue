import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { TRPCError } from "@trpc/server";
import { streamText } from "ai";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  chat: publicProcedure
    .input(z.object({ message: z.string().min(1) }))
    .subscription(async function* ({ input, signal }) {
      const baseURL = process.env.AI_BASE_URL;
      const modelId = process.env.AI_MODEL;
      if (!baseURL || !modelId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Set AI_BASE_URL and AI_MODEL",
        });
      }

      const provider = createOpenAICompatible({
        name: "chat",
        baseURL,
        apiKey: process.env.AI_API_KEY || "unused",
      });
      const result = streamText({
        model: provider.chatModel(modelId),
        prompt: input.message,
        abortSignal: signal,
      });

      for await (const delta of result.textStream) {
        if (delta) yield delta;
      }
    }),
});

export type AppRouter = typeof appRouter;
