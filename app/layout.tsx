import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: 'SOMA Dashboard',
  description: 'Panel intero para equipo SOMA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`dark ${inter.variable}`}>
      <body className="relative bg-ink text-text antialiased min-h-screen">
        {/* Blobs ambientales, fijos y sin animación: le dan al glassmorphism de la
            sidebar algo real que difuminar, sin costo de repintado por frame. */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-brand2/70 to-brand/50 blur-[80px]" />
          <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-brand/50 blur-[80px]" />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
