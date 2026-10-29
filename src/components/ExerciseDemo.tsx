// Animación de referencia de un ejercicio: una figura de perfil (mujer u hombre) pasa de la posición
// inicial a la final según el patrón de movimiento. Es una guía visual; los pasos escritos mandan.
import { useEffect, useState } from "react";
import type { Equipment, Exercise, MovementPattern } from "@/types/domain";

type P = [number, number];
interface Pose {
  head: P; neck: P; hip: P;
  knee: P; ankle: P; toe: P;
  elbow: P; wrist: P;
  // Lado lejano (opcional: si falta, igual al cercano).
  kneeF?: P; ankleF?: P; toeF?: P; elbowF?: P; wristF?: P;
}

const STAND: Pose = { head: [100, 38], neck: [100, 54], hip: [100, 108], knee: [101, 146], ankle: [100, 183], toe: [114, 185], elbow: [101, 82], wrist: [102, 108] };
const s = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });

/** Posición inicial y final de cada patrón (vista lateral, mirando a la derecha; suelo en y = 185). */
const POSES: Record<string, [Pose, Pose]> = {
  squat: [
    s({ elbow: [112, 78], wrist: [124, 70] }),
    s({ head: [118, 76], neck: [111, 91], hip: [76, 140], knee: [120, 146], elbow: [126, 110], wrist: [138, 100] }),
  ],
  hinge: [
    s({ elbow: [102, 82], wrist: [103, 108] }),
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [136, 114], wrist: [137, 140] }),
  ],
  lunge: [
    s({ kneeF: [99, 146], ankleF: [98, 183], toeF: [112, 185] }),
    s({ head: [100, 66], neck: [100, 82], hip: [100, 135], knee: [132, 142], ankle: [130, 183], toe: [144, 185], kneeF: [80, 172], ankleF: [60, 178], toeF: [50, 184], elbow: [101, 110], wrist: [102, 134] }),
  ],
  hip_extension: [
    { head: [34, 146], neck: [48, 150], hip: [100, 176], knee: [136, 142], ankle: [150, 183], toe: [164, 185], elbow: [62, 170], wrist: [84, 178] },
    { head: [34, 146], neck: [48, 150], hip: [100, 146], knee: [136, 138], ankle: [150, 183], toe: [164, 185], elbow: [62, 170], wrist: [84, 178] },
  ],
  push_up: [
    { head: [152, 116], neck: [140, 123], hip: [86, 140], knee: [60, 154], ankle: [36, 170], toe: [29, 183], elbow: [141, 153], wrist: [141, 183] },
    { head: [154, 149], neck: [142, 156], hip: [88, 164], knee: [61, 172], ankle: [36, 178], toe: [29, 183], elbow: [118, 162], wrist: [141, 183] },
  ],
  bench_press: [
    { head: [42, 140], neck: [56, 142], hip: [112, 144], knee: [140, 150], ankle: [150, 183], toe: [164, 185], elbow: [60, 112], wrist: [62, 86] },
    { head: [42, 140], neck: [56, 142], hip: [112, 144], knee: [140, 150], ankle: [150, 183], toe: [164, 185], elbow: [74, 146], wrist: [62, 122] },
  ],
  vertical_push: [
    s({ elbow: [114, 72], wrist: [110, 52] }),
    s({ elbow: [106, 30], wrist: [104, 8] }),
  ],
  horizontal_pull: [
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [136, 114], wrist: [137, 140] }),
    s({ head: [149, 84], neck: [135, 88], hip: [86, 110], knee: [100, 148], elbow: [110, 98], wrist: [124, 112] }),
  ],
  vertical_pull: [
    { head: [100, 52], neck: [100, 68], hip: [100, 122], knee: [100, 156], ankle: [100, 182], toe: [110, 184], elbow: [101, 38], wrist: [100, 12] },
    { head: [100, 28], neck: [100, 44], hip: [100, 98], knee: [100, 132], ankle: [100, 160], toe: [110, 162], elbow: [80, 34], wrist: [100, 12] },
  ],
  elbow_flexion: [
    s({ elbow: [100, 84], wrist: [102, 110] }),
    s({ elbow: [100, 84], wrist: [116, 64] }),
  ],
  elbow_extension: [
    s({ elbow: [104, 84], wrist: [120, 70] }),
    s({ elbow: [104, 84], wrist: [105, 110] }),
  ],
  shoulder_isolation: [
    s({ elbow: [102, 82], wrist: [103, 108] }),
    s({ elbow: [124, 60], wrist: [148, 58] }),
  ],
  plank: [
    { head: [152, 140], neck: [140, 146], hip: [88, 151], knee: [61, 160], ankle: [36, 171], toe: [29, 183], elbow: [140, 182], wrist: [162, 182] },
    { head: [152, 139], neck: [140, 145], hip: [88, 147], knee: [61, 158], ankle: [36, 171], toe: [29, 183], elbow: [140, 182], wrist: [162, 182] },
  ],
  crunch: [
    { head: [36, 170], neck: [50, 172], hip: [100, 178], knee: [128, 146], ankle: [152, 182], toe: [166, 185], elbow: [44, 156], wrist: [32, 164] },
    { head: [60, 140], neck: [68, 152], hip: [100, 178], knee: [128, 146], ankle: [152, 182], toe: [166, 185], elbow: [62, 126], wrist: [50, 134] },
  ],
  rotation: [
    s({ head: [100, 74], neck: [100, 90], hip: [88, 150], knee: [120, 152], ankle: [124, 183], toe: [138, 185], elbow: [118, 106], wrist: [132, 112] }),
    s({ head: [100, 74], neck: [100, 90], hip: [88, 150], knee: [120, 152], ankle: [124, 183], toe: [138, 185], elbow: [80, 108], wrist: [66, 116] }),
  ],
  calf: [
    s({}),
    s({ head: [100, 28], neck: [100, 44], hip: [100, 98], knee: [101, 136], ankle: [102, 172], toe: [114, 185] }),
  ],
  walk: [
    s({ knee: [112, 146], ankle: [118, 183], toe: [131, 185], kneeF: [92, 147], ankleF: [82, 182], toeF: [92, 185] }),
    s({ knee: [92, 147], ankle: [82, 182], toe: [92, 185], kneeF: [112, 146], ankleF: [118, 183], toeF: [131, 185] }),
  ],
  run: [
    s({ head: [104, 40], neck: [102, 56], knee: [124, 132], ankle: [114, 160], toe: [126, 162], kneeF: [94, 148], ankleF: [78, 176], toeF: [86, 183], elbow: [88, 80], wrist: [104, 96], elbowF: [114, 80], wristF: [126, 66] }),
    s({ head: [104, 40], neck: [102, 56], knee: [94, 148], ankle: [78, 176], toe: [86, 183], kneeF: [124, 132], ankleF: [114, 160], toeF: [126, 162], elbow: [114, 80], wrist: [126, 66], elbowF: [88, 80], wristF: [104, 96] }),
  ],
  stretch: [
    s({ elbow: [101, 82], wrist: [102, 108] }),
    s({ head: [104, 40], elbow: [104, 28], wrist: [110, 6] }),
  ],
};

