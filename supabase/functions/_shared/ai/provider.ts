// Interfaz común para proveedores de IA. Para integrar otro proveedor basta con implementar ChatProvider.
import type { HistoryMessage } from "../coach.ts";

export interface ChatCompletionRequest {
  system: string; // instrucciones estables (cacheables)
  context: string; // datos del usuario para este turno
  messages: HistoryMessage[];
}

export type ChatCompletionResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "refused" | "rate_limited" | "timeout" | "unavailable" | "auth" | "bad_request"; detail?: string };

export interface ChatProvider {
  readonly name: string;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
}
