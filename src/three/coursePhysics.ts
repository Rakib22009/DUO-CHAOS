import {
  CourseWorldRuntime,
  WalkableSurface,
} from './proceduralAssets';

export function sampleGroundAt(
  world: CourseWorldRuntime,
  x: number,
  z: number,
): { y: number; surfaceType: WalkableSurface['surfaceType'] } | null {
  for (const s of world.surfaces) {
    let minX = s.minX;
    let maxX = s.maxX;
    if (s.dynamicIndex !== undefined) {
      const mp = world.movingPlatforms[s.dynamicIndex];
      if (mp) {
        minX = mp.currentX - mp.halfW;
        maxX = mp.currentX + mp.halfW;
      }
    }
    if (x >= minX && x <= maxX && z >= s.minZ && z <= s.maxZ) {
      let y = s.topY;
      if (s.slopeZ && s.baseZ !== undefined && s.baseY !== undefined) {
        y = s.baseY + (z - s.baseZ) * s.slopeZ;
      }
      return { y, surfaceType: s.surfaceType };
    }
  }
  return null;
}

export function resolveStaticCollisions(
  world: CourseWorldRuntime,
  pos: { x: number; y: number; z: number },
  radius: number,
): string | null {
  for (const box of world.staticObstacles) {
    if (pos.y + 1.6 < box.minY || pos.y > box.maxY) continue;
    const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.001;
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
      return box.label;
    }
  }
  return null;
}

export function checkHazardHit(
  world: CourseWorldRuntime,
  x: number,
  y: number,
  z: number,
  time: number,
): string | null {
  for (const h of world.hazards) {
    if (h.type === 'windmill') {
      if (Math.abs(z - h.z) < 0.85 && Math.abs(y + 1.0 - h.y) < 1.35 && Math.abs(x - h.x) < 2.5) {
        const angle = (time * h.speed + h.phase) % Math.PI;
        // Horizontal alignment knocks the carried object!
        if (Math.abs(Math.sin(angle)) < 0.34) {
          return 'Windmill Sweeper';
        }
      }
    } else if (h.type === 'pendulum') {
      const swing = Math.sin(time * h.speed + h.phase) * 0.95;
      const logX = h.x + Math.sin(swing) * 2.4;
      const logY = h.y - Math.cos(swing) * 2.4;
      if (Math.abs(z - h.z) < 0.8 && Math.abs(x - logX) < 1.55 && Math.abs(y + 1.1 - logY) < 0.85) {
        return 'Swinging Timber Log';
      }
    }
  }
  return null;
}
