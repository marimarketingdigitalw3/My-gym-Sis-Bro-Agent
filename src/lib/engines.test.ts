import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_BY_ID } from "@/data/exercises";
import { RECIPES, RECIPE_BY_ID } from "@/data/recipes";
import { addDays, ageFromBirthDate, diffDays, startOfWeek, weekdayIndex } from "./dates";
import { estimateNutrition, mifflinStJeor } from "./nutrition";
import { cycleTrainingSuggestion, estimateCycle } from "./cycle";
import { classifyBodyType } from "./bodyType";
import { computeStreak } from "./consistency";
import { trainingClearance } from "./clearance";
import { generatePlan, isAllowed, selectionContextFor, substitutionOptions, type GeneratorInput } from "./workouts/generator";
import { estimatedOneRepMax, personalRecords, progressionAdvice } from "./workouts/progression";
import { dayMacros, generateMealPlan, groceryList, isRecipeSafe, substituteMeal, MEAL_SPLITS } from "./meals";
import { detectRedFlags, isUrgent } from "../../supabase/functions/_shared/safety.ts";
import type { CycleSettingsRow } from "@/types/db";

const allPlanExercises = (plan: ReturnType<typeof generatePlan>) => plan.days.flatMap((d) => d.exercises.map((e) => EXERCISE_BY_ID[e.exercise_id]));

describe("datos", () => {
  it("los ids de ejercicios y recetas son únicos y las alternativas existen", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const e of EXERCISES) for (const a of e.alternatives) expect(EXERCISE_BY_ID[a], `${e.id} → ${a}`).toBeDefined();
  });
  it("las macros de cada receta cuadran con sus calorías (±8 %)", () => {
    for (const r of RECIPES) {
      const calc = r.proteinG * 4 + r.carbsG * 4 + r.fatG * 9;
      expect(Math.abs(calc - r.kcal) / r.kcal, r.id).toBeLessThanOrEqual(0.08);
    }
  });
});

describe("fechas", () => {
  it("calcula días, semanas y edad", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(diffDays("2026-02-27", "2026-03-01")).toBe(2);
    expect(weekdayIndex("2026-10-26")).toBe(0); // lunes
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(ageFromBirthDate("2000-10-29", "2026-10-28")).toBe(25);
    expect(ageFromBirthDate("2000-10-28", "2026-10-28")).toBe(26);
  });
});

describe("nutrición (casos de referencia)", () => {
  it("Mifflin-St Jeor coincide con valores calculados a mano", () => {
    // Mujer 30 años, 165 cm, 60 kg: 600 + 1031,25 − 150 − 161 = 1320,25
    expect(mifflinStJeor(60, 165, 30, "female")).toBeCloseTo(1320.25, 2);
    // Hombre 25 años, 180 cm, 80 kg: 800 + 1125 − 125 + 5 = 1805
    expect(mifflinStJeor(80, 180, 25, "male")).toBeCloseTo(1805, 2);
    // Sin sexo declarado: punto medio (−78)
    expect(mifflinStJeor(70, 170, 40, null)).toBeCloseTo(700 + 1062.5 - 200 - 78, 2);
  });

  it("pérdida de grasa: déficit del 15 % y macros coherentes", () => {
    const r = estimateNutrition({ age: 30, sex: "female", heightCm: 165, weightKg: 70, goal: "lose_fat", lifestyle: { activityLevel: "moderate" } });
    const tdee = (700 + 1031.25 - 150 - 161) * 1.55;
    expect(r.mode).toBe("standard");
    expect(r.tdee).toBe(Math.round(tdee));
    expect(r.targets!.kcal).toBe(Math.round((tdee * 0.85) / 10) * 10);
    expect(r.targets!.proteinG).toBe(140);
    const kcalFromMacros = r.targets!.proteinG * 4 + r.targets!.carbsG * 4 + r.targets!.fatG * 9;
    expect(Math.abs(kcalFromMacros - r.targets!.kcal)).toBeLessThanOrEqual(10);
  });

  it("nunca baja del mínimo seguro", () => {
    const r = estimateNutrition({ age: 60, sex: "female", heightCm: 150, weightKg: 50, goal: "lose_fat", lifestyle: { activityLevel: "sedentary" } });
    expect(r.targets!.kcal).toBeGreaterThanOrEqual(1200);
    expect(r.targets!.kcal).toBeGreaterThanOrEqual(r.bmr!);
  });

  it("menores de edad: sin déficit", () => {
    const r = estimateNutrition({ age: 16, sex: "male", heightCm: 175, weightKg: 80, goal: "lose_fat" });
    expect(r.mode).toBe("maintenance_only");
    expect(r.targets!.kcal).toBe(Math.round(r.tdee! / 10) * 10);
  });

  it("antecedentes de TCA: sin cifras ni déficit", () => {
    const r = estimateNutrition({ age: 28, sex: "female", heightCm: 160, weightKg: 65, goal: "lose_fat", edHistory: true });
    expect(r.mode).toBe("no_numbers");
    expect(r.targets!.kcal).toBe(Math.round(r.tdee! / 10) * 10);
  });

  it("IMC bajo con objetivo de perder grasa: sin déficit", () => {
    const r = estimateNutrition({ age: 25, sex: "female", heightCm: 170, weightKg: 50, goal: "lose_fat" });
    expect(r.mode).toBe("maintenance_only");
  });

  it("datos incompletos: no inventa cifras", () => {
    const r = estimateNutrition({ age: null, sex: null, heightCm: 170, weightKg: null, goal: "maintain" });
    expect(r.targets).toBeNull();
  });
});

