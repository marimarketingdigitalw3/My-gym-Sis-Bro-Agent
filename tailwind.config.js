/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        border: v("border"),
        text: v("text"),
        muted: v("muted"),
        primary: v("primary"),
        "primary-strong": v("primary-strong"),
        "on-primary": v("on-primary"),
        secondary: v("secondary"),
        accent: v("accent"),
        success: v("success"),
        warning: v("warning"),
        danger: v("danger"),
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
      },
      borderRadius: { card: "var(--radius-card)" },
      boxShadow: { card: "var(--shadow-card)" },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { "fade-up": "fade-up .25s ease-out both" },
    },
  },
  plugins: [],
};
