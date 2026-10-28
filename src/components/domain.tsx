import { BookOpen, Clapperboard, Headphones, MapPin, Music, Tv, UtensilsCrossed } from "lucide-react";
import type { DomainKey } from "@/lib/types";

// Domains are told apart by icon shape and label, not colour: the palette keeps
// terracotta as its only chromatic accent.
export const DOMAIN_META: Record<DomainKey, { label: string; Icon: typeof Music }> = {
  film: { label: "Film", Icon: Clapperboard },
  tv: { label: "TV", Icon: Tv },
  music: { label: "Music", Icon: Music },
  dining: { label: "Dining", Icon: UtensilsCrossed },
  books: { label: "Books", Icon: BookOpen },
  travel: { label: "Places", Icon: MapPin },
  podcasts: { label: "Podcasts", Icon: Headphones },
};

export function DomainIcon({ domain, className = "size-3.5" }: { domain: DomainKey; className?: string }) {
  const { Icon } = DOMAIN_META[domain];
  return <Icon className={`${className} text-muted`} strokeWidth={1.75} aria-hidden="true" />;
}

export function EvidenceChip({ domain, name, compact = false }: { domain: DomainKey; name: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full bg-bg text-fg shadow-[0_0_0_1px_var(--border-soft)] ${compact ? "px-2.5 py-0.5 text-label" : "px-3 py-1 text-[13px]"}`}
      title={`${DOMAIN_META[domain].label}: ${name}`}
    >
      <DomainIcon domain={domain} className="size-3.5 shrink-0" />
      <span className="sr-only">{DOMAIN_META[domain].label}: </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function Initials({ name, className = "size-10 text-sm" }: { name: string; className?: string }) {
  const letters = name
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`grid shrink-0 place-items-center rounded-sm bg-surface-warm font-display text-fg-2 ${className}`} aria-hidden="true">
      {letters || "?"}
    </span>
  );
}

export function EntityImage({ src, name, className = "size-10" }: { src?: string; name: string; className?: string }) {
  if (!src) return <Initials name={name} className={`${className} text-sm`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={64} height={64} className={`${className} shrink-0 rounded-sm object-cover`} loading="lazy" referrerPolicy="no-referrer" />;
}
