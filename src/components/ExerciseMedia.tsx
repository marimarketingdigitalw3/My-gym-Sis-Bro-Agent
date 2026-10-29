// Ilustración animada de un ejercicio: alterna la pose de inicio y la de pico (RepDB).
// Si el ejercicio no tiene ilustración, muestra la figura vectorial de respaldo.
import { useEffect, useState } from "react";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { EXERCISE_MEDIA, EXERCISE_MEDIA_BASE, EXERCISE_MEDIA_CREDIT } from "@/data/exerciseMedia";
import { cx } from "@/components/ui";
import { ExerciseDemo } from "./ExerciseDemo";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function hasExerciseMedia(exerciseId: string): boolean {
  return exerciseId in EXERCISE_MEDIA;
}

export function ExerciseMedia({ exerciseId, size = 160, className, fallbackVariant = "female" }: {
  exerciseId: string; size?: number; className?: string; fallbackVariant?: "female" | "male";
}) {
  const reduced = usePrefersReducedMotion();
  const ex = EXERCISE_BY_ID[exerciseId];
  const media = EXERCISE_MEDIA[exerciseId];
  if (!ex) return null;
  if (!media) return <ExerciseDemo exercise={ex} variant={fallbackVariant} size={size} className={className} />;

  const frames = media.main ? [media.main] : [media.start!, media.peak!];
  const label = `Ilustración de ${ex.name}${frames.length > 1 ? ": posición inicial y final" : ""}`;
  return (
    <figure className={cx("relative m-0 overflow-hidden rounded-3xl", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      {frames.map((f, i) => (
        <img key={f} src={EXERCISE_MEDIA_BASE + f} alt="" width={size} height={size} loading="lazy" decoding="async"
          className={cx("absolute inset-0 h-full w-full object-cover", frames.length > 1 && !reduced && (i === 0 ? "exercise-frame-a" : "exercise-frame-b"), reduced && i === 1 && "opacity-0")} />
      ))}
      <figcaption className="absolute bottom-1 right-2 text-[9px] text-black/50">
        <a href={EXERCISE_MEDIA_CREDIT.url} target="_blank" rel="nofollow noreferrer" className="hover:underline">RepDB</a>
      </figcaption>
    </figure>
  );
}
