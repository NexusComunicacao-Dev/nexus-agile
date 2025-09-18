import type { Metadata } from "next";
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
      <body className={`${comfortaa.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="w-full border-b border-black/10 dark:border-white/10">
            <nav className="mx-auto max-w-[80vw] flex items-center justify-between p-4 text-sm">
              <a href="/" className="font-semibold">Nexus Agile</a>
              <NavClient />
            </nav>
          </header>
          <main className="mx-auto max-w-[80vw] p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}