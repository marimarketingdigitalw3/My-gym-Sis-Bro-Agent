// Estado de ánimo de Gym Bot para toda la app: se recalcula al cambiar de pantalla.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useBundle } from "./providers";
import { computeMood, type MoodResult } from "@/lib/gymbotMood";
import { todayISO, weekdayIndex } from "@/lib/dates";
import { getRecovery } from "@/services/tracking";
import { getActivePlan, listSessions } from "@/services/workouts";
import { computeStreak } from "@/lib/consistency";

const MoodCtx = createContext<MoodResult | null>(null);

export function GymBotMoodProvider({ children }: { children: ReactNode }) {
  const bundle = useBundle();
  const { pathname } = useLocation();
  const [mood, setMood] = useState<MoodResult | null>(null);
  const since = bundle.profile.created_at.slice(0, 10);

  useEffect(() => {
    let active = true;
    const today = todayISO();
    Promise.all([getActivePlan(), listSessions(60), getRecovery(today)])
      .then(([plan, sessions, recovery]) => {
        if (!active) return;
        const completedDates = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.started_at.slice(0, 10)));
        const activeDates = new Set([...completedDates, ...(recovery ? [today] : [])]);
        const todayIdx = weekdayIndex(today);
        setMood(computeMood({
          today, todayIdx, completedDates, recovery, since,
          plannedWeekdays: plan?.plan.schedule.map((d) => d.weekday) ?? [],
          streak: computeStreak(activeDates, since, today).streak,
          nextTitle: plan?.plan.schedule.find((d) => d.weekday === todayIdx)?.title ?? null,
        }));
      })
      .catch(() => active && setMood(null));
    return () => {
      active = false;
    };
  }, [pathname, since]);

  return <MoodCtx.Provider value={mood}>{children}</MoodCtx.Provider>;
}

export const useGymBotMood = () => useContext(MoodCtx);
