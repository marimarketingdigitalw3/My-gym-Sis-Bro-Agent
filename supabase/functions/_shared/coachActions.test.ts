import { describe, expect, it } from "vitest";
import { actionFromTool, describeAction, isVideoPath, parseActionIntents, parseStoredActions, videoFramePath } from "./coachActions.ts";

const catalog = [
  { id: "hip-thrust", name: "Hip thrust con barra" },
  { id: "barbell-row", name: "Remo con barra" },
  { id: "bodyweight-squat", name: "Sentadilla con peso corporal" },
];
const schedule = [
  { weekday: 0 as const, title: "Glúteos y piernas" },
  { weekday: 2 as const, title: "Tren superior" },
  { weekday: 4 as const, title: "Cuerpo completo" },
];

describe("acciones desde herramientas de la IA", () => {
  it("valida y normaliza las entradas", () => {
    expect(actionFromTool("set_training_time", { weekday: 0, time: "07:00" })).toEqual({ type: "set_training_time", weekday: 0, time: "07:00" });
    expect(actionFromTool("set_training_time", { weekday: "all", time: "7:00" })).toBeNull();
    expect(actionFromTool("move_routine", { from_weekday: 1, to_weekday: 1 })).toBeNull();
    expect(actionFromTool("add_exercise", { weekday: 3, exercise_id: "hip-thrust" })).toEqual({ type: "add_exercise", weekday: 3, exercise_id: "hip-thrust", sets: 3, rep_min: 10, rep_max: 12 });
    expect(actionFromTool("create_routine", { weekday: 5, focus: ["glutes", "hamstrings"] })?.type).toBe("create_routine");
    expect(actionFromTool("set_supplements", { add: ["creatine", "nope"], remove: [] })).toEqual({ type: "set_supplements", add: ["creatine"], remove: [] });
    expect(actionFromTool("set_supplements", { add: [] })).toBeNull();
    expect(actionFromTool("log_water", { ml: 5 })).toBeNull();
    expect(actionFromTool("desconocida", {})).toBeNull();
  });
  it("describe las acciones en español", () => {
    expect(describeAction({ type: "set_training_time", weekday: 0, time: "18:30" })).toBe("Entrenar el lunes a las 6:30 p. m.");
    expect(describeAction({ type: "add_exercise", weekday: 2, exercise_id: "hip-thrust", sets: 3, rep_min: 8, rep_max: 12 }, (id) => catalog.find((c) => c.id === id)!.name))
      .toBe("Añadir Hip thrust con barra el miércoles (3 × 8-12)");
    expect(describeAction({ type: "set_supplements", add: ["creatine"], remove: ["caffeine"] })).toBe("Suplementos: Añadir creatina y quitar cafeína o pre-entreno");
  });
  it("recupera acciones guardadas y descarta las inválidas", () => {
    const stored = parseStoredActions([
      { id: "a1", action: { type: "log_water", ml: 500 }, label: "x", applied_at: null },
      { id: "a2", action: { type: "log_water", ml: 1 } },
      { nope: true },
    ]);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("a1");
  });
});

describe("intérprete de órdenes sin IA", () => {
  it("cambia la hora de un día o de todos", () => {
    expect(parseActionIntents("Cambia la hora del lunes a las 7:00", catalog, schedule)).toEqual([{ type: "set_training_time", weekday: 0, time: "07:00" }]);
    expect(parseActionIntents("quiero entrenar todos los días a las 6 pm", catalog, schedule)).toEqual([{ type: "set_training_time", weekday: "all", time: "18:00" }]);
    expect(parseActionIntents("Arréglame el horario del miércoles a las 5 de la tarde", catalog, schedule)).toEqual([{ type: "set_training_time", weekday: 2, time: "17:00" }]);
  });
  it("mueve rutinas por nombre o por día", () => {
    expect(parseActionIntents("Mueve glúteos al jueves", catalog, schedule)).toEqual([{ type: "move_routine", from_weekday: 0, to_weekday: 3 }]);
    expect(parseActionIntents("pasa la rutina del viernes al sábado", catalog, schedule)).toEqual([{ type: "move_routine", from_weekday: 4, to_weekday: 5 }]);
  });
  it("añade y quita ejercicios del catálogo", () => {
    expect(parseActionIntents("Agrega hip thrust con barra el lunes", catalog, schedule)).toEqual([{ type: "add_exercise", weekday: 0, exercise_id: "hip-thrust", sets: 3, rep_min: 10, rep_max: 12 }]);
    expect(parseActionIntents("Quita el remo con barra del miércoles", catalog, schedule)).toEqual([{ type: "remove_exercise", weekday: 2, exercise_id: "barbell-row" }]);
  });
  it("crea rutinas por grupo muscular y quita días", () => {
    expect(parseActionIntents("Crea una rutina de pierna y femoral el sábado", catalog, schedule)[0]).toMatchObject({ type: "create_routine", weekday: 5, focus: ["legs", "hamstrings"] });
    expect(parseActionIntents("Quita la rutina del viernes", catalog, schedule)).toEqual([{ type: "remove_routine", weekday: 4 }]);
  });
  it("suplementos, ritmo del día, comidas y agua", () => {
    expect(parseActionIntents("Agrega creatina y magnesio, y quita la cafeína", catalog)).toEqual([{ type: "set_supplements", add: ["creatine", "magnesium"], remove: ["caffeine"] }]);
    expect(parseActionIntents("Me despierto a las 6 y me duermo a las 11 pm", catalog)).toEqual([{ type: "set_day_rhythm", wake_time: "06:00", sleep_time: "23:00" }]);
    expect(parseActionIntents("Quiero 5 comidas al día", catalog)).toEqual([{ type: "set_nutrition_prefs", meals_per_day: 5, diet: null, allergens: null, dislikes: null }]);
    expect(parseActionIntents("Tomé 500 ml de agua", catalog)).toEqual([{ type: "log_water", ml: 500 }]);
  });
  it("no inventa acciones en preguntas normales", () => {
    expect(parseActionIntents("¿Qué entreno hoy?", catalog, schedule)).toEqual([]);
    expect(parseActionIntents("Me duele la rodilla al hacer sentadilla", catalog, schedule)).toEqual([]);
  });
});

describe("adjuntos de video", () => {
  it("reconoce videos y nombra sus fotogramas junto al archivo", () => {
    expect(isVideoPath("u/chat/1-ab.mp4")).toBe(true);
    expect(isVideoPath("u/chat/1-ab.MOV")).toBe(true);
    expect(isVideoPath("u/chat/1-ab.jpg")).toBe(false);
    expect(videoFramePath("u/chat/1-ab.mp4", 2)).toBe("u/chat/1-ab.f2.jpg");
  });
});
