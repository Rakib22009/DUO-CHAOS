export type CharacterId = 'ranger' | 'botanist' | 'mountaineer' | 'engineer';
export type OutfitId = 'trail' | 'alpine' | 'scout' | 'parka';
export type GraphicsQuality = 'low' | 'medium' | 'high';

export type CarryObjectType =
  | 'pine_tree'
  | 'bird_nest'
  | 'water_glass'
  | 'wooden_crate'
  | 'flower_pot'
  | 'boulder_rock'
  | 'water_bucket'
  | 'wedding_cake'
  | 'fish_tank';

export type CourseThemeId = 'sunlit_valley' | 'alpine_gorge' | 'river_rapids';

export interface UserProfile {
  uid: string;
  username: string;
  photoURL: string;
  characterId: CharacterId;
  outfitId: OutfitId;
  colorHex: string;
  gamesPlayed: number;
  wins: number;
  failures: number;
  bestLevel: number;
}

export interface GameSettings {
  graphics: GraphicsQuality;
  cameraSensitivity: number; // 0.4 to 2.0
  buttonScale: number; // 0.8 to 1.4
  muted: boolean;
  touchControlsEnabled: 'auto' | 'always' | 'off';
}

export interface CarryObjectSpec {
  id: CarryObjectType;
  name: string;
  tagline: string;
  challengeRule: string;
  massFactor: number; // affects move speed (higher = heavier)
  tiltSensitivity: number; // how fast player divergence tilts it
  maxTiltDeg: number; // failure angle threshold
  hasWater: boolean;
  hasEggs: boolean;
  spanWidth: number; // collision width
  difficulty: 'Medium' | 'Hard' | 'Chaotic';
}

export const CARRY_OBJECTS: Record<CarryObjectType, CarryObjectSpec> = {
  pine_tree: {
    id: 'pine_tree',
    name: 'Giant Pine Tree',
    tagline: 'Wide evergreen trunk with prickly branches',
    challengeRule: 'Watch the 4m branch span! Clipping canyon arches or boulders snaps the trunk.',
    massFactor: 1.32,
    tiltSensitivity: 1.0,
    maxTiltDeg: 38,
    hasWater: false,
    hasEggs: false,
    spanWidth: 3.4,
    difficulty: 'Hard',
  },
  bird_nest: {
    id: 'bird_nest',
    name: "Bird's Nest & Eggs",
    tagline: 'Three dangerously round speckled eggs',
    challengeRule: 'Tilting past 22° or hard landings roll eggs out. Lose all 3 eggs and restart!',
    massFactor: 0.92,
    tiltSensitivity: 1.55,
    maxTiltDeg: 24,
    hasWater: false,
    hasEggs: true,
    spanWidth: 1.4,
    difficulty: 'Chaotic',
  },
  water_glass: {
    id: 'water_glass',
    name: 'Crystal Water Glass',
    tagline: 'Brimming with sloshing spring water',
    challengeRule: 'Sudden jerks slosh water over the rim. Keep at least 25% water to finish!',
    massFactor: 0.88,
    tiltSensitivity: 1.4,
    maxTiltDeg: 28,
    hasWater: true,
    hasEggs: false,
    spanWidth: 1.1,
    difficulty: 'Chaotic',
  },
  wooden_crate: {
    id: 'wooden_crate',
    name: 'Heavy Timber Crate',
    tagline: 'Packed with Mystery Supplies',
    challengeRule: 'Slows both players down. Survives minor scrapes, shatters on deep drops.',
    massFactor: 1.5,
    tiltSensitivity: 0.85,
    maxTiltDeg: 42,
    hasWater: false,
    hasEggs: false,
    spanWidth: 1.7,
    difficulty: 'Medium',
  },
  flower_pot: {
    id: 'flower_pot',
    name: 'Terracotta Orchid Pot',
    tagline: 'Hand-glazed brittle clay pot',
    challengeRule: 'Top-heavy wobble! Any obstacle impact fractures the ceramic pot.',
    massFactor: 1.05,
    tiltSensitivity: 1.35,
    maxTiltDeg: 26,
    hasWater: false,
    hasEggs: false,
    spanWidth: 1.2,
    difficulty: 'Hard',
  },
  boulder_rock: {
    id: 'boulder_rock',
    name: 'Granite River Boulder',
    tagline: 'Dense mountain stone that loves downhill slopes',
    challengeRule: 'Extreme weight pulls you forward on ramps. Hold Brace to stabilize together!',
    massFactor: 1.7,
    tiltSensitivity: 0.95,
    maxTiltDeg: 35,
    hasWater: false,
    hasEggs: false,
    spanWidth: 1.5,
    difficulty: 'Hard',
  },
  water_bucket: {
    id: 'water_bucket',
    name: 'Swinging Water Bucket',
    tagline: 'Metal handle swings like a pendulum',
    challengeRule: 'Sharp zig-zags whip the bucket sideways and spill water everywhere.',
    massFactor: 1.08,
    tiltSensitivity: 1.5,
    maxTiltDeg: 30,
    hasWater: true,
    hasEggs: false,
    spanWidth: 1.2,
    difficulty: 'Hard',
  },
  wedding_cake: {
    id: 'wedding_cake',
    name: '3-Tier Celebration Cake',
    tagline: 'Towering frosted pastry disaster',
    challengeRule: 'Tall center of mass amplifies tiny speed mismatches into instant frosting collapse!',
    massFactor: 1.0,
    tiltSensitivity: 1.75,
    maxTiltDeg: 21,
    hasWater: false,
    hasEggs: false,
    spanWidth: 1.3,
    difficulty: 'Chaotic',
  },
  fish_tank: {
    id: 'fish_tank',
    name: 'Glass Reef Fish Tank',
    tagline: 'Two panicked goldfish in a heavy glass box',
    challengeRule: 'Combines heavy mass, water slosh loss, and fragile glass collision rules.',
    massFactor: 1.42,
    tiltSensitivity: 1.3,
    maxTiltDeg: 27,
    hasWater: true,
    hasEggs: false,
    spanWidth: 1.8,
    difficulty: 'Chaotic',
  },
};

