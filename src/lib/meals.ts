// Planificador de comidas: filtra recetas por dieta, alergias, gustos, presupuesto y tiempo,
// reparte la energía del día entre las comidas y genera la lista de compras.
import { RECIPES, RECIPE_BY_ID } from "@/data/recipes";
import { addDays } from "./dates";
import type { MacroTargets, MealPlanDay, NutritionPrefsRow, PlannedMeal } from "@/types/db";
import type { BudgetLevel, Ingredient, MealType, Recipe } from "@/types/domain";

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Merienda",
};

export const AISLE_LABELS: Record<Ingredient["aisle"], string> = {
  protein: "Proteínas",
  dairy: "Lácteos y alternativas",
  grains: "Cereales, panes y tubérculos",
  produce: "Frutas y verduras",
  legumes: "Legumbres",
  fats: "Grasas y frutos secos",
  pantry: "Despensa",
  frozen: "Congelados",
};

// Reparto de la energía diaria según el número de comidas.
export const MEAL_SPLITS: Record<number, { type: MealType; share: number }[]> = {
  2: [{ type: "lunch", share: 0.5 }, { type: "dinner", share: 0.5 }],
  3: [{ type: "breakfast", share: 0.3 }, { type: "lunch", share: 0.4 }, { type: "dinner", share: 0.3 }],
  4: [{ type: "breakfast", share: 0.25 }, { type: "lunch", share: 0.35 }, { type: "snack", share: 0.1 }, { type: "dinner", share: 0.3 }],
  5: [{ type: "breakfast", share: 0.25 }, { type: "snack", share: 0.1 }, { type: "lunch", share: 0.3 }, { type: "snack", share: 0.1 }, { type: "dinner", share: 0.25 }],
  6: [{ type: "breakfast", share: 0.2 }, { type: "snack", share: 0.1 }, { type: "lunch", share: 0.3 }, { type: "snack", share: 0.1 }, { type: "dinner", share: 0.2 }, { type: "snack", share: 0.1 }],
};

const BUDGET_RANK: Record<BudgetLevel, number> = { low: 0, medium: 1, high: 2 };

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type Prefs = Pick<NutritionPrefsRow, "diet" | "allergens" | "dislikes" | "budget" | "cooking_minutes" | "cuisines">;

/** Reglas duras: dieta, alérgenos y alimentos rechazados. Nunca se relajan. */
export function isRecipeSafe(recipe: Recipe, prefs: Prefs): boolean {
  if (!recipe.diet.includes(prefs.diet)) return false;
  if (recipe.allergens.some((a) => prefs.allergens.includes(a))) return false;
  const dislikes = prefs.dislikes.map(normalize).filter(Boolean);
  const haystack = [recipe.name, ...recipe.ingredients.map((i) => i.name)].map(normalize);
  return !dislikes.some((d) => haystack.some((h) => h.includes(d)));
}

/** Reglas blandas: presupuesto, tiempo y estilo de cocina. Se relajan si no hay suficientes opciones. */
export function eligibleRecipes(prefs: Prefs, mealType: MealType): Recipe[] {
  const safe = RECIPES.filter((r) => r.mealTypes.includes(mealType) && isRecipeSafe(r, prefs));
  const strict = safe.filter((r) => BUDGET_RANK[r.budget] <= BUDGET_RANK[prefs.budget] && r.prepMinutes <= prefs.cooking_minutes);
  const pool = strict.length >= 3 ? strict : safe;
  const preferred = pool.filter((r) => prefs.cuisines.includes(r.cuisine));
  return preferred.length >= 3 ? [...preferred, ...pool.filter((r) => !preferred.includes(r))] : pool;
}

export function servingsFor(recipe: Recipe, kcalTarget: number | null): number {
  if (!kcalTarget) return 1;
  const raw = kcalTarget / recipe.kcal;
  return Math.min(2.5, Math.max(0.5, Math.round(raw * 4) / 4));
}

export interface MealPlanOptions {
  weekStart: string;
  prefs: Prefs & Pick<NutritionPrefsRow, "meals_per_day" | "wants_meal_prep">;
  targets: MacroTargets | null;
}