const baseInput: GeneratorInput = {
  level: "beginner", daysPerWeek: 3, sessionMinutes: 45, goals: ["general_health"],
  environment: "home_none", equipment: [], limitations: [],
};

describe("generador de entrenamientos (perfiles)", () => {
  it("principiante en casa sin equipo: solo ejercicios con peso corporal", () => {
    const plan = generatePlan(baseInput);
    expect(plan.days).toHaveLength(3);
    expect(plan.split).toBe("full_body");
    for (const ex of allPlanExercises(plan)) {
      expect(ex.equipment.every((e) => e === "bodyweight"), ex.id).toBe(true);
      expect(ex.difficulty).toBeLessThanOrEqual(2);
    }
    plan.days.forEach((d) => expect(d.exercises.length).toBeGreaterThanOrEqual(3));
  });

  it("intermedio en gimnasio con objetivo de hipertrofia: torso/pierna y rangos de hipertrofia", () => {
    const plan = generatePlan({ ...baseInput, level: "intermediate", daysPerWeek: 4, sessionMinutes: 70, goals: ["build_muscle"], environment: "gym" });
    expect(plan.split).toBe("upper_lower");
    const main = plan.days[0].exercises[0];
    expect(main.rep_min).toBe(6);
    expect(main.rep_max).toBe(10);
    expect(main.sets).toBe(4);
    expect(plan.days.every((d) => d.meta.estimatedMinutes <= 75)).toBe(true);
  });

  it("pérdida de grasa: incluye cardio final cuando hay tiempo", () => {
    const plan = generatePlan({ ...baseInput, level: "intermediate", goals: ["lose_fat"], environment: "gym", sessionMinutes: 75 });
    expect(plan.days.some((d) => d.exercises.some((e) => EXERCISE_BY_ID[e.exercise_id].category === "cardio"))).toBe(true);
  });

  it("limitación de rodilla: ningún ejercicio carga la rodilla", () => {
    const plan = generatePlan({ ...baseInput, level: "intermediate", environment: "gym", limitations: ["knee"], goals: ["glutes_legs"] });
    for (const ex of allPlanExercises(plan)) expect(ex.stressedJoints, ex.id).not.toContain("knee");
    expect(plan.rationale.join(" ")).toMatch(/zonas que marcaste/);
  });

  it("respeta el tiempo disponible", () => {
    const short = generatePlan({ ...baseInput, environment: "gym", sessionMinutes: 25 });
    const long = generatePlan({ ...baseInput, environment: "gym", sessionMinutes: 90 });
    expect(short.days[0].exercises.length).toBeLessThan(long.days[0].exercises.length);
  });

  it("embarazo: sin alto impacto ni dificultad máxima", () => {
    const plan = generatePlan({ ...baseInput, level: "advanced", environment: "gym", pregnancyStatus: "pregnant" });
    for (const ex of allPlanExercises(plan)) {
      expect(ex.difficulty).toBeLessThan(3);
      expect(["burpees", "jumping-jacks", "mountain-climbers"]).not.toContain(ex.id);
    }
  });

  it("es determinista y usa los días preferidos", () => {
    const input = { ...baseInput, preferredDays: [1, 3, 5] };
    expect(generatePlan(input)).toEqual(generatePlan(input));
    expect(generatePlan(input).days.map((d) => d.meta.weekday)).toEqual([1, 3, 5]);
  });

  it("sustituciones respetan equipo y limitaciones", () => {
    const ctx = selectionContextFor({ environment: "home_none", equipment: ["dumbbells"], limitations: ["knee"], level: "beginner" });
    const opts = substitutionOptions("barbell-back-squat", ctx);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(isAllowed(o, ctx)).toBe(true);
  });
});

