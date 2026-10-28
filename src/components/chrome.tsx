import Link from "next/link";
import { FlaskConical } from "lucide-react";

export const REPO_URL = "https://github.com/sarthak-1111/hostread";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`} aria-label="HostRead home">
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden="true">
        <rect width="64" height="64" rx="16" className="fill-ink" />
        <circle cx="32" cy="32" r="9" className="fill-accent" />
        <path d="M18 18a20 20 0 0 0 0 28M46 18a20 20 0 0 1 0 28" className="stroke-bg" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">HostRead</span>
    </Link>
  );
}

export function GithubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SiteHeader({ mode }: { mode: "live" | "sample" }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm text-ink-2">
          <Link href="/#how" className="hidden rounded-md px-3 py-1.5 hover:bg-surface hover:text-ink sm:block">
            How it works
          </Link>
          <Link href="/#scoring" className="hidden rounded-md px-3 py-1.5 hover:bg-surface hover:text-ink sm:block">
            How we score
          </Link>
          <ModePill mode={mode} />
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="rounded-md p-2 hover:bg-surface hover:text-ink" aria-label="Source code on GitHub">
            <GithubMark />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function ModePill({ mode }: { mode: "live" | "sample" }) {
  return mode === "live" ? (
    <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2" title="Using the live Qloo taste graph">
      <span className="on-air size-1.5 rounded-full bg-accent" /> Live Qloo data
    </span>
  ) : (
    <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber" title="Synthetic sample fixtures — not real Qloo output">
      <FlaskConical className="size-3.5" /> Sample data
    </span>
  );
}

export function SampleBanner({ mode }: { mode: "live" | "sample" }) {
  if (mode !== "sample") return null;
  return (
    <div role="status" className="border-b border-amber/30 bg-amber-soft text-amber">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-[13px] leading-snug sm:items-center sm:px-6">
        <FlaskConical className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <p>
          <strong className="font-semibold tracking-wide">SAMPLE DATA</strong> — the shows, brands and tastes on this page are synthetic fixtures used for development. They are
          not Qloo API output and say nothing about real audiences.
        </p>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden sm:inline">·</span>
          <span>Taste data by Qloo. Fit scores are relative rankings, not revenue predictions.</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="hover:text-ink" href={REPO_URL} target="_blank" rel="noreferrer">
            Source (MIT)
          </a>
          <a className="hover:text-ink" href="https://qloo.devpost.com" target="_blank" rel="noreferrer">
            Qloo Agentic Hackathon
          </a>
        </div>
      </div>
    </footer>
  );
}