function poseKey(ex: Pick<Exercise, "pattern" | "equipment" | "id">): string {
  const p: MovementPattern = ex.pattern;
  if (p === "horizontal_push") return ex.equipment.some((e) => e === "bench" || e === "barbell" || e === "dumbbells" || e === "machines") ? "bench_press" : "push_up";
  if (p === "core_anti_extension") return "plank";
  if (p === "core_flexion") return "crunch";
  if (p === "core_rotation") return "rotation";
  if (p === "carry") return "walk";
  if (p === "cardio") return "run";
  if (p === "mobility") return "stretch";
  return POSES[p] ? p : "stretch";
}

const pts = (...ps: P[]) => ps.map((q) => q.join(",")).join(" ");
const limb = (a: Pose) => ({
  torso: pts(a.neck, a.hip),
  legN: pts(a.hip, a.knee, a.ankle, a.toe),
  legF: pts(a.hip, a.kneeF ?? a.knee, a.ankleF ?? a.ankle, a.toeF ?? a.toe),
  armN: pts(a.neck, a.elbow, a.wrist),
  armF: pts(a.neck, a.elbowF ?? a.elbow, a.wristF ?? a.wrist),
});

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

function Equip({ kind }: { kind: Equipment | null }) {
  if (kind === "barbell") return <g><rect x={-3} y={-14} width={6} height={28} rx={2} /><circle r={11} fillOpacity={0.35} /></g>;
  if (kind === "dumbbells") return <rect x={-8} y={-4} width={16} height={8} rx={3} />;
  if (kind === "kettlebells") return <g><circle cy={9} r={7} /><path d="M-4 3 Q0 -3 4 3" fill="none" strokeWidth={2} stroke="currentColor" /></g>;
  return null;
}

