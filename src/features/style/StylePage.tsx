// Gym Sis · Mis outfits: clóset deportivo con fotos, gustos de estilo y consejos para combinar según el entreno.
import { Camera, Check, Shirt, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useBundle } from "@/app/providers";
import { RichText } from "@/components/RichText";
import {
  Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Field, Input, Modal, Notice, PageHeader, PageSkeleton, Tabs, Textarea, cx, useConfirm,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage, useAsync } from "@/lib/useAsync";
import {
  addWardrobeItem, deleteStyleAdvice, getStyleProfile, listStyleAdvice, listWardrobe, removeWardrobeItem, requestStyleAdvice, saveStyleProfile, wardrobeUrl,
  type StyleAdviceRow, type StyleProfileRow, type WardrobeItemRow,
} from "@/services/style";
import {
  ACTIVITIES, CATEGORIES, COLORS, COVERAGE, FITS, MAX_ADVICE_ITEMS, MAX_QUESTION_CHARS, STYLES, type Activity, type WardrobeCategory,
} from "../../../supabase/functions/_shared/style.ts";

type Tab = "advice" | "closet" | "style";
const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as Activity[];
const CATEGORY_KEYS = Object.keys(CATEGORIES) as WardrobeCategory[];
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
const toggle = <T,>(list: T[], v: T, max = 99) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

