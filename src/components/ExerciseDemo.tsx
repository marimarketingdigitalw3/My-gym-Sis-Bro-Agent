// Animación de referencia de un ejercicio: una figura de perfil (mujer u hombre) pasa de la posición
// inicial a la final según el patrón de movimiento. Es una guía visual; los pasos escritos mandan.
import { useEffect, useState } from "react";
import type { Exercise, MovementPattern } from "@/types/domain";

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

const KEY_SPLINES = ".45 0 .55 1;.45 0 .55 1";

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

// ---------- Geometría ----------
const add = (p: P, q: P): P => [p[0] + q[0], p[1] + q[1]];
const lerp = (p: P, q: P, t: number): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const round = (p: P): P => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];

/** Puntos derivados de una pose: hombro, cintura, pecho y orientación de la cabeza. */
function rig(a: Pose) {
  const shoulder = add(a.neck, [0, 3]);
  const v: P = [a.hip[0] - shoulder[0], a.hip[1] - shoulder[1]];
  const len = Math.hypot(v[0], v[1]) || 1;
  const front: P = [v[1] / len, -v[0] / len]; // perpendicular hacia el frente de la figura
  const chest = add(lerp(shoulder, a.hip, 0.3), [front[0] * 7, front[1] * 7]);
  const waist = lerp(shoulder, a.hip, 0.62);
  const headAngle = (Math.atan2(a.head[1] - a.neck[1], a.head[0] - a.neck[0]) * 180) / Math.PI + 90;
  return {
    ...a, shoulder, chest: round(chest), waist: round(waist), headAngle: Math.round(headAngle),
    kneeF: a.kneeF ?? a.knee, ankleF: a.ankleF ?? a.ankle, toeF: a.toeF ?? a.toe,
    elbowF: a.elbowF ?? a.elbow, wristF: a.wristF ?? a.wrist,
  };
}
type Rig = ReturnType<typeof rig>;
type Joint = Exclude<keyof Rig, "headAngle">;

interface Palette { skin: string; skinFar: string; top: string; topFar: string; bottom: string; bottomFar: string; hair: string; shoe: string; shoeFar: string; accent: string }
const PALETTES: Record<"female" | "male", Palette> = {
  female: { skin: "#E9B897", skinFar: "#D09A78", top: "#E2557B", topFar: "#C2405F", bottom: "#2E2A3A", bottomFar: "#4A4459", hair: "#4A2E22", shoe: "#F3F4F6", shoeFar: "#C9CCD3", accent: "#FFD23F" },
  male: { skin: "#C98E6A", skinFar: "#AE7553", top: "#2F6FDB", topFar: "#2459B5", bottom: "#1F2430", bottomFar: "#3A4150", hair: "#2B201B", shoe: "#F3F4F6", shoeFar: "#C9CCD3", accent: "#35D68A" },
};

/**
 * `variant`: "female" dibuja una mujer (top deportivo, leggings y coleta); "male", un hombre
 * (camiseta sin mangas, pantaloneta y cabello corto). Vista lateral, animada entre la posición inicial y la final.
 */
