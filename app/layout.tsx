import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shared Information Bias in LLMs",
  description: "Simulation sandbox for hidden-profile style LLM decision studies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold">
              LLM Bias Lab
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/simulations" className="hover:underline">
                Simulations
              </Link>
              <Link href="/compare" className="hover:underline">
                Compare
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
