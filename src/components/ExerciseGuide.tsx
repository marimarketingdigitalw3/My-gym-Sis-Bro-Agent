// Guía visual y escrita de un ejercicio: ilustración animada (inicio y pico), pasos y errores comunes.
import { useState } from "react";
import { useBundle } from "@/app/providers";
import { Chip } from "@/components/ui";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { EXERCISE_MEDIA_CREDIT } from "@/data/exerciseMedia";
import { demoVariant } from "./ExerciseDemo";
import { ExerciseMedia, hasExerciseMedia } from "./ExerciseMedia";

export function useDemoVariant() {
  const { profile } = useBundle();
  return demoVariant(profile.sex, profile.theme);
}

export function ExerciseGuide({ exerciseId, compact = false }: { exerciseId: string; compact?: boolean }) {
  const profileVariant = useDemoVariant();
  const [variant, setVariant] = useState(profileVariant);
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return null;
  const illustrated = hasExerciseMedia(exerciseId);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-start">
        <ExerciseMedia exerciseId={exerciseId} size={compact ? 140 : 180} fallbackVariant={variant} className="bg-surface-2/70" />
        {!illustrated && (
          <div className="flex gap-1.5" role="group" aria-label="Ver la animación con">
            <Chip selected={variant === "female"} onClick={() => setVariant("female")}>Mujer</Chip>
            <Chip selected={variant === "male"} onClick={() => setVariant("male")}>Hombre</Chip>
          </div>
        )}
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
        <p className="mt-2 text-xs text-muted">
          {illustrated ? <>Ilustración: posición inicial y final. <a href={EXERCISE_MEDIA_CREDIT.url} target="_blank" rel="nofollow noreferrer" className="underline">{EXERCISE_MEDIA_CREDIT.label}</a>.</> : "La animación es una referencia del movimiento; guíate por los pasos."}
        </p>
      </div>
    </div>
  );
}