export interface CourseModifier {
  themeId: CourseThemeId;
  title: string;
  subtitle: string;
  windStrength: number; // 0 to 1
  slipperiness: number; // 0 to 1
  gravityScale: number; // ~1.0
  realWorldRef?: string;
}

export const COURSE_THEMES: Record<CourseThemeId, CourseModifier> = {
  sunlit_valley: {
    themeId: 'sunlit_valley',
    title: 'Sunlit Forest Valley',
    subtitle: 'Timber bridges, mossy rocks, and waterfall canyons',
    windStrength: 0.15,
    slipperiness: 0.2,
    gravityScale: 1.0,
  },
  alpine_gorge: {
    themeId: 'alpine_gorge',
    title: 'Alpine Wind Gorge',
    subtitle: 'Gusting crosswinds across high mountain suspension planks',
    windStrength: 0.55,
    slipperiness: 0.35,
    gravityScale: 1.0,
  },
  river_rapids: {
    themeId: 'river_rapids',
    title: 'Waterfall River Rapids',
    subtitle: 'Slick river stones, mist spray, and tight log crossings',
    windStrength: 0.25,
    slipperiness: 0.65,
    gravityScale: 1.0,
  },
};

export const CHARACTER_OPTIONS: { id: CharacterId; label: string; role: string }[] = [
  { id: 'ranger', label: 'Forest Ranger', role: 'Balanced trail specialist' },
  { id: 'botanist', label: 'Field Botanist', role: 'Careful delicate-cargo handler' },
  { id: 'mountaineer', label: 'Ridge Climber', role: 'Heavy-haul alpine guide' },
  { id: 'engineer', label: 'Bridge Engineer', role: 'Precision balance tactician' },
];

export const OUTFIT_OPTIONS: { id: OutfitId; label: string }[] = [
  { id: 'trail', label: 'Trail Vest' },
  { id: 'alpine', label: 'Alpine Jacket' },
  { id: 'scout', label: 'Scout Poncho' },
  { id: 'parka', label: 'Timber Parka' },
];

export const COLOR_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#1E5631', name: 'Forest Green' },
  { hex: '#0284C7', name: 'Sky Blue' },
  { hex: '#D97706', name: 'Warm Amber' },
  { hex: '#B45309', name: 'Natural Cedar' },
  { hex: '#0D9488', name: 'River Teal' },
  { hex: '#DC2626', name: 'Summit Red' },
];

export interface PlayerNetState {
  uid: string;
  username: string;
  characterId: CharacterId;
  outfitId: OutfitId;
  colorHex: string;
  role: 'host' | 'guest';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
  isGrounded: boolean;
  isBracing: boolean;
  ready: boolean;
  connected: boolean;
}

export interface SharedObjectNetState {
  objectType: CarryObjectType;
  x: number;
  y: number;
  z: number;
  tiltX: number; // radians
  tiltZ: number; // radians
  yaw: number;
  integrity: number; // 0..100
  waterLevel: number; // 0..100
  eggsRemaining: number; // 0..3
  sloshPhase: number;
  failedReason: string | null;
}

export interface RoomNetSnapshot {
  roomId: string;
  status: 'waiting' | 'playing' | 'victory' | 'failed';
  courseTheme: CourseThemeId;
  courseModifier: CourseModifier;
  selectedObject: CarryObjectType;
  currentCheckpoint: number; // 0..3 (4 is finish)
  botPartnerEnabled: boolean;
  elapsedSec: number;
  attempts: number;
  players: Record<string, PlayerNetState>;
  objectState: SharedObjectNetState;
}

export const CHECKPOINT_POSITIONS: { index: number; label: string; z: number; x: number; y: number }[] = [
  { index: 0, label: 'Trailhead Start', z: 0, x: 0, y: 0 },
  { index: 1, label: 'Checkpoint 1 · Meadow Arch', z: -55, x: 0, y: 0 },
  { index: 2, label: 'Checkpoint 2 · Waterfall Crossing', z: -115, x: 0, y: 1.2 },
  { index: 3, label: 'Checkpoint 3 · Summit Ridge', z: -168, x: 0, y: 3.0 },
  { index: 4, label: 'Final Destination · Sunlit Pavilion', z: -210, x: 0, y: 3.0 },
];
