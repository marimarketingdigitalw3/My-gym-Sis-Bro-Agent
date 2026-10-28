// Genera la migración de datos de la biblioteca pública de ejercicios a partir de src/data/exercises.ts.
// Uso: npm run exercises:sql
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXERCISES } from "../src/data/exercises";

const str = (v: string) => `'${v.replace(/'/g, "''")}'`;
const arr = (xs: readonly string[]) => (xs.length ? `array[${xs.map(str).join(", ")}]::text[]` : "'{}'::text[]");

const rows = EXERCISES.map((e) => `  (${[
  str(e.id), str(e.name), str(e.nameEn), str(e.category), str(e.pattern), arr(e.primaryMuscles), arr(e.secondaryMuscles), arr(e.equipment),
  e.difficulty, arr(e.stressedJoints), e.unilateral, e.isCompound, arr(e.instructions), arr(e.commonMistakes), arr(e.alternatives),
  str(e.defaultUnit), e.loadIncrementKg,
].join(", ")})`);

const sql = `-- Generado por scripts/generate-exercise-sql.ts. No editar a mano.
insert into public.exercise_library (
  id, name, name_en, category, pattern, primary_muscles, secondary_muscles, equipment, difficulty, stressed_joints,
  unilateral, is_compound, instructions, common_mistakes, alternatives, default_unit, load_increment_kg
) values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name, name_en = excluded.name_en, category = excluded.category, pattern = excluded.pattern,
  primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles, equipment = excluded.equipment,
  difficulty = excluded.difficulty, stressed_joints = excluded.stressed_joints, unilateral = excluded.unilateral,
  is_compound = excluded.is_compound, instructions = excluded.instructions, common_mistakes = excluded.common_mistakes,
  alternatives = excluded.alternatives, default_unit = excluded.default_unit, load_increment_kg = excluded.load_increment_kg;
`;

const out = fileURLToPath(new URL("../supabase/migrations/20261028000004_exercise_library_data.sql", import.meta.url));
writeFileSync(out, sql);
console.log(`exercise_library: ${EXERCISES.length} ejercicios`);
