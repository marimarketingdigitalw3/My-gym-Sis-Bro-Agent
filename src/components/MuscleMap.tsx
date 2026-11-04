// Mapa muscular en 3D (vista frontal y posterior). La base es un render anatómico y cada grupo
// muscular es una máscara en public/muscles/<cuerpo>/<grupo>.webp, teñida con el color de la plantilla.
// Gym Sis usa el cuerpo de mujer; Gym Bro y General, el de hombre.
import type { CSSProperties } from "react";
import type { MuscleGroup } from "@/types/domain";

export type MuscleBody = "female" | "male";

/** Grupos con máscara propia. "full_body" y "cardio" se resuelven aparte. */
const MASKED = ["shoulders", "chest", "back", "biceps", "triceps", "forearms", "core", "glutes", "quads", "hamstrings", "calves", "adductors"] as const;
type Masked = (typeof MASKED)[number];

const FULL_BODY: Masked[] = ["chest", "back", "shoulders", "core", "glutes", "quads", "hamstrings"];

/** Cuerpos con imágenes disponibles; si falta uno, se usa el de hombre. */
const AVAILABLE: Record<MuscleBody, boolean> = { male: true, female: false };

/** Proporción de la imagen y posición horizontal (en %) del centro de cada vista. */
const LAYOUT: Record<MuscleBody, { ratio: string; front: number; back: number }> = {
  male: { ratio: "645 / 562", front: 24, back: 76.1 },
  female: { ratio: "645 / 562", front: 24, back: 76.1 },
};

const isMasked = (m: MuscleGroup): m is Masked => (MASKED as readonly string[]).includes(m);

export function muscleBodyForTheme(theme: string | null | undefined): MuscleBody {
  return theme === "sis" ? "female" : "male";
}

function Layer({ src, color, opacity }: { src: string; color: string; opacity: number }) {
  const mask = `url(${src})`;
  const style: CSSProperties = {
    backgroundColor: color, opacity, mixBlendMode: "multiply",
    maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
  };
  return <span aria-hidden className="pointer-events-none absolute inset-0" style={style} />;
}

export function MuscleMap({ primary, secondary, body = "male" }: { primary: MuscleGroup[]; secondary: MuscleGroup[]; body?: MuscleBody }) {
  const kind: MuscleBody = AVAILABLE[body] ? body : "male";
  const dir = `/muscles/${kind}`;
  const p = new Set<Masked>(primary.flatMap((m) => (m === "full_body" ? FULL_BODY : isMasked(m) ? [m] : [])));
  const s = new Set<Masked>(secondary.flatMap((m) => (m === "full_body" ? FULL_BODY : isMasked(m) ? [m] : [])).filter((m) => !p.has(m)));
  const layout = LAYOUT[kind];
  return (
    <figure className="mx-auto w-full max-w-md" role="img" aria-label="Mapa de músculos trabajados: color intenso para los principales, suave para los secundarios">
      <div className="relative isolate w-full" style={{ aspectRatio: layout.ratio }}>
        <img src={`${dir}/body.webp`} alt="" className="absolute inset-0 h-full w-full select-none drop-shadow-[0_18px_24px_rgb(0_0_0/0.18)]" draggable={false} />
        {[...s].map((m) => <Layer key={`s-${m}`} src={`${dir}/${m}.webp`} color="rgb(var(--muscle-soft))" opacity={0.7} />)}
        {[...p].map((m) => <Layer key={`p-${m}`} src={`${dir}/${m}.webp`} color="rgb(var(--muscle))" opacity={0.92} />)}
      </div>
      <figcaption className="relative mt-1 h-4 text-xs text-muted" aria-hidden>
        <span className="absolute -translate-x-1/2" style={{ left: `${layout.front}%` }}>Frente</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${layout.back}%` }}>Espalda</span>
      </figcaption>
    </figure>
  );
}
