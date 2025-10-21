import { Space_Grotesk } from "next/font/google";import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "TEKKIN",
  description: "Tekkin Core — Minimal / Tech House Platform",
};

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${inter.className} bg-[#0a0a0a] text-zinc-200`}>
  {children}
</body>
    </html>
  );
}
