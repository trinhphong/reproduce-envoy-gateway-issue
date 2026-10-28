import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  chat: publicProcedure
    .input(z.object({ message: z.string().min(1) }))
    .mutation(async function* ({ input }) {
      const baseURL = process.env.AI_BASE_URL;
      const modelId = process.env.AI_MODEL;
      if (!baseURL || !modelId) {
        throw new Error("Set AI_BASE_URL and AI_MODEL");
      }

      const provider = createOpenAICompatible({
        name: "chat",
        baseURL,
        apiKey: process.env.AI_API_KEY || "unused",
      });

      const result = streamText({
        model: provider.chatModel(modelId),
        prompt: input.message,
      });

      for await (const delta of result.textStream) {
        yield delta;
      }
    }),
});

export type AppRouter = typeof appRouter;
