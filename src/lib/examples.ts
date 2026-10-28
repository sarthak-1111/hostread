// One-click example shows on the landing page (live mode). IDs are filled in
// after API verification so examples skip the search step; without an id the
// agent resolves the name itself.
export interface ExampleShow {
  name: string;
  genre: string;
  id?: string;
}

export const LIVE_EXAMPLES: ExampleShow[] = [
  { name: "How I Built This", genre: "Business" },
  { name: "SmartLess", genre: "Comedy" },
  { name: "Crime Junkie", genre: "True crime" },
  { name: "Huberman Lab", genre: "Health" },
  { name: "The Bill Simmons Podcast", genre: "Sports" },
];
