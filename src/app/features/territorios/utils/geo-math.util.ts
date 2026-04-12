/**
 * Lightweight geometry utilities (replaces @turf/turf dependency).
 * All coordinates are [lng, lat] (GeoJSON standard).
 */

/** Calculate the area of a GeoJSON Polygon/Feature in square metres (Haversine-based). */
export function geoArea(geojson: any): number {
  let coords: number[][];
  if (geojson.type === 'Feature') {
    coords = geojson.geometry?.coordinates?.[0];
  } else if (geojson.type === 'Polygon') {
    coords = geojson.coordinates?.[0];
  } else {
    return 0;
  }
  if (!coords || coords.length < 4) return 0;
  return Math.abs(ringArea(coords));
}

/** Calculate area of a coordinate ring using the spherical excess method (same algorithm as turf). */
function ringArea(coords: number[][]): number {
  const RAD = Math.PI / 180;
  const RADIUS = 6378137; // WGS84 equatorial radius in metres
  const len = coords.length;
  if (len < 3) return 0;

  let total = 0;
  for (let i = 0; i < len - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % (len - 1)];
    const p3 = coords[(i + 2) % (len - 1)];
    total += (p3[0] - p1[0]) * RAD * Math.sin(p2[1] * RAD);
  }
  return (total * RADIUS * RADIUS) / 2;
}

/** Build a GeoJSON Polygon from a coordinate ring (like turf.polygon). */
export function geoPolygon(coordinates: number[][][]): any {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates,
    },
  };
}

/** Build a GeoJSON Polygon circle approximation from a center point and radius (like turf.circle). */
export function geoCircle(center: [number, number], radiusKm: number, steps = 64): any {
  const coords: number[][] = [];
  const RAD = Math.PI / 180;
  const lat = center[1] * RAD;
  const lng = center[0] * RAD;
  const d = radiusKm / 6371; // angular distance in radians (Earth mean radius)

  for (let i = 0; i <= steps; i++) {
    const bearing = ((2 * Math.PI) / steps) * i;
    const pLat = Math.asin(
      Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(bearing),
    );
    const pLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(pLat),
      );
    coords.push([pLng / RAD, pLat / RAD]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

/** Calculate the centroid [lng, lat] of a GeoJSON Polygon or Feature. */
export function geoCentroid(geojson: any): [number, number] | null {
  let coords: number[][];
  if (geojson.type === 'Feature') {
    coords = geojson.geometry?.coordinates?.[0];
  } else if (geojson.type === 'Polygon') {
    coords = geojson.coordinates?.[0];
  } else {
    return null;
  }
  if (!coords || coords.length < 3) return null;
  let x = 0, y = 0;
  const n = coords.length - 1; // skip closing duplicate
  for (let i = 0; i < n; i++) {
    x += coords[i][0];
    y += coords[i][1];
  }
  return [x / n, y / n];
}

/** Detect self-intersections in a polygon (like turf.kinks). Returns intersection points. */
export function geoKinks(geojson: any): { features: any[] } {
  let coords: number[][];
  if (geojson.type === 'Feature') {
    coords = geojson.geometry?.coordinates?.[0];
  } else if (geojson.type === 'Polygon') {
    coords = geojson.coordinates?.[0];
  } else {
    return { features: [] };
  }
  if (!coords || coords.length < 4) return { features: [] };

  const intersections: any[] = [];
  const n = coords.length - 1; // last coord == first coord

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // skip adjacent closing segment
      const pt = segmentIntersect(coords[i], coords[i + 1], coords[j], coords[j + 1]);
      if (pt) {
        intersections.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: pt },
        });
      }
    }
  }

  return { features: intersections };
}

/** Find intersection point of two line segments, or null if they don't intersect. */
function segmentIntersect(
  a1: number[],
  a2: number[],
  b1: number[],
  b2: number[],
): number[] | null {
  const dax = a2[0] - a1[0];
  const day = a2[1] - a1[1];
  const dbx = b2[0] - b1[0];
  const dby = b2[1] - b1[1];

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t = ((b1[0] - a1[0]) * dby - (b1[1] - a1[1]) * dbx) / denom;
  const u = ((b1[0] - a1[0]) * day - (b1[1] - a1[1]) * dax) / denom;

  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return [a1[0] + t * dax, a1[1] + t * day];
  }
  return null;
}
