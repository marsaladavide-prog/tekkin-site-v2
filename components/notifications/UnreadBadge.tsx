"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UnreadBadge() {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    let alive = true;

    const boot = async () => {
      // initial
      const res = await fetch("/api/notifications/unread-count", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (alive) setUnread(typeof data?.unread === "number" ? data.unread : 0);

      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;

      const channel = supabase
        .channel("tekkin-unread-badge")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${uid}` },
          async () => {
            const r = await fetch("/api/notifications/unread-count", { credentials: "include", cache: "no-store" });
            const d = await r.json().catch(() => null);
            if (!alive) return;
            setUnread(typeof d?.unread === "number" ? d.unread : 0);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = boot();

    return () => {
      alive = false;
      void cleanupPromise;
    };
  }, [supabase]);

  if (!unread) return null;

  return (
    <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.35)] ring-1 ring-red-400/30">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
