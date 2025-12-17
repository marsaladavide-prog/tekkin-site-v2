"use client";

import { ReactNode } from "react";

type TekkinShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * TekkinShell
 * Layout wrapper pulito per le pagine dell'area artist.
 * Si occupa solo di spaziatura, centratura e coerenza estetica.
 */
export default function TekkinShell({ children, className = "" }: TekkinShellProps) {
  return (
    <div className={`w-full min-h-[calc(100vh-80px)] px-4 md:px-6 ${className}`}>
      <div className="max-w-5xl mx-auto py-8">
        {children}
      </div>
    </div>
  );
}
