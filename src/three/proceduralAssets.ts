import * as THREE from 'three';
import {
  CarryObjectType,
  CharacterId,
  CourseThemeId,
  GraphicsQuality,
  OutfitId,
} from '../shared/gameTypes';

export interface CharacterRig {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Group;
}

export interface CarriedObjectVisual {
  group: THREE.Group;
  waterMesh?: THREE.Mesh;
  waterSurface?: THREE.Mesh;
  eggs?: THREE.Mesh[];
  fish?: THREE.Group[];
  tiers?: THREE.Group[];
}

export interface WalkableSurface {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  surfaceType: 'grass' | 'wood' | 'stone' | 'slippery';
  slopeZ?: number; // y change per unit Z (if sloped)
  baseZ?: number;
  baseY?: number;
  dynamicIndex?: number; // index into movingPlatforms
}

export interface MovingPlatformRuntime {
  mesh: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  halfW: number;
  halfD: number;
  ampX: number;
  speed: number;
  phase: number;
  currentX: number;
}

export interface SweeperHazardRuntime {
  pivot: THREE.Group;
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  phase: number;
  type: 'windmill' | 'pendulum';
}

export interface StaticObstacleBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  label: string;
}

export interface CourseWorldRuntime {
  root: THREE.Group;
  surfaces: WalkableSurface[];
  movingPlatforms: MovingPlatformRuntime[];
  hazards: SweeperHazardRuntime[];
  staticObstacles: StaticObstacleBox[];
  checkpointMeshes: THREE.Group[];
  waterfallParticles: THREE.Points;
  pollenParticles: THREE.Points;
  disposables: Array<{ dispose: () => void }>;
}

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
  maxAniso = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  return tex;
}

export function createWorldTextures(maxAniso: number) {
  const woodTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const y = i * (h / 8);
      ctx.fillStyle = i % 2 === 0 ? '#7c5132' : '#966844';
      ctx.fillRect(0, y + 2, w, h / 8 - 4);
      ctx.fillStyle = '#4e311d';
      ctx.fillRect(0, y, w, 2);
      // wood grain streaks
      ctx.strokeStyle = 'rgba(60,35,18,0.22)';
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        ctx.moveTo(0, y + 6 + g * 4);
        ctx.bezierCurveTo(w * 0.33, y + 4 + g * 4, w * 0.66, y + 9 + g * 4, w, y + 6 + g * 4);
        ctx.stroke();
      }
    }
  }, 2, 4, maxAniso);

  const grassTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#4c9a2a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = Math.random() > 0.5 ? '#5cb338' : '#3a7d1e';
      ctx.fillRect(x, y, 3, 5);
    }
  }, 16, 16, maxAniso);

  const stoneTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#78848e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 6 + Math.random() * 14;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(20,30,40,0.12)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 3, 3, maxAniso);

  return { woodTex, grassTex, stoneTex };
}

