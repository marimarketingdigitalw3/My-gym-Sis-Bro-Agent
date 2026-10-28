// Generador de planes semanales. Determinista: mismas entradas, mismo plan.
import { EXERCISES, EXERCISE_BY_ID } from "@/data/exercises";
import type { WorkoutDayMeta, WorkoutExerciseRow } from "@/types/db";
import type {
  Equipment, Exercise, FitnessLevel, GoalKey, JointArea, MovementPattern, TrainingEnvironment,
} from "@/types/domain";

export interface GeneratorInput {
  level: FitnessLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  goals: GoalKey[]; // ordenados por prioridad
  environment: TrainingEnvironment;
  equipment: Equipment[];
  limitations: JointArea[];
  dislikedExerciseIds?: string[];
  dislikedPatterns?: MovementPattern[];
  preferredDays?: number[];
  poorRecovery?: boolean; // poco sueño o estrés alto
  pregnancyStatus?: "none" | "pregnant" | "postpartum" | "prefer_not";
  painDuringExercise?: boolean;
}

export type PlannedExercise = Omit<WorkoutExerciseRow, "id" | "plan_id" | "user_id">;

export interface GeneratedDay {
  meta: WorkoutDayMeta;
  exercises: PlannedExercise[];
}

export interface GeneratedPlan {
  name: string;
  split: string;
  daysPerWeek: number;
  sessionMinutes: number;
  rationale: string[];
  days: GeneratedDay[];
}

type Role = "main" | "secondary" | "accessory" | "core" | "cardio" | "mobility";
interface Slot {
  role: Role;
  patterns: MovementPattern[];
  prefer?: "glutes" | "quads" | "hamstrings" | "back" | "chest" | "shoulders";
}
interface DayTemplate {
  title: string;
  focus: string;
  slots: Slot[];
}

const S = (role: Role, patterns: MovementPattern[], prefer?: Slot["prefer"]): Slot => ({ role, patterns, prefer });