export function generateMealPlan({ weekStart, prefs, targets }: MealPlanOptions): MealPlanDay[] {
  const split = MEAL_SPLITS[prefs.meals_per_day] ?? MEAL_SPLITS[4];
  const pools = new Map<MealType, Recipe[]>();
  for (const s of split) if (!pools.has(s.type)) pools.set(s.type, eligibleRecipes(prefs, s.type));
  const cursor = new Map<MealType, number>();

  return Array.from({ length: 7 }, (_, d) => {
    const meals: PlannedMeal[] = [];
    const usedToday = new Set<string>();
    split.forEach((slot) => {
      const pool = pools.get(slot.type) ?? [];
      if (!pool.length) return;
      // Con meal prep, almuerzo y cena se repiten en bloques de 3 días.
      const batch = prefs.wants_meal_prep && (slot.type === "lunch" || slot.type === "dinner");
      let idx: number;
      if (batch) {
        idx = Math.floor(d / 3) * 2 + (slot.type === "dinner" ? 1 : 0);
      } else {
        idx = cursor.get(slot.type) ?? 0;
        // Evita repetir la misma receta dos veces en el mismo día (almuerzo y cena comparten recetas).
        for (let tries = 0; tries < pool.length && usedToday.has(pool[idx % pool.length].id); tries++) idx++;
        cursor.set(slot.type, idx + 1);
      }
      const recipe = pool[idx % pool.length];
      usedToday.add(recipe.id);
      meals.push({ mealType: slot.type, recipeId: recipe.id, servings: servingsFor(recipe, targets ? targets.kcal * slot.share : null), completed: false });
    });
    return { date: addDays(weekStart, d), meals };
  });
}

export function substituteMeal(day: MealPlanDay, mealIndex: number, prefs: Prefs, targets: MacroTargets | null, split: { share: number }[], cheaper = false): MealPlanDay {
  const current = day.meals[mealIndex];
  const currentRecipe = RECIPE_BY_ID[current.recipeId];
  let pool = eligibleRecipes(prefs, current.mealType).filter((r) => r.id !== current.recipeId);
  if (cheaper) {
    const cheap = pool.filter((r) => BUDGET_RANK[r.budget] < BUDGET_RANK[currentRecipe?.budget ?? "high"] || r.budget === "low");
    if (cheap.length) pool = cheap;
  }
  if (!pool.length) return day;
  const targetKcal = currentRecipe ? currentRecipe.kcal * current.servings : 0;
  // Rota entre las opciones más parecidas en energía para variar sin descuadrar el día.
  const ranked = [...pool].sort((a, b) => Math.abs(a.kcal - targetKcal) - Math.abs(b.kcal - targetKcal));
  const used = new Set(day.meals.map((m) => m.recipeId));
  const pick = ranked.find((r) => !used.has(r.id)) ?? ranked[0];
  const share = split[mealIndex]?.share ?? null;
  const meals = day.meals.map((m, i) =>
    i === mealIndex ? { ...m, recipeId: pick.id, servings: servingsFor(pick, targets && share ? targets.kcal * share : null), completed: false } : m,
  );
  return { ...day, meals };
}

export interface MacroSum { kcal: number; proteinG: number; carbsG: number; fatG: number }

export function mealMacros(meal: Pick<PlannedMeal, "recipeId" | "servings">): MacroSum {
  const r = RECIPE_BY_ID[meal.recipeId];
  if (!r) return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  return {
    kcal: Math.round(r.kcal * meal.servings),
    proteinG: Math.round(r.proteinG * meal.servings),
    carbsG: Math.round(r.carbsG * meal.servings),
    fatG: Math.round(r.fatG * meal.servings),
  };
}

export function dayMacros(day: MealPlanDay): MacroSum {
  return day.meals.map(mealMacros).reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, proteinG: a.proteinG + m.proteinG, carbsG: a.carbsG + m.carbsG, fatG: a.fatG + m.fatG }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export interface GroceryItem { name: string; grams: number; aisle: Ingredient["aisle"] }

export function groceryList(days: MealPlanDay[]): Record<Ingredient["aisle"], GroceryItem[]> {
  const totals = new Map<string, GroceryItem>();
  for (const day of days) {
    for (const meal of day.meals) {
      const recipe = RECIPE_BY_ID[meal.recipeId];
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const key = normalize(ing.name);
        const prev = totals.get(key);
        totals.set(key, { name: ing.name, aisle: ing.aisle, grams: (prev?.grams ?? 0) + ing.grams * meal.servings });
      }
    }
  }
  const grouped = {} as Record<Ingredient["aisle"], GroceryItem[]>;
  for (const item of [...totals.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))) {
    (grouped[item.aisle] ??= []).push({ ...item, grams: Math.ceil(item.grams / 10) * 10 });
  }
  return grouped;
}
