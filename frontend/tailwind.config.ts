import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          main: "#0f0f0f",
          sidebar: "#151515",
          card: "#1b1b1b",
          hover: "#242424",
          active: "#2a2a2a",
          border: "#2a2a2a",
          text: "#f1f1f1",
          muted: "#7d7d7d",
          accent: "#8b8bff"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
