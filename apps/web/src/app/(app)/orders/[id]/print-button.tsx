"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-primary transition-colors duration-200 hover:bg-accent-hover print:hidden"
    >
      <Printer size={15} aria-hidden /> {label}
    </button>
  );
}
