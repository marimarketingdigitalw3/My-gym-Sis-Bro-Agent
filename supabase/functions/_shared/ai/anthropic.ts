// Proveedor Anthropic (Claude) usando el SDK oficial.
// En Deno, "@anthropic-ai/sdk" se resuelve con el import map de supabase/functions/coach-chat/deno.json.
import Anthropic from "@anthropic-ai/sdk";
import type { ChatCompletionRequest, ChatCompletionResult, ChatProvider } from "./provider.ts";

export const DEFAULT_COACH_MODEL = "claude-opus-5-5";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  client?: Pick<Anthropic, "beta">; // inyectable para pruebas
}

export class AnthropicProvider implements ChatProvider {
  readonly name = "anthropic";
  private readonly client: Pick<Anthropic, "beta">;
  private readonly model: string;

  constructor(opts: AnthropicProviderOptions) {
    this.model = opts.model || DEFAULT_COACH_MODEL;
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs ?? 45_000, maxRetries: 1 });
  }

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Respuestas de chat: esfuerzo medio explícito (en este modelo el razonamiento siempre está activo).
        output_config: { effort: "medium" },
        // Si un clasificador de seguridad rechaza la petición, la API reintenta con el modelo de respaldo recomendado.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: req.context },
        ],
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });

      if (response.stop_reason === "refusal") {
        return { ok: false, reason: "refused", detail: response.stop_details?.category ?? undefined };
      }
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) return { ok: false, reason: "unavailable", detail: `empty response (${response.stop_reason})` };
      return { ok: true, text, model: response.model };
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, reason: "timeout" };
      if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rate_limited" };
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "auth" };
      if (error instanceof Anthropic.BadRequestError) return { ok: false, reason: "bad_request", detail: error.message };
      if (error instanceof Anthropic.APIError) return { ok: false, reason: "unavailable", detail: `status ${error.status}` };
      return { ok: false, reason: "unavailable", detail: error instanceof Error ? error.message : String(error) };
    }
  }
}
