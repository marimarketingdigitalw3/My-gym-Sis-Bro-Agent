// Clasificación tradicional y orientativa de somatotipo. No es un diagnóstico
// y nunca se usa para calcular calorías ni elegir ejercicios.
import type { BodyTypeAnswers } from "@/types/db";

export const BODY_TYPE_QUESTIONS: { id: string; text: string; options: Record<"a" | "b" | "c", string> }[] = [
  { id: "frame", text: "¿Cómo describirías tu estructura ósea (muñecas, hombros)?", options: { a: "Fina o estrecha", b: "Media", c: "Ancha" } },
  { id: "gain", text: "Cuando comes más de lo habitual durante semanas…", options: { a: "Me cuesta subir de peso", b: "Subo algo, sobre todo si entreno", c: "Subo con facilidad" } },
  { id: "muscle", text: "Cuando entrenas fuerza con constancia…", options: { a: "Noto cambios lentos", b: "Gano músculo con relativa facilidad", c: "Gano fuerza, pero se nota menos la definición" } },
  { id: "storage", text: "¿Dónde sueles acumular grasa?", options: { a: "Casi en ningún lugar en particular", b: "De forma bastante repartida", c: "Abdomen, caderas o muslos con facilidad" } },
  { id: "shape", text: "Sin entrenar, tu figura tiende a ser…", options: { a: "Delgada y alargada", b: "Atlética", c: "Más redondeada o robusta" } },
];

export const BODY_TYPE_INFO = {
  ectomorph: { name: "Ectomorfo (tendencia)", text: "Suele describir estructuras más finas y dificultad para subir de peso." },
  mesomorph: { name: "Mesomorfo (tendencia)", text: "Suele describir estructuras atléticas que responden rápido al entrenamiento de fuerza." },
  endomorph: { name: "Endomorfo (tendencia)", text: "Suele describir estructuras más anchas y facilidad para ganar peso." },
  mixed: { name: "Mixto o incierto", text: "Tus respuestas combinan rasgos de varias categorías, que es lo más común." },
} as const;

export const BODY_TYPE_DISCLAIMER =
  "Los somatotipos son categorías descriptivas tradicionales, no diagnósticos validados ni predictores fiables de tu metabolismo. Tu plan se basa en tus objetivos, tu experiencia, tu rendimiento y la evolución real de tus medidas, no en esta clasificación.";

export function classifyBodyType(answers: BodyTypeAnswers["answers"]): NonNullable<BodyTypeAnswers["result"]> {
  const values = Object.values(answers ?? {});
  if (values.length < BODY_TYPE_QUESTIONS.length) return "mixed";
  const count = { a: 0, b: 0, c: 0 };
  values.forEach((v) => count[v]++);
  const max = Math.max(count.a, count.b, count.c);
  const leaders = (Object.keys(count) as ("a" | "b" | "c")[]).filter((k) => count[k] === max);
  if (max < 3 || leaders.length > 1) return "mixed";
  return { a: "ectomorph", b: "mesomorph", c: "endomorph" }[leaders[0]] as "ectomorph" | "mesomorph" | "endomorph";
}
