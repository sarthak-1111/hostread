"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-sm bg-surface px-3 py-1.5 text-[13px] font-medium text-fg shadow-[0_0_0_1px_var(--ring-warm)] transition-shadow duration-150 hover:shadow-[0_0_0_1px_var(--meta)] ${className}`}
    >
      {done ? <Check className="size-3.5 text-success-text" aria-hidden="true" /> : <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
