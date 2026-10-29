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
  // Bicicleta estática: sentado en el sillín, manos en el manubrio, piernas pedaleando.
  bike: [
    { head: [120, 34], neck: [112, 50], hip: [70, 104], knee: [104, 124], ankle: [98, 158], toe: [110, 160], kneeF: [90, 144], ankleF: [74, 164], toeF: [86, 166], elbow: [132, 78], wrist: [150, 90] },
    { head: [120, 34], neck: [112, 50], hip: [70, 104], knee: [90, 144], ankle: [74, 164], toe: [86, 166], kneeF: [104, 124], ankleF: [98, 158], toeF: [110, 160], elbow: [132, 78], wrist: [150, 90] },
  ],
  // Cinta: caminata o trote sobre la banda.
  treadmill: [
    s({ head: [104, 46], neck: [102, 62], hip: [100, 114], knee: [120, 144], ankle: [114, 168], toe: [126, 170], kneeF: [92, 150], ankleF: [82, 172], toeF: [90, 175], elbow: [90, 86], wrist: [104, 100], elbowF: [114, 86], wristF: [126, 74] }),
    s({ head: [104, 46], neck: [102, 62], hip: [100, 114], knee: [92, 150], ankle: [82, 172], toe: [90, 175], kneeF: [120, 144], ankleF: [114, 168], toeF: [126, 170], elbow: [114, 86], wrist: [126, 74], elbowF: [90, 86], wristF: [104, 100] }),
  ],
  // Elíptica: de pie, brazos en los mangos, piernas en elipse.
  elliptical: [
    { head: [102, 34], neck: [100, 50], hip: [98, 104], knee: [118, 134], ankle: [120, 162], toe: [132, 164], kneeF: [84, 136], ankleF: [78, 164], toeF: [90, 166], elbow: [114, 78], wrist: [134, 60], elbowF: [88, 78], wristF: [110, 92] },
    { head: [102, 34], neck: [100, 50], hip: [98, 104], knee: [84, 136], ankle: [78, 164], toe: [90, 166], kneeF: [118, 134], ankleF: [120, 162], toeF: [132, 164], elbow: [88, 78], wrist: [110, 92], elbowF: [114, 78], wristF: [134, 60] },
  ],
  // Remo: sentado, se desliza atrás y tira del mango.
  rower: [
    { head: [116, 88], neck: [108, 102], hip: [84, 150], knee: [122, 128], ankle: [146, 156], toe: [156, 160], elbow: [128, 118], wrist: [148, 130] },
    { head: [78, 84], neck: [84, 100], hip: [66, 150], knee: [104, 146], ankle: [146, 156], toe: [156, 160], elbow: [74, 128], wrist: [100, 128] },
  ],
};

/** Ejercicios de cardio con máquina propia. */
const MACHINE_BY_ID: Record<string, string> = {
  "stationary-bike": "bike", "treadmill-incline-walk": "treadmill", elliptical: "elliptical", "rowing-machine": "rower",
};

