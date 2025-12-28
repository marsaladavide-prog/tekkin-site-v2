"use client";

import type { ReactNode } from "react";

type ArtistSettingsHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function ArtistSettingsHeader({
  title,
  description,
  action,
}: ArtistSettingsHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">
          Tekkin settings
        </p>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-white/60">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
