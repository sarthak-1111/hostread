// One-click example shows on the landing page (live mode). Names only: the run
// resolves each one through Qloo search, so no Qloo IDs live in the repo.
export interface ExampleShow {
  name: string;
  genre: string;
  id?: string;
}

export const LIVE_EXAMPLES: ExampleShow[] = [
  { name: "Crime Junkie", genre: "True crime" },
  { name: "SmartLess", genre: "Comedy" },
  { name: "How I Built This", genre: "Business" },
  { name: "Huberman Lab", genre: "Health" },
  { name: "Darknet Diaries", genre: "Tech" },
];
