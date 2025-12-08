"use client";
import { InputHTMLAttributes } from "react";

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
  helper?: string;
  inline?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;

export default function DateInput({
  value,
  onChange,
  className = "",
  label,
  helper,
  inline,
  ...inputProps
}: DateInputProps) {
  return (
    <label
      className={[
        inline ? "flex items-center gap-1 text-[10px]" : "flex flex-col gap-1 text-[10px]",
        "text-[var(--text-muted)]",
      ].join(" ")}
    >
      {!inline && label && (
        <span className="text-[10px] font-medium text-[var(--text-muted)]">{label}</span>
      )}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`rounded-full bg-black/60 px-3 py-1 text-[10px] outline-none transition hover:bg-white/5 ${className}`}
        {...inputProps}
      />
      {!inline && helper && (
        <span className="text-[8px] text-[var(--text-muted)]">{helper}</span>
      )}
    </label>
  );
}
