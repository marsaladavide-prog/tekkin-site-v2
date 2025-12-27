"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function NotificationsBell() {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    let cleanupChannel: (() => void) | null = null;
    let cleanupAuth: (() => void) | null = null;

    const fetchCount = async () => {
      const res = await fetch("/api/notifications/unread-count", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) return; // se 401 non sporcare, riproviamo dopo auth
      const data = await res.json().catch(() => null);
      if (!alive) return;

      setUnread(typeof data?.unread === "number" ? data.unread : 0);
    };

    const startForUser = async (uid: string) => {
      await fetchCount();

      const channel = supabase
        .channel("tekkin-notifications-bell")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${uid}` },
          () => void fetchCount()
        )
        .subscribe();

      cleanupChannel = () => {
        supabase.removeChannel(channel);
      };
    };

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;

      if (uid) {
        await startForUser(uid);
        return;
      }

      // se non c’è user subito (hydration/session), ascolta auth change
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const nextUid = session?.user?.id ?? null;
        if (!nextUid) return;

        if (cleanupChannel) cleanupChannel();
        void startForUser(nextUid);
      });

      cleanupAuth = () => {
        sub.subscription.unsubscribe();
      };
    };

    void boot();

    return () => {
      alive = false;
      if (cleanupChannel) cleanupChannel();
      if (cleanupAuth) cleanupAuth();
    };
  }, [supabase]);

  const hasUnread = unread > 0;

return (
  <span className="relative inline-flex items-center">
    <Bell className={hasUnread ? "h-4 w-4 text-red-400" : "h-4 w-4 text-white/40"} />
    {hasUnread && (
      <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.35)]">
        {unread > 99 ? "99+" : unread}
      </span>
    )}
  </span>
);

}
