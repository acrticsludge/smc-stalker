/**
 * Type definitions for the Dynmap markers.json API response.
 */

/** RGBA color used in dynmap shapes */
export interface DynmapColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A 2D vertex in Minecraft's XZ plane */
export interface DynmapVertex {
  x: number;
  z: number;
}

/** A marker position in 3D space */
export interface DynmapPosition {
  x: number;
  y: number;
  z: number;
}

/** Individual marker entry in a dynmap layer */
export interface DynmapMarker {
  type: 'shape';
  shape: DynmapVertex[];
  holes: DynmapVertex[][];
  shapeY: number;
  depthTest: boolean;
  lineWidth: number;
  lineColor: DynmapColor;
  fillColor: DynmapColor;
  detail: string; // HTML content
  newTab: boolean;
  minDistance: number;
  maxDistance: number;
  label: string;
  position: DynmapPosition;
  sorting: number;
  listed: boolean;
}

/** A named layer/set of markers */
export interface DynmapMarkerSet {
  label: string;
  toggleable: boolean;
  defaultHidden: boolean;
  sorting: number;
  markers: Record<string, DynmapMarker>;
}

/** Top-level dynmap markers.json response */
export interface DynmapResponse {
  chunky: DynmapMarkerSet;
  outskirts: DynmapMarkerSet;
  townybluemap_claims: DynmapMarkerSet;
}

/**
 * Town data parsed from the HTML `detail` field of a dynmap marker.
 */
export interface ParsedTownData {
  name: string;
  mayor: string;
  residents: number;
  residentNames: string[];
  nation: string | null;
  status: string | null;
  founded: string | null; // YYYY-MM-DD or null if unparseable
  bank: number;
  upkeep: number;
}

/** Result of a dynmap poll cycle */
export interface DynmapPollResult {
  towns: ParsedTownData[];
  shapes: TownShapeData[];
  pollDurationMs: number;
  success: boolean;
  error: string | null;
}

/** Shape data associated with a town */
export interface TownShapeData {
  townName: string;
  regionIndex: number;
  markerKey: string;
  shape: DynmapVertex[];
  holes: DynmapVertex[][];
  shapeY: number;
}
