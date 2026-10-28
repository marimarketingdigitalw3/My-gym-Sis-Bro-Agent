import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Chip, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { EXERCISES } from "@/data/exercises";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { normalize } from "@/lib/meals";
import type { Equipment, ExerciseCategory, MuscleGroup } from "@/types/domain";

const MUSCLES: MuscleGroup[] = ["glutes", "quads", "hamstrings", "calves", "chest", "back", "shoulders", "biceps", "triceps", "core", "adductors"];

export default function ExerciseLibraryPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const muscle = (params.get("muscle") ?? "") as MuscleGroup | "";
  const equipment = (params.get("equipment") ?? "") as Equipment | "";
  const difficulty = params.get("difficulty") ?? "";
  const category = (params.get("category") ?? "") as ExerciseCategory | "";

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const results = useMemo(() => {
    const term = normalize(q);
    return EXERCISES.filter((e) =>
      (!term || normalize(`${e.name} ${e.nameEn}`).includes(term)) &&
      (!muscle || e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle)) &&
      (!equipment || e.equipment.includes(equipment)) &&
      (!difficulty || e.difficulty === Number(difficulty)) &&
      (!category || e.category === category),
    ).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [q, muscle, equipment, difficulty, category]);

  const activeFilters = [muscle, equipment, difficulty, category].filter(Boolean).length;

  return (
    <div>
      <PageHeader title="Biblioteca de ejercicios" subtitle={`${EXERCISES.length} ejercicios con técnica, errores comunes y alternativas.`} />
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
          <Input aria-label="Buscar ejercicios" placeholder="Buscar: sentadilla, hip thrust, remo…" value={q}
            onChange={(e) => { setQ(e.target.value); setParam("q", e.target.value); }} className="pl-10" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip selected={!muscle} onClick={() => setParam("muscle", "")}>Todos</Chip>
          {MUSCLES.map((m) => <Chip key={m} selected={muscle === m} onClick={() => setParam("muscle", muscle === m ? "" : m)}>{MUSCLE_LABELS[m]}</Chip>)}
        </div>
        <Card className="grid gap-3 p-3 sm:grid-cols-3 sm:p-4">
          <label className="sr-only" htmlFor="f-eq">Equipo</label>
          <Select id="f-eq" value={equipment} onChange={(e) => setParam("equipment", e.target.value)}>
            <option value="">Cualquier equipo</option>
            {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}
          </Select>
          <label className="sr-only" htmlFor="f-diff">Dificultad</label>
          <Select id="f-diff" value={difficulty} onChange={(e) => setParam("difficulty", e.target.value)}>
            <option value="">Cualquier dificultad</option>
            {[1, 2, 3].map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d as 1 | 2 | 3]}</option>)}
          </Select>
          <label className="sr-only" htmlFor="f-cat">Categoría</label>
          <Select id="f-cat" value={category} onChange={(e) => setParam("category", e.target.value)}>
            <option value="">Todas las categorías</option>
            {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
          </Select>
        </Card>
        <div className="flex items-center justify-between text-sm text-muted">
          <span aria-live="polite">{results.length} resultados</span>
          {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setParams({}, { replace: true }); }}><SlidersHorizontal className="h-4 w-4" /> Limpiar filtros</Button>}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-4"><EmptyState title="Sin resultados" description="Prueba con otro nombre o quita algún filtro." /></div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((e) => (
            <li key={e.id}>
              <Link to={`/exercises/${e.id}`} className="block h-full">
                <Card className="h-full transition hover:border-primary-strong">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{e.name}</p>
                    <Badge>{DIFFICULTY_LABELS[e.difficulty]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ")}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {e.equipment.map((x) => <Badge key={x} tone="primary">{EQUIPMENT_LABELS[x]}</Badge>)}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
