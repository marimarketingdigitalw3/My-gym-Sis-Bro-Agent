// Estimaciones de energía y macronutrientes.
// Supuestos documentados en docs/supuestos-calculos.md. Todo valor es una estimación, no una prescripción.
import type { ActivityLevel, LifestyleAnswers, MacroTargets } from "@/types/db";
import type { BiologicalSex, GoalKey } from "@/types/domain";

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: "Sedentaria (poco o nada de ejercicio)" },
  light: { factor: 1.375, label: "Ligera (1 a 3 días de ejercicio)" },
  moderate: { factor: 1.55, label: "Moderada (3 a 5 días)" },
  active: { factor: 1.725, label: "Alta (6 a 7 días)" },
  very_active: { factor: 1.9, label: "Muy alta (trabajo físico y entrenamiento diario)" },
};

// Ajuste sobre el gasto total según el objetivo principal: [mínimo, central, máximo].
const GOAL_ADJUSTMENT: Partial<Record<GoalKey, [number, number, number]>> = {
  lose_fat: [-0.2, -0.15, -0.1],
  recomposition: [-0.1, -0.05, 0],
  build_muscle: [0.05, 0.08, 0.1],
  strength: [0, 0.05, 0.08],
  glutes_legs: [0, 0.05, 0.08],
  upper_body: [0, 0.05, 0.08],
};
const MAINTENANCE: [number, number, number] = [-0.05, 0, 0.05];

export type NutritionMode = "standard" | "maintenance_only" | "no_numbers";

export interface NutritionInput {
  age: number | null;
  sex: BiologicalSex | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: GoalKey;
  lifestyle?: LifestyleAnswers;
  trainingDaysPerWeek?: number;
  edHistory?: boolean | null;
  pregnancyStatus?: "none" | "pregnant" | "postpartum" | "prefer_not";
}

export interface NutritionEstimate {
  mode: NutritionMode;
  bmr: number | null;
  tdee: number | null;
  activity: ActivityLevel;
  targets: MacroTargets | null;
  assumptions: string[];
  warnings: string[];
}

export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: BiologicalSex | null): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // Sin sexo declarado se usa el punto medio de ambas constantes (+5 y −161).
  const constant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return base + constant;
}

export function inferActivityLevel(lifestyle: LifestyleAnswers | undefined, trainingDays = 0): ActivityLevel {
  if (lifestyle?.activityLevel) return lifestyle.activityLevel;
  const steps = lifestyle?.dailySteps ?? null;
  let score = trainingDays >= 6 ? 3 : trainingDays >= 3 ? 2 : trainingDays >= 1 ? 1 : 0;
  if (lifestyle?.occupation === "physical") score += 1;
  if (steps !== null && steps >= 10000) score += 1;
  return (["sedentary", "light", "moderate", "active", "very_active"] as const)[Math.min(score, 4)];
}

const round = (n: number, step = 1) => Math.round(n / step) * step;

