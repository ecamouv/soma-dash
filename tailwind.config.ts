import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fondo general (negro profundo tipo Gemini)
        ink: "#0a0a0c",

        // Paneles primarios y tarjetas (Charcoal oscuro)
        panel: "#18181b",

        // Paneles secundarios, hovers e inputs (Charcoal medio)
        panel2: "#27272a",

        // Lineas y bordes sutiles
        line: "#2d2d32",

        // Colores de texto
        text: "#f4f4f5",
        muted: "#9a9aa8",

        // Colores de acento (Inspirado en Red-Eye / SOMA)
        brand: "#e11d48",
        brand2: "#f43f5e",
        // Tercer stop para gradientes de marca (botones, indicadores activos)
        brand3: "#fb7185",
      },
      borderRadius: {
        card: "12px",
      },
      fontFamily: {
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;