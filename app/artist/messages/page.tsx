import { Suspense } from "react";
import { notFound } from "next/navigation";
import TekkinShell from "@/components/artist-shell/TekkinShell";
import { MessagesPanel } from "./components/MessagesPanel";

type MessagesPageProps = {
  searchParams?: Promise<{ with?: string }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const sp = (await searchParams) ?? {};
  const withId = sp.with;

  if (!withId) {
    // per ora niente inbox globale, solo chat 1-to-1 da "Send Message"
    notFound();
  }

  return (
    <TekkinShell>
      <div className="max-w-4xl mx-auto mt-10 px-4">
        <Suspense fallback={<div className="text-tekkin-muted">Loading chat...</div>}>
            <MessagesPanel otherUserId={withId} />
          </Suspense>
      </div>
    </TekkinShell>
  );
}
