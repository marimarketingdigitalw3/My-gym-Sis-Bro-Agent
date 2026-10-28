import { Bot, MessageSquarePlus, Send, ShieldAlert, Trash2, User } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useBundle } from "@/app/providers";
import { Badge, Button, Card, IconButton, Notice, PageHeader, Select, Skeleton, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { db } from "@/services/data";
import { deleteConversation, listConversations, listMessages, sendCoachMessage } from "@/services/tracking";
import type { ChatMessageRow } from "@/types/db";
import { MAX_MESSAGE_CHARS } from "../../../supabase/functions/_shared/coach.ts";

const SUGGESTIONS = [
  "¿Qué entreno hoy?",
  "¿Puedes reemplazar las sentadillas? Me molestan las rodillas",
  "¿Cómo mejoro mis glúteos?",
  "¿Qué como después de entrenar?",
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
  if (source === "ai") return <Badge tone="primary">IA</Badge>;
  if (source === "safety") return <Badge tone="danger"><ShieldAlert className="h-3 w-3" /> Seguridad</Badge>;
  if (source === "fallback") return <Badge tone="warning">Modo de respaldo · no es IA</Badge>;
  return null;
}

export default function CoachPage() {
  const bundle = useBundle();
  const toast = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const convs = useAsync(listConversations, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function open(id: string | null) {
    setConversationId(id);
    setError(null);
    setNotice(null);
    if (!id) return setMessages([]);
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

  return (
    <div>
      <PageHeader title="Gym AI Coach" subtitle="Tu entrenador personal: técnica, rutinas, recuperación y nutrición general." />
      {db.mode === "local" && (
        <div className="mb-4"><Notice tone="warning" title="Modo de respaldo">No hay un proveedor de IA conectado en este modo. Las respuestas son predefinidas por tema y no se generan con IA en vivo.</Notice></div>
      )}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <Button block variant="outline" onClick={() => open(null)}><MessageSquarePlus className="h-4 w-4" /> Nueva conversación</Button>
          <ul className="mt-3 space-y-1">
            {convs.loading && !convs.data && <Skeleton className="h-10" />}
            {(convs.data ?? []).map((c) => (
              <li key={c.id} className="group flex items-center">
                <button type="button" onClick={() => open(c.id)} className={cx("flex-1 truncate rounded-xl px-3 py-2 text-left text-sm", c.id === conversationId ? "bg-primary/15 font-semibold text-primary-strong" : "hover:bg-surface-2")}>{c.title}</button>
                <IconButton label="Borrar conversación" className="h-8 w-8 opacity-60 group-hover:opacity-100" onClick={async () => {
                  try { await deleteConversation(c.id); if (c.id === conversationId) await open(null); await convs.reload(); toast("Conversación borrada"); } catch (e) { toast(errorMessage(e), "error"); }
                }}><Trash2 className="h-4 w-4" /></IconButton>
              </li>
            ))}
          </ul>
        </aside>

        <Card className="flex min-h-[60dvh] flex-col p-0 sm:p-0">
          <div className="flex items-center gap-2 border-b border-border p-3 lg:hidden">
            <label htmlFor="conv" className="sr-only">Conversación</label>
            <Select id="conv" value={conversationId ?? ""} onChange={(e) => open(e.target.value || null)} className="h-10 flex-1">
              <option value="">Nueva conversación</option>
              {(convs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {loadingMessages ? <Skeleton className="h-24" /> : messages.length === 0 ? (
              <div className="py-6 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary-strong"><Bot className="h-7 w-7" /></span>
                <p className="mt-3 font-semibold">¿En qué te ayudo hoy, {bundle.profile.display_name.split(" ")[0]}?</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted">Conozco tu plan, tu equipo y tu progreso. No doy diagnósticos médicos.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3.5 py-2 text-sm hover:bg-surface-2">{s}</button>)}
                </div>
              </div>
            ) : messages.map((m) => (
              <div key={m.id} className={cx("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-surface-2" : "bg-primary/15 text-primary-strong")}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed", m.role === "user" ? "bg-primary-strong text-on-primary" : "bg-surface-2")}>
                  {m.role === "assistant" && <div className="mb-1.5"><SourceBadge source={m.source} /></div>}
                  {m.role === "assistant" ? <RichText text={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5" role="status">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary-strong"><Bot className="h-4 w-4" /></span>
                <div className="flex items-center gap-1 rounded-2xl bg-surface-2 px-4 py-3" aria-label="El coach está escribiendo">
                  {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="space-y-2 border-t border-border p-3">
            {notice && <Notice tone="warning">{notice}</Notice>}
            {error && <Notice tone="danger" title="No pudimos enviar tu mensaje">{error}</Notice>}
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2">
              <label htmlFor="coach-input" className="sr-only">Escribe tu pregunta</label>
              <Textarea id="coach-input" value={input} maxLength={MAX_MESSAGE_CHARS} rows={1} placeholder="Pregunta sobre tu rutina, técnica o nutrición…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                className="max-h-40 min-h-[44px] flex-1 resize-none" />
              <Button type="submit" aria-label="Enviar" loading={sending} disabled={!input.trim()} className="h-11 w-11 shrink-0 px-0"><Send className="h-4 w-4" /></Button>
            </form>
            <p className="text-center text-[11px] text-muted">Información general de fitness, no consejo médico. Ante dolor en el pecho, desmayo o falta de aire, busca atención médica.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