export function buildCharacterModel(
  characterId: CharacterId,
  outfitId: OutfitId,
  colorHex: string,
): CharacterRig {
  const root = new THREE.Group();
  const mainColor = new THREE.Color(colorHex);
  const darkTrim = mainColor.clone().multiplyScalar(0.55);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    roughness: outfitId === 'parka' ? 0.78 : 0.55,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: outfitId === 'alpine' ? 0x2b3648 : 0x3f3a34,
    roughness: 0.82,
    metalness: 0.04,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x3b2618,
    roughness: 0.7,
    metalness: 0.12,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf1c29b,
    roughness: 0.62,
    metalness: 0.02,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.3,
    metalness: 0.45,
  });

  // Left & Right Legs (pivoted at hip y = 0.72)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.72, 0);
  const legGeo = new THREE.CylinderGeometry(0.1, 0.085, 0.54, 10);
  const lLegMesh = new THREE.Mesh(legGeo, pantsMat);
  lLegMesh.position.y = -0.27;
  lLegMesh.castShadow = true;
  const bootGeo = new THREE.BoxGeometry(0.18, 0.16, 0.28);
  const lBoot = new THREE.Mesh(bootGeo, bootMat);
  lBoot.position.set(0, -0.62, 0.04);
  lBoot.castShadow = true;
  leftLeg.add(lLegMesh, lBoot);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.72, 0);
  const rLegMesh = new THREE.Mesh(legGeo, pantsMat);
  rLegMesh.position.y = -0.27;
  rLegMesh.castShadow = true;
  const rBoot = new THREE.Mesh(bootGeo, bootMat);
  rBoot.position.set(0, -0.62, 0.04);
  rBoot.castShadow = true;
  rightLeg.add(rLegMesh, rBoot);
  root.add(leftLeg, rightLeg);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.32), jacketMat);
  torso.position.y = 1.04;
  torso.castShadow = true;
  root.add(torso);

  // Outfit collar / scarf / belt detail
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.09, 0.35),
    new THREE.MeshStandardMaterial({ color: darkTrim, roughness: 0.45, metalness: 0.2 }),
  );
  belt.position.y = 0.78;
  root.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.04), accentMat);
  buckle.position.set(0, 0.78, 0.18);
  root.add(buckle);

  // Backpack
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.46, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.75 }),
  );
  pack.position.set(0, 1.06, -0.24);
  pack.castShadow = true;
  root.add(pack);

  // Head group
  const head = new THREE.Group();
  head.position.set(0, 1.54, 0);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  headMesh.castShadow = true;
  head.add(headMesh);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 });
  const eyeGeo = new THREE.SphereGeometry(0.032, 8, 8);
  const lEye = new THREE.Mesh(eyeGeo, eyeMat);
  lEye.position.set(-0.075, 0.03, 0.19);
  const rEye = new THREE.Mesh(eyeGeo, eyeMat);
  rEye.position.set(0.075, 0.03, 0.19);
  head.add(lEye, rEye);

  // Archetype headgear
  if (characterId === 'ranger') {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.38, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 }),
    );
    brim.position.y = 0.15;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 }),
    );
    crown.position.y = 0.24;
    head.add(brim, crown);
  } else if (characterId === 'botanist') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x4c9a2a, roughness: 0.6 }),
    );
    cap.position.y = 0.04;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), accentMat);
    leaf.position.set(0, 0.29, 0);
    leaf.rotation.z = -0.35;
    head.add(cap, leaf);
  } else if (characterId === 'mountaineer') {
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 }),
    );
    beanie.position.y = 0.04;
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }),
    );
    pom.position.y = 0.28;
    head.add(beanie, pom);
  } else {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      accentMat,
    );
    helmet.position.y = 0.05;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.09, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.7 }),
    );
    visor.position.set(0, 0.07, 0.17);
    head.add(helmet, visor);
  }
  root.add(head);

  // Arms (pivoted at shoulders)
  const buildArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 1.28, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 10), jacketMat);
    sleeve.position.y = -0.2;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
    hand.position.y = -0.45;
    arm.add(sleeve, hand);
    return arm;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  root.add(leftArm, rightArm);

  return { group: root, leftArm, rightArm, leftLeg, rightLeg, head };
}

export function buildFirstPersonArms(colorHex: string): THREE.Group {
  const arms = new THREE.Group();
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.6,
    metalness: 0.06,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x6f4e37,
    roughness: 0.7,
    metalness: 0.1,
  });

  const makeArm = (side: number) => {
    const g = new THREE.Group();
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.072, 0.46, 10), sleeveMat);
    forearm.rotation.x = Math.PI * 0.38;
    forearm.position.set(side * 0.36, -0.28, -0.36);
    forearm.rotation.z = side * -0.18;

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10), cuffMat);
    cuff.rotation.x = Math.PI * 0.38;
    cuff.position.set(side * 0.31, -0.18, -0.54);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.14), gloveMat);
    hand.position.set(side * 0.28, -0.14, -0.63);
    hand.rotation.y = side * -0.25;

    g.add(forearm, cuff, hand);
    return g;
  };

  arms.add(makeArm(-1), makeArm(1));
  return arms;
}