function poseKey(ex: Pick<Exercise, "pattern" | "equipment" | "id">): string {
  const p: MovementPattern = ex.pattern;
  if (p === "horizontal_push") return ex.equipment.some((e) => e === "bench" || e === "barbell" || e === "dumbbells" || e === "machines") ? "bench_press" : "push_up";
  if (p === "core_anti_extension") return "plank";
  if (p === "core_flexion") return "crunch";
  if (p === "core_rotation") return "rotation";
  if (p === "carry") return "walk";
  if (p === "cardio") return MACHINE_BY_ID[ex.id] ?? "run";
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
// Estilo plano de la referencia: formas suaves sin contorno, piel durazno y ropa lila o violeta.
const PALETTES: Record<"female" | "male", Palette> = {
  female: { skin: "#F2BFA4", skinFar: "#DDA186", top: "#F08AA8", topFar: "#D9709A", bottom: "#6D4FD6", bottomFar: "#5A3FB8", hair: "#3B2A2A", shoe: "#FFFFFF", shoeFar: "#DDE0EE", accent: "#FFD23F" },
  male: { skin: "#F2BFA4", skinFar: "#DDA186", top: "#A99CF2", topFar: "#8E80E0", bottom: "#6D4FD6", bottomFar: "#5A3FB8", hair: "#3B2A2A", shoe: "#FFFFFF", shoeFar: "#DDE0EE", accent: "#6D4FD6" },
};
const MACHINE = { body: "#8F97B8", light: "#B3BAD4", dark: "#5E6788", base: "#E4E8F5" };

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

  const torsoW = female ? 20 : 24;
  const thighW = female ? 13 : 13;
  const shinW = female ? 9.5 : 9.5;
  const upperArmW = female ? 8 : 9;
  const foreArmW = female ? 7 : 8;
  const pullBar = exercise.pattern === "vertical_pull";
  const benchKind = key === "bench_press" ? "bench" : key === "hip_extension" ? "box" : null;
  const machine = (["bike", "treadmill", "elliptical", "rower"] as const).find((m) => m === key) ?? null;
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
      {/* Escenario: base suave como en la referencia */}
      <rect x={Math.max(8, shadowX - 64)} y={183} width={128} height={9} rx={4.5} fill={MACHINE.base} />
      {pullBar && (
        <g stroke={MACHINE.body} strokeLinecap="round">
          <line x1="64" y1="12" x2="136" y2="12" strokeWidth={6} />
          <line x1="66" y1="12" x2="66" y2="184" strokeWidth={5} opacity={0.6} />
          <line x1="134" y1="12" x2="134" y2="184" strokeWidth={5} opacity={0.6} />
        </g>
      )}
      {benchKind === "bench" && (
        <g>
          <rect x={26} y={150} width={104} height={11} rx={5.5} fill={MACHINE.dark} />
          <rect x={40} y={160} width={7} height={24} rx={3} fill={MACHINE.body} />
          <rect x={110} y={160} width={7} height={24} rx={3} fill={MACHINE.body} />
        </g>
      )}
      {benchKind === "box" && <rect x={14} y={154} width={46} height={30} rx={8} fill={MACHINE.body} />}
      {machine === "bike" && (
        <g>
          {/* Cuerpo carenado con la rueda atrás, poste del sillín, manubrio alto y pedal que gira con el pie */}
          <path d="M70 184 Q58 184 58 170 Q58 150 86 148 L136 148 Q160 150 160 170 Q160 184 146 184 Z" fill={MACHINE.body} />
          <circle cx={132} cy={166} r={16} fill={MACHINE.dark} />
          <circle cx={132} cy={166} r={9} fill={MACHINE.body} />
          <path d="M70 104 L82 148" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <rect x={54} y={98} width={32} height={10} rx={5} fill={MACHINE.dark} />
          <path d="M140 148 L152 92" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <path d="M136 92 Q152 82 166 92" stroke={MACHINE.dark} strokeWidth={6} strokeLinecap="round" fill="none" />
          <rect x={138} y={76} width={22} height={9} rx={4.5} fill={MACHINE.dark} />
        </g>
      )}
      {machine === "treadmill" && (
        <g>
          <rect x={44} y={176} width={120} height={8} rx={4} fill={MACHINE.dark} />
          <path d="M150 176 L160 92" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <rect x={140} y={84} width={34} height={10} rx={5} fill={MACHINE.dark} />
          <rect x={150} y={70} width={20} height={14} rx={4} fill={MACHINE.body} />
        </g>
      )}
      {machine === "elliptical" && (
        <g>
          <rect x={46} y={176} width={110} height={8} rx={4} fill={MACHINE.dark} />
          <path d="M140 176 L144 52" stroke={MACHINE.light} strokeWidth={6} strokeLinecap="round" />
          <path d="M134 60 L128 100 M150 50 L152 90" stroke={MACHINE.body} strokeWidth={5} strokeLinecap="round" />
          <rect x={120} y={158} width={26} height={8} rx={4} fill={MACHINE.body} />
          <rect x={72} y={160} width={26} height={8} rx={4} fill={MACHINE.body} />
        </g>
      )}
      {machine === "rower" && (
        <g>
          <rect x={40} y={162} width={132} height={9} rx={4.5} fill={MACHINE.dark} />
          <rect x={56} y={150} width={38} height={12} rx={6} fill={MACHINE.body} />
          <circle cx={166} cy={146} r={16} fill={MACHINE.body} />
          <circle cx={166} cy={146} r={8} fill={MACHINE.dark} />
          <rect x={140} y={158} width={14} height={6} rx={3} fill={MACHINE.light} />
        </g>
      )}

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
          {/* Cabeza ovalada con mentón hacia el frente, como en la referencia */}
          <path d="M-10 -4 Q-11 -13 0 -13 Q12 -13 12 -1 Q12 8 8 11 Q3 14 -3 12 Q-10 9 -10 -4 Z" fill={c.skin} />
          {female ? (
            <>
              <path d="M-10.5 1 Q-12 -13 1 -13 Q11 -12.5 11.5 -3 Q4 -8 -3 -7 Q-8 -4 -10.5 1 Z" fill={c.hair} />
              <circle cx={-10.5} cy={-5} r={2.6} fill={c.accent} />
            </>
          ) : (
            <path d="M-10.5 2 Q-12 -14 2 -13.5 Q12 -12 12 -2 Q8 -6 3 -5.5 Q-2 -8 -6 -4 Q-9 -1 -10.5 2 Z" fill={c.hair} />
          )}
          <circle cx={7.5} cy={1} r={1.2} fill="#3B2A2A" opacity={0.7} />
        </g>
      </g>

      {arm(false)}

      {machine === "bike" && (
        <g transform={`translate(${A.toe.join(" ")})`} opacity={0.9}>
          {moveTo(A.toe as P, B.toe as P)}
          <rect x={-9} y={1} width={18} height={5} rx={2.5} fill={MACHINE.dark} />
        </g>
      )}
      {machine === "rower" && (
        <g transform={`translate(${A.wrist.join(" ")})`}>
          {moveTo(A.wrist as P, B.wrist as P)}
          <rect x={-3} y={-9} width={6} height={18} rx={3} fill={MACHINE.dark} />
        </g>
      )}

      {/* Equipo en la mano cercana */}
      {kind && (
        <g transform={`translate(${A.wrist.join(" ")})`}>
          {moveTo(A.wrist as P, B.wrist as P)}
          {kind === "barbell" && (
            <g>
              <circle r={15} fill={MACHINE.dark} />
              <circle r={10} fill="none" stroke={MACHINE.body} strokeWidth={2} />
              <circle r={3} fill={MACHINE.light} />
            </g>
          )}
          {kind === "dumbbells" && (
            <g>
              <rect x={-9} y={-3} width={18} height={6} rx={2} fill={MACHINE.light} />
              <rect x={-11} y={-7} width={6} height={14} rx={2} fill={MACHINE.dark} />
              <rect x={5} y={-7} width={6} height={14} rx={2} fill={MACHINE.dark} />
            </g>
          )}
          {kind === "kettlebells" && (
            <g>
              <path d="M-5 0 Q0 -8 5 0" fill="none" stroke={MACHINE.dark} strokeWidth={3} />
              <circle cy={8} r={8} fill={MACHINE.dark} />
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
