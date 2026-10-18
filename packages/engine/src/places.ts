// City boxes for ranking places in one heatmap call (qloo.md, conflict 21). Qloo has no verified
// way to turn a city name into a shape (the locality path is out, conflict 22), so a place not in
// this table is "cannot rank", never guessed.
// TODO(verify): box size. Every city gets the same box around its centre so means compare; how big
// a box should be is still open in qloo.md.

const HALF_LAT = 0.25;
const HALF_LON = 0.3;

/** Centre of each city as [latitude, longitude]. Keys are lower case. */
const centres: Record<string, [number, number]> = {
  lagos: [6.52, 3.38],
  abuja: [9.06, 7.49],
  accra: [5.6, -0.19],
  nairobi: [-1.29, 36.82],
  johannesburg: [-26.2, 28.05],
  'cape town': [-33.92, 18.42],
  cairo: [30.04, 31.24],
  london: [51.51, -0.13],
  manchester: [53.48, -2.24],
  paris: [48.86, 2.35],
  berlin: [52.52, 13.4],
  madrid: [40.42, -3.7],
  amsterdam: [52.37, 4.9],
  'new york': [40.71, -74.01],
  'los angeles': [34.05, -118.24],
  chicago: [41.88, -87.63],
  houston: [29.76, -95.37],
  atlanta: [33.75, -84.39],
  toronto: [43.65, -79.38],
  'mexico city': [19.43, -99.13],
  'são paulo': [-23.55, -46.63],
  mumbai: [19.08, 72.88],
  delhi: [28.61, 77.21],
  seoul: [37.57, 126.98],
  tokyo: [35.68, 139.69],
  sydney: [-33.87, 151.21],
};

export interface CityBox {
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The box for a city name, or null when the table does not have it. */
export function cityBox(name: string): CityBox | null {
  const centre = centres[name.trim().toLowerCase()];
  if (!centre) return null;
  const [lat, lon] = centre;
  return {
    name,
    west: lon - HALF_LON,
    south: lat - HALF_LAT,
    east: lon + HALF_LON,
    north: lat + HALF_LAT,
  };
}

/** One WKT shape for several boxes. Longitude comes first in WKT. */
export function multiPolygon(boxes: CityBox[]): string {
  const ring = ({ west: w, south: s, east: e, north: n }: CityBox) =>
    `((${w} ${s}, ${e} ${s}, ${e} ${n}, ${w} ${n}, ${w} ${s}))`;
  return `MULTIPOLYGON(${boxes.map(ring).join(',')})`;
}

export function inBox(box: CityBox, latitude: number, longitude: number): boolean {
  return (
    longitude >= box.west && longitude <= box.east && latitude >= box.south && latitude <= box.north
  );
}

// A city's region, so "Worth a look" can offer cities near the team's own instead of the whole
// table (spec §5.2: never rank every city and lead with the winner).
const regions: Record<string, string> = {
  lagos: 'west-africa',
  abuja: 'west-africa',
  accra: 'west-africa',
  nairobi: 'east-africa',
  johannesburg: 'southern-africa',
  'cape town': 'southern-africa',
  cairo: 'north-africa',
  london: 'uk',
  manchester: 'uk',
  paris: 'europe',
  berlin: 'europe',
  madrid: 'europe',
  amsterdam: 'europe',
  'new york': 'us',
  'los angeles': 'us',
  chicago: 'us',
  houston: 'us',
  atlanta: 'us',
  toronto: 'canada',
  'mexico city': 'latin-america',
  'são paulo': 'latin-america',
  mumbai: 'south-asia',
  delhi: 'south-asia',
  seoul: 'east-asia',
  tokyo: 'east-asia',
  sydney: 'oceania',
};

const countries: Record<string, string> = {
  lagos: 'Nigeria',
  abuja: 'Nigeria',
  accra: 'Ghana',
  nairobi: 'Kenya',
  johannesburg: 'South Africa',
  'cape town': 'South Africa',
  cairo: 'Egypt',
  london: 'United Kingdom',
  manchester: 'United Kingdom',
  paris: 'France',
  berlin: 'Germany',
  madrid: 'Spain',
  amsterdam: 'Netherlands',
  'new york': 'United States',
  'los angeles': 'United States',
  chicago: 'United States',
  houston: 'United States',
  atlanta: 'United States',
  toronto: 'Canada',
  'mexico city': 'Mexico',
  'são paulo': 'Brazil',
  mumbai: 'India',
  delhi: 'India',
  seoul: 'South Korea',
  tokyo: 'Japan',
  sydney: 'Australia',
};

/** The country a table city is in, or null for a city the table does not have. */
export function cityCountry(name: string): string | null {
  return countries[name.trim().toLowerCase()] ?? null;
}

/**
 * Table cities in the same regions as `names`, not in `names`, in table order. The candidates
 * for "Worth a look", so they never replace the team's cities.
 */
export function citiesNear(names: string[], max: number): string[] {
  const named = new Set(names.map((n) => n.trim().toLowerCase()));
  const wanted = new Set([...named].flatMap((n) => regions[n] ?? []));
  return cityNames()
    .filter((c) => !named.has(c.toLowerCase()) && wanted.has(regions[c.toLowerCase()] ?? ''))
    .slice(0, max);
}

/** Every city in the table, by its display name. */
export function cityNames(): string[] {
  return Object.keys(centres).map((key) =>
    key.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase()),
  );
}