const TEMPLATES: Record<string, DayTemplate> = {
  fullA: { title: "Cuerpo completo A", focus: "Sentadilla, empuje y tirón", slots: [
    S("main", ["squat"]), S("main", ["horizontal_push"]), S("main", ["horizontal_pull"]), S("secondary", ["hinge", "hip_extension"]),
    S("core", ["core_anti_extension"]), S("accessory", ["shoulder_isolation"]), S("accessory", ["calf"]),
  ] },
  fullB: { title: "Cuerpo completo B", focus: "Bisagra, empuje vertical y jalón", slots: [
    S("main", ["hinge"]), S("main", ["vertical_push"]), S("main", ["vertical_pull"]), S("secondary", ["lunge"]),
    S("core", ["core_rotation"]), S("accessory", ["elbow_flexion"]), S("accessory", ["elbow_extension"]),
  ] },
  fullC: { title: "Cuerpo completo C", focus: "Glúteos, pecho y espalda", slots: [
    S("main", ["hip_extension"], "glutes"), S("main", ["horizontal_push"]), S("main", ["horizontal_pull"]), S("secondary", ["squat", "lunge"]),
    S("core", ["core_anti_extension", "core_flexion"]), S("accessory", ["shoulder_isolation"]),
  ] },
  upper: { title: "Tren superior", focus: "Pecho, espalda, hombros y brazos", slots: [
    S("main", ["horizontal_push"]), S("main", ["horizontal_pull"]), S("secondary", ["vertical_push"]), S("secondary", ["vertical_pull"]),
    S("accessory", ["shoulder_isolation"]), S("accessory", ["elbow_flexion"]), S("accessory", ["elbow_extension"]),
  ] },
  upper2: { title: "Tren superior B", focus: "Espalda y hombros", slots: [
    S("main", ["vertical_pull"]), S("main", ["vertical_push"]), S("secondary", ["horizontal_pull"]), S("secondary", ["horizontal_push"]),
    S("accessory", ["shoulder_isolation"]), S("core", ["core_rotation"]), S("accessory", ["elbow_flexion", "elbow_extension"]),
  ] },
  lower: { title: "Tren inferior", focus: "Cuádriceps, glúteos y femorales", slots: [
    S("main", ["squat"], "quads"), S("main", ["hinge"], "hamstrings"), S("secondary", ["lunge"]), S("accessory", ["hip_extension"], "glutes"),
    S("core", ["core_anti_extension"]), S("accessory", ["calf"]),
  ] },
  lower2: { title: "Tren inferior B", focus: "Glúteos y cadena posterior", slots: [
    S("main", ["hip_extension"], "glutes"), S("main", ["hinge"], "hamstrings"), S("secondary", ["squat", "lunge"], "glutes"),
    S("accessory", ["hip_extension"], "glutes"), S("core", ["core_rotation", "core_flexion"]), S("accessory", ["calf"]),
  ] },
  glutes: { title: "Glúteos y piernas", focus: "Énfasis en glúteos", slots: [
    S("main", ["hip_extension"], "glutes"), S("main", ["squat", "lunge"], "glutes"), S("secondary", ["hinge"], "glutes"),
    S("accessory", ["lunge", "hip_extension"], "glutes"), S("accessory", ["hip_extension"], "glutes"), S("core", ["core_anti_extension"]),
  ] },
  legsQuads: { title: "Piernas", focus: "Cuádriceps y glúteos", slots: [
    S("main", ["squat"], "quads"), S("secondary", ["lunge"], "quads"), S("secondary", ["hinge"], "hamstrings"),
    S("accessory", ["squat", "lunge"], "quads"), S("accessory", ["calf"]), S("core", ["core_flexion", "core_rotation"]),
  ] },
  push: { title: "Empuje", focus: "Pecho, hombros y tríceps", slots: [
    S("main", ["horizontal_push"], "chest"), S("main", ["vertical_push"]), S("secondary", ["horizontal_push"], "chest"),
    S("accessory", ["shoulder_isolation"]), S("accessory", ["elbow_extension"]), S("core", ["core_anti_extension"]),
  ] },
  pull: { title: "Tirón", focus: "Espalda y bíceps", slots: [
    S("main", ["vertical_pull"]), S("main", ["horizontal_pull"]), S("secondary", ["horizontal_pull", "vertical_pull"], "back"),
    S("accessory", ["shoulder_isolation"], "shoulders"), S("accessory", ["elbow_flexion"]), S("core", ["core_rotation"]),
  ] },
  legs: { title: "Piernas", focus: "Tren inferior completo", slots: [
    S("main", ["squat"]), S("main", ["hinge"]), S("secondary", ["lunge"]), S("accessory", ["hip_extension"], "glutes"),
    S("accessory", ["calf"]), S("core", ["core_flexion"]),
  ] },
  cardio: { title: "Cardio y core", focus: "Resistencia cardiovascular", slots: [
    S("cardio", ["cardio"]), S("core", ["core_anti_extension"]), S("core", ["core_rotation"]), S("mobility", ["mobility"]),
  ] },
  mobility: { title: "Movilidad y recuperación", focus: "Rango de movimiento y descanso activo", slots: [
    S("cardio", ["cardio"]), S("mobility", ["mobility"]), S("mobility", ["mobility"]), S("mobility", ["mobility"]), S("mobility", ["mobility"]),
  ] },
};

const DEFAULT_DAYS: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};

const HYPERTROPHY: GoalKey[] = ["build_muscle", "glutes_legs", "upper_body", "recomposition"];

