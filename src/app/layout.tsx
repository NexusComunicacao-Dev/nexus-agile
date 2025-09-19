import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Geist, Geist_Mono } from "next/font/google";
import { Comfortaa } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import NavClient from "./nav-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nexus Agile — Gerenciamento de Tarefas",
  description: "Planejamento de trabalho em equipe da Nexus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Paleta global aplicada em TODA a aplicação */}
        <style>{`
          :root {
            /* Core brand */
            --brand-primary: #FF7C1A;
            --brand-primary-rgb: 255,124,26;
            --brand-primary-hover: #f06f0e;
            --brand-secondary: #888888;
            --brand-secondary-rgb: 136,136,136;

            /* Base (claro) */
            --background: #ffffff;
            --foreground: #1d1f22;
            --muted: #f5f6f7;
            --muted-foreground: #888888;

            /* Semantic map para util classes existentes */
            --primary: var(--brand-primary);
            --primary-foreground: #ffffff;
            --secondary: var(--brand-secondary);
            --secondary-foreground: #ffffff;
            --accent: var(--brand-primary);
            --accent-foreground: #ffffff;
            --destructive: #dc2626;
            --destructive-foreground: #ffffff;

            --border: #f1e2d8;
            --input: #e9ded6;
            --ring: var(--brand-primary);
            --radius: 0.5rem;

            --popover: #ffffff;
            --popover-foreground: #222;
            --card: #ffffff;
            --card-foreground: #1d1f22;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --background: #0f1113;
              --foreground: #f5f6f7;
              --muted: #1b1f23;
              --muted-foreground: #a7a7a7;

              --border: #262a2f;
              --input: #2a2f35;
              --popover: #161a1d;
              --popover-foreground: #f5f6f7;
              --card: #161a1d;
              --card-foreground: #f5f6f7;

              --destructive: #ef4444;
              --destructive-foreground: #fff;
            }
          }

          /* Scrollbar estilizado (webkit) */
          * {
            scrollbar-width: thin;
            scrollbar-color: var(--brand-primary) var(--muted);
          }
          *::-webkit-scrollbar { width: 10px; height:10px; }
          *::-webkit-scrollbar-track { background: var(--muted); }
          *::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg,var(--brand-primary),#ff9d59);
            border-radius: 20px;
            border: 2px solid var(--muted);
          }
          *::-webkit-scrollbar-thumb:hover {
            background: var(--brand-primary-hover);
          }

            ::selection {
              background: rgba(var(--brand-primary-rgb),0.18);
              color: var(--foreground);
            }

          /* Utilitários globais */
          .btn-primary {
            background: var(--brand-primary);
            color:#fff;
            border:1px solid rgba(var(--brand-primary-rgb),0.2);
            border-radius: 0.5rem;
            padding: 0.5rem 0.9rem;
            font-weight: 600;
            font-size: 0.8125rem;
            line-height: 1;
            display:inline-flex;
            align-items:center;
            gap:.5ch;
            transition: background .18s, box-shadow .18s, transform .18s;
            box-shadow: 0 2px 6px -1px rgba(var(--brand-primary-rgb),0.45);
          }
          .btn-primary:hover:not(:disabled) {
            background: var(--brand-primary-hover);
          }
          .btn-primary:active:not(:disabled) {
            transform: translateY(1px);
          }
          .btn-primary:disabled {
            opacity:.55;
            cursor:not-allowed;
          }

          .badge-brand {
            background: linear-gradient(90deg,#FF7C1A,#ff9d59);
            color:#fff;
            font-size:10px;
            font-weight:600;
            letter-spacing:.5px;
            padding:4px 10px;
            border-radius:999px;
            text-transform:uppercase;
            box-shadow:0 2px 4px rgba(var(--brand-primary-rgb),0.3);
          }

          .card-surface {
            background: var(--card);
            color: var(--card-foreground);
            border:1px solid var(--border);
            border-radius: 0.75rem;
          }

          .ring-focus {
            outline:none;
            box-shadow:0 0 0 2px #fff, 0 0 0 4px var(--brand-primary);
          }

          a.brand-link {
            color: var(--brand-primary);
          }
          a.brand-link:hover {
            text-decoration:underline;
          }

          header.app-header {
            background: var(--background);
            border-bottom:1px solid var(--border);
            position:sticky;
            top:0;
            z-index:40;
            backdrop-filter: blur(8px);
          }
          @media (prefers-color-scheme: dark) {
            header.app-header {
              backdrop-filter: blur(10px);
              background: rgba(15,17,19,0.82);
            }
          }

          /* Helper para transições suaves de tema */
          body, header, main, button, input, textarea, select, a {
            transition: background-color .25s, color .25s, border-color .25s;
          }

          /* Sombras brand em elementos com bg-foreground */
          .shadow-brand {
            box-shadow:0 4px 18px -4px rgba(var(--brand-primary-rgb),0.4);
          }
          .brand-gradient {
            background: linear-gradient(135deg,#FF7C1A,#ff9d59);
          }
        `}</style>
      </head>
      <body className={`${comfortaa.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="app-header w-full">
            <nav className="mx-auto max-w-[80vw] flex items-center justify-between p-4 text-sm">
              <a href="/" className="flex items-center gap-2" aria-label="Início">
                <img
                  src="/nxs_logo.png"
                  alt="Nexus Agile"
                  className="h-10 w-auto object-contain select-none"
                  draggable={false}
                />
              </a>
              <NavClient />
            </nav>
          </header>
          <main className="mx-auto max-w-[80vw] p-6">
            {children}
          </main>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}