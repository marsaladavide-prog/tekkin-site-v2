import type { ReactNode } from "react";
import SidebarLayout from "@/components/layouts/SidebarLayout";

export default function SamplePackLayout({ children }: { children: ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
