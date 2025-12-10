"use client";

import Link from "next/link";
import { useProfileMe } from "@/app/artist/hooks/useProfileMe";

type Props = {
  artistId: string;
};

export function EditArtistProfileButton({ artistId }: Props) {
  const { profile, loading } = useProfileMe();

  if (loading || !profile) {
    return null;
  }

  const isMe = profile.id === artistId;
  if (!isMe) {
    return null;
  }

  return (
    <Link
      href="/artist/settings/profile"
      className="rounded-full border border-zinc-700 px-4 py-1 text-sm font-medium hover:bg-white hover:text-black transition-colors"
    >
      Modifica profilo
    </Link>
  );
}
