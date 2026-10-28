// Objetivos de calorías y macros ajustados por fase (InOut + ciclo).

export const ACTIVITY = {
  sedentary: { label: "Sedentaria", factor: 1.2 },
  light: { label: "1 a 3 entrenos por semana", factor: 1.375 },
  moderate: { label: "3 a 5 entrenos por semana", factor: 1.55 },
  high: { label: "6 o más entrenos por semana", factor: 1.725 },
};

export const GOALS = {
  lose: { label: "Perder grasa", adjust: -0.15 },
  maintain: { label: "Mantener y tonificar", adjust: 0 },
  gain: { label: "Ganar músculo", adjust: 0.1 },
};

export const LUTEAL_EXTRA_KCAL = 150;

// Mifflin-St Jeor, versión femenina.
export function bmr({ weight, height, age }) {
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

export function dailyTargets(profile, phase) {
  const tdee = bmr(profile) * ACTIVITY[profile.activity].factor;
  let kcal = tdee * (1 + GOALS[profile.goal].adjust);
  if (phase === "luteal") kcal += LUTEAL_EXTRA_KCAL;
  kcal = Math.round(kcal);

  const protein = Math.round(profile.weight * 1.8);
  const fat = Math.round(profile.weight * (phase === "luteal" ? 1.0 : 0.9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

export function sumMeals(meals) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// Porciones habituales. Valores aproximados.
export const QUICK_FOODS = [
  { name: "Arepa de maíz (1 mediana)", kcal: 220, protein: 5, carbs: 45, fat: 2 },
  { name: "Huevo (2 unidades)", kcal: 140, protein: 12, carbs: 1, fat: 10 },
  { name: "Pechuga de pollo (150 g)", kcal: 250, protein: 46, carbs: 0, fat: 6 },
  { name: "Arroz blanco (1 taza)", kcal: 205, protein: 4, carbs: 45, fat: 0 },
  { name: "Fríjoles (1 taza)", kcal: 225, protein: 15, carbs: 40, fat: 1 },
  { name: "Aguacate (1/2)", kcal: 120, protein: 1, carbs: 6, fat: 11 },
  { name: "Plátano maduro (1/2)", kcal: 110, protein: 1, carbs: 29, fat: 0 },
  { name: "Avena (1/2 taza)", kcal: 150, protein: 5, carbs: 27, fat: 3 },
  { name: "Yogur griego (170 g)", kcal: 100, protein: 17, carbs: 6, fat: 0 },
  { name: "Batido de proteína (1 scoop)", kcal: 120, protein: 24, carbs: 3, fat: 1 },
  { name: "Banano (1)", kcal: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Atún en agua (1 lata)", kcal: 120, protein: 26, carbs: 0, fat: 1 },
];
