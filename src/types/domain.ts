// Tipos de dominio compartidos por los motores, la UI y la capa de datos.

export type ThemeName = "sis" | "bro" | "neutral";
export type Units = "metric" | "imperial";
export type Language = "es" | "en";
export type BiologicalSex = "female" | "male";

export type GoalKey =
  | "lose_fat"
  | "build_muscle"
  | "strength"
  | "endurance"
  | "cardio_health"
  | "mobility"
  | "recomposition"
  | "glutes_legs"
  | "upper_body"
  | "general_health"
  | "maintain";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type TrainingEnvironment = "gym" | "home_gym" | "home_none" | "outdoors" | "mixed";

export type Equipment =
  | "bodyweight"
  | "dumbbells"
  | "barbell"
  | "machines"
  | "cables"
  | "bands"
  | "kettlebells"
  | "bench"
  | "cardio_machine"
  | "pullup_bar";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves"
  | "adductors"
  | "full_body"
  | "cardio";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "hip_extension"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "elbow_flexion"
  | "elbow_extension"
  | "shoulder_isolation"
  | "core_anti_extension"
  | "core_rotation"
  | "core_flexion"
  | "calf"
  | "carry"
  | "cardio"
  | "mobility";

// Zonas que el usuario puede marcar como limitadas o dolorosas.
export type JointArea = "knee" | "lower_back" | "shoulder" | "wrist" | "hip" | "ankle" | "neck" | "elbow";

export type ExerciseCategory = "strength" | "cardio" | "mobility" | "core";

export interface Exercise {
  id: string; // slug estable, ej. "goblet-squat"
  name: string; // nombre en español
  nameEn: string;
  category: ExerciseCategory;
  pattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[]; // TODO el equipo listado es necesario
  difficulty: 1 | 2 | 3; // 1 principiante, 3 avanzado
  stressedJoints: JointArea[]; // articulaciones que el ejercicio carga de forma notable
  unilateral: boolean;
  isCompound: boolean;
  instructions: string[]; // pasos de técnica, 3 a 5
  commonMistakes: string[]; // 2 a 4
  alternatives: string[]; // ids de ejercicios del mismo patrón
  defaultUnit: "reps" | "seconds";
  // Incremento de carga sugerido cuando se progresa (kg). 0 si no aplica.
  loadIncrementKg: number;
}

export type DietPattern = "omnivore" | "vegetarian" | "vegan" | "pescatarian";
export type Allergen = "gluten" | "lactose" | "nuts" | "peanuts" | "eggs" | "soy" | "fish" | "shellfish";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type CuisineStyle = "colombian" | "latin" | "mediterranean" | "international";
export type BudgetLevel = "low" | "medium" | "high";

export interface Ingredient {
  name: string; // en español, ej. "pechuga de pollo"
  grams: number; // para UNA porción base
  // Categoría para agrupar la lista de compras.
  aisle: "protein" | "dairy" | "grains" | "produce" | "legumes" | "fats" | "pantry" | "frozen";
}

export interface Recipe {
  id: string;
  name: string;
  mealTypes: MealType[];
  cuisine: CuisineStyle;
  diet: DietPattern[]; // dietas para las que es apta
  allergens: Allergen[]; // alérgenos que contiene
  budget: BudgetLevel;
  prepMinutes: number;
  ingredients: Ingredient[];
  steps: string[];
  // Valores por porción base. Son estimaciones a partir de tablas de composición estándar.
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tags: string[]; // ej. "post-entreno", "meal-prep", "alto en proteína"
}
