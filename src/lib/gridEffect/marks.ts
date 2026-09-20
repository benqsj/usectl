// The cross marks ("+") the grid draws, as a tiny publish/subscribe store.
//
// Why a store at all: the marks belong to SECTIONS (the machine screen's wordmark, the hero's cube,
// …) but they are drawn by the one background canvas, which knows nothing about sections. Sections
// push theirs in here via useGridMarks; GridCanvas reads whatever is currently in it.
//
// A mark is stored as GRID INDICES, never pixels. That is the whole point of the rewrite: a
// resize changes what `col 6, row 4` is in pixels, but it can never move the mark off the line
// the way a tuned pixel offset did (see background-line-animations.md §2, "why they drift").

export interface GridMark {
  /** 1-indexed column, 1..NUM_COLUMNS */
  col: number;
  /** 1-indexed row line, 1 = the first line below the header */
  row: number;
  opacity: number;
  /** scales the arm length; 1 = the full 16px arms of cross.svg */
  scale: number;
}

const owners = new Map<string, GridMark[]>();
const listeners = new Set<() => void>();
let snapshot: GridMark[] = [];

function rebuild() {
  const next: GridMark[] = [];
  for (const marks of owners.values()) next.push(...marks);
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setMarks(ownerId: string, marks: GridMark[]) {
  owners.set(ownerId, marks);
  rebuild();
}

export function clearMarks(ownerId: string) {
  if (owners.delete(ownerId)) rebuild();
}

export function getMarks(): readonly GridMark[] {
  return snapshot;
}

export function subscribeMarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