export function buildCarriedObject(objectType: CarryObjectType): CarriedObjectVisual {
  const group = new THREE.Group();
  const visual: CarriedObjectVisual = { group };

  if (objectType === 'pine_tree') {
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const needleMat = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.82 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.6, 10), barkMat);
    trunk.rotation.z = Math.PI / 2;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.68 - i * 0.11, 0.95, 10),
        needleMat,
      );
      cone.rotation.z = -Math.PI / 2;
      cone.position.x = 0.25 + i * 0.48;
      cone.castShadow = true;
      group.add(cone);
    }
  } else if (objectType === 'bird_nest') {
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.92 });
    const bowl = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 10, 18), twigMat);
    bowl.rotation.x = Math.PI / 2;
    bowl.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.16, 14), twigMat);
    base.position.y = -0.06;
    group.add(bowl, base);

    const eggMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.28 });
    const eggs: THREE.Mesh[] = [];
    const offsets = [
      [-0.14, 0.06, 0.08],
      [0.14, 0.06, 0.06],
      [0, 0.06, -0.14],
    ];
    offsets.forEach(([x, y, z]) => {
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), eggMat);
      egg.scale.set(1, 1.35, 1);
      egg.position.set(x, y, z);
      egg.castShadow = true;
      eggs.push(egg);
      group.add(egg);
    });
    visual.eggs = eggs;
  } else if (objectType === 'water_glass') {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.35,
      roughness: 0.08,
      metalness: 0.05,
      depthWrite: false,
    });
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.6 }),
    );
    tray.position.y = -0.34;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.72, 18, 1, true), glassMat);
    glass.position.y = 0.04;
    glass.renderOrder = 2;

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      roughness: 0.12,
    });
    const waterMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.56, 16), waterMat);
    waterMesh.position.y = -0.03;
    const waterSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.08, side: THREE.DoubleSide }),
    );
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.y = 0.25;

    group.add(tray, waterMesh, waterSurface, glass);
    visual.waterMesh = waterMesh;
    visual.waterSurface = waterSurface;
  } else if (objectType === 'wooden_crate') {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.75 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.7 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.85), crateMat);
    box.castShadow = true;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.88), trimMat);
    band1.position.y = 0.24;
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.88), trimMat);
    band2.position.y = -0.24;
    group.add(box, band1, band2);
  } else if (objectType === 'flower_pot') {
    const clayMat = new THREE.MeshStandardMaterial({ color: 0xc2653b, roughness: 0.68 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.44, 16), clayMat);
    pot.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.31, 0.08, 16), clayMat);
    rim.position.y = 0.22;
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 14),
      new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.95 }),
    );
    soil.position.y = 0.21;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.46, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.6 }),
    );
    stem.position.y = 0.44;
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
    const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), petalMat);
    flower.position.y = 0.68;
    group.add(pot, rim, soil, stem, flower);
  } else if (objectType === 'boulder_rock') {
    const rockGeo = new THREE.IcosahedronGeometry(0.52, 1);
    const pos = rockGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = 0.86 + Math.sin(i * 2.1) * 0.16;
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
    }
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, flatShading: true }),
    );
    rock.castShadow = true;
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }),
    );
    group.add(rock, strap);
  } else if (objectType === 'water_bucket') {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.78 });
    const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.52, 16, 1, true), metalMat);
    pail.material.side = THREE.DoubleSide;
    pail.castShadow = true;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), metalMat);
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = -0.26;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 16, Math.PI), metalMat);
    handle.position.y = 0.26;
    const waterMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.21, 0.36, 14),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.82, roughness: 0.1 }),
    );
    waterMesh.position.y = -0.05;
    group.add(pail, bottom, handle, waterMesh);
    visual.waterMesh = waterMesh;
  } else if (objectType === 'wedding_cake') {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.45, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.6 }),
    );
    plate.position.y = -0.32;
    group.add(plate);

    const frostingMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.55 });
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 });
    const tiers: THREE.Group[] = [];
    const specs = [
      { r: 0.4, h: 0.28, y: -0.16 },
      { r: 0.29, h: 0.25, y: 0.1 },
      { r: 0.19, h: 0.22, y: 0.33 },
    ];
    specs.forEach((s, idx) => {
      const tg = new THREE.Group();
      tg.position.y = s.y;
      const tierMesh = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.h, 18), frostingMat);
      tierMesh.castShadow = true;
      const ribbon = new THREE.Mesh(
        new THREE.CylinderGeometry(s.r + 0.01, s.r + 0.01, 0.05, 18),
        berryMat,
      );
      ribbon.position.y = -s.h * 0.32;
      tg.add(tierMesh, ribbon);
      if (idx === 2) {
        const topper = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.09, 0),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 }),
        );
        topper.position.y = 0.2;
        tg.add(topper);
      }
      tiers.push(tg);
      group.add(tg);
    });
    visual.tiers = tiers;
  } else if (objectType === 'fish_tank') {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.34,
      roughness: 0.06,
      depthWrite: false,
    });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.06, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 }),
    );
    frame.position.y = -0.28;
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.54, 0.52), glassMat);
    tank.renderOrder = 2;

    const waterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.42, 0.46),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.58, roughness: 0.1 }),
    );
    waterMesh.position.y = -0.04;

    const fishList: THREE.Group[] = [];
    for (let i = 0; i < 2; i++) {
      const fg = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshStandardMaterial({ color: i === 0 ? 0xf97316 : 0xfacc15, roughness: 0.3 }),
      );
      body.scale.set(1.5, 0.9, 0.7);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.09, 4),
        new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 }),
      );
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.11;
      fg.add(body, tail);
      fg.position.set(i === 0 ? -0.18 : 0.18, i === 0 ? 0.04 : -0.08, 0);
      fishList.push(fg);
      group.add(fg);
    }

    group.add(frame, waterMesh, tank);
    visual.waterMesh = waterMesh;
    visual.fish = fishList;
  }

  return visual;
}