function chooseSplit(input: GeneratorInput): { split: string; days: string[]; why: string } {
  const days = Math.max(1, Math.min(input.daysPerWeek, 6));
  const goal = input.goals[0] ?? "general_health";
  const glutes = input.goals.includes("glutes_legs");
  const upperFocus = goal === "upper_body";
  const enduranceLike = goal === "endurance" || goal === "cardio_health";
  const mobilityGoal = goal === "mobility";
  const beginner = input.level === "beginner";

  if (mobilityGoal) {
    const base = ["mobility", "fullA", "mobility", "fullB", "mobility", "fullC"].slice(0, days);
    return { split: "mobility_strength", days: base, why: "Tu prioridad es la movilidad: alternamos sesiones de movilidad con fuerza de cuerpo completo." };
  }
  if (enduranceLike) {
    const base = ["fullA", "cardio", "fullB", "cardio", "fullC", "cardio"].slice(0, days);
    return { split: "strength_cardio", days: base, why: "Para tu resistencia combinamos cardio con fuerza de cuerpo completo, que protege tus articulaciones y mejora el rendimiento." };
  }
  if (days <= 2) return { split: "full_body", days: ["fullA", "fullB"].slice(0, days), why: "Con pocos días, el cuerpo completo trabaja cada músculo dos veces por semana." };
  if (days === 3) {
    if (glutes) return { split: "glutes_upper_legs", days: ["glutes", "upper", "lower2"], why: "Tres días con dos sesiones de piernas para priorizar glúteos sin descuidar el tren superior." };
    if (upperFocus && !beginner) return { split: "upper_lower_upper", days: ["upper", "lower", "upper2"], why: "Dos sesiones de tren superior para priorizarlo, más una de piernas." };
    if (!beginner && HYPERTROPHY.includes(goal)) return { split: "upper_lower_full", days: ["upper", "lower", "fullC"], why: "Torso, pierna y cuerpo completo: buena frecuencia por músculo en tres días." };
    return { split: "full_body", days: ["fullA", "fullB", "fullC"], why: "Tres sesiones de cuerpo completo: la base más eficaz para empezar y progresar." };
  }
  if (days === 4) {
    if (glutes) return { split: "upper_lower_glutes", days: ["glutes", "upper", "lower2", "upper2"], why: "Torso y pierna alternados, con las sesiones de pierna orientadas a glúteos." };
    return { split: "upper_lower", days: ["upper", "lower", "upper2", "lower2"], why: "Torso y pierna dos veces por semana: equilibrio entre volumen y recuperación." };
  }
  if (beginner) {
    const extra = days === 5 ? ["cardio"] : ["cardio", "mobility"];
    return { split: "upper_lower_plus", days: [...(glutes ? ["glutes", "upper", "lower2", "upper2"] : ["upper", "lower", "upper2", "lower2"]), ...extra],
      why: "Como estás empezando, limitamos la fuerza a 4 días y sumamos cardio o movilidad para que te recuperes bien." };
  }
  if (days === 5) {
    if (glutes) return { split: "glute_focus_5", days: ["glutes", "upper", "legsQuads", "upper2", "lower2"], why: "Cinco días con tres sesiones de pierna orientadas a glúteos." };
    return { split: "ul_ppl", days: ["upper", "lower", "push", "pull", "legs"], why: "Torso/pierna más empuje/tirón/pierna: alta frecuencia para hipertrofia." };
  }
  if (glutes) return { split: "glute_focus_6", days: ["glutes", "push", "pull", "legsQuads", "upper2", "lower2"], why: "Seis días con énfasis en glúteos y piernas." };
  return { split: "ppl", days: ["push", "pull", "legs", "push", "pull", "legs"], why: "Empuje, tirón y pierna dos veces por semana." };
}

interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
  rpe: number;
}

function prescribe(role: Role, goal: GoalKey, level: FitnessLevel): Prescription {
  const beginner = level === "beginner";
  const strengthGoal = goal === "strength";
  const hyper = HYPERTROPHY.includes(goal);
  const endurance = goal === "endurance" || goal === "cardio_health";
  let p: Prescription;
  if (role === "main") {
    p = strengthGoal ? { sets: 4, repMin: 4, repMax: 6, rest: 180, rpe: 8 }
      : hyper ? { sets: 4, repMin: 6, repMax: 10, rest: 120, rpe: 8 }
        : endurance ? { sets: 3, repMin: 12, repMax: 15, rest: 60, rpe: 7 }
          : { sets: 3, repMin: 8, repMax: 12, rest: 90, rpe: 7 };
  } else if (role === "secondary") {
    p = strengthGoal ? { sets: 3, repMin: 6, repMax: 8, rest: 120, rpe: 8 }
      : endurance ? { sets: 3, repMin: 12, repMax: 15, rest: 60, rpe: 7 }
        : { sets: 3, repMin: 8, repMax: 12, rest: 90, rpe: 8 };
  } else {
    p = endurance ? { sets: 2, repMin: 15, repMax: 20, rest: 45, rpe: 7 } : { sets: 3, repMin: 10, repMax: 15, rest: 60, rpe: 8 };
  }
  if (beginner) {
    p = { ...p, sets: Math.min(p.sets, 3), repMin: Math.max(p.repMin, 8), repMax: Math.max(p.repMax, 12), rpe: Math.min(p.rpe, 7) };
    if (role === "accessory") p.sets = 2;
  }
  if (level === "advanced" && (role === "main" || role === "secondary") && !endurance) p.sets += 1;
  return p;
}

