import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EXERCISES } from "@/data/exercises";
import { Badge, Chip, Input, Modal } from "@/components/ui";
import { FOCUS_GROUPS, matchesFocus } from "@/lib/workouts/focus";
import { CATEGORY_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { isAllowed, type SelectionContext } from "@/lib/workouts/generator";
import { normalize } from "@/lib/meals";
import type { Exercise } from "@/types/domain";

/** Modal para sustituir o añadir un ejercicio. `options` restringe la lista (sustitución segura). */
export function ExercisePicker({ open, onClose, title, options, ctx, onPick, description, added }: {
  open: boolean; onClose: () => void; title: string; options?: Exercise[]; ctx: SelectionContext; onPick: (e: Exercise) => void; description?: string;
  /** Ids ya añadidos en esta sesión del selector (para marcar con ✓ y seguir añadiendo). */
  added?: string[];
}) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const list = useMemo(() => {
    const base = (options ?? EXERCISES.filter((e) => isAllowed(e, ctx))).filter((e) => !focus || matchesFocus(e, [focus]));
    const term = normalize(q);
    return term ? base.filter((e) => normalize(`${e.name} ${e.nameEn} ${e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(" ")}`).includes(term)) : base;
  }, [options, ctx, q, focus]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && <p className="mb-3 text-sm text-muted">{description}</p>}
      {!options && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
          <Input aria-label="Buscar ejercicio" placeholder="Buscar por nombre o músculo" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
      )}
      {!options && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por músculo">
          <Chip selected={focus === null} onClick={() => setFocus(null)}>Todos</Chip>
          {FOCUS_GROUPS.map((g) => <Chip key={g.key} selected={focus === g.key} onClick={() => setFocus(focus === g.key ? null : g.key)}>{g.label}</Chip>)}
        </div>
      )}
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No hay alternativas compatibles con tu equipo y tus limitaciones. Consulta a un profesional para adaptar este movimiento.</p>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-primary-strong">
                <span>
                  <span className="block font-medium">{e.name}</span>
                  <span className="text-xs text-muted">{e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</span>
                </span>
                {added?.includes(e.id) ? <Badge tone="success">Añadido ✓</Badge> : <Badge>{CATEGORY_LABELS[e.category]}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