describe("progresión", () => {
  const rx = { rep_min: 8, rep_max: 12, load_kg: null };
  const set = (reps: number, weight = 20, rpe: number | null = 8, pain = false) => ({ reps, weight_kg: weight, rpe, completed: true, pain });

  it("sube la carga si completó el rango alto", () => {
    expect(progressionAdvice(rx, [set(12), set(12), set(12)], 2).action).toBe("increase_load");
    expect(progressionAdvice(rx, [set(12), set(12), set(12)], 2).suggestedLoadKg).toBe(22);
  });
  it("sube repeticiones dentro del rango", () => {
    const a = progressionAdvice(rx, [set(10), set(9), set(9)], 2);
    expect(a.action).toBe("increase_reps");
    expect(a.targetReps).toBe(11);
  });
  it("no progresa con dolor, mala técnica o mala recuperación", () => {
    expect(progressionAdvice(rx, [set(12, 20, 7, true)], 2).action).toBe("substitute");
    expect(progressionAdvice(rx, [set(12), set(12)], 2, { poorTechnique: true }).action).toBe("repeat");
    expect(progressionAdvice(rx, [set(12), set(12)], 2, { energy: 1 }).action).toBe("repeat");
  });
  it("reduce si falló varias series", () => {
    expect(progressionAdvice(rx, [set(5), set(6), set(4)], 2).action).toBe("reduce");
  });
  it("calcula récords personales", () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    const prs = personalRecords([
      { exercise_id: "push-up", weight_kg: 0, reps: 15, completed: true, created_at: "2026-10-01T10:00:00Z" },
      { exercise_id: "goblet-squat", weight_kg: 20, reps: 10, completed: true, created_at: "2026-10-01T10:00:00Z" },
      { exercise_id: "goblet-squat", weight_kg: 24, reps: 8, completed: true, created_at: "2026-10-08T10:00:00Z" },
    ]);
    expect(prs.find((p) => p.exerciseId === "goblet-squat")!.bestWeightKg).toBe(24);
    expect(prs.find((p) => p.exerciseId === "push-up")!.bestReps).toBe(15);
  });
});

const cycleSettings = (over: Partial<CycleSettingsRow> = {}): CycleSettingsRow => ({
  user_id: "u", last_period_start: "2026-10-01", typical_cycle_length: 30, typical_period_length: 5, regularity: "regular",
  hormonal_contraception: false, wants_phase_estimates: true, period_training_preference: null, updated_at: "", ...over,
});

describe("ciclo", () => {
  it("usa la duración típica declarada (no asume 28 días)", () => {
    const e = estimateCycle(cycleSettings(), [], "2026-10-10");
    expect(e.cycleLength).toBe(30);
    expect(e.currentDay).toBe(10);
    expect(e.nextPeriodStart).toBe("2026-10-31");
    expect(e.phase).toBe("follicular");
  });
  it("aprende de los registros y marca ciclos irregulares con baja confianza", () => {
    const logs = ["2026-06-01", "2026-07-06", "2026-07-30", "2026-09-08"].map((d) => ({ logged_on: d, period_start: true }));
    const e = estimateCycle(cycleSettings({ last_period_start: null, regularity: "unknown" }), logs, "2026-09-20");
    expect(e.lengthSource).toBe("logged");
    expect(e.confidence).toBe("low");
    expect(e.variability).toBeGreaterThanOrEqual(7);
    expect(e.nextPeriodWindow).not.toBeNull();
  });
  it("con anticoncepción hormonal no estima fases", () => {
    const e = estimateCycle(cycleSettings({ hormonal_contraception: true }), [], "2026-10-12");
    expect(e.phase).toBeNull();
    expect(e.confidence).toBe("none");
  });
  it("sin fecha de periodo no inventa datos", () => {
    const e = estimateCycle(cycleSettings({ last_period_start: null }), [], "2026-10-12");
    expect(e.hasData).toBe(false);
    expect(e.phase).toBeNull();
  });
  it("los síntomas mandan sobre el calendario y nunca obliga a reducir", () => {
    const s = cycleTrainingSuggestion({ phase: "follicular", confidence: "medium" }, { symptoms: ["cramps"], energy: 2 });
    expect(s.offerLighterSession).toBe(true);
    expect(s.explanation).toMatch(/cólicos/);
    expect(s.explanation).toMatch(/también puedes seguir tu plan/i);
    const m = cycleTrainingSuggestion({ phase: "menstrual", confidence: "medium" }, { symptoms: [], energy: 4 });
    expect(m.offerLighterSession).toBe(false);
  });
});

