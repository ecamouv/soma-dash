import type { Config } from "tailwindcss";

// Todos los valores de abajo leen de las CSS custom properties definidas en
// app/globals.css (sistema derivado de design/design-notion.md). No se
// hardcodea ningún color/radio/sombra aquí -- este archivo solo expone esos
// tokens como utilidades de Tailwind.
const withOpacity = (rgbVar: string) => `rgb(var(${rgbVar}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fondo general de página -- antes negro, ahora el "warm canvas" de Notion.
        ink: withOpacity("--color-canvas-soft-rgb"),

        // Paneles primarios y tarjetas -- superficie blanca pura.
        panel: withOpacity("--color-surface-rgb"),

        // Paneles secundarios, hovers e inputs.
        panel2: withOpacity("--color-surface-soft-rgb"),

        // Líneas y bordes sutiles.
        line: withOpacity("--color-hairline-rgb"),

        // Colores de texto.
        text: withOpacity("--color-ink-rgb"),
        muted: withOpacity("--color-ink-muted-rgb"),

        // Colores de acento -- antes rojo/rosa de marca, ahora el azul único
        // estructural del sistema (reservado para CTA / foco / activo).
        brand: withOpacity("--color-primary-rgb"),
        brand2: withOpacity("--color-primary-active-rgb"),
        brand3: withOpacity("--color-primary-soft-rgb"),

        // Tokens directos del sistema, para casos que no calzan en los alias de arriba.
        canvas: withOpacity("--color-canvas-rgb"),
        "canvas-soft": withOpacity("--color-canvas-soft-rgb"),
        surface: withOpacity("--color-surface-rgb"),
        "surface-soft": withOpacity("--color-surface-soft-rgb"),
        "ink-secondary": withOpacity("--color-ink-secondary-rgb"),
        "ink-muted": withOpacity("--color-ink-muted-rgb"),
        "ink-faint": withOpacity("--color-ink-faint-rgb"),
        hairline: withOpacity("--color-hairline-rgb"),
        primary: withOpacity("--color-primary-rgb"),
        "primary-active": withOpacity("--color-primary-active-rgb"),
        "on-primary": "var(--color-on-primary)",
        "accent-sky": "var(--color-accent-sky)",
        "accent-purple": "var(--color-accent-purple)",
        "accent-purple-deep": "var(--color-accent-purple-deep)",
        "accent-pink": "var(--color-accent-pink)",
        "accent-orange": "var(--color-accent-orange)",
        "accent-orange-deep": "var(--color-accent-orange-deep)",
        "accent-teal": "var(--color-accent-teal)",
        "accent-green": "var(--color-accent-green)",
        "accent-brown": "var(--color-accent-brown)",
        "accent-white": "var(--color-accent-white)",
        "accent-bone": "var(--color-accent-bone)",
        "accent-ivory": "var(--color-accent-ivory)",
        "accent-nude": "var(--color-accent-nude)",
        "accent-beige": "var(--color-accent-beige)",
      },
      borderRadius: {
        // Escala completa remapeada a los tokens de design-notion.md --
        // así rounded-lg/xl/2xl existentes en todo el código heredan el
        // radio correcto sin tocar cada archivo.
        sm: "var(--radius-xs)",
        DEFAULT: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-xl)",
        "3xl": "var(--radius-xl)",
        full: "var(--radius-full)",
        card: "var(--radius-lg)",
      },
      boxShadow: {
        // "Barely-there": nunca sombra dura. sm/DEFAULT/md usan la capa 1,
        // lg/xl/2xl usan la capa 2 (modales, popovers).
        sm: "var(--shadow-soft)",
        DEFAULT: "var(--shadow-soft)",
        md: "var(--shadow-soft)",
        lg: "var(--shadow-elevated)",
        xl: "var(--shadow-elevated)",
        "2xl": "var(--shadow-elevated)",
        soft: "var(--shadow-soft)",
        elevated: "var(--shadow-elevated)",
      },
      spacing: {
        xxs: "var(--spacing-xxs)",
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        xxl: "var(--spacing-xxl)",
      },
      fontFamily: {
        display: ["var(--font-family-base)"],
        sans: ["var(--font-family-base)"],
      },
    },
  },
  plugins: [],
};

export default config;
