import { BookOpen, Clapperboard, Headphones, MapPin, Music, Tv, UtensilsCrossed } from "lucide-react";
import type { DomainKey } from "@/lib/types";

export const DOMAIN_META: Record<DomainKey, { label: string; Icon: typeof Music; tint: string; dot: string }> = {
  film: { label: "Film", Icon: Clapperboard, tint: "text-[#c2410c] dark:text-[#fb923c]", dot: "bg-[#ea580c]" },
  tv: { label: "TV", Icon: Tv, tint: "text-[#a16207] dark:text-[#facc15]", dot: "bg-[#ca8a04]" },
  music: { label: "Music", Icon: Music, tint: "text-[#7c3aed] dark:text-[#a78bfa]", dot: "bg-[#7c3aed]" },
  dining: { label: "Dining", Icon: UtensilsCrossed, tint: "text-[#be123c] dark:text-[#fb7185]", dot: "bg-[#e11d48]" },
  books: { label: "Books", Icon: BookOpen, tint: "text-[#0f766e] dark:text-[#2dd4bf]", dot: "bg-[#0d9488]" },
  travel: { label: "Places", Icon: MapPin, tint: "text-[#0369a1] dark:text-[#38bdf8]", dot: "bg-[#0284c7]" },
  podcasts: { label: "Podcasts", Icon: Headphones, tint: "text-[#4d7c0f] dark:text-[#a3e635]", dot: "bg-[#65a30d]" },
};

export function DomainIcon({ domain, className = "size-3.5" }: { domain: DomainKey; className?: string }) {
  const { Icon, tint } = DOMAIN_META[domain];
  return <Icon className={`${className} ${tint}`} aria-hidden="true" />;
}

export function EvidenceChip({ domain, name, compact = false }: { domain: DomainKey; name: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 ${compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]"} text-ink`}
      title={`${DOMAIN_META[domain].label}: ${name}`}
    >
      <DomainIcon domain={domain} className="size-3.5 shrink-0" />
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
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ["#f0441f", "#6343f0", "#178a5c", "#a86400", "#0369a1", "#be123c", "#0f766e"];
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg font-semibold text-white ${className}`} style={{ background: hues[h % hues.length] }} aria-hidden="true">
      {letters || "?"}
    </span>
  );
}

export function EntityImage({ src, name, className = "size-10" }: { src?: string; name: string; className?: string }) {
  if (!src) return <Initials name={name} className={`${className} text-sm`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-cover`} loading="lazy" referrerPolicy="no-referrer" />;
}
