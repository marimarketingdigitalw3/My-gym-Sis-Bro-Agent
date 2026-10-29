import { ArrowLeft, Info } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBundle } from "@/app/providers";
import { MuscleMap } from "@/components/MuscleMap";
import { ExerciseMedia } from "@/components/ExerciseMedia";
import { useDemoVariant } from "@/components/ExerciseGuide";
import { Badge, Button, Card, CardHeader, EmptyState, Notice } from "@/components/ui";
import { EXERCISE_BY_ID } from "@/data/exercises";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, EQUIPMENT_LABELS, JOINT_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/labels";
import { isAllowed } from "@/lib/workouts/generator";
import { selectionContextFromBundle } from "@/services/derived";

export default function ExerciseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const bundle = useBundle();
  const ex = EXERCISE_BY_ID[id];
  const variant = useDemoVariant();
  if (!ex) return <EmptyState title="Ejercicio no encontrado" action={<Link to="/exercises"><Button variant="outline">Volver a la biblioteca</Button></Link>} />;

  const ctx = selectionContextFromBundle(bundle);
  const conflicts = ex.stressedJoints.filter((j) => ctx.limitations.has(j));
  const missing = ex.equipment.filter((e) => !ctx.equipment.has(e));

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>
      <header>
        <h1 className="display-hero text-3xl sm:text-4xl">{ex.name}</h1>
        <p className="text-muted">{ex.nameEn}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="primary">{CATEGORY_LABELS[ex.category]}</Badge>
          <Badge>{DIFFICULTY_LABELS[ex.difficulty]}</Badge>
          <Badge>{PATTERN_LABELS[ex.pattern]}</Badge>
          {ex.unilateral && <Badge>Unilateral</Badge>}
        </div>
      </header>

      {conflicts.length > 0 && <Notice tone="warning">Este ejercicio carga zonas que marcaste: {conflicts.map((j) => JOINT_LABELS[j]).join(", ")}. Revisa las alternativas.</Notice>}
      {missing.length > 0 && <Notice>Necesitas equipo que no indicaste: {missing.map((e) => EQUIPMENT_LABELS[e]).join(", ")}.</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Músculos trabajados" />
          <MuscleMap primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
          <p className="mt-3 text-sm"><strong>Principales:</strong> {ex.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>
          {ex.secondaryMuscles.length > 0 && <p className="text-sm text-muted"><strong className="text-text">Secundarios:</strong> {ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>}
          <p className="mt-2 text-sm text-muted"><strong className="text-text">Equipo:</strong> {ex.equipment.map((e) => EQUIPMENT_LABELS[e]).join(", ")}</p>
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-3xl bg-surface-2/70 p-3">
              <ExerciseMedia exerciseId={ex.id} size={220} fallbackVariant={variant} />
            </div>
            <div className="min-w-0">
              <CardHeader title="Así se hace" subtitle="Posición inicial y final del movimiento." />
              <ol className="list-decimal space-y-2 pl-5 text-[15px]">{ex.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Técnica paso a paso" />
          <ol className="list-decimal space-y-2 pl-5 text-[15px]">{ex.instructions.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mt-4 font-semibold">Errores comunes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{ex.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Alternativas" subtitle="Útiles si no tienes el equipo o si este movimiento te molesta." />
        <ul className="grid gap-2 sm:grid-cols-2">
          {ex.alternatives.map((a) => EXERCISE_BY_ID[a]).filter(Boolean).map((alt) => (
            <li key={alt.id}>
              <Link to={`/exercises/${alt.id}`} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2.5 hover:border-primary-strong">
                <span className="font-medium">{alt.name}</span>
                {isAllowed(alt, ctx) ? <Badge tone="success">Compatible</Badge> : <Badge>Revisa equipo o zonas</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Aún no incluimos videos con licencia verificada. Si tienes dudas sobre la técnica, pide a un entrenador certificado que revise tu ejecución.
      </p>
    </div>
  );
}
