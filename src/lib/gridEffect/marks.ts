// The cross marks ("+") the grid draws, and the glow region each owner of marks frames, as a tiny
// publish/subscribe store.
//
// Why a store at all: the marks (and their region) belong to SECTIONS (the machine screen's
// wordmark, the hero's cube, …) but they are drawn by the one background canvas, which knows
// nothing about sections. Sections push theirs in here via useGridMarks; GridCanvas reads whatever
// is currently in it.
//
// A mark/region is stored as GRID INDICES, never pixels. That is the whole point of the rewrite: a
// resize changes what `col 6, row 4` is in pixels, but it can never move the mark (or the region's
// edge) off the line the way a tuned pixel offset did (see background-line-animations.md §2, "why
// they drift").

export interface GridMark {
  /** 1-indexed column, 1..NUM_COLUMNS */
  col: number;
  /** 1-indexed row line, 1 = the first line below the header */
  row: number;
  opacity: number;
  /** scales the arm length; 1 = the full 16px arms of cross.svg */
  scale: number;
}

/** The rectangle spanned by an owner's own 4 crosses — see grid-glow.md §3, "Region". */
export interface GridRegionInput {
  /** 1-indexed columns, left <= right */
  left: number;
  right: number;
  /** 1-indexed row lines, top <= bottom */
  top: number;
  bottom: number;
  /** the glow inside this region is scaled by this too, so it fades with the crosses */
  opacity: number;
}

export interface GridRegion extends GridRegionInput {
  ownerId: string;
}

interface OwnerState {
  marks: GridMark[];
  region: GridRegionInput | null;
}

const owners = new Map<string, OwnerState>();
const listeners = new Set<() => void>();
let marksSnapshot: GridMark[] = [];
let regionsSnapshot: GridRegion[] = [];

function rebuild() {
  const nextMarks: GridMark[] = [];
  const nextRegions: GridRegion[] = [];
  for (const [ownerId, state] of owners) {
    nextMarks.push(...state.marks);
    if (state.region) nextRegions.push({ ownerId, ...state.region });
  }
  marksSnapshot = nextMarks;
  regionsSnapshot = nextRegions;
  for (const listener of listeners) listener();
}

export function setMarks(ownerId: string, marks: GridMark[], region: GridRegionInput | null = null) {
  owners.set(ownerId, { marks, region });
  rebuild();
}

export function clearMarks(ownerId: string) {
  if (owners.delete(ownerId)) rebuild();
}

export function getMarks(): readonly GridMark[] {
  return marksSnapshot;
}

export function getRegions(): readonly GridRegion[] {
  return regionsSnapshot;
}

export function subscribeMarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
