"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, CreditCard, SunMoon, User } from "lucide-react";

const items = [
  {
    label: "Profilo",
    description: "Avatar, bio e link pubblici",
    href: "/artist/settings/profile",
    icon: User,
  },
  {
    label: "Account",
    description: "Email Tekkin e piano attivo",
    href: "/artist/settings/account",
    icon: CreditCard,
  },
  {
    label: "Preferences",
    description: "Tema, lingua, notifiche",
    href: "/artist/settings/preferences",
    icon: SunMoon,
  },
  {
    label: "Notifications",
    description: "Email e messaggi in-app",
    href: "/artist/settings/notifications",
    icon: BellRing,
  },
];

export default function ArtistSettingsSidebar() {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">
        Settings
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-start gap-3 rounded-2xl border px-4 py-3 transition",
                active
                  ? "border-cyan-400/60 bg-white/10 shadow-[0_0_20px_rgba(6,182,212,0.25)]"
                  : "border-white/5 bg-black/40 hover:border-white/20 hover:bg-white/5",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon className="h-5 w-5 text-cyan-300" aria-hidden />
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-white">{item.label}</span>
                <span className="text-[11px] text-white/60">{item.description}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
