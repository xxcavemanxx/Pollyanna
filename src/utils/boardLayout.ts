export interface Coordinate {
  x: number;
  y: number;
  rotation?: number;
}

export type SpaceType = 'broadway' | 'turnout' | 'homePath' | 'home' | 'base';

export interface GameSpace {
  type: SpaceType;
  index: number;
  playerIndex?: number; // Used for home paths, homes, bases, and turnouts if specific
}

// SVG dimensions
export const BOARD_SIZE = 800;
const HALF_SIZE = BOARD_SIZE / 2;

// Bases (Start Areas inside the colored corners outside the diamond - centered directly on top of player portraits!)
export const BASE_POSITIONS: Record<number, Coordinate[]> = {
  0: [ // Green (Bottom-Right) - John Pendleton Portrait
    { x: 704, y: 704 }, { x: 736, y: 704 }, { x: 704, y: 736 }, { x: 736, y: 736 }
  ],
  1: [ // Yellow (Bottom-Left) - Aunt Polly Portrait
    { x: 64, y: 704 }, { x: 96, y: 704 }, { x: 64, y: 736 }, { x: 96, y: 736 }
  ],
  2: [ // Red (Top-Right) - Jimmy Portrait
    { x: 704, y: 64 }, { x: 736, y: 64 }, { x: 704, y: 96 }, { x: 736, y: 96 }
  ],
  3: [ // Blue (Top-Left) - Pollyanna Portrait
    { x: 64, y: 64 }, { x: 96, y: 64 }, { x: 64, y: 96 }, { x: 96, y: 96 }
  ]
};

// Home Entrance points (where you turn into home path)
export const HOME_ENTRANCES: Record<number, number> = {
  0: 45, // Green (Bottom-Center)
  1: 0,  // Yellow (Left-Center)
  2: 30, // Red (Right-Center)
  3: 15  // Blue (Top-Center)
};

// Player Start Spaces on Broadway
export const START_SPACES: Record<number, number> = {
  0: 39,  // Green Start
  1: 54,  // Yellow Start
  2: 24,  // Red Start
  3: 9    // Blue Start
};

// Turnout configurations (swapped branch and merge indices for counter-clockwise traversal):
export interface TurnoutConfig {
  playerIndex: number;
  branchIndex: number;
  mergeIndex: number;
}

export const TURNOUT_CONFIGS: Record<number, TurnoutConfig> = {
  0: { playerIndex: 0, branchIndex: 40, mergeIndex: 35 },   // Green side
  1: { playerIndex: 1, branchIndex: 55, mergeIndex: 50 },   // Yellow side
  2: { playerIndex: 2, branchIndex: 25, mergeIndex: 20 },   // Red side
  3: { playerIndex: 3, branchIndex: 10, mergeIndex: 5 }     // Blue side
};

