// lib/ai/providers/openaiVision.ts
//
// Real OpenAI-backed vision provider — the one genuinely new wiring
// this feature needed. providers/openai.ts's text provider sends
// `content` as a plain string; OpenAI's Chat Completions API also
// accepts `content` as an array mixing a text part with an
// `image_url` part, which is what actually turns on vision input.
// Nothing here is a new provider/company — same OPENAI_API_KEY, same
// Chat Completions endpoint, same account.

import { AiProviderError } from "../types";
import { registerAiVisionProvider } from "../registry";
import type { AiVisionProvider, AiVisionRequest, AiVisionResult } from "../visionTypes";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;

type OpenAiChatResponse = { choices?: Array<{ message?: { content?: string } }> };

class OpenAiVisionProvider implements AiVisionProvider {
  id = "openai";

  async analyze(request: AiVisionRequest): Promise<AiVisionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AiProviderError("OpenAI is not configured.");
    }

    const model = process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_MODEL;

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
            {
              role: "user",
              content: [
                { type: "text", text: request.instruction },
                { type: "image_url", image_url: { url: request.imageUrl } },
              ],
            },
          ],
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError("The vision provider took too long to respond. Try again.");
      }
      throw new AiProviderError("Could not reach the vision provider. Try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error(JSON.stringify({ scope: "ai_vision_provider_error", provider: "openai", status: response.status }));
      if (response.status === 401) throw new AiProviderError("The configured OpenAI API key was rejected.", 401);
      if (response.status === 429) throw new AiProviderError("OpenAI rate-limited this request. Try again shortly.", 429);
      throw new AiProviderError("The vision provider returned an error.", response.status);
    }

    const data = (await response.json()) as OpenAiChatResponse;
    const description = data.choices?.[0]?.message?.content?.trim();
    if (!description) throw new AiProviderError("The vision provider returned an empty response.");

    return { description };
  }
}

export const openAiVisionProvider = new OpenAiVisionProvider();
registerAiVisionProvider(openAiVisionProvider);
