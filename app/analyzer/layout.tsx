import type { ReactNode } from "react";
import SidebarLayout from "@/components/layouts/SidebarLayout";

export default function AnalyzerLayout({ children }: { children: ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
