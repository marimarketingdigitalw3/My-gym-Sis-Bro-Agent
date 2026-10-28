import { describe, expect, it } from "vitest";
import { computeMood, type MoodInput } from "./gymbotMood";

// 2026-10-28 es miércoles (índice 2); la semana empieza el lunes 26.
const base: MoodInput = {
  today: "2026-10-28", todayIdx: 2, plannedWeekdays: [0, 2, 4], completedDates: new Set(["2026-10-26"]),
  streak: 3, recovery: null, since: "2026-09-01", nextTitle: "Tren superior",
};

describe("computeMood", () => {
  it("feliz si ya entrenó hoy", () => {
    expect(computeMood({ ...base, completedDates: new Set(["2026-10-28"]) }).mood).toBe("feliz");
  });
  it("celebrando al completar la semana", () => {
    const r = computeMood({ ...base, plannedWeekdays: [0, 2], completedDates: new Set(["2026-10-26", "2026-10-28"]) });
    expect(r.mood).toBe("celebrando");
  });
  it("cansado con poca energía o poco sueño", () => {
    expect(computeMood({ ...base, recovery: { energy: 2, sleep_hours: 8, soreness: 1 } }).mood).toBe("cansado");
    expect(computeMood({ ...base, recovery: { energy: 4, sleep_hours: 5, soreness: 1 } }).mood).toBe("cansado");
  });
  it("gruñón con dos o más sesiones pendientes en la semana", () => {
    const r = computeMood({ ...base, todayIdx: 5, today: "2026-10-31", completedDates: new Set(["2026-10-26", "2026-10-30"]), plannedWeekdays: [0, 2, 4] });
    expect(r.mood).toBe("tranquilo"); // solo falta el miércoles: sin enojo, y el sábado es descanso
    expect(computeMood({ ...base, todayIdx: 5, today: "2026-10-31", completedDates: new Set(), plannedWeekdays: [0, 2, 4] }).mood).toBe("enojado");
  });
  it("triste tras cuatro días sin entrenar", () => {
    expect(computeMood({ ...base, plannedWeekdays: [2], todayIdx: 2, completedDates: new Set(["2026-10-20"]) }).mood).toBe("triste");
  });
  it("no se pone triste con una cuenta recién creada", () => {
    expect(computeMood({ ...base, completedDates: new Set(), since: "2026-10-27" }).mood).toBe("motivado");
  });
  it("motivado cuando hoy toca entrenar", () => {
    const r = computeMood(base);
    expect(r.mood).toBe("motivado");
    expect(r.message).toContain("Tren superior");
  });
  it("tranquilo en día de descanso", () => {
    expect(computeMood({ ...base, plannedWeekdays: [0], completedDates: new Set(["2026-10-26"]) }).mood).toBe("tranquilo");
  });
});