/**
 * `variant`: "female" dibuja una figura con coleta; "male", una figura con hombros más anchos y cabello corto.
 */
export function ExerciseDemo({ exercise, variant, className, size = 160 }: {
  exercise: Pick<Exercise, "pattern" | "equipment" | "id" | "name">; variant: "female" | "male"; className?: string; size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [a, b] = POSES[poseKey(exercise)];
  const la = limb(a);
  const lb = limb(b);
  const kind = (["barbell", "dumbbells", "kettlebells"] as const).find((k) => exercise.equipment.includes(k)) ?? null;
  const female = variant === "female";
  const dur = poseKey(exercise) === "run" || poseKey(exercise) === "walk" ? "1.2s" : "2.6s";
  const anim = (attr: string, from: string, to: string) => reduced ? null : (
    <animate attributeName={attr} dur={dur} repeatCount="indefinite" values={`${from};${to};${from}`} keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
  );
  const move = (from: P, to: P) => reduced ? null : (
    <animateTransform attributeName="transform" type="translate" dur={dur} repeatCount="indefinite"
      values={`${from.join(" ")};${to.join(" ")};${from.join(" ")}`} keyTimes="0;0.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
  );
  const line = (key: keyof ReturnType<typeof limb>, width: number, opacity = 1) => (
    <polyline points={la[key]} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      {anim("points", la[key], lb[key])}
    </polyline>
  );
  const torsoW = female ? 13 : 16;
  const limbW = female ? 8 : 9.5;
  const pullBar = exercise.pattern === "vertical_pull";
  const bench = poseKey(exercise) === "bench_press" || poseKey(exercise) === "hip_extension";

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img"
      aria-label={`Animación de referencia: ${female ? "mujer" : "hombre"} haciendo ${exercise.name}`}>
      <line x1="10" y1="186" x2="190" y2="186" stroke="currentColor" strokeOpacity={0.18} strokeWidth={3} strokeLinecap="round" />
      {pullBar && <line x1="70" y1="12" x2="130" y2="12" stroke="currentColor" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />}
      {bench && <rect x={poseKey(exercise) === "bench_press" ? 30 : 20} y={poseKey(exercise) === "bench_press" ? 152 : 156} width={poseKey(exercise) === "bench_press" ? 100 : 40} height={8} rx={4} fill="currentColor" opacity={0.18} />}
      <g className="text-text">
        {line("legF", limbW, 0.4)}
        {line("armF", limbW - 1.5, 0.4)}
        {line("torso", torsoW)}
        {line("legN", limbW)}
        <g transform={`translate(${a.head.join(" ")})`}>
          {move(a.head, b.head)}
          {female ? (
            <>
              <path d="M-9 -6 Q-22 -4 -24 12 Q-16 6 -10 4 Z" fill="rgb(var(--primary-strong))" />
              <circle r={11} fill="currentColor" />
              <path d="M-11 -2 Q-8 -14 4 -12 Q10 -10 11 -4 Q2 -8 -11 -2 Z" fill="rgb(var(--primary-strong))" />
            </>
          ) : (
            <>
              <circle r={12} fill="currentColor" />
              <path d="M-12 -2 Q-10 -15 2 -14 Q11 -12 12 -5 Q0 -9 -12 -2 Z" fill="rgb(var(--primary-strong))" />
            </>
          )}
        </g>
        {line("armN", limbW - 0.5)}
        {kind && (
          <g transform={`translate(${a.wrist.join(" ")})`} fill="rgb(var(--primary-strong))" className="text-primary-strong">
            {move(a.wrist, b.wrist)}
            <Equip kind={kind} />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Figura según el perfil: sexo declarado o, si falta, el tema elegido. */
export function demoVariant(sex: "female" | "male" | null | undefined, theme: string): "female" | "male" {
  if (sex) return sex;
  return theme === "bro" ? "male" : "female";
}
