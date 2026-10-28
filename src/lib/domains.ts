import type { DomainInfo, DomainKey } from "./types";

export const DOMAINS: Record<DomainKey, DomainInfo> = {
  film: { key: "film", label: "Film", qlooType: "urn:entity:movie", noun: "film" },
  tv: { key: "tv", label: "TV", qlooType: "urn:entity:tv_show", noun: "show" },
  music: { key: "music", label: "Music", qlooType: "urn:entity:artist", noun: "artist" },
  dining: { key: "dining", label: "Food & drink", qlooType: "urn:entity:brand", noun: "food or drink brand" },
  books: { key: "books", label: "Books", qlooType: "urn:entity:book", noun: "book" },
  travel: { key: "travel", label: "Places", qlooType: "urn:entity:destination", noun: "destination" },
  podcasts: { key: "podcasts", label: "Podcasts", qlooType: "urn:entity:podcast", noun: "podcast" },
};

/** Domains shown in the audience snapshot / media kit. */
export const PROFILE_DOMAINS: DomainKey[] = ["film", "tv", "music", "dining", "books", "travel", "podcasts"];

/** Domains compared between listeners and brand fans for the overlap score. */
export const OVERLAP_DOMAINS: DomainKey[] = ["film", "tv", "music", "books", "dining"];

export function isDomainKey(v: unknown): v is DomainKey {
  return typeof v === "string" && v in DOMAINS;
}