function cardioMinutes(goal: GoalKey, role: "day" | "finisher"): number {
  if (role === "finisher") return goal === "lose_fat" ? 12 : 10;
  return goal === "endurance" ? 30 : goal === "cardio_health" ? 25 : 20;
}

const MAX_DIFFICULTY: Record<FitnessLevel, number> = { beginner: 2, intermediate: 3, advanced: 3 };
const IDEAL_DIFFICULTY: Record<FitnessLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const HIGH_IMPACT = new Set(["burpees", "jumping-jacks", "mountain-climbers", "jump-squat"]);

export function availableEquipment(input: Pick<GeneratorInput, "environment" | "equipment">): Set<Equipment> {
  const set = new Set<Equipment>(input.equipment);
  set.add("bodyweight");
  if (input.environment === "gym") {
    ["dumbbells", "barbell", "machines", "cables", "bench", "cardio_machine", "pullup_bar", "kettlebells"].forEach((e) => set.add(e as Equipment));
  }
  return set;
}

export interface SelectionContext {
  equipment: Set<Equipment>;
  limitations: Set<JointArea>;
  level: FitnessLevel;
  disliked: Set<string>;
  dislikedPatterns: Set<MovementPattern>;
  lowImpactOnly: boolean;
}

export function isAllowed(ex: Exercise, ctx: SelectionContext): boolean {
  if (!ex.equipment.every((e) => ctx.equipment.has(e))) return false;
  if (ctx.disliked.has(ex.id) || ctx.dislikedPatterns.has(ex.pattern)) return false;
  if (ex.difficulty > MAX_DIFFICULTY[ctx.level]) return false;
  if (ex.stressedJoints.some((j) => ctx.limitations.has(j))) return false;
  if (ctx.lowImpactOnly && (HIGH_IMPACT.has(ex.id) || ex.pattern === "core_flexion" || ex.difficulty === 3)) return false;
  return true;
}

function score(ex: Exercise, slot: Slot, ctx: SelectionContext, used: Map<string, number>, goal: GoalKey): number {
  let s = 0;
  s -= Math.abs(ex.difficulty - IDEAL_DIFFICULTY[ctx.level]) * 3;
  if ((slot.role === "main" || slot.role === "secondary") && ex.isCompound) s += 4;
  if (slot.role === "accessory" && !ex.isCompound) s += 2;
  if (slot.prefer && ex.primaryMuscles.includes(slot.prefer)) s += 5;
  if (goal === "strength" && ex.equipment.includes("barbell")) s += 3;
  if (goal === "glutes_legs" && ex.primaryMuscles.includes("glutes")) s += 2;
  if (slot.role === "main" && ex.unilateral) s -= 1;
  s -= (used.get(ex.id) ?? 0) * 6; // variedad entre días
  // Con equipo disponible, se prefiere cargar externamente (más fácil de progresar) frente al peso corporal.
  const wellEquipped = ctx.equipment.size >= 4;
  if (!ex.equipment.includes("bodyweight")) s += wellEquipped ? 4 : 1;
  return s;
}

function pickExercise(slot: Slot, ctx: SelectionContext, usedWeek: Map<string, number>, usedToday: Set<string>, goal: GoalKey): Exercise | null {
  const candidates = EXERCISES.filter((e) => slot.patterns.includes(e.pattern) && !usedToday.has(e.id) && isAllowed(e, ctx));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => score(b, slot, ctx, usedWeek, goal) - score(a, slot, ctx, usedWeek, goal) || a.id.localeCompare(b.id))[0];
}

function minutesFor(p: { sets: number; rest_s: number; duration_s: number | null }): number {
  const work = p.duration_s ?? 40;
  return (p.sets * (work + p.rest_s) + 60) / 60;
}

function buildWarmup(day: DayTemplate, ctx: SelectionContext): string[] {
  const mobility = EXERCISES.filter((e) => e.category === "mobility" && isAllowed(e, ctx)).slice(0, 2).map((e) => e.name);
  return [
    "5 minutos de cardio suave (caminar, bicicleta o marcha en el sitio)",
    ...mobility.map((m) => `${m}: 30 a 45 segundos`),
    day.slots.some((s) => s.role === "main") ? "1 o 2 series de aproximación ligeras del primer ejercicio" : "Movimientos articulares suaves de pies a cabeza",
  ];
}

