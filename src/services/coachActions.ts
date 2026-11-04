// Ejecuta en la app las acciones que propone el Gym AI Coach, reutilizando los mismos servicios que las pantallas.
import { EXERCISE_BY_ID } from "@/data/exercises";
import { startOfWeek, todayISO } from "@/lib/dates";
import { generateMealPlan } from "@/lib/meals";
import { addMinutes } from "@/lib/schedule";
import type { UserBundle } from "@/lib/userBundle";
import { moveDay, newDayMeta, suggestExercises } from "@/lib/workouts/focus";
import { nutritionFromBundle, selectionContextFromBundle } from "@/services/derived";
import { saveNutritionPrefs } from "@/services/profile";
import { saveMealPlan, setSupplementTaken, setWater, getWater } from "@/services/tracking";
import { addPlanExercise, getActivePlan, removePlanExercise, updatePlanExercise, updatePlanSchedule } from "@/services/workouts";
import type { NutritionPrefsRow } from "@/types/db";
import { WEEKDAY_NAMES, type CoachAction } from "../../supabase/functions/_shared/coachActions.ts";

export type ApplyResult = { ok: true; detail: string } | { ok: false; error: string };

const dayName = (w: number) => WEEKDAY_NAMES[w];

export async function applyCoachAction(a: CoachAction, bundle: UserBundle): Promise<ApplyResult> {
  try {
    switch (a.type) {
      case "set_training_time": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        if (a.weekday !== "all" && !active.plan.schedule.some((d) => d.weekday === a.weekday)) return { ok: false, error: `El ${dayName(a.weekday)} no tiene rutina.` };
        const next = active.plan.schedule.map((d) => (a.weekday === "all" || d.weekday === a.weekday ? { ...d, time: a.time } : d));
        await updatePlanSchedule(active.plan.id, next);
        return { ok: true, detail: "Horario actualizado en Entrenos." };
      }
      case "move_routine": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        const from = active.plan.schedule.find((d) => d.weekday === a.from_weekday);
        if (!from) return { ok: false, error: `El ${dayName(a.from_weekday)} no tiene rutina.` };
        await updatePlanSchedule(active.plan.id, moveDay(active.plan.schedule, from.dayIndex, a.to_weekday));
        return { ok: true, detail: `"${from.title}" ahora es el ${dayName(a.to_weekday)}.` };
      }
      case "create_routine": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        if (active.plan.schedule.some((d) => d.weekday === a.weekday)) return { ok: false, error: `El ${dayName(a.weekday)} ya tiene rutina. Pídeme moverla o quitarla primero.` };
        const meta = newDayMeta(active.plan.schedule, a.weekday, a.title, a.focus, active.plan.session_minutes + 10,
          ["5 minutos de cardio suave (caminar, bicicleta o marcha en el sitio)", "Movilidad articular de pies a cabeza", "1 o 2 series de aproximación ligeras del primer ejercicio"],
          ["Camina 2 a 3 minutos hasta normalizar la respiración", "Estira los músculos trabajados de 30 a 60 segundos"]);
        const next = [...active.plan.schedule, meta].sort((x, y) => x.weekday - y.weekday);
        await updatePlanSchedule(active.plan.id, next);
        const picks = a.suggest ? suggestExercises(a.focus, selectionContextFromBundle(bundle), 5) : [];
        await Promise.all(picks.map((ex, i) => addPlanExercise({
          plan_id: active.plan.id, day_index: meta.dayIndex, position: i, exercise_id: ex.id, sets: 3,
          rep_min: ex.defaultUnit === "reps" ? 10 : null, rep_max: ex.defaultUnit === "reps" ? 12 : null,
          duration_s: ex.defaultUnit === "seconds" ? 30 : null, rest_s: 75, target_rpe: 7, load_kg: null, notes: null,
        })));
        return { ok: true, detail: `"${meta.title}" creada el ${dayName(a.weekday)}${picks.length ? ` con ${picks.length} ejercicios` : ""}.` };
      }
      case "remove_routine": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        const day = active.plan.schedule.find((d) => d.weekday === a.weekday);
        if (!day) return { ok: false, error: `El ${dayName(a.weekday)} ya es descanso.` };
        if (active.plan.schedule.length <= 1) return { ok: false, error: "Tu plan necesita al menos un día de entrenamiento." };
        await Promise.all(active.exercises.filter((e) => e.day_index === day.dayIndex).map((e) => removePlanExercise(e.id)));
        await updatePlanSchedule(active.plan.id, active.plan.schedule.filter((d) => d.dayIndex !== day.dayIndex));
        return { ok: true, detail: `El ${dayName(a.weekday)} queda como descanso.` };
      }
      case "add_exercise": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        const day = active.plan.schedule.find((d) => d.weekday === a.weekday);
        const ex = EXERCISE_BY_ID[a.exercise_id];
        if (!day) return { ok: false, error: `El ${dayName(a.weekday)} no tiene rutina. Pídeme crearla.` };
        if (!ex) return { ok: false, error: "Ese ejercicio no está en el catálogo." };
        const position = active.exercises.filter((e) => e.day_index === day.dayIndex).length;
        const timed = ex.defaultUnit === "seconds";
        await addPlanExercise({
          plan_id: active.plan.id, day_index: day.dayIndex, position, exercise_id: ex.id, sets: a.sets,
          rep_min: timed ? null : a.rep_min, rep_max: timed ? null : a.rep_max, duration_s: timed ? 30 : null, rest_s: 60, target_rpe: 7, load_kg: null, notes: null,
        });
        return { ok: true, detail: `${ex.name} añadido a "${day.title}".` };
      }
      case "remove_exercise": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        const day = active.plan.schedule.find((d) => d.weekday === a.weekday);
        const row = day ? active.exercises.find((e) => e.day_index === day.dayIndex && e.exercise_id === a.exercise_id) : null;
        if (!row) return { ok: false, error: "Ese ejercicio no está en la rutina de ese día." };
        await removePlanExercise(row.id);
        return { ok: true, detail: `${EXERCISE_BY_ID[a.exercise_id]?.name ?? a.exercise_id} quitado del ${dayName(a.weekday)}.` };
      }
      case "swap_exercise": {
        const active = await getActivePlan();
        if (!active) return { ok: false, error: "No tienes un plan activo." };
        const day = active.plan.schedule.find((d) => d.weekday === a.weekday);
        const row = day ? active.exercises.find((e) => e.day_index === day.dayIndex && e.exercise_id === a.exercise_id) : null;
        const repl = EXERCISE_BY_ID[a.replacement_id];
        if (!row || !repl) return { ok: false, error: "No encontré ese ejercicio en la rutina o el reemplazo no existe." };
        await updatePlanExercise(row.id, { exercise_id: repl.id, ...(repl.defaultUnit === "seconds" && !row.duration_s ? { duration_s: 30, rep_min: null, rep_max: null } : {}) });
        return { ok: true, detail: `Cambiado por ${repl.name} el ${dayName(a.weekday)}.` };
      }
      case "set_supplements": {
        const current = bundle.nutrition?.supplements ?? [];
        const next = [...new Set([...current.filter((k) => !a.remove.includes(k)), ...a.add])];
        await saveNutritionPrefs({ supplements: next });
        return { ok: true, detail: "Lista de suplementos actualizada en Nutrición." };
      }
      case "set_day_rhythm": {
        const patch: Partial<NutritionPrefsRow> = {};
        if (a.wake_time) patch.wake_time = a.wake_time;
        if (a.sleep_time) patch.sleep_time = a.sleep_time;
        await saveNutritionPrefs(patch);
        return { ok: true, detail: "Ritmo del día actualizado; los horarios de comidas y suplementos se recalculan." };
      }
      case "set_nutrition_prefs": {
        const patch: Partial<NutritionPrefsRow> = {};
        if (a.meals_per_day) patch.meals_per_day = a.meals_per_day;
        if (a.diet) patch.diet = a.diet as NutritionPrefsRow["diet"];
        if (a.allergens) patch.allergens = a.allergens as NutritionPrefsRow["allergens"];
        if (a.dislikes) patch.dislikes = a.dislikes;
        await saveNutritionPrefs(patch);
        return { ok: true, detail: "Preferencias de alimentación guardadas." };
      }
      case "regenerate_meal_plan": {
        const prefs = bundle.nutrition;
        if (!prefs) return { ok: false, error: "Completa tus preferencias de alimentación primero." };
        const estimate = nutritionFromBundle(bundle);
        const targets = estimate.mode === "no_numbers" ? null : estimate.targets;
        const weekStart = startOfWeek(todayISO());
        await saveMealPlan(weekStart, generateMealPlan({ weekStart, prefs, targets }), targets);
        return { ok: true, detail: "Plan de comidas de la semana regenerado." };
      }
      case "log_water": {
        const today = todayISO();
        const current = await getWater(today);
        await setWater(today, current + a.ml);
        return { ok: true, detail: `${a.ml} ml de agua registrados (${current + a.ml} ml hoy).` };
      }
      case "log_supplement": {
        await setSupplementTaken(todayISO(), a.supplement, a.taken);
        return { ok: true, detail: a.taken ? "Suplemento marcado como tomado." : "Suplemento desmarcado." };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo aplicar el cambio." };
  }
}

// Reexport para que la UI no importe desde supabase/ directamente.
export { addMinutes };
