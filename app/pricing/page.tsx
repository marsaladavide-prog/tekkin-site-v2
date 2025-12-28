import { Suspense } from "react";
import PricingClient from "./PricingClient";

function PricingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="h-10 w-64 rounded bg-white/5" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="h-56 rounded bg-white/5" />
        <div className="h-56 rounded bg-white/5" />
        <div className="h-56 rounded bg-white/5" />
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingSkeleton />}>
      <PricingClient />
    </Suspense>
  );
}