function buildCooldown(ctx: SelectionContext): string[] {
  const stretches = EXERCISES.filter((e) => e.category === "mobility" && isAllowed(e, ctx)).slice(2, 5).map((e) => `${e.name}: 30 a 60 segundos`);
  return ["Camina 2 a 3 minutos hasta normalizar la respiración", ...stretches];
}

export function generatePlan(input: GeneratorInput): GeneratedPlan {
  const goal = input.goals[0] ?? "general_health";
  const lowImpactOnly = input.pregnancyStatus === "pregnant" || input.pregnancyStatus === "postpartum";
  const level: FitnessLevel = lowImpactOnly ? "beginner" : input.level;
  const ctx: SelectionContext = {
    equipment: availableEquipment(input),
    limitations: new Set(input.limitations),
    level,
    disliked: new Set(input.dislikedExerciseIds ?? []),
    dislikedPatterns: new Set(input.dislikedPatterns ?? []),
    lowImpactOnly,
  };
  const { split, days, why } = chooseSplit({ ...input, level });
  const weekdays = input.preferredDays && input.preferredDays.length === days.length
    ? [...input.preferredDays].sort((a, b) => a - b)
    : DEFAULT_DAYS[days.length];

  const rationale = [why];
  const sessionMinutes = Math.max(15, Math.min(input.sessionMinutes, 150));
  const budget = sessionMinutes - 10; // calentamiento y vuelta a la calma
  const usedWeek = new Map<string, number>();
  const skippedPatterns = new Set<string>();

  const builtDays: GeneratedDay[] = days.map((key, dayIndex) => {
    const template = TEMPLATES[key];
    const usedToday = new Set<string>();
    const exercises: PlannedExercise[] = [];
    let minutes = 0;

    for (const slot of template.slots) {
      const ex = pickExercise(slot, ctx, usedWeek, usedToday, goal);
      if (!ex) {
        skippedPatterns.add(slot.patterns.join("/"));
        continue;
      }
      const timed = ex.defaultUnit === "seconds";
      let planned: PlannedExercise;
      if (slot.role === "cardio" || ex.category === "cardio") {
        const mins = Math.min(cardioMinutes(goal, "day"), Math.max(10, budget - minutes - 10));
        planned = base(ex, dayIndex, exercises.length, { sets: 1, rest_s: 0, duration_s: mins * 60, rep_min: null, rep_max: null, target_rpe: 6,
          notes: "Ritmo en el que puedas hablar con frases cortas." });
      } else if (slot.role === "mobility" || ex.category === "mobility") {
        planned = base(ex, dayIndex, exercises.length, { sets: 2, rest_s: 15, duration_s: 45, rep_min: null, rep_max: null, target_rpe: null, notes: null });
      } else {
        const p = prescribe(slot.role, goal, level);
        const sets = input.poorRecovery ? Math.max(2, p.sets - 1) : p.sets;
        planned = base(ex, dayIndex, exercises.length, timed
          ? { sets, rest_s: 45, duration_s: level === "beginner" ? 20 : 30, rep_min: null, rep_max: null, target_rpe: p.rpe, notes: null }
          : { sets, rest_s: p.rest, duration_s: null, rep_min: p.repMin, rep_max: p.repMax, target_rpe: p.rpe,
            notes: slot.role === "main" ? "Empieza con un peso que te deje 2 o 3 repeticiones en reserva." : null });
      }
      const cost = minutesFor(planned);
      const essential = exercises.length < 3;
      if (!essential && minutes + cost > budget) continue;
      exercises.push(planned);
      minutes += cost;
      usedToday.add(ex.id);
      usedWeek.set(ex.id, (usedWeek.get(ex.id) ?? 0) + 1);
    }

    // Final de cardio si el objetivo es perder grasa y queda tiempo.
    if (goal === "lose_fat" && key !== "cardio" && key !== "mobility" && budget - minutes >= 12) {
      const finisher = EXERCISES.find((e) => e.category === "cardio" && isAllowed(e, ctx) && !usedToday.has(e.id));
      if (finisher) {
        const mins = cardioMinutes(goal, "finisher");
        exercises.push(base(finisher, dayIndex, exercises.length, { sets: 1, rest_s: 0, duration_s: mins * 60, rep_min: null, rep_max: null, target_rpe: 6,
          notes: "Cardio final opcional a ritmo moderado." }));
        minutes += mins;
      }
    }

    return {
      meta: {
        dayIndex,
        weekday: weekdays[dayIndex] ?? dayIndex,
        title: template.title,
        focus: template.focus,
        warmup: buildWarmup(template, ctx),
        cooldown: buildCooldown(ctx),
        estimatedMinutes: Math.round(minutes + 10),
      },
      exercises,
    };
  });

  if (input.poorRecovery) rationale.push("Tu sueño o tu nivel de estrés sugieren una recuperación limitada: reducimos una serie por ejercicio.");
  if (input.limitations.length) rationale.push("Evitamos ejercicios que cargan de forma notable las zonas que marcaste como limitadas.");
  if (lowImpactOnly) rationale.push("Por embarazo o posparto el plan usa ejercicios de bajo impacto y esfuerzo moderado. Confírmalo con tu equipo de salud.");
  if (input.painDuringExercise) rationale.push("Si un ejercicio te causa dolor, usa el botón Sustituir: te mostramos alternativas más amables.");
  if (level === "beginner") rationale.push("Prescribimos un esfuerzo moderado (te deben quedar 3 repeticiones en reserva) para aprender la técnica con seguridad.");
  if (goal === "lose_fat") rationale.push("Mantener la fuerza mientras pierdes grasa ayuda a conservar músculo; el cardio final es un complemento.");
  if (skippedPatterns.size) rationale.push("Con tu equipo o tus limitaciones no hay alternativas seguras para algunos movimientos, así que los omitimos.");

  return {
    name: `Plan ${input.daysPerWeek} días · ${GOAL_SHORT[goal]}`,
    split,
    daysPerWeek: days.length,
    sessionMinutes,
    rationale,
    days: builtDays,
  };
}

