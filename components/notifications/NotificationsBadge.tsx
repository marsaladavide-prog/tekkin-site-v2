"use client";

import { useEffect, useState } from "react";

export default function UnreadBadge() {
  const [n, setN] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!alive) return;
      const v = typeof data?.unread === "number" ? data.unread : 0;
      setN(v);
    };
    void load();
    const t = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  if (!n) return null;

  return (
    <span className="ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-black">
      {n > 99 ? "99+" : n}
    </span>
  );
}