export function buildObstacleCourseWorld(
  scene: THREE.Scene,
  quality: GraphicsQuality,
  courseTheme: CourseThemeId,
  maxAniso: number,
): CourseWorldRuntime {
  const root = new THREE.Group();
  const surfaces: WalkableSurface[] = [];
  const movingPlatforms: MovingPlatformRuntime[] = [];
  const hazards: SweeperHazardRuntime[] = [];
  const staticObstacles: StaticObstacleBox[] = [];
  const checkpointMeshes: THREE.Group[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const { woodTex, grassTex, stoneTex } = createWorldTextures(maxAniso);
  disposables.push(woodTex, grassTex, stoneTex);

  const skyHex =
    courseTheme === 'alpine_gorge'
      ? 0xbfe3ff
      : courseTheme === 'river_rapids'
        ? 0xa7f3d0
        : 0xbae6fd;
  scene.background = new THREE.Color(skyHex);
  scene.fog = new THREE.FogExp2(skyHex, 0.0085);

  // Materials
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    color: courseTheme === 'alpine_gorge' ? 0x65a30d : 0x4c9a2a,
    roughness: 0.88,
  });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85 });
  const slickStoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x67e8f9,
    roughness: 0.18,
    metalness: 0.15,
  });
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.14,
    metalness: 0.1,
    transparent: true,
    opacity: 0.86,
  });
  disposables.push(grassMat, woodMat, stoneMat, slickStoneMat, riverMat);

  const addPlatform = (
    id: string,
    cx: number,
    topY: number,
    cz: number,
    w: number,
    d: number,
    thickness: number,
    mat: THREE.Material,
    surfaceType: WalkableSurface['surfaceType'],
    slopeZ = 0,
  ) => {
    const geo = new THREE.BoxGeometry(w, thickness, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, topY - thickness * 0.5, cz);
    if (slopeZ !== 0) {
      mesh.rotation.x = Math.atan(slopeZ);
    }
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);
    disposables.push(geo);

    surfaces.push({
      id,
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
      topY,
      surfaceType,
      slopeZ,
      baseZ: cz,
      baseY: topY,
    });
  };

  // Surrounding distant valley floor (decorative abyss below bridges)
  const valleyGeo = new THREE.PlaneGeometry(420, 420);
  const valleyMesh = new THREE.Mesh(
    valleyGeo,
    new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.95 }),
  );
  valleyMesh.rotation.x = -Math.PI / 2;
  valleyMesh.position.set(0, -8.5, -105);
  valleyMesh.receiveShadow = true;
  root.add(valleyMesh);
  disposables.push(valleyGeo);

  // Rushing river winding under bridges
  const riverGeo = new THREE.PlaneGeometry(420, 26);
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.position.set(0, -6.2, -108);
  root.add(riverMesh);
  disposables.push(riverGeo);

  // --- COURSE LAYOUT FROM Z = +6 TO Z = -220 ---
  // 1. Trailhead Start Meadow (Z: +6 to -14, Y: 0)
  addPlatform('start_meadow', 0, 0, -4, 14, 20, 1.5, grassMat, 'grass');

  // 2. Narrow Twin Wooden Bridge (Z: -14 to -34, Y: 0)
  addPlatform('bridge_1', 0, 0, -24, 4.2, 20, 0.5, woodMat, 'wood');

  // 3. Chicane Rock Courtyard (Z: -34 to -50, Y: 0)
  addPlatform('courtyard_1', 0, 0, -42, 10, 16, 1.4, stoneMat, 'stone');

  // Checkpoint 1 Meadow (Z: -50 to -62, Y: 0)
  addPlatform('cp1_pad', 0, 0, -56, 11, 12, 1.5, grassMat, 'grass');

  // 4. Moving Sliding Platforms over Canyon Gap (Z: -64 to -84, Y: 0.3)
  for (let i = 0; i < 2; i++) {
    const mpGroup = new THREE.Group();
    const mpGeo = new THREE.BoxGeometry(5.2, 0.55, 7.5);
    const mpMesh = new THREE.Mesh(mpGeo, woodMat);
    mpMesh.receiveShadow = true;
    mpMesh.castShadow = true;
    mpGroup.add(mpMesh);
    const cz = -68 - i * 10;
    mpGroup.position.set(0, 0.05, cz);
    root.add(mpGroup);
    disposables.push(mpGeo);

    const dynIdx = movingPlatforms.length;
    movingPlatforms.push({
      mesh: mpGroup,
      baseX: 0,
      baseY: 0.32,
      baseZ: cz,
      halfW: 2.6,
      halfD: 3.75,
      ampX: 3.1,
      speed: 0.85 + i * 0.25,
      phase: i * Math.PI,
      currentX: 0,
    });
    surfaces.push({
      id: `moving_${i}`,
      minX: -2.6,
      maxX: 2.6,
      minZ: cz - 3.75,
      maxZ: cz + 3.75,
      topY: 0.32,
      surfaceType: 'wood',
      dynamicIndex: dynIdx,
    });
  }

  // 5. Slippery Mossy Uphill Ramp (Z: -84 to -108, Y rises from 0 to 1.2)
  addPlatform('slippery_ramp', 0, 0.6, -96, 7.5, 24, 1.2, slickStoneMat, 'slippery', -0.05);

  // 6. Checkpoint 2 Waterfall Overlook (Z: -108 to -122, Y: 1.2)
  addPlatform('cp2_pad', 0, 1.2, -115, 11, 14, 1.6, grassMat, 'grass');

  // 7. Windmill Sweeper Bridge (Z: -122 to -144, Y: 1.2)
  addPlatform('windmill_bridge', 0, 1.2, -133, 5.4, 22, 0.6, woodMat, 'wood');

  // 8. Uphill Mountain Ridge Climb (Z: -144 to -162, Y rises 1.2 -> 3.0)
  addPlatform('mountain_climb', 0, 2.1, -153, 8.2, 18, 1.4, stoneMat, 'stone', -0.1);

  // 9. Checkpoint 3 Summit Ridge (Z: -162 to -174, Y: 3.0)
  addPlatform('cp3_pad', 0, 3.0, -168, 11, 12, 1.6, grassMat, 'grass');

  // 10. High Suspension Final Bridge (Z: -174 to -198, Y: 3.0)
  addPlatform('final_bridge', 0, 3.0, -186, 4.0, 24, 0.5, woodMat, 'wood');

  // 11. Victory Pavilion Plaza (Z: -198 to -220, Y: 3.0)
  addPlatform('victory_plaza', 0, 3.0, -209, 15, 22, 1.8, grassMat, 'grass');

  // --- CHECKPOINT ARCHWAYS & VICTORY PAVILION ---
  const cpSpecs = [
    { z: -55, y: 0, isFinish: false },
    { z: -115, y: 1.2, isFinish: false },
    { z: -168, y: 3.0, isFinish: false },
    { z: -208, y: 3.0, isFinish: true },
  ];
  const archWoodMat = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.7 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  cpSpecs.forEach((cp) => {
    const g = new THREE.Group();
    g.position.set(0, cp.y, cp.z);
    const span = cp.isFinish ? 6.5 : 4.8;
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.2, 10), archWoodMat);
    leftPost.position.set(-span * 0.5, 2.1, 0);
    leftPost.castShadow = true;
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.2, 10), archWoodMat);
    rightPost.position.set(span * 0.5, 2.1, 0);
    rightPost.castShadow = true;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.8, 0.38, 0.45), archWoodMat);
    beam.position.set(0, 4.15, 0);
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glowMat);
    lantern.position.set(0, 3.55, 0);
    g.add(leftPost, rightPost, beam, lantern);
    root.add(g);
    checkpointMeshes.push(g);
  });

  // --- OBSTACLES: CHICANE BOULDERS & ROTATING SWEEPERS ---
  const boulderPositions = [
    [-2.4, 0, -39],
    [2.3, 0, -45],
    [-1.8, 0.55, -94],
    [2.0, 0.85, -100],
  ];
  boulderPositions.forEach(([bx, by, bz], idx) => {
    const bMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), stoneMat);
    bMesh.position.set(bx, by + 0.8, bz);
    bMesh.castShadow = true;
    root.add(bMesh);
    staticObstacles.push({
      minX: bx - 0.85,
      maxX: bx + 0.85,
      minY: by,
      maxY: by + 1.8,
      minZ: bz - 0.85,
      maxZ: bz + 0.85,
      label: `Boulder #${idx + 1}`,
    });
  });

  // Rotating Windmill Sweeper & Swinging Log Pendulum
  const hazardConfigs: Array<{ x: number; y: number; z: number; type: 'windmill' | 'pendulum'; speed: number }> = [
    { x: 0, y: 2.1, z: -130, type: 'windmill', speed: 1.45 },
    { x: 0, y: 2.1, z: -138, type: 'windmill', speed: -1.65 },
    { x: 0, y: 5.5, z: -186, type: 'pendulum', speed: 1.8 },
  ];
  const barMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  hazardConfigs.forEach((hc, idx) => {
    const pivot = new THREE.Group();
    pivot.position.set(hc.x, hc.y, hc.z);
    if (hc.type === 'windmill') {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12), archWoodMat);
      hub.rotation.x = Math.PI / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.26, 0.26), barMat);
      bar.castShadow = true;
      pivot.add(hub, bar);
    } else {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), archWoodMat);
      rope.position.y = -1.2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.8, 12), barMat);
      log.rotation.z = Math.PI / 2;
      log.position.y = -2.4;
      log.castShadow = true;
      pivot.add(rope, log);
    }
    root.add(pivot);
    hazards.push({
      pivot,
      x: hc.x,
      y: hc.y,
      z: hc.z,
      radius: 2.2,
      speed: hc.speed,
      phase: idx * 1.1,
      type: hc.type,
    });
  });

  // --- INSTANCED PINE TREES & MOUNTAIN RIDGES ---
  const treeCount = quality === 'low' ? 60 : quality === 'medium' ? 110 : 160;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7);
  const foliageGeo = new THREE.ConeGeometry(1.55, 4.6, 8);
  const trunkInst = new THREE.InstancedMesh(
    trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 }),
    treeCount,
  );
  const foliageInst = new THREE.InstancedMesh(
    foliageGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 }),
    treeCount,
  );
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (9.5 + Math.random() * 48);
    const z = 12 - Math.random() * 245;
    const s = 0.85 + Math.random() * 0.45;
    dummy.position.set(x, -7.4 + s * 1.1, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, -7.4 + s * 4.0, z);
    dummy.updateMatrix();
    foliageInst.setMatrixAt(i, dummy.matrix);

    tint.setHSL(0.32 + (Math.random() - 0.5) * 0.05, 0.55, 0.24 + Math.random() * 0.14);
    foliageInst.setColorAt(i, tint);
  }
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  root.add(trunkInst, foliageInst);
  disposables.push(trunkGeo, foliageGeo);

  // Distant Mountain Peaks
  const peakMat = new THREE.MeshStandardMaterial({
    color: courseTheme === 'alpine_gorge' ? 0x64748b : 0x2d6a4f,
    roughness: 0.92,
    flatShading: true,
  });
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const dist = 125 + (i % 3) * 28;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(28 + (i % 4) * 8, 56 + (i % 3) * 18, 6), peakMat);
    peak.position.set(Math.cos(angle) * dist, 14, -105 + Math.sin(angle) * dist);
    root.add(peak);
  }

  // Waterfall cliff & mist particles near Checkpoint 2
  const cliff = new THREE.Mesh(
    new THREE.BoxGeometry(16, 28, 12),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }),
  );
  cliff.position.set(-22, 6, -112);
  const waterRibbon = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 22),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  waterRibbon.position.set(-13.8, 5, -112);
  waterRibbon.rotation.y = Math.PI / 2;
  root.add(cliff, waterRibbon);

  // Waterfall mist particle cloud
  const wfCount = quality === 'low' ? 60 : 140;
  const wfPos = new Float32Array(wfCount * 3);
  for (let i = 0; i < wfCount; i++) {
    wfPos[i * 3] = -13.5 + (Math.random() - 0.5) * 3;
    wfPos[i * 3 + 1] = -5 + Math.random() * 18;
    wfPos[i * 3 + 2] = -112 + (Math.random() - 0.5) * 5.5;
  }
  const wfGeo = new THREE.BufferGeometry();
  wfGeo.setAttribute('position', new THREE.BufferAttribute(wfPos, 3));
  const wfMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.55, transparent: true, opacity: 0.72 });
  const waterfallParticles = new THREE.Points(wfGeo, wfMat);
  root.add(waterfallParticles);
  disposables.push(wfGeo, wfMat);

  // Ambient floating sunlit pollen / firefly particles
  const pCount = quality === 'low' ? 80 : 200;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 40;
    pPos[i * 3 + 1] = Math.random() * 8;
    pPos[i * 3 + 2] = 10 - Math.random() * 230;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xfef08a, size: 0.22, transparent: true, opacity: 0.75 });
  const pollenParticles = new THREE.Points(pGeo, pMat);
  root.add(pollenParticles);
  disposables.push(pGeo, pMat);

  scene.add(root);

  return {
    root,
    surfaces,
    movingPlatforms,
    hazards,
    staticObstacles,
    checkpointMeshes,
    waterfallParticles,
    pollenParticles,
    disposables,
  };
}
