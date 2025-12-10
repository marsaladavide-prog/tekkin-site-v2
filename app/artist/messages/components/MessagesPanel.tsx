"use client";

import { useEffect, useState, useRef } from "react";
import type {
  ArtistMessage,
  ArtistMessageThread,
  PeerProfile,
} from "@/types/messages";

type MessagesPanelProps = {
  otherUserId: string;
};

type ThreadResponse = {
  thread: ArtistMessageThread;
  messages: ArtistMessage[];
  peerProfile: PeerProfile | null;
  me: { id: string };
};

export function MessagesPanel({ otherUserId }: MessagesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<ArtistMessageThread | null>(null);
  const [messages, setMessages] = useState<ArtistMessage[]>([]);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadThread() {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/thread?with=${otherUserId}`);
        if (!res.ok) {
          console.error("Error loading thread", await res.text());
          return;
        }
        const data: ThreadResponse = await res.json();
        if (cancelled) return;

        setThread(data.thread);
        setMessages(data.messages);
        setPeer(data.peerProfile);
        setMeId(data.me.id);
      } catch (err) {
        console.error("Error fetching thread", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadThread();

    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!thread || !input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thread_id: thread.id,
          body: input,
        }),
      });

      if (!res.ok) {
        console.error("Error sending message", await res.text());
        setSending(false);
        return;
      }

      const msg: ArtistMessage = await res.json();
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch (err) {
      console.error("Error sending message", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const title =
    peer?.artist_name || "Artist chat";

  if (loading && !thread) {
    return (
      <div className="rounded-2xl border border-tekkin-border bg-tekkin-panel p-6 text-tekkin-muted">
        Caricamento chat...
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="rounded-2xl border border-tekkin-border bg-tekkin-panel p-6 text-tekkin-muted">
        Impossibile caricare la chat.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-tekkin-border bg-tekkin-panel/80 backdrop-blur-sm p-4 md:p-6 flex flex-col h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {peer?.avatar_url ? (
            <img
              src={peer.avatar_url}
              alt={peer.artist_name ?? "Artist"}
              className="w-9 h-9 rounded-full object-cover border border-tekkin-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-full border border-tekkin-border flex items-center justify-center text-xs font-mono text-tekkin-muted">
              {(peer?.artist_name?.charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-[11px] font-mono text-tekkin-muted uppercase tracking-[0.16em]">
              Direct messages
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-xl border border-tekkin-border/60 bg-black/40 px-3 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-xs text-tekkin-muted text-center mt-8">
            Inizia la conversazione con un primo messaggio.
          </div>
        )}

        {messages.map((m) => {
          const isMe = m.sender_id === meId;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
                  isMe
                    ? "bg-tekkin-accent text-black rounded-br-sm"
                    : "bg-zinc-900 text-zinc-100 rounded-bl-sm border border-tekkin-border/60"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <span className="block text-[9px] mt-1 opacity-60 text-right">
                  {new Date(m.created_at).toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="mt-4 flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi un messaggio..."
          className="flex-1 h-16 resize-none rounded-xl border border-tekkin-border bg-black/60 px-3 py-2 text-xs md:text-sm text-tekkin-text placeholder:text-tekkin-muted focus:outline-none focus:border-tekkin-accent"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-tekkin-accent text-black text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tekkin-accent/80 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
