export type MascotMood = "happy" | "sad" | "tired" | "motivated" | "angry" | "celebrating" | "neutral";
export declare function moodFromProgress(p: number): MascotMood;
export declare const MOODS: MascotMood[];
export declare class GymBotMascot extends HTMLElement {
  readonly mood: MascotMood;
  react(mood: MascotMood, ms?: number): void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gym-bot-mascot": {
        mood?: MascotMood;
        progress?: number;
        size?: number;
        static?: "" | undefined;
        className?: string;
        "aria-hidden"?: boolean | "true" | "false";
        ref?: import("react").Ref<GymBotMascot>;
      };
    }
  }
}
