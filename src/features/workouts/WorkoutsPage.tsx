import { Clock, Info, Moon, Pencil, Play, Plus, RefreshCw, Repeat, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBundle, useUserData } from "@/app/providers";
import {
  Badge, Button, Card, CardHeader, cx, EmptyState, ErrorState, Field, IconButton, Input, Modal, Notice, PageHeader, PageSkeleton, Select, Tabs, useConfirm,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { trainingClearance } from "@/lib/clearance";
import { addDays, formatLongDate, startOfWeek, todayISO, weekdayIndex, WEEKDAYS } from "@/lib/dates";
import { addMinutes, dayStartTime, formatTime, TIME_RE } from "@/lib/schedule";
import { formatDuration, MUSCLE_LABELS } from "@/lib/labels";
import { substitutionOptions } from "@/lib/workouts/generator";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { generatorInputFromBundle, selectionContextFromBundle } from "@/services/derived";
import { saveOnboardingSection } from "@/services/profile";
import { getRecovery } from "@/services/tracking";
import {
  addPlanExercise, allSets, deleteSession, getActivePlan, listSessions, regeneratePlan, removePlanExercise, startSession, updatePlanExercise, updatePlanSchedule,
} from "@/services/workouts";
import type { WorkoutExerciseRow } from "@/types/db";
import { ExercisePicker } from "./ExercisePicker";

export default function WorkoutsPage() {
  const [tab, setTab] = useState<"plan" | "history">("plan");
  return (
    <div>
      <PageHeader title="Mis entrenamientos" subtitle="Tu plan semanal, adaptado a tu equipo, tiempo y nivel."
        action={<Link to="/exercises"><Button variant="outline" size="sm">Biblioteca de ejercicios</Button></Link>} />
      <div className="mb-5"><Tabs label="Secciones de entrenamiento" value={tab} onChange={setTab} items={[{ value: "plan", label: "Plan semanal" }, { value: "history", label: "Historial" }]} /></div>
      {tab === "plan" ? <PlanView /> : <HistoryView />}
    </div>
  );
}

function PlanView() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [active, recovery] = await Promise.all([getActivePlan(), getRecovery(todayISO())]);
    return { active, recovery };
  }, []);
  const todayIdx = weekdayIndex(todayISO());
  const [day, setDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<WorkoutExerciseRow | null>(null);
  const [swapping, setSwapping] = useState<WorkoutExerciseRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const ctx = useMemo(() => selectionContextFromBundle(bundle), [bundle]);

  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "No se pudo cargar tu plan."} onRetry={reload} />;
  const { active, recovery } = data;
  const clearance = trainingClearance(bundle.onboarding?.health, recovery);

  if (!active) {
    return (
      <EmptyState title="Todavía no tienes un plan activo" description="Lo generamos con tus respuestas del cuestionario."
        action={<Button loading={busy} onClick={async () => {
          setBusy(true);
          try { await regeneratePlan(generatorInputFromBundle(bundle)); await reload(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
        }}>Generar mi plan</Button>} />
    );
  }

  const schedule = active.plan.schedule;
  const preferredTime = bundle.onboarding?.lifestyle?.preferredTime;
  const selected = day ?? (schedule.find((d) => d.weekday >= todayIdx)?.dayIndex ?? schedule[0]?.dayIndex ?? 0);
  const meta = schedule.find((d) => d.dayIndex === selected);
  const exercises = active.exercises.filter((e) => e.day_index === selected).sort((a, b) => a.position - b.position);

  const patchLocal = (id: string, patch: Partial<WorkoutExerciseRow> | null) => setData((d) => d && d.active ? {
    ...d, active: { ...d.active, exercises: patch === null ? d.active.exercises.filter((e) => e.id !== id) : d.active.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) },
  } : d);

  async function start() {
    if (!meta) return;
    setBusy(true);
    try {
      const s = await startSession(active!.plan.id, meta.dayIndex, meta.title);
      navigate(`/workouts/session/${s.id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {clearance.status === "blocked" && <Notice tone="danger" title="Entrenamiento en pausa">{clearance.reasons[0]} Busca evaluación médica antes de seguir.</Notice>}

      <Card>
        <CardHeader title={active.plan.name} subtitle={`${active.plan.days_per_week} días · ${active.plan.session_minutes} min por sesión`}
          action={<Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}><RefreshCw className="h-4 w-4" /> Regenerar</Button>} />
        <details className="text-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-primary-strong"><Info className="h-4 w-4" /> ¿Por qué este plan?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{active.plan.rationale.map((r) => <li key={r}>{r}</li>)}</ul>
        </details>
      </Card>

      {/* Agenda semanal: cada día con su rutina y su horario */}
      <Card className="p-3 sm:p-4">
        <p className="px-2 pb-2 pt-1 text-sm font-semibold">Tu semana de entrenamiento</p>
        <ol className="space-y-1.5" aria-label="Días del plan">
          {WEEKDAYS.map((name, wd) => {
            const d = schedule.find((x) => x.weekday === wd);
            const date = addDays(startOfWeek(todayISO()), wd);
            const isToday = wd === todayIdx;
            if (!d) {
              return (
                <li key={name} className={cx("flex items-center gap-3 rounded-3xl px-3 py-2.5 text-sm text-muted", isToday && "bg-surface-2/70")}>
                  <DayBadge name={name} date={date} today={isToday} />
                  <span className="flex items-center gap-1.5"><Moon className="h-4 w-4" aria-hidden /> Descanso</span>
                </li>
              );
            }
            const start = dayStartTime(d, preferredTime);
            const sel = selected === d.dayIndex;
            return (
              <li key={name}>
                <button type="button" onClick={() => setDay(d.dayIndex)} aria-pressed={sel}
                  className={cx("flex w-full items-center gap-3 rounded-3xl border px-3 py-2.5 text-left transition",
                    sel ? "border-primary-strong/40 bg-primary-strong/10" : "border-transparent hover:bg-surface-2/70")}>
                  <DayBadge name={name} date={date} today={isToday} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.title}{isToday ? " (hoy)" : ""}</span>
                    <span className="block truncate text-xs text-muted">{d.focus}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-semibold tabular-nums">
                    {formatTime(start)}
                    <span className="block font-normal text-muted">{d.estimatedMinutes} min</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      {meta && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{WEEKDAYS[meta.weekday]}</p>
              <h2 className="text-2xl font-semibold">{meta.title}</h2>
              <p className="text-sm text-muted">{meta.focus} · ~{meta.estimatedMinutes} min</p>
              <button type="button" onClick={() => setTimeOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold hover:bg-border/60">
                <Clock className="h-4 w-4" aria-hidden />
                {formatTime(dayStartTime(meta, preferredTime))} a {formatTime(addMinutes(dayStartTime(meta, preferredTime), meta.estimatedMinutes))}
                <span className="sr-only">Cambiar hora</span><Pencil className="h-3.5 w-3.5 text-muted" aria-hidden />
              </button>
            </div>
            <Button onClick={start} loading={busy} disabled={clearance.status === "blocked" || exercises.length === 0}><Play className="h-4 w-4" /> Empezar sesión</Button>
          </div>

          <div className="mt-4 rounded-3xl bg-surface-2/70 p-3.5 text-sm">
            <p className="font-semibold">Calentamiento</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{meta.warmup.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>

          <ol className="mt-4 space-y-3">
            {exercises.map((e, i) => {
              const ex = EXERCISE_BY_ID[e.exercise_id];
              return (
                <li key={e.id} className="rounded-3xl border border-border/60 bg-surface-2/40 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">{i + 1}</p>
                      <Link to={`/exercises/${e.exercise_id}`} className="font-semibold hover:text-primary-strong">{ex?.name ?? e.exercise_id}</Link>
                      <p className="text-xs text-muted">{ex?.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>
                    </div>
                    <div className="flex shrink-0">
                      <IconButton label={`Sustituir ${ex?.name}`} onClick={() => setSwapping(e)}><Repeat className="h-4 w-4" /></IconButton>
                      <IconButton label={`Editar ${ex?.name}`} onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton label={`Quitar ${ex?.name}`} onClick={async () => {
                        try { await removePlanExercise(e.id); patchLocal(e.id, null); toast("Ejercicio quitado"); } catch (err) { toast(errorMessage(err), "error"); }
                      }}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="primary">{e.sets} × {e.rep_min ? `${e.rep_min}${e.rep_max && e.rep_max !== e.rep_min ? `–${e.rep_max}` : ""} reps` : formatDuration(e.duration_s ?? 0)}</Badge>
                    {e.rest_s > 0 && <Badge>Descanso {formatDuration(e.rest_s)}</Badge>}
                    {e.target_rpe && <Badge>Esfuerzo {e.target_rpe}/10</Badge>}
                    {e.load_kg ? <Badge>{e.load_kg} kg</Badge> : null}
                  </div>
                  {e.notes && <p className="mt-2 text-sm text-muted">{e.notes}</p>}
                </li>
              );
            })}
          </ol>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Añadir ejercicio</Button>

          <div className="mt-4 rounded-3xl bg-surface-2/70 p-3.5 text-sm">
            <p className="font-semibold">Vuelta a la calma</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{meta.cooldown.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Cómo progresar" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Cuando completes todas las series en el rango alto de repeticiones con buena técnica, sube un poco el peso.</li>
          <li>Si no llegas al rango bajo, mantén o baja el peso. Durante la sesión verás una recomendación basada en tu última vez.</li>
          <li>Nunca progreses con dolor: usa Sustituir y, si el dolor persiste, consulta a un profesional.</li>
        </ul>
      </Card>

      {timeOpen && meta && (
        <TimeModal title={`Hora del ${WEEKDAYS[meta.weekday].toLowerCase()}`} initial={dayStartTime(meta, preferredTime)}
          onClose={() => setTimeOpen(false)}
          onSave={async (time, allDays) => {
            const next = schedule.map((d) => (allDays || d.dayIndex === meta.dayIndex ? { ...d, time } : d));
            try {
              await updatePlanSchedule(active.plan.id, next);
              setData((x) => x && x.active ? { ...x, active: { ...x.active, plan: { ...x.active.plan, schedule: next } } } : x);
              setTimeOpen(false);
              toast("Horario guardado");
            } catch (e) { toast(errorMessage(e), "error"); }
          }} />
      )}

      {editing && <EditExerciseModal row={editing} onClose={() => setEditing(null)} onSaved={(r) => { patchLocal(r.id, r); setEditing(null); toast("Cambios guardados"); }} />}

      <ExercisePicker
        open={!!swapping}
        onClose={() => setSwapping(null)}
        title="Sustituir ejercicio"
        description="Alternativas compatibles con tu equipo y tus limitaciones."
        ctx={ctx}
        options={swapping ? substitutionOptions(swapping.exercise_id, ctx) : []}
        onPick={async (ex) => {
          if (!swapping) return;
          try {
            const r = await updatePlanExercise(swapping.id, { exercise_id: ex.id, ...(ex.defaultUnit === "seconds" && !swapping.duration_s ? { duration_s: 30, rep_min: null, rep_max: null } : {}) });
            patchLocal(swapping.id, r);
            toast(`Cambiado por ${ex.name}`);
          } catch (e) { toast(errorMessage(e), "error"); }
          setSwapping(null);
        }}
      />

      <ExercisePicker open={adding} onClose={() => setAdding(false)} title="Añadir ejercicio" ctx={ctx} onPick={async (ex) => {
        try {
          const created = await addPlanExercise({
            plan_id: active.plan.id, day_index: selected, position: exercises.length, exercise_id: ex.id, sets: 3,
            rep_min: ex.defaultUnit === "reps" ? 10 : null, rep_max: ex.defaultUnit === "reps" ? 12 : null,
            duration_s: ex.defaultUnit === "seconds" ? 30 : null, rest_s: 60, target_rpe: 7, load_kg: null, notes: null,
          });
          setData((d) => d && d.active ? { ...d, active: { ...d.active, exercises: [...d.active.exercises, created] } } : d);
          toast(`${ex.name} añadido`);
        } catch (e) { toast(errorMessage(e), "error"); }
        setAdding(false);
      }} />

      <RegenerateModal open={regenOpen} onClose={() => setRegenOpen(false)} onDone={async () => { setRegenOpen(false); await refresh(); await reload(); setDay(null); toast("Plan regenerado"); }} />
    </div>
  );
}

function EditExerciseModal({ row, onClose, onSaved }: { row: WorkoutExerciseRow; onClose: () => void; onSaved: (r: WorkoutExerciseRow) => void }) {
  const [sets, setSets] = useState(row.sets);
  const [repMin, setRepMin] = useState(row.rep_min ?? 0);
  const [repMax, setRepMax] = useState(row.rep_max ?? 0);
  const [duration, setDuration] = useState(row.duration_s ?? 0);
  const [rest, setRest] = useState(row.rest_s);
  const [load, setLoad] = useState(row.load_kg ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timed = row.rep_min === null;

  async function save() {
    if (sets < 1 || sets > 10) return setError("Entre 1 y 10 series.");
    if (!timed && (repMin < 1 || repMax < repMin || repMax > 100)) return setError("Revisa el rango de repeticiones.");
    if (timed && (duration < 5 || duration > 7200)) return setError("Duración entre 5 segundos y 2 horas.");
    setSaving(true);
    try {
      const r = await updatePlanExercise(row.id, {
        sets, rest_s: rest, load_kg: load === "" ? null : Number(load),
        ...(timed ? { duration_s: duration } : { rep_min: repMin, rep_max: repMax }),
      });
      onSaved(r);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar ${EXERCISE_BY_ID[row.exercise_id]?.name ?? ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Guardar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Series" htmlFor="sets"><Input id="sets" type="number" min={1} max={10} value={sets} onChange={(e) => setSets(Number(e.target.value))} /></Field>
        <Field label="Descanso (s)" htmlFor="rest"><Input id="rest" type="number" min={0} max={600} step={15} value={rest} onChange={(e) => setRest(Number(e.target.value))} /></Field>
        {timed ? (
          <Field label="Duración (s)" htmlFor="dur"><Input id="dur" type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
        ) : (
          <>
            <Field label="Repeticiones mínimas" htmlFor="rmin"><Input id="rmin" type="number" min={1} value={repMin} onChange={(e) => setRepMin(Number(e.target.value))} /></Field>
            <Field label="Repeticiones máximas" htmlFor="rmax"><Input id="rmax" type="number" min={1} value={repMax} onChange={(e) => setRepMax(Number(e.target.value))} /></Field>
          </>
        )}
        <Field label="Carga de referencia (kg)" optional htmlFor="load"><Input id="load" type="number" min={0} step={0.5} value={load} onChange={(e) => setLoad(e.target.value)} /></Field>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

function RegenerateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const bundle = useBundle();
  const f = bundle.onboarding?.fitness ?? {};
  const [days, setDays] = useState(f.daysPerWeek ?? 3);
  const [minutes, setMinutes] = useState(f.sessionMinutes ?? 45);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setSaving(true);
    setError(null);
    try {
      await saveOnboardingSection({ fitness: { ...f, daysPerWeek: days, sessionMinutes: minutes } });
      const input = generatorInputFromBundle({ ...bundle, onboarding: bundle.onboarding ? { ...bundle.onboarding, fitness: { ...f, daysPerWeek: days, sessionMinutes: minutes } } : null });
      await regeneratePlan({ ...input, preferredDays: input.preferredDays?.length === days ? input.preferredDays : undefined });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Regenerar plan"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={go} loading={saving}>Generar plan nuevo</Button></>}>
      <p className="mb-4 text-sm text-muted">Crearemos un plan nuevo con tus datos actuales. Tu historial de sesiones se conserva.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Días por semana" htmlFor="rd"><Select id="rd" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
        <Field label="Minutos por sesión" htmlFor="rm"><Select id="rm" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[20, 30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}

function HistoryView() {
  const bundle = useBundle();
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [sessions, sets] = await Promise.all([listSessions(200), allSets()]);
    return { sessions: sessions.filter((s) => s.status !== "in_progress" || s.started_at.slice(0, 10) === todayISO()), sets };
  }, []);
  if (loading && !data) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Error"} onRetry={reload} />;
  if (!data.sessions.length) return <EmptyState title="Aún no hay sesiones" description="Cuando completes tu primer entrenamiento, lo verás aquí con todas sus series." />;
  return (
    <ul className="space-y-3">
      {confirmDialog}
      {data.sessions.map((s) => {
        const sets = data.sets.filter((x) => x.session_id === s.id && x.completed);
        const byEx = [...new Set(sets.map((x) => x.exercise_id))];
        return (
          <li key={s.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm first-letter:uppercase text-muted">{formatLongDate(s.started_at.slice(0, 10))}{s.duration_s ? ` · ${Math.round(s.duration_s / 60)} min` : ""}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge tone={s.status === "completed" ? "success" : s.status === "abandoned" ? "neutral" : "warning"}>
                    {s.status === "completed" ? "Completada" : s.status === "abandoned" ? "Abandonada" : "En curso"}
                  </Badge>
                  {s.status === "in_progress" && <Link to={`/workouts/session/${s.id}`}><Button size="sm" variant="ghost">Continuar</Button></Link>}
                  <IconButton label="Borrar sesión" onClick={async () => {
                    if (!(await ask("¿Borrar esta sesión y sus series?", "Borrar sesión"))) return;
                    try { await deleteSession(s.id); setData((d) => d && { ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }); toast("Sesión borrada"); } catch (e) { toast(errorMessage(e), "error"); }
                  }}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </div>
              {byEx.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-muted">
                  {byEx.map((id) => {
                    const xs = sets.filter((x) => x.exercise_id === id);
                    return <li key={id}><span className="text-text">{EXERCISE_BY_ID[id]?.name ?? id}:</span> {xs.map((x) => (x.weight_kg ? `${bundle.profile.units === "imperial" ? Math.round(Number(x.weight_kg) * 2.20462) : x.weight_kg}×${x.reps}` : x.reps ? `${x.reps}` : `${x.duration_s}s`)).join(", ")}</li>;
                  })}
                </ul>
              )}
              {s.perceived_effort && <p className="mt-2 text-xs text-muted">Esfuerzo percibido: {s.perceived_effort}/10{s.pain_reported ? " · reportaste dolor" : ""}</p>}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function DayBadge({ name, date, today }: { name: string; date: string; today: boolean }) {
  return (
    <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-center leading-none",
      today ? "bg-primary-strong text-on-primary" : "bg-surface-2 text-text")}>
      <span className="text-[10px] font-semibold uppercase">{name.slice(0, 3)}</span>
      <span className="-mt-2 text-base font-semibold tabular-nums">{Number(date.slice(8, 10))}</span>
    </span>
  );
}

function TimeModal({ title, initial, onClose, onSave }: { title: string; initial: string; onClose: () => void; onSave: (time: string, allDays: boolean) => Promise<void> }) {
  const [time, setTime] = useState(initial);
  const [all, setAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = TIME_RE.test(time);
  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        await onSave(time, all);
        setSaving(false);
      }}>
        <Field label="Hora de inicio" htmlFor="day-time" error={valid ? undefined : "Usa el formato HH:MM."}>
          <Input id="day-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4" />
          Usar esta hora para todos los días de entreno
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!valid}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}
