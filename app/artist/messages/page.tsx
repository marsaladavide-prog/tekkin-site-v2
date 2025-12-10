import { Suspense } from "react";
import { notFound } from "next/navigation";
import TekkinShell from "@/app/artist/components/TekkinShell";
import { MessagesPanel } from "./components/MessagesPanel";

type MessagesPageProps = {
  searchParams: {
    with?: string;
  };
};

export default function MessagesPage({ searchParams }: MessagesPageProps) {
  const otherId = searchParams.with;

  if (!otherId) {
    // per ora niente inbox globale, solo chat 1-to-1 da "Send Message"
    notFound();
  }

  return (
    <TekkinShell>
      <div className="max-w-4xl mx-auto mt-10 px-4">
        <Suspense fallback={<div className="text-tekkin-muted">Loading chat...</div>}>
          <MessagesPanel otherUserId={otherId} />
        </Suspense>
      </div>
    </TekkinShell>
  );
}
