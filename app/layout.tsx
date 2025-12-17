import { Inter } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/SupabaseProvider";
import { TekkinFloatingPlayer } from "@/components/player/TekkinFloatingPlayer";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "TEKKIN",
  description: "Tekkin Core - Minimal / Tech House Platform",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--bg)] text-[var(--text)]`}>
        <SupabaseProvider>
          {children}
          <TekkinFloatingPlayer />
          <Toaster richColors position="bottom-right" />
        </SupabaseProvider>
      </body>
    </html>
  );
}
