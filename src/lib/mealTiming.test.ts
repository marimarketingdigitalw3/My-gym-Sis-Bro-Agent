import { describe, expect, it } from "vitest";
import { eatingWindow, supplementTime, windowStatus } from "./mealTiming";

const rest = { wake: "06:30", sleep: "22:30", trainingStart: null, trainingMinutes: 0 };

describe("eatingWindow", () => {
  it("perder grasa: 10 h, abre 1 h después de despertar y cierra 3 h antes de dormir como máximo", () => {
    const w = eatingWindow("lose_fat", rest);
    expect(w.start).toBe("07:30");
    expect(w.end).toBe("17:30");
    expect(w.hours).toBe(10);
  });
  it("ganar músculo: ventana más larga, cierra 2 h antes de dormir", () => {
    const w = eatingWindow("build_muscle", rest);
    expect(w.start).toBe("07:00");
    expect(w.end).toBe("20:00");
  });
  it("si entrena tarde, alarga el cierre para comer después de entrenar", () => {
    const w = eatingWindow("lose_fat", { ...rest, trainingStart: "18:00", trainingMinutes: 60 });
    expect(w.end).toBe("20:00");
    expect(w.notes.join(" ")).toMatch(/después de entrenar/);
  });
  it("si entrena antes de abrir, la primera comida es después del entreno", () => {
    const w = eatingWindow("lose_fat", { ...rest, trainingStart: "06:45", trainingMinutes: 45 });
    expect(w.start).toBe("07:45");
  });
  it("funciona si se duerme después de medianoche", () => {
    const w = eatingWindow("maintain", { wake: "09:00", sleep: "01:00", trainingStart: null, trainingMinutes: 0 });
    expect(w.start).toBe("09:30");
    expect(w.end).toBe("21:30");
  });
  it("reparte las comidas dentro de la ventana", () => {
    const w = eatingWindow("lose_fat", rest, 3);
    expect(w.meals.map((m) => m.time)).toEqual(["07:30", "12:30", "17:30"]);
  });
});

describe("windowStatus", () => {
  it("antes, abierta y cerrada", () => {
    expect(windowStatus({ start: "08:00", end: "18:00" }, "07:00")).toMatchObject({ state: "before", minutesLeft: 60 });
    expect(windowStatus({ start: "08:00", end: "18:00" }, "13:00")).toMatchObject({ state: "open", minutesLeft: 300, progress: 50 });
    expect(windowStatus({ start: "08:00", end: "18:00" }, "19:00").state).toBe("closed");
  });
});

describe("supplementTime", () => {
  const training = { ...rest, trainingStart: "17:00", trainingMinutes: 60 };
  const w = eatingWindow("build_muscle", training);
  it("creatina después de entrenar; en descanso con la primera comida", () => {
    expect(supplementTime("creatine", training, w).time).toBe("18:30");
    expect(supplementTime("creatine", rest, eatingWindow("build_muscle", rest)).time).toBe("07:00");
  });
  it("cafeína 45 min antes de entrenar y aviso si es muy tarde", () => {
    expect(supplementTime("caffeine", training, w)).toMatchObject({ time: "16:15" });
    expect(supplementTime("caffeine", training, w).warning).toBeUndefined();
    const late = { ...rest, trainingStart: "20:00", trainingMinutes: 60 };
    expect(supplementTime("caffeine", late, eatingWindow("maintain", late)).warning).toMatch(/sueño/);
    expect(supplementTime("caffeine", rest, w).time).toBeNull();
  });
  it("magnesio 1 h antes de dormir y hierro en ayunas", () => {
    expect(supplementTime("magnesium", rest, w).time).toBe("21:30");
    expect(supplementTime("iron", rest, w).time).toBe("07:00");
  });
});