// Hardcoded Broadway coordinates precisely mapped to board image tile centers.
// 60 spaces arranged in a diamond loop, counter-clockwise from Yellow entrance.
// Index 0 = Yellow entrance (left-center), 15 = Blue (top), 30 = Red (right), 45 = Green (bottom).
export const BROADWAY_COORDS: Coordinate[] = [
  // Side 0: Yellow entrance → Blue entrance (indices 0–14, 15 spaces)
  { x: 15, y: 398, rotation: 0 },     // 0: Yellow entrance
  { x: 30, y: 350, rotation: -45 },    // 1
  { x: 55, y: 326, rotation: -45 },    // 2
  { x: 80, y: 301, rotation: -45 },    // 3
  { x: 105, y: 277, rotation: -45 },   // 4
  { x: 130, y: 252, rotation: -45 },   // 5
  { x: 155, y: 228, rotation: -45 },   // 6
  { x: 180, y: 203, rotation: -45 },   // 7
  { x: 205, y: 179, rotation: -45 },   // 8
  { x: 230, y: 154, rotation: -45 },   // 9
  { x: 255, y: 130, rotation: -45 },   // 10
  { x: 280, y: 105, rotation: -45 },   // 11
  { x: 305, y: 81, rotation: -45 },    // 12
  { x: 330, y: 56, rotation: -45 },    // 13
  { x: 355, y: 32, rotation: -45 },    // 14
  
  // Side 1: Blue entrance → Red entrance (indices 15–29, 15 spaces)
  { x: 403, y: 17, rotation: 90 },     // 15: Blue entrance
  { x: 451, y: 32, rotation: 45 },     // 16
  { x: 476, y: 57, rotation: 45 },     // 17
  { x: 500, y: 82, rotation: 45 },     // 18
  { x: 525, y: 107, rotation: 45 },    // 19
  { x: 549, y: 132, rotation: 45 },    // 20
  { x: 574, y: 157, rotation: 45 },    // 21
  { x: 599, y: 182, rotation: 45 },    // 22
  { x: 623, y: 207, rotation: 45 },    // 23
  { x: 648, y: 232, rotation: 45 },    // 24
  { x: 673, y: 257, rotation: 45 },    // 25
  { x: 697, y: 282, rotation: 45 },    // 26
  { x: 722, y: 307, rotation: 45 },    // 27
  { x: 746, y: 332, rotation: 45 },    // 28
  { x: 771, y: 357, rotation: 45 },    // 29

  // Side 2: Red entrance → Green entrance (indices 30–44, 15 spaces)
  { x: 784, y: 405, rotation: 0 },     // 30: Red entrance
  { x: 773, y: 456, rotation: -45 },   // 31
  { x: 748, y: 481, rotation: -45 },   // 32
  { x: 723, y: 506, rotation: -45 },   // 33
  { x: 698, y: 530, rotation: -45 },   // 34
  { x: 673, y: 555, rotation: -45 },   // 35
  { x: 648, y: 580, rotation: -45 },   // 36
  { x: 623, y: 605, rotation: -45 },   // 37
  { x: 599, y: 629, rotation: -45 },   // 38
  { x: 574, y: 654, rotation: -45 },   // 39
  { x: 549, y: 679, rotation: -45 },   // 40
  { x: 524, y: 704, rotation: -45 },   // 41
  { x: 499, y: 728, rotation: -45 },   // 42
  { x: 474, y: 753, rotation: -45 },   // 43
  { x: 449, y: 778, rotation: -45 },   // 44
  
  // Side 3: Green entrance → Yellow entrance (indices 45–59, 15 spaces)
  { x: 400, y: 787, rotation: 90 },    // 45: Green entrance
  { x: 349, y: 775, rotation: 45 },    // 46
  { x: 324, y: 750, rotation: 45 },    // 47
  { x: 300, y: 725, rotation: 45 },    // 48
  { x: 275, y: 699, rotation: 45 },    // 49
  { x: 250, y: 674, rotation: 45 },    // 50
  { x: 226, y: 649, rotation: 45 },    // 51
  { x: 201, y: 624, rotation: 45 },    // 52
  { x: 176, y: 598, rotation: 45 },    // 53
  { x: 151, y: 573, rotation: 45 },    // 54
  { x: 127, y: 548, rotation: 45 },    // 55
  { x: 102, y: 523, rotation: 45 },    // 56
  { x: 77, y: 497, rotation: 45 },     // 57
  { x: 53, y: 472, rotation: 45 },     // 58
  { x: 28, y: 447, rotation: 45 },     // 59
];

// Generate Turnout path coordinates (rounded U-shape arches bulging INWARDS toward the center)
const TURNOUT_ARCS: Record<number, { start: Coordinate; end: Coordinate; bulge: number }> = {
  0: { start: { x: 496, y: 626 }, end: { x: 621, y: 504 }, bulge: -0.79 }, // Green
  1: { start: { x: 175, y: 494 }, end: { x: 298, y: 620 }, bulge: -0.81 }, // Yellow
  2: { start: { x: 625, y: 305 }, end: { x: 506, y: 181 }, bulge: -0.84 }, // Red
  3: { start: { x: 302, y: 177 }, end: { x: 179, y: 297 }, bulge: -0.83 }  // Blue
};