export function ExerciseDemo({ exercise, variant, className, size = 160 }: {
  exercise: Pick<Exercise, "pattern" | "equipment" | "id" | "name">; variant: "female" | "male"; className?: string; size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const key = poseKey(exercise);
  const [pa, pb] = POSES[key];
  const A = rig(pa);
  const B = rig(pb);
  const female = variant === "female";
  const c = PALETTES[variant];
  const dur = key === "run" || key === "walk" ? "1.1s" : "2.8s";
  const kind = (["barbell", "dumbbells", "kettlebells"] as const).find((k) => exercise.equipment.includes(k)) ?? null;

  const anim = (attr: string, from: number, to: number) => reduced || from === to ? null : (
    <animate attributeName={attr} dur={dur} repeatCount="indefinite" values={`${from};${to};${from}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
  );
  const moveTo = (from: P, to: P) => reduced ? null : (
    <animateTransform attributeName="transform" type="translate" dur={dur} repeatCount="indefinite"
      values={`${from.join(" ")};${to.join(" ")};${from.join(" ")}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
  );
  /** Segmento redondeado entre dos articulaciones (miembro con volumen). */
  const seg = (p: Joint, q: Joint, w: number, color: string) => {
    const [x1, y1] = A[p] as P; const [x2, y2] = A[q] as P;
    const [bx1, by1] = B[p] as P; const [bx2, by2] = B[q] as P;
    return (
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round">
        {anim("x1", x1, bx1)}{anim("y1", y1, by1)}{anim("x2", x2, bx2)}{anim("y2", y2, by2)}
      </line>
    );
  };
  const dot = (p: Joint, r: number, color: string) => {
    const [x, y] = A[p] as P; const [bx, by] = B[p] as P;
    return <circle cx={x} cy={y} r={r} fill={color}>{anim("cx", x, bx)}{anim("cy", y, by)}</circle>;
  };

  const torsoW = female ? 21 : 25;
  const thighW = female ? 15 : 16;
  const shinW = female ? 11 : 12;
  const upperArmW = female ? 8.5 : 10.5;
  const foreArmW = female ? 7.5 : 9;
  const pullBar = exercise.pattern === "vertical_pull";
  const benchKind = key === "bench_press" ? "bench" : key === "hip_extension" ? "box" : null;
  const shadowX = (A.hip[0] + A.ankle[0]) / 2;

  // Piernas: leggings completas en ella; pantaloneta y pierna descubierta en él.
  const leg = (far: boolean) => {
    const sfx = far ? "F" : "";
    const knee = `knee${sfx}` as Joint; const ankle = `ankle${sfx}` as Joint; const toe = `toe${sfx}` as Joint;
    return (
      <g>
        {seg("hip", knee, thighW, far ? c.bottomFar : c.bottom)}
        {seg(knee, ankle, shinW, female ? (far ? c.bottomFar : c.bottom) : (far ? c.skinFar : c.skin))}
        {!female && seg("hip", knee, thighW + 1, far ? c.bottomFar : c.bottom)}
        {seg(ankle, toe, 9, far ? c.shoeFar : c.shoe)}
      </g>
    );
  };
  const arm = (far: boolean) => {
    const sfx = far ? "F" : "";
    const elbow = `elbow${sfx}` as Joint; const wrist = `wrist${sfx}` as Joint;
    return (
      <g>
        {seg("shoulder", elbow, upperArmW, far ? c.skinFar : c.skin)}
        {seg(elbow, wrist, foreArmW, far ? c.skinFar : c.skin)}
        {dot(wrist, foreArmW / 2 + 1, far ? c.skinFar : c.skin)}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img"
      aria-label={`Animación de referencia: ${female ? "mujer" : "hombre"} haciendo ${exercise.name}`}>
      {/* Escenario */}
      <ellipse cx={shadowX} cy={188} rx={46} ry={5} fill="#000" opacity={0.12} />
      <line x1="8" y1="187" x2="192" y2="187" stroke="currentColor" strokeOpacity={0.15} strokeWidth={2} strokeLinecap="round" />
      {pullBar && (
        <g stroke="#6B7280" strokeLinecap="round">
          <line x1="64" y1="12" x2="136" y2="12" strokeWidth={5} />
          <line x1="66" y1="12" x2="66" y2="186" strokeWidth={4} opacity={0.35} />
          <line x1="134" y1="12" x2="134" y2="186" strokeWidth={4} opacity={0.35} />
        </g>
      )}
      {benchKind === "bench" && (
        <g fill="#6B7280">
          <rect x={26} y={150} width={104} height={10} rx={4} />
          <rect x={40} y={160} width={6} height={26} rx={2} opacity={0.7} />
          <rect x={110} y={160} width={6} height={26} rx={2} opacity={0.7} />
        </g>
      )}
      {benchKind === "box" && <rect x={14} y={154} width={46} height={32} rx={6} fill="#6B7280" opacity={0.85} />}

      {/* Lado lejano */}
      {leg(true)}
      {arm(true)}

      {/* Tronco: top deportivo o camiseta; abdomen descubierto en el top de ella */}
      {female ? (
        <>
          {seg("waist", "hip", torsoW - 3, c.skin)}
          {seg("shoulder", "waist", torsoW, c.top)}
          {dot("chest", 7.5, c.top)}
          {dot("hip", torsoW / 2 + 0.5, c.bottom)}
        </>
      ) : (
        <>
          {seg("shoulder", "hip", torsoW, c.top)}
          {dot("hip", torsoW / 2 + 0.5, c.bottom)}
        </>
      )}
      {seg("neck", "shoulder", 8, c.skin)}

      {/* Lado cercano */}
      {leg(false)}

      {/* Cabeza: gira con la postura */}
      <g transform={`translate(${A.head.join(" ")})`}>
        {moveTo(A.head, B.head)}
        <g transform={`rotate(${A.headAngle})`}>
          {!reduced && A.headAngle !== B.headAngle && (
            <animateTransform attributeName="transform" type="rotate" dur={dur} repeatCount="indefinite"
              values={`${A.headAngle};${B.headAngle};${A.headAngle}`} keyTimes="0;0.5;1" calcMode="spline" keySplines={KEY_SPLINES} />
          )}
          {female && <path d="M-9 -7 Q-24 -6 -23 12 Q-19 5 -10 2 Z" fill={c.hair} />}
          <circle r={11.5} fill={c.skin} />
          {female ? (
            <>
              <path d="M-11.5 1 Q-13 -13 1 -13 Q11 -12.5 11.5 -3 Q4 -8 -3 -7 Q-8 -4 -11.5 1 Z" fill={c.hair} />
              <circle cx={-10.5} cy={-5} r={2.6} fill={c.accent} />
            </>
          ) : (
            <path d="M-11.5 0 Q-12.5 -14 1 -13.5 Q11.5 -12.5 11.5 -4 Q2 -8.5 -11.5 0 Z" fill={c.hair} />
          )}
          <circle cx={-2} cy={1} r={2.6} fill={c.skinFar} />
          <circle cx={6.5} cy={-1.5} r={1.4} fill="#1B1512" />
          <path d="M5 5 Q7.5 6.5 9.5 5" fill="none" stroke="#9A5B47" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      </g>

      {arm(false)}

      {/* Equipo en la mano cercana */}
      {kind && (
        <g transform={`translate(${A.wrist.join(" ")})`}>
          {moveTo(A.wrist as P, B.wrist as P)}
          {kind === "barbell" && (
            <g>
              <circle r={15} fill="#374151" />
              <circle r={10} fill="none" stroke="#6B7280" strokeWidth={2} />
              <circle r={3} fill="#D1D5DB" />
            </g>
          )}
          {kind === "dumbbells" && (
            <g>
              <rect x={-9} y={-3} width={18} height={6} rx={2} fill="#9CA3AF" />
              <rect x={-11} y={-7} width={6} height={14} rx={2} fill="#374151" />
              <rect x={5} y={-7} width={6} height={14} rx={2} fill="#374151" />
            </g>
          )}
          {kind === "kettlebells" && (
            <g>
              <path d="M-5 0 Q0 -8 5 0" fill="none" stroke="#374151" strokeWidth={3} />
              <circle cy={8} r={8} fill="#374151" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

/** Figura según el perfil: sexo declarado o, si falta, el tema elegido. */
export function demoVariant(sex: "female" | "male" | null | undefined, theme: string): "female" | "male" {
  if (sex) return sex;
  return theme === "bro" ? "male" : "female";
}
