import { describe, expect, it } from "vitest";
import { metrosFromCells } from "@/lib/metros";

describe("metrosFromCells", () => {
  it("groups heatmap cells under the nearest metro and ranks by mean affinity", () => {
    const cells = [
      { lat: 39.8, lon: -86.1, affinity: 1 }, // Indianapolis
      { lat: 39.7, lon: -86.3, affinity: 0.98 },
      { lat: 41.9, lon: -87.7, affinity: 0.6 }, // Chicago
      { lat: 41.8, lon: -87.6, affinity: 0.7 },
    ];
    expect(metrosFromCells(cells)).toEqual([
      { name: "Indianapolis", affinity: 0.99 },
      { name: "Chicago", affinity: 0.65 },
    ]);
  });

  it("drops cells far from any metro and metros with a single cell", () => {
    const cells = [
      { lat: 47.0, lon: -101.0, affinity: 1 }, // rural North Dakota
      { lat: 40.71, lon: -74.0, affinity: 0.9 }, // one New York cell
    ];
    expect(metrosFromCells(cells)).toEqual([]);
  });
});