function Photo({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { data } = useAsync(() => wardrobeUrl(path), [path]);
  return data
    ? <img src={data} alt={alt} className={cx("h-full w-full object-cover", className)} />
    : <span className="grid h-full w-full place-items-center text-muted"><Shirt className="h-6 w-6" aria-hidden /></span>;
}

const itemLabel = (i: WardrobeItemRow) => i.name || `${CATEGORIES[i.category]}${i.colors.length ? ` ${i.colors.join(" y ").toLowerCase()}` : ""}`;

export default function StylePage() {
  const bundle = useBundle();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("advice");
  const data = useAsync(async () => {
    const [profile, closet, advice] = await Promise.all([getStyleProfile(), listWardrobe(), listStyleAdvice()]);
    return { profile, closet, advice };
  }, []);

  if (bundle.profile.theme !== "sis") {
    return (
      <div className="space-y-4">
        <PageHeader title="Mis outfits" />
        <Notice title="Disponible en Gym Sis">Esta sección es parte de la plantilla Gym Sis. Puedes activarla en Ajustes.</Notice>
        <Link to="/settings"><Button variant="outline">Ir a Ajustes</Button></Link>
      </div>
    );
  }
  if (data.loading && !data.data) return <PageSkeleton />;
  if (data.error || !data.data) return <ErrorState message={data.error ?? "No pudimos cargar tu clóset."} onRetry={data.reload} />;
  const { profile, closet, advice } = data.data;
  const setData = (patch: Partial<NonNullable<typeof data.data>>) => data.setData((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div className="space-y-5">
      <PageHeader title="Mis outfits" subtitle="Sube tus prendas y te digo cómo combinarlas según tu entreno y tu estilo." />
      <Tabs label="Secciones de Mis outfits" value={tab} onChange={setTab}
        items={[{ value: "advice", label: "Pedir consejo" }, { value: "closet", label: `Mi clóset (${closet.length})` }, { value: "style", label: "Mi estilo" }]} />

      {tab === "advice" && (
        <AdvicePanel profile={profile} closet={closet} advice={advice} onGoCloset={() => setTab("closet")} onGoStyle={() => setTab("style")}
          onNew={(a) => setData({ advice: [a, ...advice].slice(0, 10) })}
          onDelete={async (id) => {
            await deleteStyleAdvice(id);
            setData({ advice: advice.filter((x) => x.id !== id) });
          }} />
      )}
      {tab === "closet" && (
        <ClosetPanel userId={bundle.profile.id} closet={closet}
          onAdded={(item) => { setData({ closet: [item, ...closet] }); toast("Prenda guardada en tu clóset.", "success"); }}
          onRemoved={(id) => setData({ closet: closet.filter((x) => x.id !== id) })} />
      )}
      {tab === "style" && (
        <StylePanel profile={profile} onSaved={(p) => { setData({ profile: p }); toast("Tu estilo quedó guardado.", "success"); }} />
      )}
    </div>
  );
}

// ---------- Pedir consejo ----------
function AdvicePanel({ profile, closet, advice, onNew, onDelete, onGoCloset, onGoStyle }: {
  profile: StyleProfileRow | null; closet: WardrobeItemRow[]; advice: StyleAdviceRow[];
  onNew: (a: StyleAdviceRow) => void; onDelete: (id: string) => Promise<void>; onGoCloset: () => void; onGoStyle: () => void;
}) {
  const toast = useToast();
  const [activity, setActivity] = useState<Activity>(() => {
    const first = profile?.activities.find((a): a is Activity => a in ACTIVITIES);
    return first ?? "fuerza";
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [latest, setLatest] = useState<StyleAdviceRow | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  async function ask() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await requestStyleAdvice({ activity, itemIds: selected, question: question.trim() });
      setLatest(res.advice);
      setNotice(res.notice);
      onNew(res.advice);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader title="¿Qué vas a entrenar?" icon={<Sparkles className="h-5 w-5" />} subtitle="Elijo el soporte, la tela y el calzado según el impacto." />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de entreno">
          {ACTIVITY_KEYS.map((k) => <Chip key={k} selected={activity === k} onClick={() => setActivity(k)}>{ACTIVITIES[k].label}</Chip>)}
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold">Prendas para combinar <span className="font-normal text-muted">(opcional, hasta {MAX_ADVICE_ITEMS})</span></p>
          {closet.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aún no tienes prendas. <button type="button" className="font-semibold text-primary-strong" onClick={onGoCloset}>Sube tus outfits</button> y armo looks con lo que ya tienes.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Prendas de tu clóset">
              {closet.map((i) => {
                const on = selected.includes(i.id);
                return (
                  <li key={i.id}>
                    <button type="button" aria-pressed={on} aria-label={`${on ? "Quitar" : "Elegir"} ${itemLabel(i)}`}
                      onClick={() => setSelected((l) => toggle(l, i.id, MAX_ADVICE_ITEMS))}
                      className={cx("relative block aspect-square w-full overflow-hidden rounded-2xl border-2 bg-surface-2 transition", on ? "border-primary-strong" : "border-transparent")}>
                      <Photo path={i.storage_path} alt={itemLabel(i)} />
                      {on && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary-strong text-on-primary"><Check className="h-3.5 w-3.5" /></span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Field label="¿Algo en especial?" optional htmlFor="style-question" hint="Por ejemplo: “clase a las 6 a. m. y luego voy a la oficina” o “quiero verme más colorida”.">
          <Textarea id="style-question" rows={2} maxLength={MAX_QUESTION_CHARS} value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        {!profile && <p className="mt-2 text-sm text-muted">Consejo más personal: <button type="button" className="font-semibold text-primary-strong" onClick={onGoStyle}>cuéntame tu estilo</button>.</p>}
        <Button className="mt-4 w-full" loading={busy} onClick={() => void ask()}><Wand2 className="h-4 w-4" /> Pedir consejo</Button>
      </Card>

      <div className="space-y-4">
        {latest ? (
          <Card aria-live="polite">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={latest.source === "ai" ? "primary" : "warning"}>{latest.source === "ai" ? "Estilista IA" : "Modo de respaldo"}</Badge>
              <span className="text-sm text-muted">{ACTIVITIES[latest.activity as Activity]?.label ?? latest.activity}</span>
            </div>
            {notice && <div className="mb-3"><Notice tone="warning">{notice}</Notice></div>}
            <RichText text={latest.content} />
          </Card>
        ) : (
          <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Tu próximo look" description="Elige tu entreno y, si quieres, algunas prendas. Te digo cómo combinarlas para rendir y verte increíble." />
        )}

        {advice.filter((a) => a.id !== latest?.id).length > 0 && (
          <Card>
            <CardHeader title="Consejos anteriores" />
            <ul className="space-y-2">
              {advice.filter((a) => a.id !== latest?.id).map((a) => (
                <li key={a.id}>
                  <details className="rounded-2xl border border-border/60 px-3 py-2">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">{ACTIVITIES[a.activity as Activity]?.label ?? a.activity}</span>
                      <span className="text-muted">{formatDate(a.created_at)}</span>
                    </summary>
                    <div className="mt-2 text-sm"><RichText text={a.content} /></div>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={async () => {
                      if (await confirm("¿Borrar este consejo?", "Borrar")) await onDelete(a.id).catch((e) => toast(errorMessage(e), "error"));
                    }}><Trash2 className="h-4 w-4" /> Borrar</Button>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

// ---------- Mi clóset ----------
function ClosetPanel({ userId, closet, onAdded, onRemoved }: {
  userId: string; closet: WardrobeItemRow[]; onAdded: (i: WardrobeItemRow) => void; onRemoved: (id: string) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ file: File; url: string } | null>(null);
  const [category, setCategory] = useState<WardrobeCategory>("leggings");
  const [colors, setColors] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<WardrobeCategory | "all">("all");
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Solo se pueden subir fotos.", "error");
    setDraft({ file: f, url: URL.createObjectURL(f) });
    setColors([]);
    setName("");
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      onAdded(await addWardrobeItem(userId, draft.file, { category, colors, name: name.trim() || null }));
      setDraft(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const shown = filter === "all" ? closet : closet.filter((i) => i.category === filter);
  const used = CATEGORY_KEYS.filter((k) => closet.some((i) => i.category === k));

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Sube una foto de cada prenda</p>
          <p className="text-sm text-muted">Mejor sobre un fondo liso. Solo tú puedes verlas.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Foto de la prenda" onChange={(e) => pick(e.target.files)} />
        <Button onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /> Añadir prenda</Button>
      </Card>

      {closet.length === 0 ? (
        <EmptyState icon={<Shirt className="h-6 w-6" />} title="Tu clóset está vacío" description="Empieza por tus básicos: leggings, tops deportivos y zapatillas." />
      ) : (
        <>
          {used.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
              <Chip selected={filter === "all"} onClick={() => setFilter("all")}>Todo</Chip>
              {used.map((k) => <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>{CATEGORIES[k]}</Chip>)}
            </div>
          )}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((i) => (
              <li key={i.id} className="overflow-hidden rounded-card border border-border/60 bg-surface shadow-card">
                <div className="aspect-square bg-surface-2"><Photo path={i.storage_path} alt={itemLabel(i)} /></div>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{i.name || CATEGORIES[i.category]}</p>
                    <p className="truncate text-xs text-muted">{i.name ? CATEGORIES[i.category] : ""}{i.name && i.colors.length ? " · " : ""}{i.colors.join(", ")}</p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Borrar ${itemLabel(i)}`} onClick={async () => {
                    if (!(await confirm("¿Borrar esta prenda de tu clóset?", "Borrar"))) return;
                    try {
                      await removeWardrobeItem(i);
                      onRemoved(i.id);
                    } catch (e) {
                      toast(errorMessage(e), "error");
                    }
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title="Nueva prenda"
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button loading={saving} onClick={() => void save()}>Guardar prenda</Button></>}>
        {draft && (
          <div className="space-y-4">
            <img src={draft.url} alt="Prenda por guardar" className="mx-auto max-h-56 rounded-2xl object-contain" />
            <div>
              <p className="mb-2 text-sm font-semibold">Tipo</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de prenda">
                {CATEGORY_KEYS.map((k) => <Chip key={k} selected={category === k} onClick={() => setCategory(k)}>{CATEGORIES[k]}</Chip>)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Colores <span className="font-normal text-muted">(hasta 3)</span></p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Colores de la prenda">
                {COLORS.map((c) => <Chip key={c} selected={colors.includes(c)} onClick={() => setColors((l) => toggle(l, c, 3))}>{c}</Chip>)}
              </div>
            </div>
            <Field label="Nombre" optional htmlFor="item-name" hint="Por ejemplo: “leggings negros de tiro alto”.">
              <Input id="item-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
      {confirmDialog}
    </div>
  );
}

// ---------- Mi estilo ----------
function StylePanel({ profile, onSaved }: { profile: StyleProfileRow | null; onSaved: (p: StyleProfileRow) => void }) {
  const toast = useToast();
  const [styles, setStyles] = useState<string[]>(profile?.styles ?? []);
  const [fav, setFav] = useState<string[]>(profile?.favorite_colors ?? []);
  const [avoid, setAvoid] = useState<string[]>(profile?.avoid_colors ?? []);
  const [fit, setFit] = useState<StyleProfileRow["fit"]>(profile?.fit ?? null);
  const [coverage, setCoverage] = useState<StyleProfileRow["coverage"]>(profile?.coverage ?? null);
  const [activities, setActivities] = useState<string[]>(profile?.activities ?? []);
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next = { styles, favorite_colors: fav, avoid_colors: avoid, fit, coverage, activities, notes: notes.trim() || null };
    try {
      await saveStyleProfile(next);
      onSaved({ ...(profile ?? { user_id: "", updated_at: "" }), ...next } as StyleProfileRow);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const group = (title: string, hint: string | null, children: React.ReactNode) => (
    <div>
      <p className="text-sm font-semibold">{title}{hint && <span className="font-normal text-muted"> {hint}</span>}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={title}>{children}</div>
    </div>
  );

  return (
    <Card className="space-y-5">
      <CardHeader title="Cuéntame tu estilo" subtitle="Con esto personalizo cada consejo." />
      {group("Estilos que te gustan", "(hasta 3)", STYLES.map((s) => <Chip key={s} selected={styles.includes(s)} onClick={() => setStyles((l) => toggle(l, s, 3))}>{s}</Chip>))}
      {group("Colores favoritos", null, COLORS.map((c) => <Chip key={c} selected={fav.includes(c)} disabled={avoid.includes(c)} onClick={() => setFav((l) => toggle(l, c, 6))}>{c}</Chip>))}
      {group("Colores que prefieres evitar", null, COLORS.map((c) => <Chip key={c} selected={avoid.includes(c)} disabled={fav.includes(c)} onClick={() => setAvoid((l) => toggle(l, c, 6))}>{c}</Chip>))}
      {group("Ajuste", null, (Object.keys(FITS) as (keyof typeof FITS)[]).map((k) => <Chip key={k} selected={fit === k} onClick={() => setFit(fit === k ? null : k)}>{FITS[k]}</Chip>))}
      {group("Cobertura", null, (Object.keys(COVERAGE) as (keyof typeof COVERAGE)[]).map((k) => <Chip key={k} selected={coverage === k} onClick={() => setCoverage(coverage === k ? null : k)}>{COVERAGE[k]}</Chip>))}
      {group("Lo que sueles entrenar", null, ACTIVITY_KEYS.map((k) => <Chip key={k} selected={activities.includes(k)} onClick={() => setActivities((l) => toggle(l, k, 8))}>{ACTIVITIES[k].label}</Chip>))}
      <Field label="Algo más que deba saber" optional htmlFor="style-notes" hint="Por ejemplo: “entreno antes del trabajo” o “me encantan los conjuntos”.">
        <Textarea id="style-notes" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button className="w-full sm:w-auto" loading={saving} onClick={() => void save()}>Guardar mi estilo</Button>
    </Card>
  );
}