describe("seguridad", () => {
  it("detecta señales de alarma en español e inglés", () => {
    expect(detectRedFlags("Me dio dolor en el pecho corriendo")).toContain("chest_pain");
    expect(detectRedFlags("I almost fainted after squats")).toContain("fainting");
    expect(detectRedFlags("¿Qué como después de entrenar?")).toEqual([]);
    expect(isUrgent(["chest_pain"])).toBe(true);
    expect(isUrgent(["sudden_severe_pain"])).toBe(false);
  });
  it("bloquea el entrenamiento ante síntomas cardiovasculares", () => {
    expect(trainingClearance({ redFlags: ["fainting"] }).status).toBe("blocked");
    expect(trainingClearance({}, { red_flags: ["chest_pain"] }).status).toBe("blocked");
    expect(trainingClearance({ pregnancyStatus: "pregnant" }).status).toBe("modified");
    expect(trainingClearance({}).status).toBe("ok");
  });
});

describe("plan de comidas", () => {
  const prefs = {
    diet: "vegan" as const, allergens: ["soy" as const, "gluten" as const], dislikes: ["champiñón"], budget: "low" as const,
    cooking_minutes: 30, cuisines: ["colombian" as const], meals_per_day: 4, wants_meal_prep: false,
  };
  const targets = { kcal: 2000, kcalMin: 1900, kcalMax: 2100, proteinG: 120, carbsG: 230, fatG: 65, waterMl: 2400 };

  it("respeta dieta, alergias y rechazos en toda la semana", () => {
    const days = generateMealPlan({ weekStart: "2026-10-26", prefs, targets });
    expect(days).toHaveLength(7);
    for (const d of days) {
      expect(d.meals.length).toBeGreaterThan(0);
      for (const m of d.meals) expect(isRecipeSafe(RECIPE_BY_ID[m.recipeId], prefs), m.recipeId).toBe(true);
    }
  });

  it("no repite receta dentro del mismo día", () => {
    const omni = { ...prefs, diet: "omnivore" as const, allergens: [], dislikes: [], budget: "medium" as const, cuisines: ["colombian" as const, "latin" as const] };
    for (const d of generateMealPlan({ weekStart: "2026-10-26", prefs: omni, targets })) {
      const ids = d.meals.map((m) => m.recipeId);
      expect(new Set(ids).size, d.date).toBe(ids.length);
    }
  });

  it("ajusta porciones a la energía objetivo (±25 %)", () => {
    const omni = { ...prefs, diet: "omnivore" as const, allergens: [], dislikes: [], budget: "medium" as const };
    const days = generateMealPlan({ weekStart: "2026-10-26", prefs: omni, targets });
    for (const d of days) expect(Math.abs(dayMacros(d).kcal - 2000) / 2000).toBeLessThan(0.25);
  });

  it("sustituir mantiene la seguridad y cambia la receta", () => {
    const days = generateMealPlan({ weekStart: "2026-10-26", prefs, targets });
    const swapped = substituteMeal(days[0], 1, prefs, targets, MEAL_SPLITS[4]);
    expect(swapped.meals[1].recipeId).not.toBe(days[0].meals[1].recipeId);
    expect(isRecipeSafe(RECIPE_BY_ID[swapped.meals[1].recipeId], prefs)).toBe(true);
  });

  it("la lista de compras suma ingredientes", () => {
    const days = generateMealPlan({ weekStart: "2026-10-26", prefs, targets: null });
    const list = groceryList(days);
    expect(Object.values(list).flat().length).toBeGreaterThan(5);
  });
});

describe("constancia", () => {
  it("los comodines protegen la racha y hoy no la rompe", () => {
    const start = "2026-10-01";
    const active = Array.from({ length: 10 }, (_, i) => i).filter((i) => i !== 8).map((i) => addDays(start, i));
    const s = computeStreak(active, start, addDays(start, 10));
    expect(s.streak).toBe(9);
    expect(s.usedFreezes).toBe(1);
    expect(computeStreak([start, addDays(start, 2)], start, addDays(start, 2)).streak).toBe(1);
  });
});

describe("somatotipo", () => {
  it("devuelve mixto si no hay mayoría clara", () => {
    expect(classifyBodyType({ frame: "a", gain: "a", muscle: "a", storage: "b", shape: "c" })).toBe("ectomorph");
    expect(classifyBodyType({ frame: "a", gain: "b", muscle: "c", storage: "a", shape: "b" })).toBe("mixed");
    expect(classifyBodyType({})).toBe("mixed");
  });
});
