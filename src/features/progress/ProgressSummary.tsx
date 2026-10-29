// Resumen de progreso: racha, semana, objetivo, peso, récords y actividad reciente.
import { Check, Dumbbell, Flame, Target, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useBundle } from "@/app/providers";
import { AthleteArt } from "@/components/AthleteArt";
import { TrendChart } from "@/components/charts";
import { Card, CardHeader, cx, EmptyState, ErrorState, PageSkeleton, ProgressBar, Stat } from "@/components/ui";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { CHALLENGE_DAYS, computeStreak } from "@/lib/consistency";
import { addDays, formatLongDate, startOfWeek, todayISO, WEEKDAYS_SHORT } from "@/lib/dates";
import { formatWeight } from "@/lib/labels";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { GOAL_LABELS, primaryGoal } from "@/lib/userBundle";
import { personalRecords } from "@/lib/workouts/progression";
import { getRecovery, listMeasurements } from "@/services/tracking";
import { allSets, getActivePlan, listSessions } from "@/services/workouts";

export function ProgressSummary() {
  const bundle = useBundle();
  const today = todayISO();
  const { data, loading, error, reload } = useAsync(async () => {
    const [active, sessions, sets, measurements, recovery] = await Promise.all([
      getActivePlan(), listSessions(200), allSets(), listMeasurements(), getRecovery(today),
    ]);
    return { active, sessions, sets, measurements, recovery };
  }, [today]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ? errorMessage(error) : "No se pudo cargar tu progreso."} onRetry={reload} />;

  const { active, sessions, sets, measurements, recovery } = data;
  const theme = bundle.profile.theme;
  const weekStart = startOfWeek(today);
  const completed = sessions.filter((s) => s.status === "completed");
  const completedDates = new Set(completed.map((s) => s.started_at.slice(0, 10)));
  const completedThisWeek = completed.filter((s) => s.started_at.slice(0, 10) >= weekStart).length;
  const streak = computeStreak(new Set([...completedDates, ...(recovery ? [today] : [])]), bundle.profile.created_at.slice(0, 10), today);

  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }));
  const prs = personalRecords(sets).slice(0, 3);
  const goal = primaryGoal(bundle);
  const target = bundle.profile.target_weight_kg ? Number(bundle.profile.target_weight_kg) : null;
  const startWeight = weights[0]?.value ?? (bundle.profile.weight_kg ? Number(bundle.profile.weight_kg) : null);
  const latestWeight = weights[weights.length - 1]?.value ?? startWeight;
  const weightProgress = target && startWeight && latestWeight && startWeight !== target
    ? Math.max(0, Math.min(100, ((startWeight - latestWeight) / (startWeight - target)) * 100)) : null;

  return (
    <div className="space-y-5">
      {/* Racha y logros */}
      <section className="streak-card relative overflow-hidden rounded-card border border-border/60 p-5 shadow-card sm:p-7" aria-label="Racha">
        <div className="relative z-10 max-w-[58%] sm:max-w-[62%]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-text backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-headline" aria-hidden /> Racha activa
          </span>
          <p className="display-hero mt-3 text-3xl sm:text-4xl">
            {streak.streak > 0 ? <>Llevas una racha de <em>{streak.streak} {streak.streak === 1 ? "día" : "días"}</em></> : <>Hoy empieza <em>tu racha</em></>}
          </p>
          <p className="mt-2 text-sm text-muted">Día {streak.challengeDay} de {CHALLENGE_DAYS} del reto. Cada entrenamiento suma.</p>
          <ul className="mt-5 flex gap-3" aria-label="Logros">
            {[
              { label: "Sesiones", value: completed.length, done: completed.length > 0 },
              { label: "Mejor racha", value: streak.best, done: streak.best >= 7 },
              { label: "Reto 66", value: `${streak.challengeDay}`, done: streak.challengeDay >= CHALLENGE_DAYS },
            ].map((b) => (
              <li key={b.label} className="flex w-16 flex-col items-center text-center sm:w-20">
                <span className={cx("grid h-12 w-12 place-items-center rounded-full font-display text-lg font-semibold tabular-nums shadow-sm sm:h-14 sm:w-14",
                  b.done ? "bg-primary-strong text-on-primary" : "bg-surface/90 text-text ring-1 ring-border")}>{b.value}</span>
                <span className="mt-1 text-[11px] font-medium text-muted">{b.label}</span>
              </li>
            ))}
          </ul>
        </div>
        {theme === "neutral" ? (
          <Flame className="absolute -bottom-4 -right-4 h-44 w-44 text-[rgb(var(--streak-art)/0.12)] sm:h-56 sm:w-56" aria-hidden />
        ) : (
          <AthleteArt variant={theme} className="absolute -bottom-2 -right-3 h-[74%] max-w-[46%] w-auto opacity-90 text-[rgb(var(--streak-art))] sm:right-4" />
        )}
      </section>

      {/* Semana */}
      <Card className="tint-blue">
        <CardHeader title="Tu semana" subtitle={`${completedThisWeek} de ${active?.plan.days_per_week ?? 0} sesiones completadas`}
          action={<Link to="/workouts" className="text-sm font-semibold text-primary-strong">Ver plan</Link>} />
        <ol className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS_SHORT.map((label, i) => {
            const date = addDays(weekStart, i);
            const planned = active?.plan.schedule.some((d) => d.weekday === i);
            const done = completedDates.has(date);
            const isToday = date === today;
            return (
              <li key={label} className={cx("flex flex-col items-center gap-1.5 rounded-full border py-2.5 text-xs font-medium",
                isToday ? "border-primary-strong/30 bg-surface shadow-sm" : "border-border/60 bg-surface-2/50 text-muted")}>
                {label}
                <span aria-label={done ? "completado" : planned ? "planificado" : "descanso"}
                  className={cx("grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                    done ? "bg-primary-strong text-on-primary" : isToday ? "bg-primary-strong/10 text-text" : planned ? "bg-surface text-text" : "text-muted")}>
                  {done ? <Check className="h-4 w-4" /> : Number(date.slice(8, 10))}
                </span>
                <span className={cx("h-1 w-1 rounded-full", planned ? "bg-headline" : "bg-transparent")} aria-hidden />
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="tint-green">
          <CardHeader title="Tu objetivo" subtitle={GOAL_LABELS[goal]} icon={<Target className="h-5 w-5" />} />
          {weightProgress !== null && target ? (
            <>
              <ProgressBar value={weightProgress} label="Progreso hacia el peso objetivo" />
              <p className="mt-2 text-sm text-muted">{formatWeight(latestWeight, bundle.profile.units)} hoy · objetivo {formatWeight(target, bundle.profile.units)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Medimos tu avance con fuerza, constancia y cómo te sientes. Registra tu peso o medidas en Cuerpo si quieres seguirlos.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Sesiones" value={completed.length} hint="en total" />
            <Stat label="Días activos" value={streak.activeDays} hint="en el reto" />
          </div>
        </Card>

        <Card className="tint-yellow">
          <CardHeader title="Récords recientes" icon={<Trophy className="h-5 w-5" />} />
          {prs.length ? (
            <ul className="space-y-2">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{EXERCISE_BY_ID[p.exerciseId]?.name ?? p.exerciseId}</span>
                  <span className="shrink-0 font-semibold">{p.bestWeightKg > 0 ? `${formatWeight(p.bestWeightKg, bundle.profile.units)} × ${p.bestReps}` : `${p.bestReps} reps`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Completa tu primer entrenamiento para ver tus récords.</p>}
        </Card>

        <Card className="tint-purple md:col-span-2">
          <CardHeader title="Evolución del peso" icon={<Target className="h-5 w-5" />} />
          {weights.length >= 2
            ? <TrendChart data={weights} unit="kg" label="Peso" height={180} />
            : <EmptyState title="Aún no hay suficientes registros" description="Registra tu peso al menos dos veces en Cuerpo para ver la tendencia. El peso es solo una de muchas formas de medir tu progreso." />}
        </Card>
      </div>

      <Card>
        <CardHeader title="Actividad reciente" />
        {completed.length ? (
          <ul className="divide-y divide-border">
            {completed.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium">{s.title}</span>
                <span className="text-muted">{formatLongDate(s.started_at.slice(0, 10))}{s.duration_s ? ` · ${Math.round(s.duration_s / 60)} min` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Tu historial empieza hoy" description="Cuando completes un entrenamiento aparecerá aquí." icon={<Dumbbell className="h-5 w-5" />} />}
      </Card>
    </div>
  );
}
