"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Splash from "@/components/core/Splash";

export default function HomePage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    router.prefetch("/artist/projects");
  }, [router]);

  const handleDone = useCallback(() => {
    setShowSplash(false);
    router.replace("/artist/projects");
  }, [router]);

  if (showSplash) return <Splash onDone={handleDone} />;

  return null;
}
