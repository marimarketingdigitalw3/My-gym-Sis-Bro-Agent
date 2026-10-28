import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { formatContext, isRateLimited, prepareHistory, validateChatRequest, type CoachContext } from "./coach.ts";
import { fallbackReply } from "./coachFallback.ts";
import { buildCoachContext, type CoachContextInput } from "./coachContext.ts";
import { AnthropicProvider } from "./ai/anthropic.ts";

const ctx: CoachContext = {
  firstName: "Mar", language: "es", level: "beginner", goals: ["glutes_legs"], equipment: ["dumbbells"], limitations: ["knee"],
  todayWorkout: { title: "Glúteos y piernas", exercises: ["Puente de glúteo", "Peso muerto rumano con mancuernas"] },
  recentSessions: [], personalRecords: [], missedSessionsThisWeek: 0,
  nutrition: { diet: "vegan", allergens: ["gluten"], proteinTargetG: 110 }, cycleToday: null,
};

describe("validación de peticiones", () => {
  it("acepta mensajes válidos y rechaza los inválidos", () => {
    expect(validateChatRequest({ message: " Hola " })).toEqual({ ok: true, value: { conversationId: null, message: "Hola" } });
    expect(validateChatRequest({ message: "" }).ok).toBe(false);
    expect(validateChatRequest({ message: "x".repeat(2001) }).ok).toBe(false);
    expect(validateChatRequest({ message: "hola", conversationId: "1; drop table" }).ok).toBe(false);
    expect(validateChatRequest(null).ok).toBe(false);
  });
  it("aplica el límite por hora", () => {
    expect(isRateLimited(29, 30)).toBe(false);
    expect(isRateLimited(30, 30)).toBe(true);
  });
  it("prepara un historial alterno que empieza por el usuario", () => {
    const h = prepareHistory([
      { role: "assistant", content: "bienvenida" },
      { role: "user", content: "a" },
      { role: "user", content: "b" },
      { role: "assistant", content: "c" },
    ], "nueva");
    expect(h.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(h[0].content).toBe("a\n\nb");
    expect(h[2].content).toBe("nueva");
  });
});

describe("contexto mínimo", () => {
  const base: CoachContextInput = {
    profile: { display_name: "María del Mar", language: "es" },
    settings: { ai_share_context: true, cycle_tracking_enabled: false },
    onboarding: { fitness: { level: "beginner" }, environment: { equipment: ["dumbbells"] }, health: { limitations: ["knee"] } },
    goals: [{ goal: "glutes_legs", priority: 1, status: "active" }],
    plan: { id: "p", days_per_week: 3, schedule: [{ dayIndex: 0, weekday: 2, title: "Glúteos" }] },
    planExercises: [{ day_index: 0, position: 0, exercise_id: "glute-bridge" }],
    recentSessions: [], recentSets: [], nutrition: null, proteinTargetG: null,
    cycleToday: { symptoms: ["cramps"], energy: 2 },
    todayWeekday: 2, weekStartISO: "2026-10-26", exerciseName: (id) => `nombre:${id}`,
  };
  it("incluye el entrenamiento de hoy y omite datos de ciclo si el seguimiento está desactivado", () => {
    const c = buildCoachContext(base);
    expect(c.firstName).toBe("María");
    expect(c.todayWorkout).toEqual({ title: "Glúteos", exercises: ["nombre:glute-bridge"] });
    expect(c.cycleToday).toBeNull();
    expect(formatContext(c)).not.toMatch(/cramps/);
  });
  it("no comparte nada personal si la persona lo desactivó", () => {
    const c = buildCoachContext({ ...base, settings: { ai_share_context: false, cycle_tracking_enabled: true } });
    expect(c.goals).toEqual([]);
    expect(c.limitations).toEqual([]);
    expect(c.todayWorkout).toBeNull();
    expect(c.cycleToday).toBeNull();
  });
});

describe("respuestas de respaldo", () => {
  it("prioriza la seguridad", () => {
    const r = fallbackReply("Me dio dolor en el pecho haciendo sentadillas", ctx);
    expect(r.source).toBe("safety");
    expect(r.text).toMatch(/evaluación médica/);
  });
  it("usa el plan de hoy", () => {
    const r = fallbackReply("¿Qué entreno hoy?", ctx);
    expect(r.intent).toBe("today");
    expect(r.text).toMatch(/Puente de glúteo/);
  });
  it("sustituye ejercicios por molestias en la rodilla", () => {
    expect(fallbackReply("Las sentadillas me molestan en la rodilla", ctx).intent).toBe("knee");
  });
  it("respeta dieta y alergias en las ideas de comida", () => {
    const r = fallbackReply("¿Qué puedo comer después de entrenar?", ctx);
    expect(r.intent).toBe("postworkout");
    expect(r.text).not.toMatch(/avena|huevo|yogur|queso/i);
  });
  it("responde en inglés cuando se pregunta en inglés", () => {
    expect(fallbackReply("I have cramps today, what are my options?", ctx).text).toMatch(/options/);
  });
});

function fakeClient(impl: (params?: unknown) => Promise<unknown>) {
  const create = vi.fn(impl);
  return { create, client: { beta: { messages: { create } } } as unknown as Pick<Anthropic, "beta"> };
}

describe("proveedor Anthropic", () => {
  const request = { system: "s", context: "<user_context/>", messages: [{ role: "user" as const, content: "hola" }] };

  it("envía modelo, esfuerzo, fallbacks y contexto en un bloque aparte", async () => {
    const { create, client } = fakeClient(async () => ({
      model: "claude-opus-5-5", stop_reason: "end_turn", stop_details: null,
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "¡Hola!" }],
    }));
    const r = await new AnthropicProvider({ apiKey: "x", client }).complete(request);
    expect(r).toEqual({ ok: true, text: "¡Hola!", model: "claude-opus-5-5" });
    const params = create.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.output_config).toEqual({ effort: "medium" });
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect((params.system as unknown[]).length).toBe(2);
  });

  it("trata los rechazos antes de leer el contenido", async () => {
    const { client } = fakeClient(async () => ({ model: "m", stop_reason: "refusal", stop_details: { category: "bio" }, content: [] }));
    expect(await new AnthropicProvider({ apiKey: "x", client }).complete(request)).toEqual({ ok: false, reason: "refused", detail: "bio" });
  });

  it("clasifica tiempos de espera y errores de conexión", async () => {
    const timeout = fakeClient(async () => { throw new Anthropic.APIConnectionTimeoutError(); });
    expect((await new AnthropicProvider({ apiKey: "x", client: timeout.client }).complete(request))).toMatchObject({ ok: false, reason: "timeout" });
    const conn = fakeClient(async () => { throw new Anthropic.APIConnectionError({ message: "down" }); });
    expect((await new AnthropicProvider({ apiKey: "x", client: conn.client }).complete(request))).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
