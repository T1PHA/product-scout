import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Product Scout",
  description: "Analyse de viabilité produit : e-commerce et achat-revente",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-line bg-card/80 backdrop-blur sticky top-0 z-20">
          <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3 sm:gap-6 text-sm">
            <Link href="/" className="font-semibold tracking-tight text-base flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              Product Scout
            </Link>
            <div className="flex gap-0.5 sm:gap-1 ml-auto whitespace-nowrap">
              <Link href="/" className="px-2 sm:px-3 py-1.5 rounded-md hover:bg-paper"><span className="hidden sm:inline">Nouvelle analyse</span><span className="sm:hidden">Analyser</span></Link>
              <Link href="/comparer" className="px-2 sm:px-3 py-1.5 rounded-md hover:bg-paper">Comparer</Link>
              <Link href="/reglages" className="px-2 sm:px-3 py-1.5 rounded-md hover:bg-paper">Réglages</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
