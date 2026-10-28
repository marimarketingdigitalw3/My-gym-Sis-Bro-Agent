import type { Equipment, ExerciseCategory, FitnessLevel, JointArea, MovementPattern, MuscleGroup, TrainingEnvironment, Units } from "@/types/domain";

export const LEVEL_LABELS: Record<FitnessLevel, string> = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };

export const ENVIRONMENT_LABELS: Record<TrainingEnvironment, string> = {
  gym: "Gimnasio comercial", home_gym: "Gimnasio en casa", home_none: "En casa sin equipo", outdoors: "Al aire libre", mixed: "Combinación",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: "Peso corporal", dumbbells: "Mancuernas", barbell: "Barra y discos", machines: "Máquinas", cables: "Poleas",
  bands: "Bandas elásticas", kettlebells: "Kettlebells", bench: "Banco", cardio_machine: "Caminadora o máquina de cardio", pullup_bar: "Barra de dominadas",
};

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Pecho", back: "Espalda", shoulders: "Hombros", biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos", core: "Core",
  glutes: "Glúteos", quads: "Cuádriceps", hamstrings: "Isquiotibiales", calves: "Pantorrillas", adductors: "Aductores",
  full_body: "Cuerpo completo", cardio: "Cardio",
};

export const JOINT_LABELS: Record<JointArea, string> = {
  knee: "Rodilla", lower_back: "Zona lumbar", shoulder: "Hombro", wrist: "Muñeca", hip: "Cadera", ankle: "Tobillo", neck: "Cuello", elbow: "Codo",
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = { strength: "Fuerza", cardio: "Cardio", mobility: "Movilidad", core: "Core" };

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: "Sentadilla", hinge: "Bisagra de cadera", lunge: "Zancada", hip_extension: "Extensión de cadera", horizontal_push: "Empuje horizontal",
  vertical_push: "Empuje vertical", horizontal_pull: "Tirón horizontal", vertical_pull: "Tirón vertical", elbow_flexion: "Flexión de codo",
  elbow_extension: "Extensión de codo", shoulder_isolation: "Hombro (aislamiento)", core_anti_extension: "Core antiextensión",
  core_rotation: "Core rotación", core_flexion: "Core flexión", calf: "Pantorrilla", carry: "Acarreo", cardio: "Cardio", mobility: "Movilidad",
};

export const DIFFICULTY_LABELS = { 1: "Básico", 2: "Intermedio", 3: "Avanzado" } as const;

// ---------- Unidades ----------
const KG_TO_LB = 2.20462;

export function formatWeight(kg: number | null | undefined, units: Units, digits = 1): string {
  if (kg === null || kg === undefined) return "—";
  const v = units === "imperial" ? Number(kg) * KG_TO_LB : Number(kg);
  return `${Number(v.toFixed(digits))} ${units === "imperial" ? "lb" : "kg"}`;
}

export const weightUnit = (units: Units) => (units === "imperial" ? "lb" : "kg");
export const toDisplayWeight = (kg: number, units: Units) => (units === "imperial" ? Math.round(kg * KG_TO_LB * 10) / 10 : kg);
export const fromDisplayWeight = (v: number, units: Units) => (units === "imperial" ? Math.round((v / KG_TO_LB) * 100) / 100 : v);

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
