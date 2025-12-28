import type { ReactNode } from "react";

import ArtistSettingsSidebar from "@/components/settings/ArtistSettingsSidebar";

export default function ArtistSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-tekkin-bg px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full lg:w-64">
          <div className="sticky top-6">
            <ArtistSettingsSidebar />
          </div>
        </div>

        <div className="flex-1 space-y-6">{children}</div>
      </div>
    </div>
  );
}
