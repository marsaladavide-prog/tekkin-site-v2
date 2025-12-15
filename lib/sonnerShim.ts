import type { ReactNode } from "react";

type ToastId = string;

export type ToastOptions = {
  id?: ToastId;
};

const formatLog = (level: "loading" | "success" | "error", message: string, id?: ToastId) => {
  const suffix = id ? ` (id=${id})` : "";
  if (level === "error") {
    console.error(`[toast] ${level}: ${message}${suffix}`);
  } else {
    console.info(`[toast] ${level}: ${message}${suffix}`);
  }
};

let toastCounter = 0;

export const toast = {
  loading(message: string) {
    const id = `toast-${Date.now()}-${toastCounter++}`;
    formatLog("loading", message, id);
    return id;
  },
  success(message: string, options?: ToastOptions) {
    formatLog("success", message, options?.id);
  },
  error(message: string, options?: ToastOptions) {
    formatLog("error", message, options?.id);
  },
};

export type ToasterProps = {
  richColors?: boolean;
  position?: string;
  children?: ReactNode;
};

export function Toaster(_props: ToasterProps) {
  return null;
}
