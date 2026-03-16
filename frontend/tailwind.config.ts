import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        muted: "var(--muted)",
        surface: "var(--surface)",
        panel: "var(--panel)",
        line: "var(--line)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.12)",
        glow: "0 0 0 1px rgba(96, 165, 250, 0.18), 0 20px 45px rgba(37, 99, 235, 0.12)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