// Generate Turnout path coordinates using measured circular arcs
export const getTurnoutCoords = (playerIndex: number, extraLength: number = 3): Coordinate[] => {
  const arc = TURNOUT_ARCS[playerIndex];
  if (!arc) return [];
  
  const A = arc.start;
  const B = arc.end;
  const bulge = arc.bulge;
  
  const L = Math.hypot(B.x - A.x, B.y - A.y);
  if (L === 0) return [];
  
  const b_abs = Math.abs(bulge);
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const ux = (B.x - A.x) / L;
  const uy = (B.y - A.y) / L;
  const nx = -uy;
  const ny = ux;
  
  const sign = bulge >= 0 ? 1 : -1;
  const R = L * (1 + b_abs * b_abs) / (4 * b_abs);
  const dC = L * (1 - b_abs * b_abs) / (4 * b_abs);
  
  const cx = M.x - sign * dC * nx;
  const cy = M.y - sign * dC * ny;
  
  const apex = {
    x: M.x + bulge * (L / 2) * nx,
    y: M.y + bulge * (L / 2) * ny
  };
  
  const thetaA = Math.atan2(A.y - cy, A.x - cx);
  const thetaApex = Math.atan2(apex.y - cy, apex.x - cx);
  const thetaB = Math.atan2(B.y - cy, B.x - cx);
  
  let diff1 = thetaApex - thetaA;
  diff1 = Math.atan2(Math.sin(diff1), Math.cos(diff1));
  
  let diff2 = thetaB - thetaApex;
  diff2 = Math.atan2(Math.sin(diff2), Math.cos(diff2));
  
  // Total spaces inside turnout is 4 + extraLength (7 spaces by default when extraLength = 3)
  const numSpaces = 4 + extraLength;
  const steps = numSpaces - 1;
  
  const coords: Coordinate[] = [];
  for (let i = 0; i < numSpaces; i++) {
    const t = i / steps;
    let angle;
    if (t <= 0.5) {
      const t1 = t * 2;
      angle = thetaA + t1 * diff1;
    } else {
      const t2 = (t - 0.5) * 2;
      angle = thetaApex + t2 * diff2;
    }
    coords.push({
      x: Math.round(cx + R * Math.cos(angle)),
      y: Math.round(cy + R * Math.sin(angle))
    });
  }
  
  // Force exact start and end points
  coords[0] = { ...A };
  coords[coords.length - 1] = { ...B };
  
  return coords;
};

// Generate Home Paths aligned to the measured board lines
export const getHomePathCoords = (playerIndex: number): Coordinate[] => {
  const coords: Coordinate[] = [];
  const steps = 6;
  
  // Home path line endpoints (start = center of 1st home path tile (H0), end = home space in center badge)
  const homePathLines: Record<number, { start: { x: number; y: number }; end: { x: number; y: number } }> = {
    0: { start: { x: 400, y: 722 }, end: { x: 400, y: 470 } },  // Green: Bottom-Center going UP
    1: { start: { x: 83, y: 396 }, end: { x: 326, y: 396 } },    // Yellow: Left-Center going RIGHT
    2: { start: { x: 720, y: 405 }, end: { x: 471, y: 405 } },   // Red: Right-Center going LEFT
    3: { start: { x: 403, y: 86 }, end: { x: 402, y: 326 } }     // Blue: Top-Center going DOWN
  };
  
  const line = homePathLines[playerIndex];
  if (!line) return coords;
  
  for (let i = 0; i < steps; i++) {
    // Spanned across 6 intervals: H0 at t=0 (start of line) to H5 at t=5/6, and Home space at t=6/6 (end of line)
    const t = i / 6;
    coords.push({
      x: Math.round(line.start.x + (line.end.x - line.start.x) * t),
      y: Math.round(line.start.y + (line.end.y - line.start.y) * t)
    });
  }
  
  return coords;
};

// Home center target alignments inside the center badge (matching the end of the home path lines)
export const HOME_COORDS: Record<number, Coordinate> = {
  0: { x: 400, y: 470 },     // Green Home (bottom slot)
  1: { x: 326, y: 396 },     // Yellow Home (left slot)
  2: { x: 471, y: 405 },     // Red Home (right slot)
  3: { x: 402, y: 326 }      // Blue Home (top slot)
};

