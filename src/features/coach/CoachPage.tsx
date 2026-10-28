import {
  Apple, ArrowLeft, ArrowUpRight, Copy, Dumbbell, History, MessageSquarePlus, Plus, Repeat, Send, ShieldAlert, Sparkles, Trash2, User,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useBundle } from "@/app/providers";
import { Avatar } from "@/app/AppShell";
import { Badge, Button, IconButton, Modal, Notice, Skeleton, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { GymBotIcon } from "@/components/GymBot";
import { db } from "@/services/data";
import { deleteConversation, listConversations, listMessages, sendCoachMessage } from "@/services/tracking";
import type { ChatConversationRow, ChatMessageRow } from "@/types/db";
import { MAX_MESSAGE_CHARS } from "../../../supabase/functions/_shared/coach.ts";

/** Identidad visual del coach: la mascota Gym Bot. */
function Orb({ size = 36 }: { size?: number }) {
  return <GymBotIcon size={size} className="shadow-[0_6px_18px_-8px_rgb(138_92_255/0.6)]" />;
}

const SHORTCUTS: { title: string; subtitle: string; prompt: string; icon: typeof Dumbbell; wide?: boolean }[] = [
  { title: "Entreno", subtitle: "¿Qué entreno hoy?", prompt: "¿Qué entreno hoy?", icon: Dumbbell },
  { title: "Nutrición", subtitle: "Comida post-entreno", prompt: "¿Qué como después de entrenar?", icon: Apple },
  { title: "Sustituir", subtitle: "Un ejercicio que me molesta", prompt: "¿Puedes reemplazar las sentadillas? Me molestan las rodillas", icon: Repeat, wide: true },
];

const MORE_IDEAS = [
  "¿Cómo mejoro mis glúteos?",
  "Me perdí dos días de entrenamiento, ¿cómo ajusto la semana?",
  "¿Por qué no progreso en press de banca?",
];

/** Render mínimo y seguro: negritas (**x**) y viñetas, sin HTML. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-5">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:[•\-*]|\d+\.)\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="prose-coach space-y-2">{blocks}</div>;
}

function SourceBadge({ source }: { source: ChatMessageRow["source"] }) {
  if (source === "ai") return <Badge tone="primary"><Sparkles className="h-3 w-3" /> IA</Badge>;
  if (source === "safety") return <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> Seguridad</Badge>;
  if (source === "fallback") return <Badge tone="warning">Modo de respaldo · no es IA</Badge>;
  return null;
}

const glass = "border border-white/50 bg-surface/75 [[data-theme=bro]_&]:border-white/10 shadow-[0_10px_30px_-18px_rgb(30_40_90/0.35)] backdrop-blur-xl";

export default function CoachPage() {
  const bundle = useBundle();
  const toast = useToast();
  const [view, setView] = useState<"home" | "chat">("home");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const convs = useAsync(listConversations, []);
  const firstName = bundle.profile.display_name.split(" ")[0];

  useEffect(() => {
    if (view === "chat") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, view]);

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
      setMessages(await listMessages(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMessages(false);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    if (message.length > MAX_MESSAGE_CHARS) return setError(`El mensaje supera ${MAX_MESSAGE_CHARS} caracteres.`);
    setView("chat");
    setSending(true);
    setError(null);
    const optimistic: ChatMessageRow = {
      id: `tmp-${Date.now()}`, conversation_id: conversationId ?? "", user_id: bundle.profile.id, role: "user", content: message, source: "user", created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    try {
      const res = await sendCoachMessage(conversationId, message);
      setNotice(res.notice);
      if (!conversationId) {
        setConversationId(res.conversationId);
        void convs.reload();
      }
      setMessages((m) => [...m.map((x) => (x.id === optimistic.id ? { ...x, conversation_id: res.conversationId } : x)), res.message]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(message);
      setError(errorMessage(e));
    } finally {
      setSending(false);
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

  const composer = (
    <div className={cx("rounded-[1.75rem] p-3", glass)}>
      {notice && <div className="mb-2"><Notice tone="warning">{notice}</Notice></div>}
      {error && <div className="mb-2"><Notice tone="danger" title="No pudimos enviar tu mensaje">{error}</Notice></div>}
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="coach-input" className="sr-only">Escribe tu pregunta</label>
        <Textarea id="coach-input" ref={inputRef} value={input} maxLength={MAX_MESSAGE_CHARS} rows={2}
          placeholder="Pregunta lo que quieras sobre tu rutina, técnica o nutrición…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          className="max-h-40 min-h-[56px] resize-none border-0 bg-transparent px-2 shadow-none focus:ring-0" />
        <div className="mt-1 flex items-center justify-between">
          <IconButton label="Nueva conversación" onClick={newChat} className="border border-border/70 bg-surface"><Plus className="h-4 w-4" /></IconButton>
          <button type="submit" aria-label="Enviar" disabled={!input.trim() || sending}
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
          <Notice tone="warning" title="Modo de respaldo">No hay un proveedor de IA conectado en este modo. Las respuestas son predefinidas por tema y no se generan con IA en vivo.</Notice>
        )}

        <section className={cx("relative overflow-hidden rounded-card p-5 sm:p-6", glass)}>
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, #ffd23f 0%, #ff9a3d 30%, #8a5cff 55%, transparent 72%)" }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Orb size={40} />
              <h2 className="text-xl font-semibold">Tu entrenador personal</h2>
            </div>
            <p className="mt-3 max-w-md text-sm text-muted">
              Conozco tu plan, tu equipo y tu progreso. Te ayudo con técnica, sustituciones, recuperación y nutrición. No doy diagnósticos médicos.
            </p>
            <Button className="mt-4" onClick={newChat}><Sparkles className="h-4 w-4" /> Empezar a conversar</Button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map(({ title, subtitle, prompt, icon: Icon, wide }) => (
            <button key={title} type="button" onClick={() => send(prompt)}
              className={cx("group flex flex-col justify-between gap-6 rounded-card p-4 text-left transition hover:-translate-y-0.5", glass, wide && "col-span-2")}>
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

        <div className="flex flex-wrap gap-2">
          {MORE_IDEAS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-border/70 bg-surface/80 px-3.5 py-2 text-sm shadow-sm hover:bg-surface">{q}</button>
          ))}
        </div>

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
        <IconButton label="Historial de conversaciones" onClick={() => setHistoryOpen(true)} className={cx("h-12 w-12", glass)}><History className="h-5 w-5" /></IconButton>
      </header>

      <div className="flex-1 space-y-5 pb-4" aria-live="polite">
        {loadingMessages ? <Skeleton className="h-24" /> : messages.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Orb size={56} />
            <p className="mt-4 font-semibold">¿En qué te ayudo, {firstName}?</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Escribe tu pregunta abajo. Ante dolor en el pecho, desmayo o falta de aire, busca atención médica.</p>
          </div>
        ) : messages.map((m) => (
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end gap-2.5">
              <div className={cx("max-w-[80%] rounded-[1.4rem] rounded-br-md px-4 py-2.5 text-[15px]", glass)}>
                <p className="whitespace-pre-wrap">{m.content}</p>
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
                </div>
                <div className="mt-1 flex items-center gap-1 pl-1">
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
      <p className="mt-2 text-center text-[11px] text-muted">Información general de fitness, no consejo médico.</p>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} conversations={conversations} onOpen={open} onDelete={remove} />
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
