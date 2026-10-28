// Decide si se pueden mostrar recomendaciones normales de entrenamiento.
import { isUrgent } from "../../supabase/functions/_shared/safety.ts";
import type { HealthAnswers, RecoveryLogRow } from "@/types/db";

export type ClearanceStatus = "ok" | "modified" | "blocked";

export interface Clearance {
  status: ClearanceStatus;
  reasons: string[];
  recommendProfessional: boolean;
}

export function trainingClearance(health: HealthAnswers | undefined, todayRecovery?: Pick<RecoveryLogRow, "red_flags"> | null): Clearance {
  const h = health ?? {};
  const flags = [...(h.redFlags ?? []), ...(todayRecovery?.red_flags ?? [])];

  if (isUrgent(flags)) {
    return {
      status: "blocked",
      reasons: [
        "Reportaste un síntoma que requiere evaluación médica antes de seguir entrenando (dolor en el pecho, desmayo, falta de aire intensa o palpitaciones).",
      ],
      recommendProfessional: true,
    };
  }

  const reasons: string[] = [];
  if (flags.includes("sudden_severe_pain")) reasons.push("Reportaste un dolor intenso y repentino: evita cargar esa zona hasta que te evalúen.");
  if (h.medicalRestriction) reasons.push("Tienes una restricción médica: sigue las indicaciones de tu profesional de la salud y usa este plan solo si es compatible.");
  if (h.pregnancyStatus === "pregnant") reasons.push("Durante el embarazo el plan evita impactos, ejercicios boca arriba prolongados y esfuerzos máximos. Confirma el plan con tu equipo de salud.");
  if (h.pregnancyStatus === "postpartum") reasons.push("En el posparto conviene una vuelta gradual y una valoración del suelo pélvico. El plan empieza con intensidad baja.");
  if (h.chronicConditions) reasons.push("Mencionaste una condición crónica: consulta con tu médico qué intensidad es adecuada para ti.");
  if (h.painDuringExercise) reasons.push("Sientes dolor al entrenar: el plan evita las zonas marcadas. Si el dolor persiste, consulta a un fisioterapeuta.");

  if (reasons.length) return { status: "modified", reasons, recommendProfessional: true };
  return { status: "ok", reasons: [], recommendProfessional: false };
}
