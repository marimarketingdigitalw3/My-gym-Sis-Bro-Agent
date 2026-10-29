import { describe, expect, it } from "vitest";
import { applyWeekOrder, matchesFocus, moveDay, newDayMeta, suggestExercises } from "./focus";
import { EXERCISE_BY_ID } from "@/data/exercises";
import type { SelectionContext } from "./generator";
import type { WorkoutDayMeta } from "@/types/db";

const ctx: SelectionContext = {
  equipment: new Set(["bodyweight", "dumbbells", "bench", "barbell", "machines", "cables", "bands", "kettlebells", "pullup_bar"]),
  limitations: new Set(), level: "intermediate", disliked: new Set(), dislikedPatterns: new Set(), lowImpactOnly: false,
};
const day = (dayIndex: number, weekday: number, title: string): WorkoutDayMeta =>
  ({ dayIndex, weekday, title, focus: "", warmup: [], cooldown: [], estimatedMinutes: 50 });

describe("grupos musculares", () => {
  it("sugiere ejercicios de glúteos compatibles y sin repetir", () => {
    const list = suggestExercises(["glutes"], ctx, 4);
    expect(list).toHaveLength(4);
    expect(new Set(list.map((e) => e.id)).size).toBe(4);
    for (const e of list) expect(e.primaryMuscles).toContain("glutes");
  });
  it("respeta las limitaciones: sin rodilla no sugiere ejercicios que la carguen", () => {
    const list = suggestExercises(["legs"], { ...ctx, limitations: new Set(["knee"]) }, 6);
    for (const e of list) expect(e.stressedJoints).not.toContain("knee");
  });
  it("femoral filtra isquiotibiales", () => {
    const ex = Object.values(EXERCISE_BY_ID).find((e) => e.primaryMuscles.includes("hamstrings"))!;
    expect(matchesFocus(ex, ["hamstrings"])).toBe(true);
    expect(matchesFocus(ex, ["chest"])).toBe(false);
  });
});

describe("orden de la semana", () => {
  const sched = [day(0, 0, "Pierna"), day(1, 2, "Torso"), day(2, 4, "Glúteos")];
  it("mover Glúteos al lunes intercambia con Pierna", () => {
    const next = moveDay(sched, 2, 0);
    expect(next.find((d) => d.title === "Glúteos")!.weekday).toBe(0);
    expect(next.find((d) => d.title === "Pierna")!.weekday).toBe(4);
  });
  it("mover a un día libre no afecta a las demás", () => {
    const next = moveDay(sched, 1, 3);
    expect(next.map((d) => d.weekday)).toEqual([0, 3, 4]);
  });
  it("aplica el orden arrastrado", () => {
    const next = applyWeekOrder(sched, [2, null, 0, null, 1, null, null]);
    expect(next.map((d) => [d.title, d.weekday])).toEqual([["Glúteos", 0], ["Pierna", 2], ["Torso", 4]]);
  });
  it("un día nuevo usa el primer índice libre", () => {
    expect(newDayMeta(sched, 5, "Femoral", ["hamstrings"], 50, [], []).dayIndex).toBe(3);
  });
});
