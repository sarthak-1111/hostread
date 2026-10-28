// Brand-safety categories a show can exclude. Matching uses Qloo tags /
// category names and the brand name, so it works on live data without a
// hard-coded tag list. Over-matching is preferred to under-matching here.
import type { BrandEntity, SafetyCategory } from "./types";

export const SAFETY_CATEGORIES: { key: SafetyCategory; label: string; hint: string }[] = [
  { key: "alcohol", label: "Alcohol", hint: "Beer, wine, spirits" },
  { key: "gambling", label: "Gambling", hint: "Sportsbooks, casinos, lotteries" },
  { key: "tobacco", label: "Tobacco & vaping", hint: "Cigarettes, cigars, vapes" },
  { key: "cannabis", label: "Cannabis & CBD", hint: "Dispensaries, CBD, THC" },
  { key: "crypto", label: "Crypto", hint: "Exchanges, tokens, NFTs" },
  { key: "firearms", label: "Firearms", hint: "Guns, ammunition" },
  { key: "adult", label: "Adult", hint: "Adult content and services" },
];

const PATTERNS: Record<SafetyCategory, RegExp> = {
  alcohol:
    /\b(beer|brew(ing|ery|ers)?|ale|ipa|lager|stout|wine|winery|vineyard|champagne|prosecco|spirits?|liquor|vodka|whisk(e)?y|bourbon|scotch|rum|gin|tequila|mezcal|cognac|brandy|hard seltzer|cider|sake|alcohol(ic)?|distill(ery|ers)?|budweiser|heineken|corona extra|coors|miller lite|jack daniel|johnnie walker|smirnoff|bacardi|white claw|truly|jameson|hennessy|patr[oó]n)\b/i,
  gambling: /\b(casino|sportsbook|sports betting|betting|bet(s)?|wager|poker|slots?|lottery|lotto|gambling|draftkings|fanduel|betmgm|caesars sportsbook|parlay|bingo)\b/i,
  tobacco: /\b(tobacco|cigar(ette)?s?|vap(e|es|ing|or)|e-?cig|nicotine|juul|marlboro|zyn|snus|hookah)\b/i,
  cannabis: /\b(cannabis|marijuana|cbd|thc|dispensary|hemp|weed|edibles)\b/i,
  crypto: /\b(crypto(currency)?|bitcoin|ethereum|blockchain|nft|coinbase|binance|kraken|crypto\.com|token|coin exchange|web3)\b/i,
  firearms: /\b(firearms?|guns?|rifles?|pistols?|ammunition|ammo|smith ?& ?wesson|glock|remington|sig sauer)\b/i,
  adult: /\b(adult (toys|content|entertainment)|sex toys?|lingerie club|onlyfans|strip club|erotic)\b/i,
};

export function brandSafetyCategories(brand: BrandEntity, knownCategory?: SafetyCategory): SafetyCategory[] {
  const hay = [brand.name, brand.category ?? "", ...(brand.tags ?? []).map((t) => t.name)].join(" | ");
  const out = new Set<SafetyCategory>();
  if (knownCategory) out.add(knownCategory);
  for (const [cat, re] of Object.entries(PATTERNS) as [SafetyCategory, RegExp][]) {
    if (re.test(hay)) out.add(cat);
  }
  return [...out];
}

export function parseExclusions(raw: string | null | undefined): SafetyCategory[] {
  if (!raw) return [];
  const valid = new Set(SAFETY_CATEGORIES.map((c) => c.key));
  return [...new Set(raw.split(",").map((s) => s.trim().toLowerCase()))].filter((s): s is SafetyCategory => valid.has(s as SafetyCategory)).sort();
}
