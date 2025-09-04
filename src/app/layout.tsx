import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Comfortaa } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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
  title: "Nexus Agile — Kanban, Poker e Sprints",
  description: "Planejamento de trabalho em equipe com Kanban, Planning Poker e Sprints.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${comfortaa.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="w-full border-b border-black/10 dark:border-white/10">
            <nav className="mx-auto max-w-5xl flex items-center justify-between p-4 text-sm">
              <a href="/" className="font-semibold">Nexus Agile</a>
              <div className="flex gap-4">
                <a href="/projects" className="hover:underline">Projetos</a>
                <a href="/board" className="hover:underline">Kanban</a>
                <a href="/poker" className="hover:underline">Planning Poker</a>
                <a href="/sprints" className="hover:underline">Sprints</a>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
