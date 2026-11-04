import { describe, expect, it } from "vitest";
import { DEFAULT_VOICES, isAllowedAudio, isVoiceKind, speechText, voiceIdFor } from "./voice.ts";

describe("voz del coach", () => {
  it("convierte Markdown en texto para leer en voz alta", () => {
    expect(speechText("## Plan\n**Hoy:** 3 series\n- Sentadilla\n- [Ver](https://x.y)")).toBe("Plan\nHoy: 3 series\nSentadilla\nVer");
  });
  it("recorta textos largos en el final de una frase", () => {
    const t = speechText("Frase uno. ".repeat(400), 100);
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith(".")).toBe(true);
  });
  it("usa la voz configurada o la voz base", () => {
    expect(voiceIdFor("female", () => undefined)).toBe(DEFAULT_VOICES.female);
    expect(voiceIdFor("male", (n) => (n === "ELEVENLABS_VOICE_MALE" ? "IhY4M972n9BRInNffBsN" : undefined))).toBe("IhY4M972n9BRInNffBsN");
    expect(voiceIdFor("male", () => "../malo")).toBe(DEFAULT_VOICES.male);
  });
  it("valida el tipo de voz y el audio grabado", () => {
    expect(isVoiceKind("female")).toBe(true);
    expect(isVoiceKind("robot")).toBe(false);
    expect(isAllowedAudio("audio/webm;codecs=opus", 2000)).toBe(true);
    expect(isAllowedAudio("video/mp4", 2000)).toBe(false);
    expect(isAllowedAudio("audio/webm", 0)).toBe(false);
  });
});
