// Mapa muscular esquemático (vista frontal y posterior). Ilustración propia, sin imágenes externas.
import type { MuscleGroup } from "@/types/domain";

type Region = { muscle: MuscleGroup; d: string };

const FRONT: Region[] = [
  { muscle: "shoulders", d: "M34 46c-6 1-10 6-10 12l8 2c1-5 3-9 7-11zM86 46c6 1 10 6 10 12l-8 2c-1-5-3-9-7-11z" },
  { muscle: "chest", d: "M40 50h18v16c-7 1-14 0-19-4zM62 50h18l1 12c-5 4-12 5-19 4z" },
  { muscle: "biceps", d: "M24 62l8 2-2 16-7-2zM96 62l-8 2 2 16 7-2z" },
  { muscle: "forearms", d: "M22 82l7 2-3 18-6-2zM98 82l-7 2 3 18 6-2z" },
  { muscle: "core", d: "M44 70h32l-2 30H46z" },
  { muscle: "quads", d: "M44 106h14l-2 36h-10zM62 106h14l-2 36H64z" },
  { muscle: "adductors", d: "M56 106h8l-2 20h-4z" },
  { muscle: "calves", d: "M46 150h9l-1 26h-7zM65 150h9l-1 26h-7z" },
];

const BACK: Region[] = [
  { muscle: "shoulders", d: "M34 46c-6 1-10 6-10 12l8 2c1-5 3-9 7-11zM86 46c6 1 10 6 10 12l-8 2c-1-5-3-9-7-11z" },
  { muscle: "back", d: "M40 48h40l-4 34H44z" },
  { muscle: "triceps", d: "M24 62l8 2-2 16-7-2zM96 62l-8 2 2 16 7-2z" },
  { muscle: "core", d: "M46 84h28v14H46z" },
  { muscle: "glutes", d: "M44 100h15v16H45zM61 100h15l-1 16H61z" },
  { muscle: "hamstrings", d: "M45 118h13l-2 26h-10zM62 118h13l-1 26H64z" },
  { muscle: "calves", d: "M46 150h9l-1 26h-7zM65 150h9l-1 26h-7z" },
];

const SILHOUETTE = "M60 8a11 11 0 1 1 0 22a11 11 0 1 1 0-22zM42 34h36c10 2 16 10 18 22l4 46-8 2-6-36-2 40H45l-2-40-6 36-8-2 4-46c2-12 8-20 18-22zM45 104h30l-1 76h-12l-2-60-2 60H46z";

function Figure({ regions, label, primary, secondary }: { regions: Region[]; label: string; primary: Set<MuscleGroup>; secondary: Set<MuscleGroup> }) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 186" className="h-44 w-auto" aria-hidden>
        <path d={SILHOUETTE} fill="rgb(var(--surface-2))" stroke="rgb(var(--border))" strokeWidth="1.5" />
        {regions.map((r, i) => (
          <path key={i} d={r.d}
            fill={primary.has(r.muscle) ? "rgb(var(--primary-strong))" : secondary.has(r.muscle) ? "rgb(var(--primary) / .45)" : "transparent"} />
        ))}
      </svg>
      <figcaption className="text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ primary, secondary }: { primary: MuscleGroup[]; secondary: MuscleGroup[] }) {
  const p = new Set(primary.includes("full_body") ? (["chest", "back", "shoulders", "core", "glutes", "quads", "hamstrings"] as MuscleGroup[]) : primary);
  const s = new Set(secondary);
  return (
    <div className="flex justify-center gap-6" role="img" aria-label="Mapa de músculos trabajados: color intenso para los principales, suave para los secundarios">
      <Figure regions={FRONT} label="Frente" primary={p} secondary={s} />
      <Figure regions={BACK} label="Espalda" primary={p} secondary={s} />
    </div>
  );
}