// Map GameSpace to visual coordinate
export const getSpaceCoordinate = (space: GameSpace, extraTurnoutLength: number = 3): Coordinate => {
  switch (space.type) {
    case 'base':
      if (space.playerIndex !== undefined && BASE_POSITIONS[space.playerIndex]) {
        return BASE_POSITIONS[space.playerIndex][space.index];
      }
      return { x: 100, y: 100 };
      
    case 'broadway':
      return BROADWAY_COORDS[space.index] || { x: 0, y: 0 };
      
    case 'turnout':
      if (space.playerIndex !== undefined) {
        const tCoords = getTurnoutCoords(space.playerIndex, extraTurnoutLength);
        return tCoords[space.index] || { x: 0, y: 0 };
      }
      return { x: 0, y: 0 };
      
    case 'homePath':
      if (space.playerIndex !== undefined) {
        const hpCoords = getHomePathCoords(space.playerIndex);
        return hpCoords[space.index] || { x: 0, y: 0 };
      }
      return { x: 0, y: 0 };
      
    case 'home':
      if (space.playerIndex !== undefined) {
        return HOME_COORDS[space.playerIndex];
      }
      return { x: HALF_SIZE, y: HALF_SIZE };
      
    default:
      return { x: 0, y: 0 };
  }
};

// Apply stack offset when multiple pawns are on the same space
// Highly optimized side-by-side alignment perpendicular to diagonal paths!
export const getStackedPawnCoords = (
  space: GameSpace, 
  pawnIndex: number, 
  totalOnSpace: number,
  extraTurnoutLength: number = 3
): Coordinate => {
  const base = getSpaceCoordinate(space, extraTurnoutLength);
  
  if (totalOnSpace <= 1 || space.type === 'base') {
    return base;
  }
  
  // Symmetrical placement: if spaces are twice as wide, align pawns side-by-side perpendicular to track!
  if (space.type === 'broadway' || space.type === 'turnout') {
    const idx = space.index;
    let rotation = 45;
    
    if (space.type === 'broadway') {
      const coord = BROADWAY_COORDS[idx];
      rotation = coord.rotation ?? 45;
    } else if (space.playerIndex !== undefined) {
      // Turnouts inherit the player diagonal slope
      rotation = (space.playerIndex === 0 || space.playerIndex === 2) ? -45 : 45;
    }
    
    let dxPerp = 0.707;
    let dyPerp = 0.707;
    let dxTrack = -0.707;
    let dyTrack = 0.707;
    
    if (rotation === 45) {
      dxPerp = 0.707;
      dyPerp = -0.707;
      dxTrack = 0.707;
      dyTrack = 0.707;
    } else if (rotation === 0) {
      dxPerp = 0;
      dyPerp = 1;
      dxTrack = 1;
      dyTrack = 0;
    } else if (rotation === 90) {
      dxPerp = 1;
      dyPerp = 0;
      dxTrack = 0;
      dyTrack = 1;
    }
    
    // Distribute side-by-side perpendicular
    if (totalOnSpace === 2) {
      const directionFactor = pawnIndex === 0 ? -12 : 12;
      return {
        x: base.x + dxPerp * directionFactor,
        y: base.y + dyPerp * directionFactor
      };
    } else {
      // 3 or 4 pawns: distribute in a small square within the wide cell
      const column = pawnIndex % 2 === 0 ? -12 : 12;
      const row = pawnIndex < 2 ? -8 : 8; // spread slightly along track direction
      
      return {
        x: base.x + dxPerp * column + dxTrack * row,
        y: base.y + dyPerp * column + dyTrack * row
      };
    }
  }

  // Homepath straight alignments (horizontal or vertical lanes)
  if (space.type === 'homePath' && space.playerIndex !== undefined) {
    const isVertical = space.playerIndex === 0 || space.playerIndex === 3;
    
    if (totalOnSpace === 2) {
      const offsetDirection = pawnIndex === 0 ? -10 : 10;
      if (isVertical) {
        return { x: base.x + offsetDirection, y: base.y };
      } else {
        return { x: base.x, y: base.y + offsetDirection };
      }
    } else {
      const perpOffset = pawnIndex % 2 === 0 ? -10 : 10;
      const parallelOffset = pawnIndex < 2 ? -6 : 6;
      if (isVertical) {
        return { x: base.x + perpOffset, y: base.y + parallelOffset };
      } else {
        return { x: base.x + parallelOffset, y: base.y + perpOffset };
      }
    }
  }

  // Standard radial fallback
  const angleStep = (2 * Math.PI) / totalOnSpace;
  const radius = 10;
  const angle = pawnIndex * angleStep;
  
  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + Math.sin(angle) * radius
  };
};
