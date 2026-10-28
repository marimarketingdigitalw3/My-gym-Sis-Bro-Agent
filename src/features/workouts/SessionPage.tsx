import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Flag, ListOrdered, Pause, Play, Repeat, SkipForward, TimerReset, Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBundle } from "@/app/providers";
import {
  Badge, Button, Card, Chip, ErrorState, Field, IconButton, Input, Modal, Notice, PageSkeleton, ProgressBar, Select, Textarea, cx, useConfirm,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { trainingClearance } from "@/lib/clearance";
import { todayISO } from "@/lib/dates";
import { formatDuration, formatWeight, fromDisplayWeight, MUSCLE_LABELS, toDisplayWeight, weightUnit } from "@/lib/labels";
import { substitutionOptions } from "@/lib/workouts/generator";
import { personalRecords, progressionAdvice } from "@/lib/workouts/progression";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { selectionContextFromBundle } from "@/services/derived";
import { getRecovery } from "@/services/tracking";
import {
  abandonSession, allSets, completeSession, deleteSet, getActivePlan, getSession, lastPerformance, saveSet,
} from "@/services/workouts";
import type { ExerciseSetRow, WorkoutExerciseRow } from "@/types/db";
import { ExercisePicker } from "./ExercisePicker";

interface SessionUi {
  index: number;
  swaps: Record<string, string>; // id de fila del plan -> ejercicio usado hoy
  pausedMs: number;
  pausedAt: number | null;
}

const uiKey = (id: string) => `mgs:session-ui:${id}`;
function loadUi(id: string): SessionUi {
  try {
    const raw = sessionStorage.getItem(uiKey(id));
    if (raw) return JSON.parse(raw);
  } catch {
    // sin almacenamiento
  }
  return { index: 0, swaps: {}, pausedMs: 0, pausedAt: null };
}

export default function SessionPage() {
  const { sessionId = "" } = useParams();
  const bundle = useBundle();
  const navigate = useNavigate();
  const toast = useToast();
  const units = bundle.profile.units;
  const ctx = useMemo(() => selectionContextFromBundle(bundle), [bundle]);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [found, active, history, recovery] = await Promise.all([getSession(sessionId), getActivePlan(), allSets(), getRecovery(todayISO())]);
    if (!found) throw new Error("No encontramos esta sesión.");
    const planRows = active && found.session.plan_id === active.plan.id
      ? active.exercises.filter((e) => e.day_index === found.session.day_index).sort((a, b) => a.position - b.position)
      : [];
    return { ...found, planRows, history, recovery };
  }, [sessionId]);

  const [ui, setUi] = useState<SessionUi>(() => loadUi(sessionId));
  useEffect(() => {
    try {
      sessionStorage.setItem(uiKey(sessionId), JSON.stringify(ui));
    } catch {
      // sin almacenamiento
    }
  }, [ui, sessionId]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restRemainingOnPause, setRestRemainingOnPause] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  const paused = ui.pausedAt !== null;

  const togglePause = useCallback(() => {
    setUi((u) => {
      if (u.pausedAt === null) {
        if (restEnd) setRestRemainingOnPause(Math.max(0, restEnd - Date.now()));
        setRestEnd(null);
        return { ...u, pausedAt: Date.now() };
      }
      if (restRemainingOnPause) setRestEnd(Date.now() + restRemainingOnPause);
      setRestRemainingOnPause(null);
      return { ...u, pausedMs: u.pausedMs + (Date.now() - u.pausedAt), pausedAt: null };
    });
  }, [restEnd, restRemainingOnPause]);

  if (loading && !data) return <div className="mx-auto max-w-2xl p-4"><PageSkeleton /></div>;
  if (error || !data) return <div className="mx-auto max-w-2xl p-4"><ErrorState message={error ?? "Error"} onRetry={reload} /></div>;

  const { session, sets, planRows, history, recovery } = data;
  const clearance = trainingClearance(bundle.onboarding?.health, recovery);

  if (session.status === "completed") return <SessionSummary sessionId={session.id} title={session.title} durationS={session.duration_s ?? 0} sets={sets} history={history} />;
  if (clearance.status === "blocked") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Notice tone="danger" title="Detén el entrenamiento">{clearance.reasons[0]} Busca evaluación médica. Si los síntomas son intensos, llama a emergencias.</Notice>
        <Link to="/"><Button variant="outline">Volver al inicio</Button></Link>
      </div>
    );
  }
  if (!planRows.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Notice tone="warning">Esta sesión pertenece a un plan que ya no está activo. Puedes cerrarla y empezar una del plan actual.</Notice>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => { await abandonSession(session.id); navigate("/workouts"); }}>Cerrar sesión</Button>
        </div>
      </div>
    );
  }

  const idx = Math.min(ui.index, planRows.length - 1);
  const row = planRows[idx];
  const exerciseId = ui.swaps[row.id] ?? row.exercise_id;
  const ex = EXERCISE_BY_ID[exerciseId];
  const mySets = sets.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number);
  const previous = lastPerformance(history, exerciseId, session.id);
  const advice = progressionAdvice(row, previous, ex?.loadIncrementKg ?? 0, { energy: recovery?.energy, soreness: recovery?.soreness });
  const totalSets = planRows.reduce((a, r) => a + r.sets, 0);
  const doneSets = sets.filter((s) => s.completed).length;
  const elapsed = Math.max(0, Math.floor(((ui.pausedAt ?? now) - new Date(session.started_at).getTime() - ui.pausedMs) / 1000));
  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : null;
  const painThisExercise = mySets.some((s) => s.pain);

  const go = (i: number) => {
    setUi((u) => ({ ...u, index: Math.max(0, Math.min(planRows.length - 1, i)) }));
    setRestEnd(null);
    window.scrollTo({ top: 0 });
  };

  async function logSet(setNumber: number, values: { weight: number | null; reps: number | null; duration: number | null; rpe: number | null; pain: boolean }) {
    try {
      const saved = await saveSet({
        session_id: session.id, exercise_id: exerciseId, set_number: setNumber, target_reps: row.rep_max,
        reps: values.reps, weight_kg: values.weight !== null ? fromDisplayWeight(values.weight, units) : null,
        duration_s: values.duration, rpe: values.rpe, completed: true, pain: values.pain,
      });
      setData((d) => d && { ...d, sets: [...d.sets.filter((s) => !(s.exercise_id === exerciseId && s.set_number === setNumber)), saved] });
      if (values.pain) {
        toast("Registramos dolor: detén este ejercicio y prueba una alternativa", "error");
      } else if (setNumber < row.sets && row.rest_s > 0) {
        setRestEnd(Date.now() + row.rest_s * 1000);
      } else if (setNumber >= row.sets && idx < planRows.length - 1) {
        toast("Ejercicio completado");
      }
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  async function undoSet(setNumber: number) {
    try {
      await deleteSet(session.id, exerciseId, setNumber);
      setData((d) => d && { ...d, sets: d.sets.filter((s) => !(s.exercise_id === exerciseId && s.set_number === setNumber)) });
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
          <Link to="/workouts" aria-label="Salir del modo entrenamiento" className="rounded-full p-2 hover:bg-surface-2"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{session.title}</p>
            <p className="text-xs text-muted" aria-live="off">{formatDuration(elapsed)}{paused ? " · en pausa" : ""} · {doneSets}/{totalSets} series</p>
          </div>
          <IconButton label={paused ? "Reanudar" : "Pausar"} onClick={togglePause}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</IconButton>
          <IconButton label="Ver todos los ejercicios" onClick={() => setListOpen(true)}><ListOrdered className="h-5 w-5" /></IconButton>
        </div>
        <div className="mx-auto max-w-2xl px-3 pb-2"><ProgressBar value={doneSets} max={totalSets} label="Series completadas" /></div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-3 pt-4">
        {paused && <Notice title="Sesión en pausa">El cronómetro y el descanso están detenidos. Toca reanudar cuando quieras seguir.</Notice>}

        {restLeft !== null && restLeft > 0 && (
          <Card className="flex items-center justify-between gap-3 border-primary-strong">
            <div>
              <p className="text-sm text-muted">Descanso</p>
              <p className="text-4xl font-semibold tabular-nums" role="timer" aria-live="polite">{Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRestEnd((e) => (e ?? Date.now()) + 15_000)}><TimerReset className="h-4 w-4" /> +15 s</Button>
              <Button variant="secondary" size="sm" onClick={() => setRestEnd(null)}><SkipForward className="h-4 w-4" /> Saltar</Button>
            </div>
          </Card>
        )}

        <Card>
          <p className="text-xs font-semibold text-muted">Ejercicio {idx + 1} de {planRows.length}</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{ex?.name ?? exerciseId}</h1>
              <p className="text-sm text-muted">{ex?.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSwapOpen(true)}><Repeat className="h-4 w-4" /> Sustituir</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary">{row.sets} series × {row.rep_min ? `${row.rep_min}–${row.rep_max} reps` : formatDuration(row.duration_s ?? 0)}</Badge>
            {row.rest_s > 0 && <Badge>Descanso {formatDuration(row.rest_s)}</Badge>}
            {row.target_rpe && <Badge>Esfuerzo objetivo {row.target_rpe}/10</Badge>}
            {ui.swaps[row.id] && <Badge tone="warning">Sustituido hoy</Badge>}
          </div>

          <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">
            <p className="font-semibold">La última vez</p>
            <p className="text-muted">
              {previous.length
                ? previous.map((s) => (s.weight_kg ? `${formatWeight(Number(s.weight_kg), units)}×${s.reps}` : s.reps ? `${s.reps} reps` : `${s.duration_s}s`)).join(" · ")
                : "Sin registros previos."}
            </p>
            <p className="mt-2 font-semibold">Sugerencia de hoy</p>
            <p className="text-muted">{advice.message}</p>
          </div>

          {painThisExercise && <div className="mt-3"><Notice tone="warning">Marcaste dolor en este ejercicio. No sigas cargando la zona: usa Sustituir o pasa al siguiente. Si persiste, consulta a un profesional.</Notice></div>}

          <ol className="mt-4 space-y-2">
            {Array.from({ length: row.sets }, (_, i) => i + 1).map((n) => (
              <SetRow key={`${exerciseId}-${n}`} n={n} timed={row.rep_min === null} units={units}
                saved={mySets.find((s) => s.set_number === n) ?? null}
                defaults={{
                  weight: advice.suggestedLoadKg ? toDisplayWeight(advice.suggestedLoadKg, units) : (previous[n - 1]?.weight_kg ? toDisplayWeight(Number(previous[n - 1].weight_kg), units) : null),
                  reps: advice.targetReps ?? row.rep_min, duration: row.duration_s,
                }}
                bodyweight={!!ex && ex.equipment.every((e) => e === "bodyweight" || e === "bench" || e === "pullup_bar")}
                onSave={(v) => logSet(n, v)} onUndo={() => undoSet(n)} disabled={paused} />
            ))}
          </ol>

          {ex && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-primary-strong">Técnica y errores comunes</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{ex.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="mt-3 font-semibold">Evita</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">{ex.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul>
            </details>
          )}
        </Card>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
          {idx < planRows.length - 1
            ? <Button onClick={() => go(idx + 1)}>Siguiente <ChevronRight className="h-4 w-4" /></Button>
            : <Button onClick={() => setFinishOpen(true)}><Flag className="h-4 w-4" /> Terminar</Button>}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setFinishOpen(true)}>Terminar entrenamiento</Button>
          <Button variant="ghost" size="sm" onClick={async () => {
            if (!(await ask("¿Abandonar la sesión? Las series registradas se conservan en el historial.", "Abandonar"))) return;
            await abandonSession(session.id);
            navigate("/workouts");
          }}>Abandonar</Button>
        </div>
      </main>

      <ExercisePicker open={swapOpen} onClose={() => setSwapOpen(false)} title="Sustituir solo por hoy" ctx={ctx}
        description="Elige una alternativa compatible. Para cambiarla de forma permanente, edítala en tu plan."
        options={substitutionOptions(row.exercise_id, ctx, [exerciseId])}
        onPick={(e) => { setUi((u) => ({ ...u, swaps: { ...u.swaps, [row.id]: e.id } })); setSwapOpen(false); toast(`Hoy harás ${e.name}`); }} />

      {confirmDialog}
      <Modal open={listOpen} onClose={() => setListOpen(false)} title="Ejercicios de la sesión">
        <ol className="space-y-1">
          {planRows.map((r: WorkoutExerciseRow, i) => {
            const id = ui.swaps[r.id] ?? r.exercise_id;
            const done = sets.filter((s) => s.exercise_id === id && s.completed).length;
            return (
              <li key={r.id}>
                <button type="button" onClick={() => { go(i); setListOpen(false); }} className={cx("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-surface-2", i === idx && "bg-primary/10")}>
                  <span>{i + 1}. {EXERCISE_BY_ID[id]?.name}</span>
                  <span className="text-sm text-muted">{done}/{r.sets}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Modal>

      <FinishModal open={finishOpen} onClose={() => setFinishOpen(false)} incomplete={totalSets - doneSets}
        onFinish={async (v) => {
          await completeSession(session.id, { ...v, startedAt: new Date(new Date(session.started_at).getTime() + ui.pausedMs).toISOString() });
          try { sessionStorage.removeItem(uiKey(session.id)); } catch { /* sin almacenamiento */ }
          await reload();
        }} />
    </div>
  );
}

function SetRow({ n, timed, units, saved, defaults, bodyweight, onSave, onUndo, disabled }: {
  n: number; timed: boolean; units: "metric" | "imperial"; saved: ExerciseSetRow | null; bodyweight: boolean;
  defaults: { weight: number | null; reps: number | null; duration: number | null };
  onSave: (v: { weight: number | null; reps: number | null; duration: number | null; rpe: number | null; pain: boolean }) => Promise<void>;
  onUndo: () => void; disabled: boolean;
}) {
  const [weight, setWeight] = useState<string>(saved?.weight_kg ? String(toDisplayWeight(Number(saved.weight_kg), units)) : defaults.weight ? String(defaults.weight) : "");
  const [reps, setReps] = useState<string>(String(saved?.reps ?? defaults.reps ?? ""));
  const [duration, setDuration] = useState<string>(String(saved?.duration_s ?? defaults.duration ?? ""));
  const [rpe, setRpe] = useState<string>(saved?.rpe ? String(saved.rpe) : "");
  const [pain, setPain] = useState(saved?.pain ?? false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const done = !!saved?.completed;

  async function submit() {
    setBusy(true);
    await onSave({
      weight: weight === "" ? null : Number(weight),
      reps: timed ? null : reps === "" ? 0 : Number(reps),
      duration: timed ? Number(duration) || null : null,
      rpe: rpe ? Number(rpe) : null,
      pain,
    });
    setBusy(false);
  }

  return (
    <li ref={ref} className={cx("rounded-2xl border p-3 transition", done ? "border-success/40 bg-success/5" : "border-border")}>
      <div className="flex items-end gap-2">
        <span className="mb-2.5 w-6 text-center text-sm font-semibold text-muted">{n}</span>
        {!bodyweight && !timed && (
          <Field label={weightUnit(units)} htmlFor={`w${n}`}>
            <Input id={`w${n}`} type="number" inputMode="decimal" min={0} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} disabled={done} className="h-10 w-20" />
          </Field>
        )}
        {timed ? (
          <Field label="seg" htmlFor={`d${n}`}>
            <Input id={`d${n}`} type="number" inputMode="numeric" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={done} className="h-10 w-20" />
          </Field>
        ) : (
          <Field label="reps" htmlFor={`r${n}`}>
            <Input id={`r${n}`} type="number" inputMode="numeric" min={0} max={200} value={reps} onChange={(e) => setReps(e.target.value)} disabled={done} className="h-10 w-16" />
          </Field>
        )}
        <Field label="esfuerzo" htmlFor={`p${n}`}>
          <Select id={`p${n}`} value={rpe} onChange={(e) => setRpe(e.target.value)} disabled={done} className="h-10 w-20 px-2">
            <option value="">—</option>
            {[6, 7, 8, 9, 10].map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
        </Field>
        <div className="ml-auto">
          {done
            ? <Button variant="ghost" size="sm" onClick={onUndo} aria-label={`Deshacer serie ${n}`}>Deshacer</Button>
            : <Button size="sm" onClick={submit} loading={busy} disabled={disabled} aria-label={`Completar serie ${n}`}><Check className="h-4 w-4" /></Button>}
        </div>
      </div>
      {!done && (
        <label className="mt-2 flex items-center gap-2 pl-8 text-xs text-muted">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--danger))]" checked={pain} onChange={(e) => setPain(e.target.checked)} />
          Sentí dolor (no molestia muscular normal)
        </label>
      )}
    </li>
  );
}

function FinishModal({ open, onClose, incomplete, onFinish }: { open: boolean; onClose: () => void; incomplete: number; onFinish: (v: { perceived_effort: number | null; pain_reported: boolean; notes: string | null }) => Promise<void> }) {
  const [effort, setEffort] = useState<number | null>(null);
  const [pain, setPain] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="Terminar entrenamiento"
      footer={<><Button variant="ghost" onClick={onClose}>Seguir entrenando</Button>
        <Button loading={saving} onClick={async () => {
          setSaving(true);
          setError(null);
          try { await onFinish({ perceived_effort: effort, pain_reported: pain, notes: notes.trim() || null }); onClose(); } catch (e) { setError(errorMessage(e)); setSaving(false); }
        }}>Guardar sesión</Button></>}>
      <div className="space-y-4 text-sm">
        {incomplete > 0 && <Notice tone="warning">Quedan {incomplete} series sin registrar. Puedes terminar igual: cuenta lo que hiciste.</Notice>}
        <div>
          <p className="mb-1.5 font-medium">¿Qué tan exigente fue? (1 muy fácil, 10 máximo)</p>
          <div className="flex flex-wrap gap-1.5">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <Chip key={n} selected={effort === n} onClick={() => setEffort(n)}>{n}</Chip>)}</div>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={pain} onChange={(e) => setPain(e.target.checked)} /> Sentí dolor durante la sesión</label>
        {pain && <Notice tone="warning">No subiremos la carga en los ejercicios con dolor. Si el dolor es agudo, persiste o se inflama, consulta a un profesional.</Notice>}
        <Field label="Notas" optional htmlFor="notes"><Textarea id="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

function SessionSummary({ sessionId, title, durationS, sets, history }: { sessionId: string; title: string; durationS: number; sets: ExerciseSetRow[]; history: ExerciseSetRow[] }) {
  const bundle = useBundle();
  const done = sets.filter((s) => s.completed);
  const volume = done.reduce((a, s) => a + Number(s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  const before = personalRecords(history.filter((s) => s.session_id !== sessionId));
  const after = personalRecords(history);
  const newPrs = after.filter((p) => {
    const prev = before.find((b) => b.exerciseId === p.exerciseId);
    return done.some((s) => s.exercise_id === p.exerciseId) && prev && (p.bestE1rm > prev.bestE1rm || (p.bestE1rm === 0 && p.bestReps > prev.bestReps));
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pt-8">
      <div className="hero-surface rounded-card p-6 text-center shadow-card">
        <Trophy className="mx-auto h-10 w-10" />
        <h1 className="mt-2 text-3xl font-semibold">¡Sesión completada!</h1>
        <p className="mt-1 text-white/85">{title}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center"><p className="text-xs text-muted">Duración</p><p className="text-xl font-semibold">{Math.round(durationS / 60)} min</p></Card>
        <Card className="text-center"><p className="text-xs text-muted">Series</p><p className="text-xl font-semibold">{done.length}</p></Card>
        <Card className="text-center"><p className="text-xs text-muted">Volumen</p><p className="text-xl font-semibold">{formatWeight(volume, bundle.profile.units, 0)}</p></Card>
      </div>
      {newPrs.length > 0 && (
        <Card>
          <p className="font-semibold">Nuevos récords</p>
          <ul className="mt-1 text-sm text-muted">{newPrs.map((p) => <li key={p.exerciseId}>{EXERCISE_BY_ID[p.exerciseId]?.name}: {p.bestWeightKg ? `${formatWeight(p.bestWeightKg, bundle.profile.units)} × ${p.bestReps}` : `${p.bestReps} reps`}</li>)}</ul>
        </Card>
      )}
      <p className="text-center text-sm text-muted">Tus resultados ya ajustan las recomendaciones de la próxima sesión.</p>
      <div className="flex justify-center gap-2">
        <Link to="/"><Button>Ir al inicio</Button></Link>
        <Link to="/progress"><Button variant="outline">Ver progreso</Button></Link>
      </div>
    </div>
  );
}
