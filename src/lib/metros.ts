// Large US metro areas with approximate centre coordinates. Qloo's heatmap
// returns geohash cells (coordinates and affinity, no place names), so the
// geography step groups cells under the nearest metro to name the areas where
// an audience over-indexes.
import type { GeoPoint } from "./types";

const METROS: [name: string, lat: number, lon: number][] = [
  ["New York", 40.71, -74.01],
  ["Los Angeles", 34.05, -118.24],
  ["Chicago", 41.88, -87.63],
  ["Dallas", 32.78, -96.8],
  ["Houston", 29.76, -95.37],
  ["Washington, DC", 38.91, -77.04],
  ["Philadelphia", 39.95, -75.17],
  ["Miami", 25.76, -80.19],
  ["Atlanta", 33.75, -84.39],
  ["Boston", 42.36, -71.06],
  ["Phoenix", 33.45, -112.07],
  ["San Francisco", 37.77, -122.42],
  ["Riverside", 33.95, -117.4],
  ["Detroit", 42.33, -83.05],
  ["Seattle", 47.61, -122.33],
  ["Minneapolis", 44.98, -93.27],
  ["San Diego", 32.72, -117.16],
  ["Tampa", 27.95, -82.46],
  ["Denver", 39.74, -104.99],
  ["Baltimore", 39.29, -76.61],
  ["St. Louis", 38.63, -90.2],
  ["Orlando", 28.54, -81.38],
  ["Charlotte", 35.23, -80.84],
  ["San Antonio", 29.42, -98.49],
  ["Portland, OR", 45.52, -122.68],
  ["Sacramento", 38.58, -121.49],
  ["Pittsburgh", 40.44, -80.0],
  ["Austin", 30.27, -97.74],
  ["Las Vegas", 36.17, -115.14],
  ["Cincinnati", 39.1, -84.51],
  ["Kansas City", 39.1, -94.58],
  ["Columbus", 39.96, -83.0],
  ["Indianapolis", 39.77, -86.16],
  ["Cleveland", 41.5, -81.69],
  ["San Jose", 37.34, -121.89],
  ["Nashville", 36.16, -86.78],
  ["Virginia Beach", 36.85, -75.98],
  ["Providence", 41.82, -71.41],
  ["Jacksonville", 30.33, -81.66],
  ["Milwaukee", 43.04, -87.91],
  ["Raleigh", 35.78, -78.64],
  ["Oklahoma City", 35.47, -97.52],
  ["Memphis", 35.15, -90.05],
  ["Richmond", 37.54, -77.44],
  ["Louisville", 38.25, -85.76],
  ["New Orleans", 29.95, -90.07],
  ["Salt Lake City", 40.76, -111.89],
  ["Hartford", 41.76, -72.67],
  ["Buffalo", 42.89, -78.88],
  ["Birmingham", 33.52, -86.8],
  ["Rochester", 43.16, -77.61],
  ["Grand Rapids", 42.96, -85.67],
  ["Tucson", 32.22, -110.97],
  ["Honolulu", 21.31, -157.86],
  ["Tulsa", 36.15, -95.99],
  ["Fresno", 36.74, -119.79],
  ["Omaha", 41.26, -95.93],
  ["Albuquerque", 35.08, -106.65],
  ["Knoxville", 35.96, -83.92],
  ["Boise", 43.62, -116.2],
  ["Des Moines", 41.59, -93.62],
  ["Madison", 43.07, -89.4],
  ["Charleston, SC", 32.78, -79.93],
  ["Anchorage", 61.22, -149.9],
];

/** Cells farther than this from every metro are left out. */
const MAX_KM = 80;
/** A metro needs at least this many cells so one stray cell can't top the list. */
const MIN_CELLS = 2;

function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export interface HeatCell {
  lat: number;
  lon: number;
  affinity: number;
}

/** Mean cell affinity per nearest metro, highest first. */
export function metrosFromCells(cells: HeatCell[], take = 8): GeoPoint[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const c of cells) {
    let best: string | undefined;
    let bestKm = MAX_KM;
    for (const [name, lat, lon] of METROS) {
      const d = km(c.lat, c.lon, lat, lon);
      if (d <= bestKm) {
        best = name;
        bestKm = d;
      }
    }
    if (!best) continue;
    const a = acc.get(best) ?? { sum: 0, n: 0 };
    a.sum += c.affinity;
    a.n += 1;
    acc.set(best, a);
  }
  return [...acc.entries()]
    .filter(([, a]) => a.n >= MIN_CELLS)
    .map(([name, a]) => ({ name, affinity: Math.round((a.sum / a.n) * 1000) / 1000 }))
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, take);
}