export function estimateNutrition(input: NutritionInput): NutritionEstimate {
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const activity = inferActivityLevel(input.lifestyle, input.trainingDaysPerWeek);
  const { age, heightCm, weightKg, sex } = input;

  if (input.edHistory) {
    warnings.push(
      "Indicaste antecedentes de trastornos de la conducta alimentaria. Por tu bienestar no mostramos cifras de calorías ni proponemos déficit. Te recomendamos acompañamiento de un profesional en nutrición.",
    );
  }

  if (age === null || heightCm === null || weightKg === null) {
    return {
      mode: input.edHistory ? "no_numbers" : "standard",
      bmr: null,
      tdee: null,
      activity,
      targets: null,
      assumptions: ["Faltan edad, estatura o peso: completa tu perfil para estimar tus necesidades."],
      warnings,
    };
  }

  const bmr = mifflinStJeor(weightKg, heightCm, age, sex);
  const tdee = bmr * ACTIVITY_FACTORS[activity].factor;
  assumptions.push("Metabolismo basal estimado con la ecuación de Mifflin-St Jeor.");
  if (!sex) assumptions.push("Sin sexo biológico declarado se usó un valor intermedio, lo que reduce la precisión (±80 kcal aprox.).");
  assumptions.push(`Gasto total = basal × ${ACTIVITY_FACTORS[activity].factor} (${ACTIVITY_FACTORS[activity].label}).`);

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let mode: NutritionMode = input.edHistory ? "no_numbers" : "standard";
  let adjustment = GOAL_ADJUSTMENT[input.goal] ?? MAINTENANCE;

  const blockDeficit = (reason: string) => {
    if (adjustment[1] < 0) adjustment = MAINTENANCE;
    if (mode === "standard") mode = "maintenance_only";
    warnings.push(reason);
  };

  if (age < 18) {
    adjustment = MAINTENANCE;
    mode = input.edHistory ? "no_numbers" : "maintenance_only";
    warnings.push("Eres menor de 18 años: no calculamos déficit ni superávit. Una persona adulta responsable y un profesional de la salud deben acompañar cualquier cambio de peso.");
  }
  if (input.edHistory) adjustment = MAINTENANCE;
  if (input.pregnancyStatus === "pregnant" || input.pregnancyStatus === "postpartum") {
    blockDeficit("Durante el embarazo o la lactancia las necesidades cambian. No proponemos déficit: sigue la guía de tu equipo de salud.");
  }
  if (bmi < 18.5 && adjustment[1] < 0) {
    blockDeficit("Tu índice de masa corporal ya es bajo, así que no proponemos déficit. Si quieres cambiar tu composición corporal, prioriza fuerza y consulta a un profesional.");
  }

  const floor = Math.max(bmr, sex === "male" ? 1500 : sex === "female" ? 1200 : 1350);
  const clamp = (k: number) => Math.max(k, adjustment[1] < 0 ? floor : 0);
  const kcal = round(clamp(tdee * (1 + adjustment[1])), 10);
  const kcalMin = round(clamp(tdee * (1 + adjustment[0])), 10);
  const kcalMax = round(clamp(tdee * (1 + adjustment[2])), 10);
  if (adjustment[1] < 0 && tdee * (1 + adjustment[1]) < floor) {
    assumptions.push("El objetivo se limitó a un mínimo seguro para no restringir de más.");
  }

  // Proteína por kg; con IMC alto se usa el peso de referencia (IMC 25) para no sobrestimar.
  const refWeight = bmi > 30 ? 25 * heightM * heightM : weightKg;
  const proteinPerKg =
    input.goal === "lose_fat" || input.goal === "recomposition" ? 2.0
      : ["build_muscle", "strength", "glutes_legs", "upper_body"].includes(input.goal) ? 1.8
        : 1.4;
  const proteinG = round(refWeight * proteinPerKg);
  let fatG = round(Math.max(0.8 * refWeight, (0.25 * kcal) / 9));
  let carbsG = round((kcal - proteinG * 4 - fatG * 9) / 4);
  if (carbsG < 100) {
    fatG = round(Math.max(0.6 * refWeight, (0.2 * kcal) / 9));
    carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4));
  }
  assumptions.push(`Proteína: ${proteinPerKg} g por kg${bmi > 30 ? " de peso de referencia" : ""}. Grasa mínima 0,8 g/kg o 25 % de la energía. El resto, carbohidratos.`);

  const waterMl = round(weightKg * 35, 50);
  assumptions.push("Agua: unos 35 ml por kg al día como guía general, más lo que pierdas al entrenar o con calor.");

  return {
    mode,
    bmr: round(bmr),
    tdee: round(tdee),
    activity,
    targets: { kcal, kcalMin, kcalMax, proteinG, carbsG, fatG, waterMl },
    assumptions,
    warnings,
  };
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function sumMacros(items: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }[]): MacroTotals {
  return items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + Number(m.kcal),
      proteinG: acc.proteinG + Number(m.protein_g),
      carbsG: acc.carbsG + Number(m.carbs_g),
      fatG: acc.fatG + Number(m.fat_g),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
