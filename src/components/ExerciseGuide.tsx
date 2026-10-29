// Guía visual y escrita de un ejercicio: animación de referencia (mujer u hombre), pasos y errores comunes.
import { useState } from "react";
import { useBundle } from "@/app/providers";
import { Chip } from "@/components/ui";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { demoVariant, ExerciseDemo } from "./ExerciseDemo";

export function useDemoVariant() {
  const { profile } = useBundle();
  return demoVariant(profile.sex, profile.theme);
}

export function ExerciseGuide({ exerciseId, compact = false }: { exerciseId: string; compact?: boolean }) {
  const profileVariant = useDemoVariant();
  const [variant, setVariant] = useState(profileVariant);
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-start">
        <div className="rounded-3xl bg-surface-2/70 p-2">
          <ExerciseDemo exercise={ex} variant={variant} size={compact ? 130 : 160} />
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Ver la animación con">
          <Chip selected={variant === "female"} onClick={() => setVariant("female")}>Mujer</Chip>
          <Chip selected={variant === "male"} onClick={() => setVariant("male")}>Hombre</Chip>
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">Cómo hacerlo</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">{ex.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
        {!compact && (
          <>
            <p className="mt-3 font-semibold">Evita</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{ex.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
        <p className="mt-2 text-xs text-muted">La animación es una referencia del movimiento; guíate por los pasos.</p>
      </div>
    </div>
  );
}
