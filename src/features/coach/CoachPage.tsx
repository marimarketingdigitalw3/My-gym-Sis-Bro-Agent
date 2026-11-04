import {
  Apple, ArrowLeft, ArrowUpRight, Camera, Check, Copy, Dumbbell, HeartPulse, History, ImagePlus, Loader2, MessageSquarePlus, Pill, Plus, Send, Video, Mic, Square, Volume2, VolumeX,
  ShieldAlert, Sparkles, Trash2, User, Wand2, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useBundle, useUserData } from "@/app/providers";
import { Avatar } from "@/app/AppShell";
import { Badge, Button, IconButton, Modal, Notice, Skeleton, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { GymBotIcon } from "@/components/GymBot";
import { db } from "@/services/data";
import { applyCoachAction } from "@/services/coachActions";
import { chatImageUrl, deleteConversation, listConversations, listMessages, saveMessageActions, sendCoachMessage, uploadChatAttachment } from "@/services/tracking";
import type { ChatConversationRow, ChatMessageRow } from "@/types/db";
import { useCoachVoice } from "./useCoachVoice";
import { RichText } from "@/components/RichText";
import { MAX_MESSAGE_CHARS } from "../../../supabase/functions/_shared/coach.ts";
import { actionSection, isVideoPath, MAX_ATTACHMENTS, MAX_VIDEO_BYTES, parseStoredActions, type StoredAction } from "../../../supabase/functions/_shared/coachActions.ts";

/** Identidad visual del coach: la mascota Gym Bot. */
function Orb({ size = 36 }: { size?: number }) {
  return <GymBotIcon size={size} className="shadow-[0_6px_18px_-8px_rgb(138_92_255/0.6)]" />;
}

/** Las cuatro perspectivas del agente, con una pregunta de ejemplo cada una. */
const SHORTCUTS: { title: string; subtitle: string; prompt: string; icon: typeof Dumbbell }[] = [
  { title: "Entrenamiento", subtitle: "¿Qué entreno hoy?", prompt: "¿Qué entreno hoy y en qué me fijo en la técnica?", icon: Dumbbell },
  { title: "Nutrición", subtitle: "Comida post-entreno", prompt: "¿Qué como después de entrenar según mis preferencias?", icon: Apple },
  { title: "Suplementos", subtitle: "Qué tomar y cuándo", prompt: "¿Qué suplementos tienen sentido para mi objetivo y a qué hora los tomo?", icon: Pill },
  { title: "Fisioterapia", subtitle: "Una molestia al entrenar", prompt: "Me molesta la rodilla al hacer sentadilla. ¿Qué alternativas y cuidados me recomiendas?", icon: HeartPulse },
];

const ACTION_IDEAS = [
  "Cambia la hora del lunes a las 7:00",
  "Agrega una rutina de glúteos el sábado",
  "Agrega creatina a mis suplementos",
  "Quiero 5 comidas al día",
];

function SourceBadge({ source }: { source: ChatMessageRow["source"] }) {
  if (source === "ai") return <Badge tone="primary"><Sparkles className="h-3 w-3" /> IA</Badge>;
  if (source === "safety") return <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> Seguridad</Badge>;
  if (source === "fallback") return <Badge tone="warning">Modo de respaldo · no es IA</Badge>;
  return null;
}

/** Miniatura de una foto o un video adjunto (URL firmada o local). */
function ChatMedia({ path, size = 96 }: { path: string; size?: number }) {
  const { data } = useAsync(() => chatImageUrl(path), [path]);
  const video = isVideoPath(path);
  return (
    <span className="block overflow-hidden rounded-2xl bg-surface-2" style={{ width: video ? size * 1.6 : size, height: size }}>
      {data
        ? video
          ? <video src={data} controls playsInline preload="metadata" aria-label="Video adjunto" className="h-full w-full object-cover" />
          : <img src={data} alt="Foto adjunta" className="h-full w-full object-cover" />
        : <span className="grid h-full w-full place-items-center text-muted">{video ? <Video className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}</span>}
    </span>
  );
}

const glass = "border border-white/50 bg-surface/75 [[data-theme=bro]_&]:border-white/10 shadow-[0_10px_30px_-18px_rgb(30_40_90/0.35)] backdrop-blur-xl";

interface Pending { file: File; url: string }

export default function CoachPage() {
  const bundle = useBundle();
  const { refresh } = useUserData();
  const toast = useToast();
  const [view, setView] = useState<"home" | "chat">("home");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const voiceError = useCallback((m: string) => toast(m, "error"), [toast]);
  const voice = useCoachVoice(bundle.profile.theme === "sis" ? "female" : "male", voiceError);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const convs = useAsync(listConversations, []);
  const firstName = bundle.profile.display_name.split(" ")[0];

  useEffect(() => {
    if (view === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, view]);

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)), [pending]);

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setNotice(null);
    setView("chat");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function open(id: string) {
    setConversationId(id);
    setError(null);
    setNotice(null);
    setView("chat");
    setHistoryOpen(false);
    setLoadingMessages(true);
    try {
      const rows = await listMessages(id);
      setMessages(rows.map((m) => ({ ...m, attachments: m.attachments ?? [], actions: parseStoredActions(m.actions) })));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMessages(false);
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...pending];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) { toast("Solo se pueden adjuntar fotos o videos.", "error"); continue; }
      if (f.type.startsWith("video/") && f.size > MAX_VIDEO_BYTES) { toast("El video supera 50 MB. Recórtalo a unos segundos.", "error"); continue; }
      if (next.length >= MAX_ATTACHMENTS) { toast(`Máximo ${MAX_ATTACHMENTS} adjuntos por mensaje.`, "error"); break; }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPending(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send(text: string) {
    const message = text.trim();
    if ((!message && !pending.length) || sending) return;
    if (message.length > MAX_MESSAGE_CHARS) return setError(`El mensaje supera ${MAX_MESSAGE_CHARS} caracteres.`);
    voice.prime();
    setView("chat");
    setSending(true);
    setError(null);
    const files = pending;
    setPending([]);
    setInput("");
    const optimistic: ChatMessageRow = {
      id: `tmp-${Date.now()}`, conversation_id: conversationId ?? "", user_id: bundle.profile.id, role: "user", content: message || "(foto)", source: "user",
      attachments: [], actions: [], created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const attachments: string[] = [];
      for (const p of files) attachments.push(await uploadChatAttachment(bundle.profile.id, p.file));
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? { ...x, attachments } : x)));
      const res = await sendCoachMessage(conversationId, message, attachments);
      setNotice(res.notice);
      if (!conversationId) {
        setConversationId(res.conversationId);
        void convs.reload();
      }
      const reply = { ...res.message, attachments: res.message.attachments ?? [], actions: parseStoredActions(res.message.actions) };
      setMessages((m) => [...m.map((x) => (x.id === optimistic.id ? { ...x, conversation_id: res.conversationId, attachments } : x)), reply]);
      if (voice.autoSpeak && reply.id) void voice.speak(reply.id, reply.content);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(message);
      setPending(files);
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function apply(msg: ChatMessageRow, ids: string[]) {
    setApplying(msg.id);
    let actions = msg.actions;
    const results: string[] = [];
    try {
      for (const id of ids) {
        const item = actions.find((a) => a.id === id);
        if (!item || item.applied_at) continue;
        const r = await applyCoachAction(item.action, bundle);
        if (r.ok) {
          actions = actions.map((a) => (a.id === id ? { ...a, applied_at: new Date().toISOString() } : a));
          results.push(r.detail);
        } else {
          toast(`${item.label}: ${r.error}`, "error");
        }
      }
      setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, actions } : x)));
      if (!msg.id.startsWith("tmp-")) await saveMessageActions(msg.id, actions);
      await refresh();
      if (results.length) toast(results.length === 1 ? results[0] : `${results.length} cambios aplicados.`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setApplying(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Respuesta copiada");
    } catch {
      toast("No se pudo copiar. Selecciona el texto manualmente.", "error");
    }
  }

  async function remove(c: ChatConversationRow) {
    try {
      await deleteConversation(c.id);
      if (c.id === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
      await convs.reload();
      toast("Conversación borrada");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const conversations = convs.data ?? [];
  const canSend = (input.trim().length > 0 || pending.length > 0) && !sending;

  const composer = (
    <div className={cx("rounded-[1.75rem] p-3", glass)}>
      {notice && <div className="mb-2"><Notice tone="warning">{notice}</Notice></div>}
      {error && <div className="mb-2"><Notice tone="danger" title="No pudimos enviar tu mensaje">{error}</Notice></div>}
      {pending.length > 0 && (
        <ul className="mb-2 flex gap-2" aria-label="Adjuntos por enviar">
          {pending.map((p, i) => (
            <li key={p.url} className="relative">
              {p.file.type.startsWith("video/")
                ? <video src={p.url} muted playsInline preload="metadata" aria-label={`Video por enviar ${i + 1}`} className="h-16 w-24 rounded-2xl object-cover" />
                : <img src={p.url} alt={`Foto por enviar ${i + 1}`} className="h-16 w-16 rounded-2xl object-cover" />}
              <button type="button" aria-label={`Quitar adjunto ${i + 1}`} onClick={() => setPending((l) => l.filter((x) => x !== p))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-text text-surface shadow"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="coach-input" className="sr-only">Escribe tu pregunta</label>
        <Textarea id="coach-input" ref={inputRef} value={input} maxLength={MAX_MESSAGE_CHARS} rows={2}
          placeholder="Pregunta o pide un cambio: “cambia la hora del lunes a las 7”, “agrega pierna el viernes”…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          className="max-h-40 min-h-[56px] resize-none border-0 bg-transparent px-2 shadow-none focus:ring-0" />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <IconButton label="Nueva conversación" onClick={newChat} className="border border-border/70 bg-surface"><Plus className="h-4 w-4" /></IconButton>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only" aria-label="Adjuntar foto o video" onChange={(e) => addFiles(e.target.files)} />
            <IconButton label="Adjuntar foto o video" onClick={() => fileRef.current?.click()} className="border border-border/70 bg-surface"><Camera className="h-4 w-4" /></IconButton>
            {voice.mic === "idle" && (
              <IconButton label="Hablar con el coach" disabled={sending} onClick={() => void voice.startMic((t) => void send(t))} className="border border-border/70 bg-surface"><Mic className="h-4 w-4" /></IconButton>
            )}
            {voice.mic === "recording" && (
              <button type="button" onClick={voice.stopMic} aria-label="Detener y enviar nota de voz"
                className="flex h-10 items-center gap-2 rounded-full bg-danger px-3 text-sm font-semibold text-white shadow-md">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden />
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                <span className="tabular-nums">0:{String(voice.seconds).padStart(2, "0")}</span>
              </button>
            )}
            {voice.mic === "transcribing" && (
              <span className="flex h-10 items-center gap-2 px-2 text-sm text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Transcribiendo…</span>
            )}
          </div>
          <button type="submit" aria-label="Enviar" disabled={!canSend}
            className="grid h-11 w-11 place-items-center rounded-full bg-primary-strong text-on-primary shadow-md transition disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );

  // ---------- Vista de bienvenida ----------
  if (view === "home") {
    return (
      <div className="space-y-5">
        <section className="flex items-center gap-3">
          <Avatar name={bundle.profile.display_name} size={48} />
          <div className="min-w-0 leading-tight">
            <p className="text-sm text-muted">Hola, {firstName}</p>
            <p className="font-semibold">Gym AI Coach</p>
          </div>
        </section>
        <h1 className="display-hero text-[2.1rem] sm:text-5xl">¿Cómo te puedo ayudar <em>hoy</em>, {firstName}?</h1>

        {db.mode === "local" && (
          <Notice tone="warning" title="Modo de respaldo">Sin proveedor de IA conectado: las respuestas son predefinidas y no analizo fotos. Los cambios en tu plan (horarios, ejercicios, suplementos) sí funcionan.</Notice>
        )}

        <section className={cx("relative overflow-hidden rounded-card p-5 sm:p-6", glass)}>
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, #ffd23f 0%, #ff9a3d 30%, #8a5cff 55%, transparent 72%)" }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Orb size={40} />
              <h2 className="text-xl font-semibold">Tu equipo en un solo agente</h2>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted">
              Entrenador, nutricionista, especialista en suplementos y fisioterapeuta. Conoce tu plan y tu progreso, revisa tus fotos
              (técnica, comidas, etiquetas) y puede cambiar tus horarios, ejercicios, comidas y suplementos con tu confirmación. No da diagnósticos médicos.
            </p>
            <Button className="mt-4" onClick={newChat}><Sparkles className="h-4 w-4" /> Empezar a conversar</Button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map(({ title, subtitle, prompt, icon: Icon }) => (
            <button key={title} type="button" onClick={() => send(prompt)}
              className={cx("group flex flex-col justify-between gap-6 rounded-card p-4 text-left transition hover:-translate-y-0.5", glass)}>
              <span className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-surface"><Icon className="h-4 w-4" aria-hidden /></span>
                <span className="text-lg font-semibold">{title}</span>
              </span>
              <span className="flex items-end justify-between gap-2">
                <span className="text-sm text-muted">{subtitle}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface shadow-sm transition group-hover:bg-primary-strong group-hover:text-on-primary">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </span>
            </button>
          ))}
        </div>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Wand2 className="h-4 w-4" aria-hidden /> Pídele cambios</p>
          <div className="flex flex-wrap gap-2">
            {ACTION_IDEAS.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-border/70 bg-surface/80 px-3.5 py-2 text-sm shadow-sm hover:bg-surface">{q}</button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Conversaciones recientes</h2>
            {conversations.length > 4 && <button type="button" className="text-sm text-muted hover:text-text" onClick={() => setHistoryOpen(true)}>Ver todas</button>}
          </div>
          {convs.loading && !convs.data ? <Skeleton className="h-14" /> : conversations.length === 0 ? (
            <p className="text-sm text-muted">Aún no tienes conversaciones. Empieza con una de las sugerencias.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c.id)} className={cx("flex w-full items-center gap-3 rounded-full px-4 py-3 text-left", glass)}>
                    <MessageSquarePlus className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} conversations={conversations} onOpen={open} onDelete={remove} />
      </div>
    );
  }

  // ---------- Vista de chat ----------
  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <header className="mb-4 flex items-center justify-between gap-3">
        <IconButton label="Volver al inicio del coach" onClick={() => setView("home")} className={cx("h-12 w-12", glass)}><ArrowLeft className="h-5 w-5" /></IconButton>
        <p className="font-semibold">Gym AI Coach</p>
        <div className="flex items-center gap-2">
          <IconButton label={voice.autoSpeak ? "Desactivar respuestas en voz alta" : "Activar respuestas en voz alta"} aria-pressed={voice.autoSpeak}
            onClick={voice.toggleAuto} className={cx("h-12 w-12", glass, voice.autoSpeak && "text-primary-strong")}>
            {voice.autoSpeak ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </IconButton>
          <IconButton label="Historial de conversaciones" onClick={() => setHistoryOpen(true)} className={cx("h-12 w-12", glass)}><History className="h-5 w-5" /></IconButton>
        </div>
      </header>

      <div className="flex-1 space-y-5 pb-4" aria-live="polite">
        {loadingMessages ? <Skeleton className="h-24" /> : messages.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Orb size={56} />
            <p className="mt-4 font-semibold">¿En qué te ayudo, {firstName}?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Pregunta, adjunta una foto o un video de tu técnica, o pídeme un cambio en tu plan. Ante dolor en el pecho, desmayo o falta de aire, busca atención médica.</p>
          </div>
        ) : messages.map((m) => (
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end gap-2.5">
              <div className={cx("max-w-[80%] rounded-[1.4rem] rounded-br-md px-4 py-2.5 text-[15px]", glass)}>
                {m.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">{m.attachments.map((p) => <ChatMedia key={p} path={p} />)}</div>
                )}
                {m.content !== "(foto)" && <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
              <span className="mt-1 hidden h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 sm:grid"><User className="h-4 w-4" aria-hidden /></span>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="mt-1"><Orb size={32} /></span>
              <div className="min-w-0 max-w-[85%]">
                <div className={cx("rounded-[1.4rem] rounded-tl-md px-4 py-3 text-[15px] leading-relaxed", glass)}>
                  <div className="mb-1.5"><SourceBadge source={m.source} /></div>
                  <RichText text={m.content} />
                  {m.actions.length > 0 && <ActionCards message={m} busy={applying === m.id} onApply={(ids) => apply(m, ids)} />}
                </div>
                <div className="mt-1 flex items-center gap-1 pl-1">
                  <IconButton label={voice.speakingId === m.id ? "Detener lectura" : "Escuchar respuesta"} onClick={() => void voice.speak(m.id, m.content)} className={cx("h-8 w-8 text-muted", voice.speakingId === m.id && "text-primary-strong")}>
                    {voice.loadingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : voice.speakingId === m.id ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-4 w-4" />}
                  </IconButton>
                  <IconButton label="Copiar respuesta" onClick={() => copy(m.content)} className="h-8 w-8 text-muted"><Copy className="h-4 w-4" /></IconButton>
                </div>
              </div>
            </div>
          )
        ))}
        {sending && (
          <div className="flex items-center gap-2.5" role="status">
            <Orb size={32} />
            <div className={cx("flex items-center gap-1 rounded-[1.4rem] px-4 py-3", glass)} aria-label="El coach está escribiendo">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-28 md:bottom-4">{composer}</div>
      <p className="mt-2 text-center text-[11px] text-muted">Información general de entrenamiento, nutrición, suplementos y movimiento, no consejo médico.</p>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} conversations={conversations} onOpen={open} onDelete={remove} />
    </div>
  );
}

/** Cambios propuestos por el coach: cada uno se aplica con un toque, o todos a la vez. */
function ActionCards({ message, busy, onApply }: { message: ChatMessageRow; busy: boolean; onApply: (ids: string[]) => void }) {
  const pendingIds = message.actions.filter((a) => !a.applied_at).map((a) => a.id);
  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-surface p-2.5" aria-label="Cambios propuestos">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Wand2 className="h-3.5 w-3.5" aria-hidden /> Cambios propuestos</p>
        {pendingIds.length > 1 && <Button size="sm" loading={busy} onClick={() => onApply(pendingIds)}>Aplicar todo</Button>}
      </div>
      <ul className="space-y-1.5">
        {message.actions.map((a: StoredAction) => (
          <li key={a.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block">{a.label}</span>
              {a.applied_at && <Link to={actionSection(a.action)} className="text-xs font-semibold text-primary-strong">Ver en {actionSection(a.action) === "/workouts" ? "Entrenos" : "Nutrición"}</Link>}
            </span>
            {a.applied_at ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success"><Check className="h-3.5 w-3.5" /> Aplicado</span>
            ) : (
              <button type="button" disabled={busy} onClick={() => onApply([a.id])}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-strong px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aplicar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryModal({ open, onClose, conversations, onOpen, onDelete }: {
  open: boolean; onClose: () => void; conversations: ChatConversationRow[]; onOpen: (id: string) => void; onDelete: (c: ChatConversationRow) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Conversaciones">
      {conversations.length === 0 ? <p className="text-sm text-muted">Aún no tienes conversaciones.</p> : (
        <ul className="divide-y divide-border">
          {conversations.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1">
              <button type="button" onClick={() => onOpen(c.id)} className="flex-1 truncate rounded-xl px-2 py-2.5 text-left text-sm font-medium hover:bg-surface-2">{c.title}</button>
              <IconButton label={`Borrar conversación ${c.title}`} onClick={() => onDelete(c)}><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
