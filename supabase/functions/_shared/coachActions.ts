// Acciones del Gym AI Coach: cambios que el agente propone en otras secciones de la app.
// La IA las devuelve como llamadas a herramientas; la app las muestra y la persona las confirma antes de aplicarlas.
// Compartido entre la Edge Function (Deno) y la app (Vite): sin dependencias externas ni alias "@/".

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lunes

export type CoachAction =
  | { type: "set_training_time"; weekday: Weekday | "all"; time: string }
  | { type: "move_routine"; from_weekday: Weekday; to_weekday: Weekday }
  | { type: "create_routine"; weekday: Weekday; title: string; focus: string[]; suggest: boolean }
  | { type: "remove_routine"; weekday: Weekday }
  | { type: "add_exercise"; weekday: Weekday; exercise_id: string; sets: number; rep_min: number | null; rep_max: number | null }
  | { type: "remove_exercise"; weekday: Weekday; exercise_id: string }
  | { type: "swap_exercise"; weekday: Weekday; exercise_id: string; replacement_id: string }
  | { type: "set_supplements"; add: string[]; remove: string[] }
  | { type: "set_day_rhythm"; wake_time: string | null; sleep_time: string | null }
  | { type: "set_nutrition_prefs"; meals_per_day: number | null; diet: string | null; allergens: string[] | null; dislikes: string[] | null }
  | { type: "regenerate_meal_plan" }
  | { type: "log_water"; ml: number }
  | { type: "log_supplement"; supplement: string; taken: boolean };

export type CoachActionType = CoachAction["type"];

/** Acción tal como se guarda con el mensaje: incluye etiqueta y estado. */
export interface StoredAction {
  id: string;
  action: CoachAction;
  label: string;
  applied_at: string | null;
}

export const MAX_ACTIONS_PER_REPLY = 6;
export const MAX_ATTACHMENTS = 3;

