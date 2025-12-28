"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import ArtistSettingsHeader from "@/components/settings/ArtistSettingsHeader";
import NotificationsBell from "@/components/notifications/NotificationsBell";

export default function ArtistNotificationsSettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  return (
    <section className="space-y-5">
      <ArtistSettingsHeader
        title="Notifications"
        description="Decidi quali alert Tekkin ricevere via email o in-app."
        action={
          <Link
            href="/artist/notifications"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-cyan-400/40 hover:bg-white/10"
          >
            <NotificationsBell />
            Apri inbox
          </Link>
        }
      />

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                Email notifications
              </p>
              <p className="text-sm text-white/60">
                Ricevi alert di Signals e nuovi circuiti direttamente in inbox.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(event) => setEmailNotifications(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              <span className="text-xs text-white/70">
                {emailNotifications ? "Attive" : "Disattive"}
              </span>
            </label>
          </div>
          <p className="mt-3 text-[11px] text-white/50">
            TODO: persistere questa preferenza lato server quando disponibile.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                In-app notifications
              </p>
              <p className="text-sm text-white/60">
                Attiva alert per Signals, scansione track e nuovo ranking.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={inAppNotifications}
                onChange={(event) => setInAppNotifications(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              <span className="text-xs text-white/70">
                {inAppNotifications ? "On" : "Off"}
              </span>
            </label>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-white/50">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            Queste notifiche sono gestite dal browser e Tekkin Push.
          </p>
        </div>
      </div>
    </section>
  );
}
