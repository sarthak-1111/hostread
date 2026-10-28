// One-click example shows on the landing page (live mode). Names only: the run
// resolves each one through Qloo search, so no Qloo IDs live in the repo.
export interface ExampleShow {
  name: string;
  genre: string;
  id?: string;
}

/** Brand-side examples, also resolved by name through Qloo search. */
export const BRAND_EXAMPLES: ExampleShow[] = [
  { name: "Allbirds", genre: "Footwear" },
  { name: "Liquid Death", genre: "Beverage" },
  { name: "Duolingo", genre: "App" },
  { name: "Glossier", genre: "Beauty" },
  { name: "Patagonia", genre: "Outdoor" },
];

export const LIVE_EXAMPLES: ExampleShow[] = [
  { name: "Crime Junkie", genre: "True crime" },
  { name: "SmartLess", genre: "Comedy" },
  { name: "How I Built This", genre: "Business" },
  { name: "Huberman Lab", genre: "Health" },
  { name: "Darknet Diaries", genre: "Tech" },
];