function base(ex: Exercise, dayIndex: number, position: number,
  p: Pick<PlannedExercise, "sets" | "rest_s" | "duration_s" | "rep_min" | "rep_max" | "target_rpe" | "notes">): PlannedExercise {
  return { day_index: dayIndex, position, exercise_id: ex.id, load_kg: null, ...p };
}

const GOAL_SHORT: Record<GoalKey, string> = {
  lose_fat: "Pérdida de grasa", build_muscle: "Hipertrofia", strength: "Fuerza", endurance: "Resistencia",
  cardio_health: "Salud cardiovascular", mobility: "Movilidad", recomposition: "Recomposición", glutes_legs: "Glúteos y piernas",
  upper_body: "Tren superior", general_health: "Salud general", maintain: "Mantenimiento",
};

/** Alternativas seguras para sustituir un ejercicio durante el plan o la sesión. */
export function substitutionOptions(exerciseId: string, ctx: SelectionContext, exclude: string[] = []): Exercise[] {
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return [];
  const listed = ex.alternatives.map((id) => EXERCISE_BY_ID[id]).filter(Boolean);
  const samePattern = EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== ex.id);
  // Si el patrón entero queda excluido (p. ej. rodilla limitada), se buscan ejercicios para los mismos músculos.
  const sameMuscles = EXERCISES.filter((e) => e.category === ex.category && e.primaryMuscles.some((m) => ex.primaryMuscles.includes(m)));
  const seen = new Set<string>([ex.id, ...exclude]);
  const out: Exercise[] = [];
  for (const e of [...listed, ...samePattern, ...sameMuscles]) {
    if (seen.has(e.id) || !isAllowed(e, ctx)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out.slice(0, 6);
}

export function selectionContextFor(input: Pick<GeneratorInput, "environment" | "equipment" | "limitations" | "level" | "dislikedExerciseIds" | "pregnancyStatus">): SelectionContext {
  return {
    equipment: availableEquipment(input),
    limitations: new Set(input.limitations),
    level: input.level === "beginner" ? "intermediate" : input.level, // para sustituir se permiten opciones algo más variadas
    disliked: new Set(input.dislikedExerciseIds ?? []),
    dislikedPatterns: new Set(),
    lowImpactOnly: input.pregnancyStatus === "pregnant" || input.pregnancyStatus === "postpartum",
  };
}
