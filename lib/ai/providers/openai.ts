// lib/ai/providers/openai.ts
//
// Real OpenAI-backed text provider. Plain fetch against the Chat
// Completions REST API — no SDK dependency for one HTTP call. The API
// key is read here, server-side, and never leaves this file in any
// response — callers only ever get back the generated text or a safe
// AiProviderError message.

import { AiProviderError, type AiTextProvider, type BuiltPrompt } from "../types";
import { registerAiTextProvider } from "../registry";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;

class OpenAiTextProvider implements AiTextProvider {
  id = "openai";

  async generate(prompt: BuiltPrompt): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      // Should never actually be reached — the route checks
      // isAiTextConfigured() first — but never silently proceeds
      // without a key if it somehow is.
      throw new AiProviderError("OpenAI is not configured.");
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError("The AI provider took too long to respond. Try again.");
      }
      throw new AiProviderError("Could not reach the AI provider. Try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Safe, non-leaking: never include the request body/key/raw
      // provider payload in what's thrown or logged.
      console.error(JSON.stringify({ scope: "ai_provider_error", provider: "openai", status: response.status }));
      if (response.status === 401) throw new AiProviderError("The configured OpenAI API key was rejected.", 401);
      if (response.status === 429) throw new AiProviderError("OpenAI rate-limited this request. Try again shortly.", 429);
      throw new AiProviderError("The AI provider returned an error.", response.status);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiProviderError("The AI provider returned an empty response.");

    return text;
  }
}

export const openAiTextProvider = new OpenAiTextProvider();
registerAiTextProvider(openAiTextProvider);
