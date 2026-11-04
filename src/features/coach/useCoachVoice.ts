// Voz del coach: escuchar respuestas (ElevenLabs o voz del navegador) y dictar mensajes (nota de voz o dictado del navegador).
import { useCallback, useEffect, useRef, useState } from "react";
import { speakCoachMessage, transcribeAudio } from "@/services/tracking";
import { speechText } from "../../../supabase/functions/_shared/voice.ts";

export type VoiceKind = "female" | "male";
export type MicState = "idle" | "recording" | "transcribing";

const AUTO_KEY = "mgs:coach-voice-auto";
const MAX_RECORD_MS = 60_000;
/** WAV silencioso de 0,1 s: desbloquea la reproducción en iOS dentro del gesto del usuario. */
function silentWav(): string {
  const rate = 8000, samples = 800, buf = new ArrayBuffer(44 + samples), v = new DataView(buf);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + samples, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

type BrowserRecognition = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};

function browserRecognition(): BrowserRecognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
}

function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Voz del navegador en español; la más cercana al tipo pedido si el sistema la distingue por nombre. */
function speakInBrowser(text: string, kind: VoiceKind, onEnd: () => void): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
  const byName = voices.find((v) => (kind === "female" ? /female|mujer|paulina|monica|mónica|helena|laura|sabina|elvira/i : /male|hombre|jorge|diego|juan|pablo|alvaro|álvaro/i).test(v.name));
  u.voice = byName ?? voices[0] ?? null;
  u.rate = 1.03;
  u.onend = onEnd;
  u.onerror = onEnd;
  speechSynthesis.speak(u);
  return true;
}

export function useCoachVoice(kind: VoiceKind, onError: (message: string) => void) {
  const [autoSpeak, setAutoSpeak] = useState(readAuto);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mic, setMic] = useState<MicState>("idle");
  const [seconds, setSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<{ stop: () => void; cancel: () => void } | null>(null);
  const urlCache = useRef(new Map<string, string>());
  const serverVoice = useRef(true);

  const audio = () => (audioRef.current ??= new Audio());

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  useEffect(() => () => {
    stop();
    recorderRef.current?.cancel();
  }, [stop]);

  /** Llamar dentro de un clic para que la respuesta automática pueda sonar en móviles. */
  const prime = useCallback(() => {
    if (!autoSpeak) return;
    const a = audio();
    if (!a.src) {
      a.src = silentWav();
      a.play().catch(() => undefined);
    }
  }, [autoSpeak]);

  const toggleAuto = useCallback(() => {
    setAutoSpeak((v) => {
      const next = !v;
      try {
        localStorage.setItem(AUTO_KEY, next ? "1" : "0");
      } catch {
        // preferencia solo para esta sesión
      }
      if (!next) stop();
      return next;
    });
  }, [stop]);

  const speak = useCallback(async (id: string, content: string) => {
    if (speakingId === id) return stop();
    stop();
    const text = speechText(content);
    if (!text) return;
    const done = () => setSpeakingId((cur) => (cur === id ? null : cur));
    setSpeakingId(id);
    let url = urlCache.current.get(id) ?? null;
    if (!url && serverVoice.current && !id.startsWith("tmp-")) {
      setLoadingId(id);
      try {
        url = await speakCoachMessage(id, kind);
        if (url) urlCache.current.set(id, url);
        else serverVoice.current = false;
      } catch (e) {
        onError(e instanceof Error ? e.message : "La voz del coach no está disponible ahora.");
      } finally {
        setLoadingId(null);
      }
    }
    if (url) {
      const a = audio();
      a.src = url;
      a.onended = done;
      a.onerror = done;
      try {
        await a.play();
        return;
      } catch {
        // reproducción bloqueada: se intenta con la voz del navegador
      }
    }
    if (!speakInBrowser(text, kind, done)) {
      done();
      onError("Tu navegador no puede leer en voz alta.");
    }
  }, [kind, onError, speakingId, stop]);

  /** Graba una nota de voz (o usa el dictado del navegador) y entrega el texto. */
  const startMic = useCallback(async (onText: (text: string) => void) => {
    if (mic !== "idle") return;
    stop();
    const mime = pickMime();
    const canRecord = serverVoice.current && !!mime && !!navigator.mediaDevices?.getUserMedia;
    if (!canRecord) {
      const rec = browserRecognition();
      if (!rec) return onError("Tu navegador no permite dictar. Escribe tu mensaje o usa otro navegador.");
      rec.lang = "es-ES";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let said = "";
      rec.onresult = (e) => { said = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim(); };
      rec.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") onError("No pudimos usar el micrófono. Revisa el permiso del navegador."); };
      rec.onend = () => { setMic("idle"); recorderRef.current = null; if (said) onText(said); };
      recorderRef.current = { stop: () => rec.stop(), cancel: () => { rec.onend = () => setMic("idle"); rec.stop(); } };
      setMic("recording");
      setSeconds(0);
      rec.start();
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Necesitamos permiso para usar el micrófono.");
    }
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    let cancelled = false;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (Date.now() - started >= MAX_RECORD_MS) recorder.stop();
    }, 250);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      window.clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      if (cancelled || !chunks.length) return setMic("idle");
      setMic("transcribing");
      try {
        const text = await transcribeAudio(new Blob(chunks, { type: recorder.mimeType || mime }));
        if (text === null) {
          serverVoice.current = false;
          onError("La transcripción no está disponible. Toca el micrófono otra vez para dictar con el navegador.");
        } else if (text) {
          onText(text);
        } else {
          onError("No se entendió la nota de voz. Inténtalo de nuevo más cerca del micrófono.");
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : "No pudimos transcribir la nota de voz.");
      } finally {
        setMic("idle");
      }
    };
    recorderRef.current = { stop: () => recorder.state !== "inactive" && recorder.stop(), cancel: () => { cancelled = true; if (recorder.state !== "inactive") recorder.stop(); } };
    setSeconds(0);
    setMic("recording");
    recorder.start();
  }, [mic, onError, stop]);

  const stopMic = useCallback(() => recorderRef.current?.stop(), []);
  const cancelMic = useCallback(() => recorderRef.current?.cancel(), []);

  return { autoSpeak, toggleAuto, speak, stop, prime, speakingId, loadingId, mic, seconds, startMic, stopMic, cancelMic };
}
