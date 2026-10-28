import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, diffDays } from "../app/js/dates.js";
import { averageCycleLength, cycleDay, getCycleInfo, phaseForDay } from "../app/js/cycle.js";
import { dailyTargets, LUTEAL_EXTRA_KCAL } from "../app/js/nutrition.js";
import { levelFor, questsFor, stageFor, streakFor, totalXP } from "../app/js/quests.js";

test("fechas cruzan meses y años", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(diffDays("2026-02-27", "2026-03-01"), 2);
});

test("día del ciclo es cíclico y tolera fechas anteriores", () => {
  assert.equal(cycleDay("2026-10-01", 28, "2026-10-01"), 1);
  assert.equal(cycleDay("2026-10-01", 28, "2026-10-29"), 1);
  assert.equal(cycleDay("2026-10-01", 28, "2026-09-30"), 28);
});

test("fases de un ciclo de 28 días", () => {
  const phases = Array.from({ length: 28 }, (_, i) => phaseForDay(i + 1, 28, 5));
  assert.deepEqual(phases.slice(0, 5), Array(5).fill("menstrual"));
  assert.equal(phases[12 - 1], "follicular");
  assert.deepEqual(phases.slice(13 - 1, 15), ["ovulatory", "ovulatory", "ovulatory"]);
  assert.equal(phases[16 - 1], "luteal");
  assert.equal(phases[28 - 1], "luteal");
});

test("predicciones del ciclo", () => {
  const info = getCycleInfo({ lastPeriodStart: "2026-10-01", cycleLength: 28, periodLength: 5 }, "2026-10-10");
  assert.equal(info.day, 10);
  assert.equal(info.nextPeriod, "2026-10-29");
  assert.equal(info.ovulation, "2026-10-14");
  assert.equal(info.fertileStart, "2026-10-09");
  assert.equal(info.fertileEnd, "2026-10-15");
});

test("media de ciclos ignora valores fuera de rango", () => {
  assert.equal(averageCycleLength(["2026-07-01", "2026-07-31", "2026-08-30"], 28), 30);
  assert.equal(averageCycleLength(["2026-07-01", "2026-09-30"], 28), 28);
});

test("la fase lútea suma calorías y mantiene macros coherentes", () => {
  const p = { weight: 62, height: 162, age: 28, activity: "moderate", goal: "maintain" };
  const f = dailyTargets(p, "follicular");
  const l = dailyTargets(p, "luteal");
  assert.equal(l.kcal - f.kcal, LUTEAL_EXTRA_KCAL);
  assert.equal(f.protein, Math.round(62 * 1.8));
  assert.ok(Math.abs(f.protein * 4 + f.carbs * 4 + f.fat * 9 - f.kcal) <= 4);
});

test("las misiones crecen por etapa y bajan de dificultad en la regla", () => {
  assert.equal(questsFor(1, "follicular").length, 3);
  assert.equal(questsFor(30, "follicular").length, 4);
  assert.equal(questsFor(66, "follicular").length, 5);
  assert.equal(stageFor(45).name, "Consolidación");
  const easy = questsFor(1, "menstrual").reduce((a, q) => a + q.xp, 0);
  const hard = questsFor(1, "ovulatory").reduce((a, q) => a + q.xp, 0);
  assert.ok(easy < hard);
});

test("XP con bonus por día completo y niveles", () => {
  const log = {
    "2026-10-01": { total: 2, done: { a: { xp: 10, stat: "mind" }, b: { xp: 20, stat: "strength" } } },
    "2026-10-02": { total: 3, done: { a: { xp: 10, stat: "mind" } } },
  };
  assert.equal(totalXP(log), 45 + 10);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(50).level, 2);
  assert.equal(levelFor(199).level, 2);
});

test("comodines protegen la racha y hoy no la rompe", () => {
  const start = "2026-10-01";
  const done = { total: 1, done: { a: { xp: 10, stat: "mind" } } };
  const log = {};
  for (let i = 0; i < 10; i++) if (i !== 8) log[addDays(start, i)] = done;
  // Día 9 (i=8) vacío: hay un comodín ganado en i=7, la racha sigue.
  const s = streakFor(log, start, addDays(start, 10));
  assert.equal(s.streak, 9);
  assert.equal(s.used, 1);
  assert.equal(s.freezes, 0);

  // Sin comodines disponibles, un día vacío reinicia la racha.
  const early = { [start]: done, [addDays(start, 2)]: done };
  assert.equal(streakFor(early, start, addDays(start, 2)).streak, 1);
});
