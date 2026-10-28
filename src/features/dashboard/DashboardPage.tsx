import { ArrowRight, Bot, CalendarDays, CalendarHeart, Check, CheckCircle2, ChevronRight, Dumbbell, Flame, Snowflake, Target, Trophy, UtensilsCrossed } from "lucide-react";
import { AthleteArt } from "@/components/AthleteArt";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useBundle } from "@/app/providers";
import { TrendChart } from "@/components/charts";
import {
  Badge, Card, CardHeader, EmptyState, ErrorState, Notice, PageSkeleton, ProgressBar, ProgressRing, Stat, cx,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { trainingClearance } from "@/lib/clearance";
import { computeStreak, CHALLENGE_DAYS, weeklyCompletion } from "@/lib/consistency";
import { cycleTrainingSuggestion, estimateCycle, PHASE_INFO } from "@/lib/cycle";
import { addDays, formatLongDate, startOfWeek, todayISO, weekdayIndex, WEEKDAYS_SHORT } from "@/lib/dates";
import { formatWeight } from "@/lib/labels";
import { sumMacros } from "@/lib/nutrition";
import { personalRecords } from "@/lib/workouts/progression";
import { GOAL_LABELS, primaryGoal } from "@/lib/userBundle";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { nutritionFromBundle, showCalories } from "@/services/derived";
import { getRecovery, getWater, listCycleLogs, listMealLogs, listMeasurements } from "@/services/tracking";
import { allSets, getActivePlan, listSessions, startSession } from "@/services/workouts";
import { RecoveryCheckin } from "@/features/wellness/RecoveryCheckin";
import { WaterTracker } from "@/features/nutrition/WaterTracker";

export default function DashboardPage() {
  const bundle = useBundle();
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayISO();
  const [starting, setStarting] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [active, sessions, sets, measurements, meals, water, recovery, cycleLogs] = await Promise.all([
      getActivePlan(), listSessions(200), allSets(), listMeasurements(), listMealLogs(today, today), getWater(today), getRecovery(today),
      bundle.settings.cycle_tracking_enabled ? listCycleLogs() : Promise.resolve([]),
    ]);
    return { active, sessions, sets, measurements, meals, water, recovery, cycleLogs };
  }, [today]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo cargar tu panel."} onRetry={reload} />;

  const { active, sessions, sets, measurements, meals, water, recovery, cycleLogs } = data;
  const clearance = trainingClearance(bundle.onboarding?.health, recovery);
  const weekStart = startOfWeek(today);
  const todayIdx = weekdayIndex(today);
  const completed = sessions.filter((s) => s.status === "completed");
  const completedDates = new Set(completed.map((s) => s.started_at.slice(0, 10)));
  const completedThisWeek = completed.filter((s) => s.started_at.slice(0, 10) >= weekStart).length;
  const todayDay = active?.plan.schedule.find((d) => d.weekday === todayIdx) ?? null;
  const nextDay = active?.plan.schedule.find((d) => d.weekday > todayIdx) ?? active?.plan.schedule[0] ?? null;
  const todaysExercises = todayDay && active ? active.exercises.filter((e) => e.day_index === todayDay.dayIndex) : [];
  const doneToday = completedDates.has(today);

  const activeDates = new Set([...completedDates, ...(recovery ? [today] : [])]);
  const streak = computeStreak(activeDates, bundle.profile.created_at.slice(0, 10), today);

  const nutrition = nutritionFromBundle(bundle);
  const caloriesVisible = showCalories(bundle, nutrition);
  const eaten = sumMacros(meals);

  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }));
  const prs = personalRecords(sets).slice(0, 3);
  const goal = primaryGoal(bundle);
  const target = bundle.profile.target_weight_kg ? Number(bundle.profile.target_weight_kg) : null;
  const startWeight = weights[0]?.value ?? (bundle.profile.weight_kg ? Number(bundle.profile.weight_kg) : null);
  const latestWeight = weights[weights.length - 1]?.value ?? startWeight;
  const weightProgress = target && startWeight && latestWeight && startWeight !== target
    ? Math.max(0, Math.min(100, ((startWeight - latestWeight) / (startWeight - target)) * 100)) : null;

  const cycleEstimate = bundle.settings.cycle_tracking_enabled ? estimateCycle(bundle.cycle, cycleLogs, today) : null;
  const cycleToday = cycleLogs.find((c) => c.logged_on === today) ?? null;
  const cycleTip = cycleEstimate ? cycleTrainingSuggestion(cycleEstimate, cycleToday, bundle.cycle?.period_training_preference) : null;

  async function start(dayIndex: number, title: string) {
    if (!active) return;
    setStarting(true);
    try {
      const s = await startSession(active.plan.id, dayIndex, title);
      navigate(`/workouts/session/${s.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setStarting(false);
    }
  }

  const firstName = bundle.profile.display_name.split(" ")[0];
  const theme = bundle.profile.theme;
  return (
    <div className="space-y-5">
      {/* Saludo y resumen del día */}
      <section className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-muted first-letter:uppercase">{formatLongDate(today)}</p>
          <h1 className="display-hero mt-2 text-[2.35rem] sm:text-5xl">
            Hola, <em>{firstName}</em>
            <span className="block">{theme === "sis" ? <>Hoy toca <em>brillar</em></> : theme === "bro" ? "A darle con todo" : "Tu resumen de hoy"}</span>
          </h1>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-sm font-semibold shadow-sm" title="Racha actual">
          <Flame className="h-4 w-4 text-headline" aria-hidden /> {streak.streak} <span className="text-xs font-medium text-muted">días</span>
        </span>
      </section>

      <div className="flex items-center gap-4">
        <p className="flex items-baseline gap-3 tabular-nums">
          <span className="text-5xl font-semibold leading-none">{String(completedThisWeek).padStart(2, "0")}</span>
          <span className="h-10 w-px self-center bg-border" aria-hidden />
          <span className="text-5xl font-light leading-none text-muted">{String(active?.plan.days_per_week ?? 0).padStart(2, "0")}</span>
        </p>
        <p className="text-sm leading-tight text-muted">Sesiones<br />esta semana</p>
        <Link to="/workouts" aria-label="Ver plan semanal" className="ml-auto grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-surface shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </Link>
      </div>

      {clearance.status !== "ok" && (
        <Notice tone={clearance.status === "blocked" ? "danger" : "warning"} title={clearance.status === "blocked" ? "Entrenamiento en pausa" : "Tu plan tiene ajustes de seguridad"}>
          <ul className="list-disc space-y-1 pl-4">{clearance.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sesión de hoy */}
        <section className="relative overflow-hidden rounded-card border border-border/60 bg-surface shadow-card">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-80 blur-2xl"
            style={{ background: "radial-gradient(circle at 30% 30%, rgb(var(--primary) / .9), rgb(var(--accent) / .9) 55%, transparent 72%)" }} />
          <div className="relative p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{todayDay ? "Entrenamiento de hoy" : "Hoy"}</p>
            <h2 className="mt-1 text-2xl font-semibold">{clearance.status === "blocked" ? "Entrenamiento en pausa" : todayDay ? todayDay.title : "Día de descanso"}</h2>
            <p className="text-sm text-muted">{todayDay ? todayDay.focus : "Camina, estira o descansa."}</p>
            <div className="mt-5 flex gap-6 text-sm">
              <div>
                <p className="text-muted">{todayDay ? "Ejercicios" : "Próxima sesión"}</p>
                <p className="mt-0.5 font-semibold">{todayDay ? todaysExercises.length : nextDay ? `${WEEKDAYS_SHORT[nextDay.weekday]} · ${nextDay.title}` : "—"}</p>
              </div>
              {todayDay && <span className="w-px bg-border" aria-hidden />}
              {todayDay && (
                <div>
                  <p className="text-muted">Duración</p>
                  <p className="mt-0.5 font-semibold">~{todayDay.estimatedMinutes} min</p>
                </div>
              )}
            </div>
          </div>
          {clearance.status !== "blocked" && (todayDay || nextDay) && (
            doneToday && todayDay ? (
              <p className="relative flex items-center gap-2 border-t border-border/60 bg-surface-2/60 px-5 py-4 text-sm font-semibold text-success sm:px-6">
                <CheckCircle2 className="h-5 w-5" /> Sesión de hoy completada
              </p>
            ) : (
              <button type="button" disabled={starting}
                onClick={() => (todayDay ? start(todayDay.dayIndex, todayDay.title) : nextDay && start(nextDay.dayIndex, nextDay.title))}
                className="relative flex w-full items-center justify-between border-t border-border/60 bg-surface-2/60 px-5 py-4 text-left font-semibold transition hover:bg-surface-2 disabled:opacity-60 sm:px-6">
                {starting ? "Abriendo…" : todayDay ? "Empezar la sesión de hoy" : "Entrenar igual hoy"}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
            )
          )}
        </section>

        {/* Progreso semanal: tarjeta destacada */}
        <section className="feature-card rounded-card p-5 shadow-card sm:p-6" aria-label="Progreso de la semana">
          <p className="text-lg font-semibold">Progreso de la semana</p>
          <div className="mt-4 flex items-center gap-5">
            <ProgressRing value={weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)} size={128} stroke={14}
              color="var(--feature-ring)" track="var(--feature-fg) / .12" label="Cumplimiento semanal">
              <span className="text-2xl font-semibold">{weeklyCompletion(completedThisWeek, active?.plan.days_per_week ?? 0)}<span className="text-sm">%</span></span>
            </ProgressRing>
            <span className="h-24 w-px bg-feature-fg/15" aria-hidden />
            <ul className="space-y-3 text-sm">
              {[
                { icon: CalendarDays, value: active?.plan.days_per_week ?? 0, label: "Planificadas" },
                { icon: CheckCircle2, value: completedThisWeek, label: "Completadas" },
                { icon: Snowflake, value: streak.freezes, label: "Comodines" },
              ].map(({ icon: Icon, value, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-feature-fg/10"><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="leading-tight"><span className="block font-semibold tabular-nums">{value}</span><span className="text-xs opacity-70">{label}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Racha y logros: titular en cursiva con ilustración según el tema */}
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
                  b.done ? "bg-primary-strong text-on-primary" : "bg-surface/80 text-text")}>{b.value}</span>
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

      {/* Semana en píldoras */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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

        <RecoveryCheckin date={today} value={recovery} onSaved={(r) => setData((d) => (d ? { ...d, recovery: r } : d))} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Objetivo */}
        <Card>
          <CardHeader title="Tu objetivo" subtitle={GOAL_LABELS[goal]} icon={<Target className="h-5 w-5" />} />
          {weightProgress !== null && target ? (
            <>
              <ProgressBar value={weightProgress} label="Progreso hacia el peso objetivo" />
              <p className="mt-2 text-sm text-muted">{formatWeight(latestWeight, bundle.profile.units)} hoy · objetivo {formatWeight(target, bundle.profile.units)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Medimos tu avance con fuerza, constancia y cómo te sientes. Registra tu peso o medidas en Progreso si quieres seguirlos.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Sesiones" value={completed.length} hint="en total" />
            <Stat label="Días activos" value={streak.activeDays} hint="en el reto" />
          </div>
        </Card>

        {/* Nutrición */}
        <Card>
          <CardHeader title="Nutrición de hoy" icon={<UtensilsCrossed className="h-5 w-5" />} action={<Link to="/nutrition" className="text-sm font-semibold text-primary-strong">Abrir</Link>} />
          {nutrition.targets && caloriesVisible ? (
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span>Energía</span><span className="font-semibold">{Math.round(eaten.kcal)} / {nutrition.targets.kcal} kcal</span></div>
              <ProgressBar value={eaten.kcal} max={nutrition.targets.kcal} label="Calorías" />
              <div className="flex justify-between"><span>Proteína</span><span className="font-semibold">{Math.round(eaten.proteinG)} / {nutrition.targets.proteinG} g</span></div>
              <ProgressBar value={eaten.proteinG} max={nutrition.targets.proteinG} label="Proteína" />
              <p className="text-xs text-muted">Valores estimados.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">{meals.length ? `Registraste ${meals.length} comidas hoy.` : "Aún no registras comidas hoy."} Enfócate en comidas completas y regulares.</p>
          )}
        </Card>

        {bundle.settings.water_tracking_enabled && (
          <WaterTracker date={today} ml={water} goalMl={nutrition.targets?.waterMl ?? null} onChange={(ml) => setData((d) => (d ? { ...d, water: ml } : d))} />
        )}

        {/* Peso */}
        <Card className="md:col-span-2">
          <CardHeader title="Evolución del peso" icon={<Target className="h-5 w-5" />} action={<Link to="/progress" className="text-sm font-semibold text-primary-strong">Registrar</Link>} />
          {weights.length >= 2
            ? <TrendChart data={weights} unit="kg" label="Peso" height={180} />
            : <EmptyState title="Aún no hay suficientes registros" description="Registra tu peso al menos dos veces para ver la tendencia. El peso es solo una de muchas formas de medir tu progreso." />}
        </Card>

        {/* Fuerza */}
        <Card>
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

        {cycleEstimate && cycleTip && (
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader title="Cycle Wellness" icon={<CalendarHeart className="h-5 w-5" />} action={<Link to="/cycle" className="text-sm font-semibold text-primary-strong">Abrir</Link>} />
            {cycleEstimate.hasData && cycleEstimate.phase && (
              <Badge tone="primary">{PHASE_INFO[cycleEstimate.phase].name}{cycleEstimate.currentDay ? ` · día ${cycleEstimate.currentDay}` : ""}</Badge>
            )}
            <p className="mt-2 font-semibold">{cycleTip.headline}</p>
            <p className="mt-1 text-sm text-muted">{cycleTip.explanation}</p>
          </Card>
        )}

        {/* Coach */}
        <Link to="/coach" className="group md:col-span-2 lg:col-span-1">
          <Card className="flex h-full items-center gap-4 transition group-hover:border-primary-strong">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary-strong"><Bot className="h-6 w-6" /></span>
            <span className="flex-1">
              <span className="block font-semibold">Pregúntale a Gym AI Coach</span>
              <span className="block text-sm text-muted">“¿Qué entreno hoy?”, “¿Qué como después de entrenar?”</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" />
          </Card>
        </Link>
      </div>

      {/* Actividad reciente */}
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