export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
export const FOCUS_KEYS = ["glutes", "legs", "hamstrings", "quads", "calves", "chest", "back", "shoulders", "arms", "core", "cardio"] as const;
export const FOCUS_LABELS: Record<string, string> = {
  glutes: "glúteos", legs: "pierna", hamstrings: "femoral", quads: "cuádriceps", calves: "pantorrillas", chest: "pecho",
  back: "espalda", shoulders: "hombros", arms: "brazos", core: "abdomen", cardio: "cardio",
};
export const SUPPLEMENT_KEYS = ["creatine", "whey", "caffeine", "electrolytes", "omega3", "vitamin_d", "multivitamin", "magnesium", "iron", "collagen", "casein"] as const;
export const SUPPLEMENT_LABELS: Record<string, string> = {
  creatine: "creatina", whey: "proteína en polvo", caffeine: "cafeína o pre-entreno", electrolytes: "electrolitos", omega3: "omega 3",
  vitamin_d: "vitamina D", multivitamin: "multivitamínico", magnesium: "magnesio", iron: "hierro", collagen: "colágeno", casein: "caseína",
};
const DIETS = ["omnivore", "vegetarian", "vegan", "pescatarian"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Herramientas para el proveedor de IA (JSON Schema) ----------
const weekdaySchema = { type: "integer", minimum: 0, maximum: 6, description: "Día de la semana: 0 lunes, 1 martes, 2 miércoles, 3 jueves, 4 viernes, 5 sábado, 6 domingo" };
const timeSchema = { type: "string", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$", description: "Hora en formato HH:MM de 24 horas" };

export const COACH_TOOLS = [
  {
    name: "set_training_time",
    description: "Cambia la hora de inicio de la rutina de un día (o de todos los días de entrenamiento).",
    input_schema: { type: "object", properties: { weekday: { oneOf: [weekdaySchema, { type: "string", enum: ["all"] }] }, time: timeSchema }, required: ["weekday", "time"] },
  },
  {
    name: "move_routine",
    description: "Mueve la rutina de un día a otro día de la semana. Si el destino ya tiene rutina, se intercambian.",
    input_schema: { type: "object", properties: { from_weekday: weekdaySchema, to_weekday: weekdaySchema }, required: ["from_weekday", "to_weekday"] },
  },
  {
    name: "create_routine",
    description: "Crea una rutina nueva en un día de descanso, con grupos musculares y ejercicios sugeridos compatibles con el equipo y las limitaciones de la persona.",
    input_schema: {
      type: "object",
      properties: {
        weekday: weekdaySchema,
        title: { type: "string", maxLength: 40 },
        focus: { type: "array", items: { type: "string", enum: [...FOCUS_KEYS] }, minItems: 1 },
        suggest: { type: "boolean", description: "true para añadir ejercicios sugeridos automáticamente" },
      },
      required: ["weekday", "focus"],
    },
  },
  {
    name: "remove_routine",
    description: "Quita la rutina de un día (queda como descanso).",
    input_schema: { type: "object", properties: { weekday: weekdaySchema }, required: ["weekday"] },
  },
  {
    name: "add_exercise",
    description: "Añade un ejercicio del catálogo a la rutina de un día. Usa solo ids del catálogo del contexto.",
    input_schema: {
      type: "object",
      properties: {
        weekday: weekdaySchema, exercise_id: { type: "string" },
        sets: { type: "integer", minimum: 1, maximum: 10 }, rep_min: { type: "integer", minimum: 1, maximum: 100 }, rep_max: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["weekday", "exercise_id"],
    },
  },
  {
    name: "remove_exercise",
    description: "Quita un ejercicio de la rutina de un día.",
    input_schema: { type: "object", properties: { weekday: weekdaySchema, exercise_id: { type: "string" } }, required: ["weekday", "exercise_id"] },
  },
  {
    name: "swap_exercise",
    description: "Sustituye un ejercicio de un día por otro del catálogo (por ejemplo, por una molestia o por falta de equipo).",
    input_schema: { type: "object", properties: { weekday: weekdaySchema, exercise_id: { type: "string" }, replacement_id: { type: "string" } }, required: ["weekday", "exercise_id", "replacement_id"] },
  },
  {
    name: "set_supplements",
    description: "Añade o quita suplementos de la lista de la persona (la app sugiere la hora de cada uno).",
    input_schema: {
      type: "object",
      properties: { add: { type: "array", items: { type: "string", enum: [...SUPPLEMENT_KEYS] } }, remove: { type: "array", items: { type: "string", enum: [...SUPPLEMENT_KEYS] } } },
    },
  },
  {
    name: "set_day_rhythm",
    description: "Cambia la hora de despertar o de dormir, que define la ventana de comidas y las horas de los suplementos.",
    input_schema: { type: "object", properties: { wake_time: timeSchema, sleep_time: timeSchema } },
  },
  {
    name: "set_nutrition_prefs",
    description: "Cambia preferencias de alimentación: comidas al día, tipo de dieta, alergias o alimentos que no le gustan.",
    input_schema: {
      type: "object",
      properties: {
        meals_per_day: { type: "integer", minimum: 2, maximum: 6 },
        diet: { type: "string", enum: DIETS },
        allergens: { type: "array", items: { type: "string", enum: ["gluten", "lactose", "nuts", "peanuts", "eggs", "soy", "fish", "shellfish"] } },
        dislikes: { type: "array", items: { type: "string", maxLength: 40 } },
      },
    },
  },
  {
    name: "regenerate_meal_plan",
    description: "Vuelve a generar el plan de comidas de esta semana con las preferencias actuales.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_water",
    description: "Registra agua bebida hoy (en mililitros).",
    input_schema: { type: "object", properties: { ml: { type: "integer", minimum: 50, maximum: 3000 } }, required: ["ml"] },
  },
  {
    name: "log_supplement",
    description: "Marca un suplemento como tomado (o no tomado) hoy.",
    input_schema: { type: "object", properties: { supplement: { type: "string", enum: [...SUPPLEMENT_KEYS] }, taken: { type: "boolean" } }, required: ["supplement"] },
  },
] as const;

// ---------- Validación de entradas de herramientas ----------
const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? Math.round(v) : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const weekday = (v: unknown): Weekday | null => int(v, 0, 6) as Weekday | null;
const time = (v: unknown): string | null => (typeof v === "string" && TIME_RE.test(v) ? v : null);
const strList = (v: unknown, allowed?: readonly string[]): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && (!allowed || allowed.includes(x))).slice(0, 10) : [];

/** Convierte una llamada a herramienta (nombre + input) en una acción válida, o null si no es válida. */
export function actionFromTool(name: string, input: unknown): CoachAction | null {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "set_training_time": {
      const t = time(i.time); const wd = i.weekday === "all" ? "all" : weekday(i.weekday);
      return t && wd !== null ? { type: "set_training_time", weekday: wd, time: t } : null;
    }
    case "move_routine": {
      const a = weekday(i.from_weekday); const b = weekday(i.to_weekday);
      return a !== null && b !== null && a !== b ? { type: "move_routine", from_weekday: a, to_weekday: b } : null;
    }
    case "create_routine": {
      const wd = weekday(i.weekday); const focus = strList(i.focus, FOCUS_KEYS);
      if (wd === null || !focus.length) return null;
      const title = typeof i.title === "string" && i.title.trim() ? i.title.trim().slice(0, 40) : focus.map((f) => FOCUS_LABELS[f]).join(" y ");
      return { type: "create_routine", weekday: wd, title: title.charAt(0).toUpperCase() + title.slice(1), focus, suggest: i.suggest !== false };
    }
    case "remove_routine": {
      const wd = weekday(i.weekday);
      return wd !== null ? { type: "remove_routine", weekday: wd } : null;
    }
    case "add_exercise": {
      const wd = weekday(i.weekday);
      if (wd === null || typeof i.exercise_id !== "string") return null;
      const sets = int(i.sets, 1, 10) ?? 3; const rmin = int(i.rep_min, 1, 100); const rmax = int(i.rep_max, 1, 100);
      return { type: "add_exercise", weekday: wd, exercise_id: i.exercise_id, sets, rep_min: rmin ?? (rmax ? rmax : 10), rep_max: rmax ?? (rmin ? rmin : 12) };
    }
    case "remove_exercise": {
      const wd = weekday(i.weekday);
      return wd !== null && typeof i.exercise_id === "string" ? { type: "remove_exercise", weekday: wd, exercise_id: i.exercise_id } : null;
    }
    case "swap_exercise": {
      const wd = weekday(i.weekday);
      return wd !== null && typeof i.exercise_id === "string" && typeof i.replacement_id === "string" && i.exercise_id !== i.replacement_id
        ? { type: "swap_exercise", weekday: wd, exercise_id: i.exercise_id, replacement_id: i.replacement_id } : null;
    }
    case "set_supplements": {
      const add = strList(i.add, SUPPLEMENT_KEYS); const remove = strList(i.remove, SUPPLEMENT_KEYS);
      return add.length || remove.length ? { type: "set_supplements", add, remove } : null;
    }
    case "set_day_rhythm": {
      const w = time(i.wake_time); const s = time(i.sleep_time);
      return w || s ? { type: "set_day_rhythm", wake_time: w, sleep_time: s } : null;
    }
    case "set_nutrition_prefs": {
      const meals = int(i.meals_per_day, 2, 6); const diet = typeof i.diet === "string" && DIETS.includes(i.diet) ? i.diet : null;
      const allergens = Array.isArray(i.allergens) ? strList(i.allergens) : null; const dislikes = Array.isArray(i.dislikes) ? strList(i.dislikes) : null;
      return meals || diet || allergens || dislikes ? { type: "set_nutrition_prefs", meals_per_day: meals, diet, allergens, dislikes } : null;
    }
    case "regenerate_meal_plan":
      return { type: "regenerate_meal_plan" };
    case "log_water": {
      const ml = int(i.ml, 50, 3000);
      return ml ? { type: "log_water", ml } : null;
    }
    case "log_supplement":
      return typeof i.supplement === "string" && SUPPLEMENT_KEYS.includes(i.supplement as (typeof SUPPLEMENT_KEYS)[number])
        ? { type: "log_supplement", supplement: i.supplement, taken: i.taken !== false } : null;
    default:
      return null;
  }
}

/** Valida acciones guardadas (por ejemplo, leídas de la base de datos). */
export function parseStoredActions(raw: unknown): StoredAction[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredAction[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const a = x.action && typeof x.action === "object" ? (x.action as Record<string, unknown>) : null;
    if (!a || typeof a.type !== "string" || typeof x.id !== "string") continue;
    const action = actionFromTool(a.type, a);
    if (!action) continue;
    out.push({ id: x.id, action, label: typeof x.label === "string" ? x.label : describeAction(action), applied_at: typeof x.applied_at === "string" ? x.applied_at : null });
  }
  return out.slice(0, MAX_ACTIONS_PER_REPLY);
}

// ---------- Etiquetas en español ----------
export function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

export function describeAction(a: CoachAction, exerciseName: (id: string) => string = (id) => id): string {
  const day = (w: Weekday) => `el ${WEEKDAY_NAMES[w]}`;
  switch (a.type) {
    case "set_training_time": return a.weekday === "all" ? `Entrenar todos los días a las ${formatTime12(a.time)}` : `Entrenar ${day(a.weekday)} a las ${formatTime12(a.time)}`;
    case "move_routine": return `Mover la rutina del ${WEEKDAY_NAMES[a.from_weekday]} al ${WEEKDAY_NAMES[a.to_weekday]}`;
    case "create_routine": return `Crear la rutina "${a.title}" ${day(a.weekday)}${a.suggest ? " con ejercicios sugeridos" : ""}`;
    case "remove_routine": return `Quitar la rutina ${day(a.weekday)} (queda como descanso)`;
    case "add_exercise": return `Añadir ${exerciseName(a.exercise_id)} ${day(a.weekday)} (${a.sets} × ${a.rep_min === a.rep_max ? a.rep_min : `${a.rep_min}-${a.rep_max}`})`;
    case "remove_exercise": return `Quitar ${exerciseName(a.exercise_id)} ${day(a.weekday)}`;
    case "swap_exercise": return `Cambiar ${exerciseName(a.exercise_id)} por ${exerciseName(a.replacement_id)} ${day(a.weekday)}`;
    case "set_supplements": {
      const parts = [];
      if (a.add.length) parts.push(`añadir ${a.add.map((k) => SUPPLEMENT_LABELS[k] ?? k).join(", ")}`);
      if (a.remove.length) parts.push(`quitar ${a.remove.map((k) => SUPPLEMENT_LABELS[k] ?? k).join(", ")}`);
      const s = parts.join(" y "); return `Suplementos: ${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    }
    case "set_day_rhythm": {
      const parts = [];
      if (a.wake_time) parts.push(`despertar a las ${formatTime12(a.wake_time)}`);
      if (a.sleep_time) parts.push(`dormir a las ${formatTime12(a.sleep_time)}`);
      const s = parts.join(" y "); return `Ritmo del día: ${s}`;
    }
    case "set_nutrition_prefs": {
      const parts = [];
      if (a.meals_per_day) parts.push(`${a.meals_per_day} comidas al día`);
      if (a.diet) parts.push(`dieta ${{ omnivore: "omnívora", vegetarian: "vegetariana", vegan: "vegana", pescatarian: "pescetariana" }[a.diet] ?? a.diet}`);
      if (a.allergens) parts.push(`alergias: ${a.allergens.join(", ") || "ninguna"}`);
      if (a.dislikes) parts.push(`evitar: ${a.dislikes.join(", ") || "nada"}`);
      return `Alimentación: ${parts.join(" · ")}`;
    }
    case "regenerate_meal_plan": return "Regenerar el plan de comidas de esta semana";
    case "log_water": return `Registrar ${a.ml} ml de agua hoy`;
    case "log_supplement": return `${a.taken ? "Marcar" : "Desmarcar"} ${SUPPLEMENT_LABELS[a.supplement] ?? a.supplement} como tomado hoy`;
  }
}

/** Sección de la app donde se ve el cambio. */
export function actionSection(a: CoachAction): "/workouts" | "/nutrition" {
  return ["set_supplements", "set_day_rhythm", "set_nutrition_prefs", "regenerate_meal_plan", "log_water", "log_supplement"].includes(a.type) ? "/nutrition" : "/workouts";
}

// ---------- Intérprete de órdenes sin IA (modo demo y respaldo) ----------
export interface CatalogItem { id: string; name: string }
export interface ScheduleItem { weekday: Weekday; title: string }

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const DAY_RE = "(lunes|martes|miercoles|jueves|viernes|sabado|domingo)";
const dayIndex = (s: string): Weekday => WEEKDAY_NAMES.findIndex((d) => strip(d) === strip(s)) as Weekday;

function parseTime(raw: string): string | null {
  const m = strip(raw).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la manana|de la tarde|de la noche)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0;
  const suf = m[3] ? strip(m[3]).replace(/[.\s]/g, "") : "";
  if (/^p|tarde|noche/.test(suf) && h < 12) h += 12;
  if (/^a|manana/.test(suf) && h === 12) h = 0;
  if (!suf && h >= 1 && h <= 5) h += 12; // "a las 5" se entiende como la tarde
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function findCatalog(text: string, catalog: CatalogItem[]): CatalogItem | null {
  const t = strip(text);
  let best: CatalogItem | null = null; let bestLen = 0;
  for (const c of catalog) {
    const n = strip(c.name);
    if (n.length > bestLen && t.includes(n)) { best = c; bestLen = n.length; }
  }
  return best;
}

/**
 * Reconoce órdenes frecuentes en español y las convierte en acciones. Devuelve [] si no hay ninguna.
 * Se usa cuando no hay proveedor de IA; con IA, las herramientas cubren muchos más casos.
 */
export function parseActionIntents(message: string, catalog: CatalogItem[], schedule: ScheduleItem[] = []): CoachAction[] {
  const text = strip(message);
  const out: CoachAction[] = [];
  const push = (a: CoachAction | null) => { if (a && out.length < MAX_ACTIONS_PER_REPLY) out.push(a); };

  // Hora de entreno: "cambia la hora del lunes a las 7", "entrenar a las 6 pm todos los días"
  const TIME = "(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.?\\s*m\\.?|p\\.?\\s*m\\.?|de la manana|de la tarde|de la noche)?)";
  const timeM = text.match(new RegExp(`(?:hora|horario|entren\\w*|rutina)[^.]*?a las?\\s+${TIME}`));
  if (timeM) {
    const t = parseTime(timeM[1]);
    const dayM = text.match(new RegExp(`\\b(?:del?|los|el)\\s+${DAY_RE}`));
    const all = /todos los dias|toda la semana|cada dia/.test(text);
    if (t) push({ type: "set_training_time", weekday: all || !dayM ? "all" : dayIndex(dayM[1]), time: t });
  }

  // Mover rutina: "mueve glúteos al lunes", "pasa la rutina del martes al jueves"
  const moveM = text.match(new RegExp(`(?:mueve|mover|pasa|pasar|cambia|cambiar|pon|poner)\\s+(?:la\\s+)?(?:rutina\\s+)?(?:de\\s+|del\\s+)?(.+?)\\s+(?:al|para el|el)\\s+${DAY_RE}`));
  if (moveM && !timeM) {
    const what = moveM[1].trim(); const to = dayIndex(moveM[2]);
    const fromDay = what.match(new RegExp(DAY_RE));
    let from: Weekday | null = fromDay ? dayIndex(fromDay[1]) : null;
    if (from === null) {
      const hit = schedule.find((s) => strip(s.title).includes(what) || what.includes(strip(s.title)) || strip(s.title).split(/\W+/).some((w) => w.length > 3 && what.includes(w)));
      from = hit ? hit.weekday : null;
    }
    if (from !== null && from !== to) push({ type: "move_routine", from_weekday: from, to_weekday: to });
  }

  // Añadir o quitar ejercicio: "agrega hip thrust el lunes", "quita el remo con barra del jueves"
  const addM = text.match(new RegExp(`(?:agrega|agregar|anade|anadir|añade|añadir|mete|incluye|suma)\\s+(.+?)\\s+(?:el|al|los|para el)\\s+${DAY_RE}`));
  if (addM) {
    const ex = findCatalog(addM[1], catalog);
    if (ex) push({ type: "add_exercise", weekday: dayIndex(addM[2]), exercise_id: ex.id, sets: 3, rep_min: 10, rep_max: 12 });
  }
  // Quitar un día completo: "quita la rutina del sábado"; si no, quitar un ejercicio.
  const remDayM = text.match(new RegExp(`(?:quita|quitar|elimina|eliminar|borra|borrar)\\s+(?:la\\s+)?(?:rutina|entreno|entrenamiento)\\s+(?:del?\\s+)?${DAY_RE}`));
  const remM = remDayM ? null : text.match(new RegExp(`(?:quita|quitar|elimina|eliminar|saca|sacar|borra|borrar)\\s+(.+?)\\s+(?:del|el|de el|los)\\s+${DAY_RE}`));
  if (remDayM) push({ type: "remove_routine", weekday: dayIndex(remDayM[1]) });
  if (remM) {
    const ex = findCatalog(remM[1], catalog);
    if (ex) push({ type: "remove_exercise", weekday: dayIndex(remM[2]), exercise_id: ex.id });
  }

  // Crear rutina: "crea una rutina de glúteos el sábado", "agrega pierna el viernes"
  const createM = text.match(new RegExp(`(?:crea|crear|agrega|agregar|anade|añade|pon|poner|programa|programar)\\s+(?:una\\s+|un\\s+)?(?:rutina|entreno|entrenamiento|dia)?\\s*(?:de\\s+)?(.+?)\\s+(?:el|para el|los)\\s+${DAY_RE}`));
  if (createM && !addM) {
    const focus = FOCUS_KEYS.filter((k) => strip(createM[1]).includes(strip(FOCUS_LABELS[k])) || (k === "legs" && /piernas?/.test(createM[1])));
    if (focus.length) {
      const title = focus.map((f) => FOCUS_LABELS[f]).join(" y ");
      push({ type: "create_routine", weekday: dayIndex(createM[2]), title: title.charAt(0).toUpperCase() + title.slice(1), focus: [...focus], suggest: true });
    }
  }

  // Suplementos: "agrega creatina", "quita la cafeína"
  // El alcance de cada verbo termina donde empieza el verbo contrario ("agrega creatina y quita la cafeína").
  const supWord = (k: string) => strip(SUPPLEMENT_LABELS[k]).split(" ")[0];
  const supAdd = SUPPLEMENT_KEYS.filter((k) => new RegExp(`(?:agrega|agregar|anade|añade|toma|tomar|empieza|incluye|suma)(?:(?!quita|elimina|deja|saca|borra)[^.])*?\\b${supWord(k)}`).test(text));
  const supRem = SUPPLEMENT_KEYS.filter((k) => new RegExp(`(?:quita|quitar|elimina|deja|dejar|saca|borra)(?:(?!agrega|anade|añade|toma|incluye|suma)[^.])*?\\b${supWord(k)}`).test(text));
  if (supAdd.length || supRem.length) push({ type: "set_supplements", add: [...supAdd], remove: [...supRem] });

  // Ritmo del día: "me despierto a las 6", "me duermo a las 11 pm"
  const wakeM = text.match(/(?:despierto|levanto|despertar|levantar)[^.]*?a las?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la manana|de la tarde|de la noche)?)/);
  const sleepM = text.match(/(?:duermo|acuesto|dormir|acostar)[^.]*?a las?\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la manana|de la tarde|de la noche)?)/);
  if (wakeM || sleepM) {
    let w = wakeM ? parseTime(wakeM[1]) : null; let s = sleepM ? parseTime(sleepM[1]) : null;
    if (w && parseInt(w, 10) >= 12 && parseInt(w, 10) <= 17) w = `${String(parseInt(w, 10) - 12).padStart(2, "0")}${w.slice(2)}`; // "me levanto a las 5" = 5 a. m.
    if (s && parseInt(s, 10) >= 1 && parseInt(s, 10) <= 4) s = `${String(parseInt(s, 10) + 20).padStart(2, "0")}${s.slice(2)}`; // "me duermo a las 11"→ 23:00 ya cubierto; 1-4 → 21-24 no; mantener
    if (w || s) push({ type: "set_day_rhythm", wake_time: w, sleep_time: s });
  }

  // Comidas al día: "quiero 5 comidas al día"
  const mealsM = text.match(/(\d)\s+comidas/);
  if (mealsM) {
    const n = parseInt(mealsM[1], 10);
    if (n >= 2 && n <= 6) push({ type: "set_nutrition_prefs", meals_per_day: n, diet: null, allergens: null, dislikes: null });
  }
  if (/(regenera|rehaz|rehacer|vuelve a (generar|hacer)|cambia)[^.]*?(plan de comidas|menu|comidas de la semana)/.test(text)) push({ type: "regenerate_meal_plan" });

  // Agua: "tomé 500 ml de agua"
  const waterM = text.match(/(\d{2,4})\s*ml\s+(?:de\s+)?agua|(\d(?:[.,]\d)?)\s*(?:litros?|l)\s+(?:de\s+)?agua/);
  if (waterM) {
    const ml = waterM[1] ? parseInt(waterM[1], 10) : Math.round(parseFloat(waterM[2].replace(",", ".")) * 1000);
    if (ml >= 50 && ml <= 3000) push({ type: "log_water", ml });
  }

  return out;
}
