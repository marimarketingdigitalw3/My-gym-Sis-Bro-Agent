// Programa de 66 días con misiones adaptadas a la fase (Life Reset + ciclo).
import { addDays, diffDays } from "./dates.js";

export const PROGRAM_DAYS = 66;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
export const FULL_DAY_BONUS = 0.5;

export const STAGES = [
  { name: "Base", from: 1, to: 22, quests: 3 },
  { name: "Construcción", from: 23, to: 44, quests: 4 },
  { name: "Consolidación", from: 45, to: 66, quests: 5 },
];

// Cada misión tiene una versión por fase: [título, dificultad 1 a 3].
const TEMPLATES = {
  movement: {
    area: "Movimiento",
    stat: "strength",
    menstrual: ["Caminar 20 min o yoga suave", 1],
    follicular: ["Entreno de fuerza de 40 min subiendo peso", 3],
    ovulatory: ["Intenta un récord personal o un HIIT de 20 min", 3],
    luteal: ["Fuerza moderada de 30 min, sin buscar marcas", 2],
  },
  nutrition: {
    area: "Nutrición",
    stat: "energy",
    menstrual: ["Come una fuente de hierro (legumbres, carne o espinaca)", 1],
    follicular: ["Llega a tu objetivo de proteína", 2],
    ovulatory: ["Incluye 3 porciones de fruta o verdura", 2],
    luteal: ["Ten listo un snack con proteína para el antojo", 1],
  },
  water: {
    area: "Agua",
    stat: "energy",
    menstrual: ["Bebe 2 litros de agua (una infusión caliente cuenta)", 1],
    follicular: ["Bebe 2,5 litros de agua", 1],
    ovulatory: ["Bebe 2,5 litros y repón electrolitos si entrenas", 2],
    luteal: ["Bebe 2 litros y reduce la sal para evitar retención", 1],
  },
  sleep: {
    area: "Sueño",
    stat: "discipline",
    menstrual: ["Acuéstate 30 min antes de lo normal", 1],
    follicular: ["Duerme al menos 7 horas", 2],
    ovulatory: ["Duerme al menos 7 horas", 2],
    luteal: ["Sin cafeína después de las 2 p. m.", 2],
  },
  mind: {
    area: "Mente",
    stat: "mind",
    menstrual: ["5 min de respiración o diario", 1],
    follicular: ["Planea tus entrenos de la semana", 1],
    ovulatory: ["Haz eso que vienes posponiendo", 2],
    luteal: ["10 min de meditación o estiramiento", 1],
  },
  screen: {
    area: "Pantalla",
    stat: "discipline",
    menstrual: ["Sin redes la última hora antes de dormir", 2],
    follicular: ["Máximo 2 horas de redes hoy", 2],
    ovulatory: ["Entrena sin mirar el celular entre series", 2],
    luteal: ["Sin redes la última hora antes de dormir", 2],
  },
};

export const STATS = {
  strength: "Fuerza",
  energy: "Energía",
  discipline: "Disciplina",
  mind: "Mente",
};

export function programDay(startISO, dateISO) {
  return diffDays(startISO, dateISO) + 1;
}

export function stageFor(day) {
  return STAGES.find((s) => day >= s.from && day <= s.to) ?? STAGES[STAGES.length - 1];
}

function areasFor(day) {
  const base = ["movement", "nutrition", "water", "sleep"];
  const count = stageFor(day).quests;
  if (count <= base.length) return base.slice(0, count);
  return [...base, day % 2 ? "mind" : "screen"];
}

export function questsFor(day, phase) {
  return areasFor(day).map((key) => {
    const t = TEMPLATES[key];
    const [title, difficulty] = t[phase];
    return { id: key, area: t.area, stat: t.stat, title, difficulty, xp: difficulty * 10 };
  });
}

// log: { [fecha]: { total, done: { [questId]: { xp, stat } } } }
function dayXP(entry) {
  const done = Object.values(entry.done);
  const xp = done.reduce((a, q) => a + q.xp, 0);
  const full = entry.total > 0 && done.length >= entry.total;
  return Math.round(full ? xp * (1 + FULL_DAY_BONUS) : xp);
}

export function totalXP(log) {
  return Object.values(log).reduce((a, e) => a + dayXP(e), 0);
}

export function statTotals(log) {
  const totals = Object.fromEntries(Object.keys(STATS).map((k) => [k, 0]));
  for (const entry of Object.values(log)) {
    for (const q of Object.values(entry.done)) totals[q.stat] += q.xp;
  }
  return totals;
}

export function levelFor(xp) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  return { level, current: xp - 50 * (level - 1) ** 2, needed: 50 * level ** 2 - 50 * (level - 1) ** 2 };
}

// Racha con comodines: un día vacío gasta un comodín en vez de romper la racha.
// El día de hoy no rompe nada porque aún no termina.
export function streakFor(log, startISO, todayISO) {
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let used = 0;
  const days = diffDays(startISO, todayISO);
  for (let i = 0; i <= days; i++) {
    const date = addDays(startISO, i);
    if (i > 0 && i % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    const done = Object.keys(log[date]?.done ?? {}).length > 0;
    if (done) {
      streak++;
    } else if (date === todayISO) {
      continue;
    } else if (freezes > 0) {
      freezes--;
      used++;
    } else {
      streak = 0;
    }
    best = Math.max(best, streak);
  }
  return { streak, best, freezes, used };
}
