// Interfaz común para proveedores de IA. Para integrar otro proveedor basta con implementar ChatProvider.
import type { HistoryMessage } from "../coach.ts";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  input: unknown;
}

export interface ChatCompletionRequest {
  system: string; // instrucciones estables (cacheables)
  /** Bloque estable adicional (por ejemplo, el catálogo de ejercicios); también cacheable. */
  reference?: string;
  context: string; // datos del usuario para este turno
  messages: HistoryMessage[];
  /** Fotos adjuntas al último mensaje del usuario. */
  images?: ImageInput[];
  tools?: ToolDefinition[];
}

export type ChatCompletionResult =
  | { ok: true; text: string; model: string; toolCalls: ToolCall[] }
  | { ok: false; reason: "refused" | "rate_limited" | "timeout" | "unavailable" | "auth" | "bad_request"; detail?: string };

export interface ChatProvider {
  readonly name: string;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
}
