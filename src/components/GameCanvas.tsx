import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CARRY_OBJECTS,
  CHECKPOINT_POSITIONS,
  CarryObjectType,
  CharacterId,
  CourseThemeId,
  GameSettings,
  OutfitId,
  RoomNetSnapshot,
} from '../shared/gameTypes';
import {
  buildCarriedObject,
  buildCharacterModel,
  buildFirstPersonArms,
  buildObstacleCourseWorld,
  CarriedObjectVisual,
  CharacterRig,
  CourseWorldRuntime,
} from '../three/proceduralAssets';
import {
  checkHazardHit,
  resolveStaticCollisions,
  sampleGroundAt,
} from '../three/coursePhysics';
import { soundEngine } from '../audio/soundEngine';

export interface LocalInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1 (forward positive)
  lookDeltaX: number;
  lookDeltaY: number;
  jumpBufferedUntil: number;
  isBracing: boolean;
}

export interface GameCanvasProps {
  mode: 'intro' | 'lobby' | 'play';
  settings: GameSettings;
  localUid: string;
  characterId: CharacterId;
  outfitId: OutfitId;
  colorHex: string;
  courseTheme: CourseThemeId;
  selectedObject: CarryObjectType;
  roomSnapshot: RoomNetSnapshot | null;
  inputRef: React.MutableRefObject<LocalInputState>;
  onSendPlayerState: (payload: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    speed: number;
    isGrounded: boolean;
    isBracing: boolean;
  }) => void;
  onSendObjectTelemetry: (payload: {
    waterLevel?: number;
    eggsRemaining?: number;
    integrity?: number;
  }) => void;
  onCheckpointReached: (checkpointIndex: number) => void;
  onFailureTriggered: (reason: string) => void;
  onVictoryTriggered: () => void;
  onLocalHudUpdate: (hud: {
    speed: number;
    tiltDeg: number;
    waterLevel: number;
    eggsRemaining: number;
    integrity: number;
    distanceToPartner: number;
    surfaceType: string;
  }) => void;
  respawnSignal: number;
}

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  settings,
  localUid,
  characterId,
  outfitId,
  colorHex,
  courseTheme,
  selectedObject,
  roomSnapshot,
  inputRef,
  onSendPlayerState,
  onSendObjectTelemetry,
  onCheckpointReached,
  onFailureTriggered,
  onVictoryTriggered,
  onLocalHudUpdate,
  respawnSignal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Latest props in refs so WebGL scene never tears down on React updates
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const localUidRef = useRef(localUid);
  localUidRef.current = localUid;
  const roomRef = useRef(roomSnapshot);
  roomRef.current = roomSnapshot;
  const courseThemeRef = useRef(courseTheme);
  courseThemeRef.current = courseTheme;
  const selectedObjectRef = useRef(selectedObject);
  selectedObjectRef.current = selectedObject;
  const charConfigRef = useRef({ characterId, outfitId, colorHex });
  charConfigRef.current = { characterId, outfitId, colorHex };

  const callbacksRef = useRef({
    onSendPlayerState,
    onSendObjectTelemetry,
    onCheckpointReached,
    onFailureTriggered,
    onVictoryTriggered,
    onLocalHudUpdate,
  });
  callbacksRef.current = {
    onSendPlayerState,
    onSendObjectTelemetry,
    onCheckpointReached,
    onFailureTriggered,
    onVictoryTriggered,
    onLocalHudUpdate,
  };

  // Physics state kept across frames
  const physicsRef = useRef({
    x: -1.4,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: -0.08,
    isGrounded: true,
    coyoteTimer: 0,
    footstepTimer: 0,
    bobPhase: 0,
    shakeMag: 0,
    hitstopTimer: 0,
    localWaterLevel: 100,
    localEggsRemaining: 3,
    localIntegrity: 100,
    eggLossCooldown: 0,
    lastTelemetrySentAt: 0,
    lastNetSentAt: 0,
    lastHudSentAt: 0,
    lobbyTurnAngle: 0.35,
    lobbyDragging: false,
    lobbyLastX: 0,
    lastCheckpointTriggered: 0,
    victorySent: false,
    failSent: false,
  });

  // Handle respawn signal from parent (after failure -> reset at latest checkpoint)
  useEffect(() => {
    if (respawnSignal === 0) return;
    const snap = roomRef.current;
    const cpIdx = snap?.currentCheckpoint ?? 0;
    const cp = CHECKPOINT_POSITIONS[cpIdx] || CHECKPOINT_POSITIONS[0];
    const isHost = snap?.players[localUidRef.current]?.role !== 'guest';
    const p = physicsRef.current;
    p.x = cp.x + (isHost ? -1.4 : 1.4);
    p.y = cp.y;
    p.z = cp.z;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.yaw = 0;
    p.pitch = -0.06;
    p.isGrounded = true;
    p.localWaterLevel = 100;
    p.localEggsRemaining = 3;
    p.localIntegrity = 100;
    p.failSent = false;
    p.victorySent = false;
    p.lastCheckpointTriggered = cpIdx;
  }, [respawnSignal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, settingsRef.current.graphics === 'high' ? 2 : 1.35),
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl && settingsRef.current.graphics !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      72,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      450,
    );
    scene.add(camera);

    // 3-Point Sunlit Outdoor Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f6212, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    sunLight.position.set(28, 46, 22);
    sunLight.castShadow = !isSoftwareGl && settingsRef.current.graphics !== 'low';
    sunLight.shadow.mapSize.width = settingsRef.current.graphics === 'high' ? 2048 : 1024;
    sunLight.shadow.mapSize.height = settingsRef.current.graphics === 'high' ? 2048 : 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 160;
    const d = 55;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.42);
    rimLight.position.set(-20, 18, -80);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let builtTheme = courseThemeRef.current;
    let builtQuality = settingsRef.current.graphics;
    let world: CourseWorldRuntime = buildObstacleCourseWorld(scene, builtQuality, builtTheme, maxAniso);

    // First-person arms attached to camera
    let fpArmsColor = charConfigRef.current.colorHex;
    let fpArms = buildFirstPersonArms(fpArmsColor);
    fpArms.visible = false;
    camera.add(fpArms);

    // Lobby preview character rig
    let lobbyCharSig = `${charConfigRef.current.characterId}|${charConfigRef.current.outfitId}|${charConfigRef.current.colorHex}`;
    let lobbyChar: CharacterRig = buildCharacterModel(
      charConfigRef.current.characterId,
      charConfigRef.current.outfitId,
      charConfigRef.current.colorHex,
    );
    lobbyChar.group.position.set(0, 0, -2);
    scene.add(lobbyChar.group);

    // Remote partner rig
    let partnerSig = '';
    let partnerRig: CharacterRig | null = null;

    // Carried object visual
    let carriedType: CarryObjectType = selectedObjectRef.current;
    let carriedVisual: CarriedObjectVisual = buildCarriedObject(carriedType);
    carriedVisual.group.visible = false;
    scene.add(carriedVisual.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Keyboard & PointerLock bindings for desktop gameplay
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'play') return;
      keys[e.code] = true;
      if (e.code === 'Space') {
        inputRef.current.jumpBufferedUntil = performance.now() + 140;
      }
      if (e.code === 'KeyE' || e.code === 'ShiftLeft') {
        inputRef.current.isBracing = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
      if (e.code === 'KeyE' || e.code === 'ShiftLeft') {
        inputRef.current.isBracing = false;
      }
    };
    const onBlur = () => {
      Object.keys(keys).forEach((k) => (keys[k] = false));
      inputRef.current.isBracing = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (modeRef.current === 'play' && document.pointerLockElement === renderer.domElement) {
        const sens = 0.0022 * settingsRef.current.cameraSensitivity;
        physicsRef.current.yaw -= e.movementX * sens;
        physicsRef.current.pitch = THREE.MathUtils.clamp(
          physicsRef.current.pitch - e.movementY * sens,
          -1.15,
          1.1,
        );
      } else if (modeRef.current === 'lobby' && physicsRef.current.lobbyDragging) {
        const dx = e.clientX - physicsRef.current.lobbyLastX;
        physicsRef.current.lobbyLastX = e.clientX;
        physicsRef.current.lobbyTurnAngle += dx * 0.01;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      soundEngine.unlock();
      if (modeRef.current === 'lobby') {
        physicsRef.current.lobbyDragging = true;
        physicsRef.current.lobbyLastX = e.clientX;
      } else if (modeRef.current === 'play' && !('ontouchstart' in window)) {
        if (document.pointerLockElement !== renderer.domElement) {
          renderer.domElement.requestPointerLock?.();
        }
      }
    };
    const onPointerUp = () => {
      physicsRef.current.lobbyDragging = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const p = physicsRef.current;

      // Rebuild course if theme or graphics quality changed
      if (
        courseThemeRef.current !== builtTheme ||
        settingsRef.current.graphics !== builtQuality
      ) {
        builtTheme = courseThemeRef.current;
        builtQuality = settingsRef.current.graphics;
        scene.remove(world.root);
        world.disposables.forEach((d) => d.dispose());
        world = buildObstacleCourseWorld(scene, builtQuality, builtTheme, maxAniso);
        renderer.shadowMap.enabled = !isSoftwareGl && builtQuality !== 'low';
      }

      // Update lobby character if customization changed
      const curCharSig = `${charConfigRef.current.characterId}|${charConfigRef.current.outfitId}|${charConfigRef.current.colorHex}`;
      if (curCharSig !== lobbyCharSig) {
        lobbyCharSig = curCharSig;
        scene.remove(lobbyChar.group);
        lobbyChar = buildCharacterModel(
          charConfigRef.current.characterId,
          charConfigRef.current.outfitId,
          charConfigRef.current.colorHex,
        );
        lobbyChar.group.position.set(0, 0, -2);
        scene.add(lobbyChar.group);
      }

      if (charConfigRef.current.colorHex !== fpArmsColor) {
        fpArmsColor = charConfigRef.current.colorHex;
        camera.remove(fpArms);
        fpArms = buildFirstPersonArms(fpArmsColor);
        camera.add(fpArms);
      }

      // Animate moving platforms & hazards
      world.movingPlatforms.forEach((mp) => {
        mp.currentX = mp.baseX + Math.sin(elapsed * mp.speed + mp.phase) * mp.ampX;
        mp.mesh.position.x = mp.currentX;
      });
      world.hazards.forEach((h) => {
        if (h.type === 'windmill') {
          h.pivot.rotation.z = elapsed * h.speed + h.phase;
        } else {
          h.pivot.rotation.z = Math.sin(elapsed * h.speed + h.phase) * 0.95;
        }
      });
      world.checkpointMeshes.forEach((cm, idx) => {
        const lantern = cm.children[3];
        if (lantern) {
          lantern.rotation.y = elapsed * 1.4 + idx;
          lantern.position.y = 3.55 + Math.sin(elapsed * 2.5 + idx) * 0.12;
        }
      });

      // Animate waterfall mist & ambient pollen
      const wfAttr = world.waterfallParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < wfAttr.count; i++) {
        let wy = wfAttr.getY(i) - dt * 7.5;
        if (wy < -5.5) wy = 13;
        wfAttr.setY(i, wy);
      }
      wfAttr.needsUpdate = true;

      const polAttr = world.pollenParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < polAttr.count; i++) {
        const py = polAttr.getY(i) + Math.sin(elapsed * 1.2 + i) * dt * 0.25;
        polAttr.setY(i, py);
      }
      polAttr.needsUpdate = true;

      const curMode = modeRef.current;

      if (curMode === 'intro') {
        lobbyChar.group.visible = false;
        fpArms.visible = false;
        carriedVisual.group.visible = false;
        if (partnerRig) partnerRig.group.visible = false;

        // Cinematic valley flyover camera pan
        const sweepZ = -45 - Math.sin(elapsed * 0.18) * 55;
        const sweepX = Math.sin(elapsed * 0.22) * 14;
        camera.position.set(sweepX, 8.5 + Math.cos(elapsed * 0.3) * 1.8, sweepZ);
        camera.lookAt(0, 1.5, sweepZ - 28);
      } else if (curMode === 'lobby') {
        lobbyChar.group.visible = true;
        fpArms.visible = false;
        carriedVisual.group.visible = false;
        if (partnerRig) partnerRig.group.visible = false;

        // Idle animation & rotation
        lobbyChar.group.rotation.y = p.lobbyTurnAngle;
        lobbyChar.leftArm.rotation.x = Math.sin(elapsed * 2) * 0.08;
        lobbyChar.rightArm.rotation.x = -Math.sin(elapsed * 2) * 0.08;
        lobbyChar.head.rotation.y = Math.sin(elapsed * 1.1) * 0.12;
        lobbyChar.group.position.y = Math.sin(elapsed * 2.4) * 0.02;

        camera.position.set(0.65, 1.45, 0.9);
        camera.lookAt(0, 1.1, -2.0);
        sunLight.position.set(14, 24, 14);
        sunLight.target.position.set(0, 0, -2);
      } else if (curMode === 'play') {
        lobbyChar.group.visible = false;
        fpArms.visible = true;
        carriedVisual.group.visible = true;

        const snap = roomRef.current;
        const objType = snap?.selectedObject || selectedObjectRef.current;
        if (objType !== carriedType) {
          carriedType = objType;
          scene.remove(carriedVisual.group);
          carriedVisual = buildCarriedObject(carriedType);
          scene.add(carriedVisual.group);
        }

        const spec = CARRY_OBJECTS[carriedType];
        const isPlaying = snap?.status === 'playing';

        if (p.hitstopTimer > 0) {
          p.hitstopTimer -= dt;
        } else if (isPlaying) {
          // Consume mobile touch look deltas
          const touchSens = 0.0042 * settingsRef.current.cameraSensitivity;
          if (inputRef.current.lookDeltaX !== 0 || inputRef.current.lookDeltaY !== 0) {
            p.yaw -= inputRef.current.lookDeltaX * touchSens;
            p.pitch = THREE.MathUtils.clamp(
              p.pitch - inputRef.current.lookDeltaY * touchSens,
              -1.15,
              1.1,
            );
            inputRef.current.lookDeltaX = 0;
            inputRef.current.lookDeltaY = 0;
          }

          // Combine keyboard + virtual joystick inputs
          let moveX = inputRef.current.moveX;
          let moveY = inputRef.current.moveY;
          if (keys['KeyW'] || keys['ArrowUp']) moveY += 1;
          if (keys['KeyS'] || keys['ArrowDown']) moveY -= 1;
          if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;
          if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;

          const mag = Math.hypot(moveX, moveY);
          if (mag > 1) {
            moveX /= mag;
            moveY /= mag;
          }

          // Compute ground beneath player
          const ground = sampleGroundAt(world, p.x, p.z);
          const braceScale = inputRef.current.isBracing ? 0.58 : 1.0;
          const speedLimit = (5.4 / Math.sqrt(spec.massFactor)) * braceScale;

          _forward.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
          _right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

          const targetVx = (_forward.x * moveY + _right.x * moveX) * speedLimit;
          const targetVz = (_forward.z * moveY + _right.z * moveX) * speedLimit;

          const slip = ground?.surfaceType === 'slippery'
            ? 2.2 * (1 - (snap?.courseModifier.slipperiness || 0.2) * 0.5)
            : 11.5;

          p.vx += (targetVx - p.vx) * Math.min(1, dt * slip);
          p.vz += (targetVz - p.vz) * Math.min(1, dt * slip);

          // Apply wind lateral drift on bridges
          const wind = (snap?.courseModifier.windStrength || 0.15) * Math.sin(elapsed * 1.4);
          p.vx += wind * dt * 1.1;

          // Coyote time & buffered Jump
          if (p.isGrounded) {
            p.coyoteTimer = 0.12;
          } else {
            p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
          }

          if (performance.now() < inputRef.current.jumpBufferedUntil && p.coyoteTimer > 0) {
            p.vy = 6.9 / Math.pow(spec.massFactor, 0.25);
            p.isGrounded = false;
            p.coyoteTimer = 0;
            inputRef.current.jumpBufferedUntil = 0;
            soundEngine.jump();
          }

          p.vy -= 18.5 * dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.y += p.vy * dt;

          // Ground landing & platform follow
          const newGround = sampleGroundAt(world, p.x, p.z);
          if (newGround && p.y <= newGround.y && p.vy <= 0 && p.y >= newGround.y - 1.5) {
            if (!p.isGrounded && p.vy < -8.5) {
              // Heavy landing shock!
              p.shakeMag = 0.08;
              soundEngine.impact();
              if (spec.hasWater) p.localWaterLevel = Math.max(0, p.localWaterLevel - 16);
              if (spec.hasEggs && p.eggLossCooldown <= 0) {
                p.localEggsRemaining = Math.max(0, p.localEggsRemaining - 1);
                p.eggLossCooldown = 1.4;
              }
            }
            p.y = newGround.y;
            p.vy = 0;
            p.isGrounded = true;
          } else {
            p.isGrounded = false;
          }

          // Static boulder collisions & rotating hazard hits
          const hitBoulder = resolveStaticCollisions(world, p, 0.55 + spec.spanWidth * 0.2);
          if (hitBoulder) {
            p.shakeMag = 0.09;
            p.hitstopTimer = 0.04;
            soundEngine.impact();
            p.localIntegrity = Math.max(0, p.localIntegrity - 28);
            if (carriedType === 'flower_pot' || carriedType === 'fish_tank') {
              p.localIntegrity = 0;
            }
          }

          const hitHazard = checkHazardHit(world, p.x, p.y, p.z, elapsed);
          if (hitHazard && !p.failSent) {
            p.shakeMag = 0.14;
            p.hitstopTimer = 0.05;
            p.failSent = true;
            soundEngine.fail();
            callbacksRef.current.onFailureTriggered(`Smacked by ${hitHazard}!`);
          }

          // Canyon fall check
          if (p.y < -4.2 && !p.failSent) {
            p.failSent = true;
            soundEngine.fail();
            callbacksRef.current.onFailureTriggered('Fell into the river canyon!');
          }

          // Footstep audio & first-person bobbing
          const horizSpeed = Math.hypot(p.vx, p.vz);
          if (p.isGrounded && horizSpeed > 0.6) {
            p.bobPhase += dt * horizSpeed * 2.2;
            p.footstepTimer -= dt;
            if (p.footstepTimer <= 0) {
              soundEngine.footstep(newGround?.surfaceType === 'wood' ? 'wood' : 'grass');
              p.footstepTimer = Math.max(0.24, 0.52 - horizSpeed * 0.04);
            }
          }

          // Object-specific water slosh & egg tilt degradation
          p.eggLossCooldown = Math.max(0, p.eggLossCooldown - dt);
          const objNet = snap?.objectState;
          const tiltRad = objNet ? Math.hypot(objNet.tiltX, objNet.tiltZ) : 0;
          const tiltDeg = THREE.MathUtils.radToDeg(tiltRad);

          if (spec.hasWater) {
            const sloshIntensity = (tiltDeg / spec.maxTiltDeg) + (horizSpeed > 4.2 ? 0.45 : 0);
            if (sloshIntensity > 0.65 && !inputRef.current.isBracing) {
              p.localWaterLevel = Math.max(0, p.localWaterLevel - dt * 11.5 * sloshIntensity);
              if (Math.random() < dt * 2.5) soundEngine.waterSlosh();
            }
            if ((objNet?.waterLevel ?? p.localWaterLevel) < 25 && !p.failSent) {
              p.failSent = true;
              soundEngine.fail();
              callbacksRef.current.onFailureTriggered('Spilled too much water!');
            }
          }

          if (spec.hasEggs) {
            if (tiltDeg > spec.maxTiltDeg * 0.85 && p.eggLossCooldown <= 0) {
              p.localEggsRemaining = Math.max(0, p.localEggsRemaining - 1);
              p.eggLossCooldown = 1.6;
              p.shakeMag = 0.08;
              soundEngine.impact();
            }
            if ((objNet?.eggsRemaining ?? p.localEggsRemaining) <= 0 && !p.failSent) {
              p.failSent = true;
              soundEngine.fail();
              callbacksRef.current.onFailureTriggered('All 3 eggs rolled out of the nest!');
            }
          }

          if (tiltDeg > spec.maxTiltDeg && !spec.hasWater && !spec.hasEggs) {
            p.localIntegrity = Math.max(0, p.localIntegrity - dt * 42);
          }

          if ((objNet?.integrity ?? p.localIntegrity) <= 0 && !p.failSent) {
            p.failSent = true;
            soundEngine.fail();
            callbacksRef.current.onFailureTriggered(`${spec.name} shattered!`);
          }

          // Checkpoints & Finish triggers
          for (let ci = 1; ci <= 3; ci++) {
            const cp = CHECKPOINT_POSITIONS[ci];
            if (p.z <= cp.z + 1.5 && p.lastCheckpointTriggered < ci) {
              p.lastCheckpointTriggered = ci;
              soundEngine.checkpoint();
              callbacksRef.current.onCheckpointReached(ci);
            }
          }
          if (p.z <= CHECKPOINT_POSITIONS[4].z + 2.0 && !p.victorySent) {
            p.victorySent = true;
            soundEngine.victory();
            callbacksRef.current.onVictoryTriggered();
          }

          // Sync player & object telemetry over WebSocket (~25Hz)
          const nowMs = performance.now();
          if (nowMs - p.lastNetSentAt > 40) {
            p.lastNetSentAt = nowMs;
            callbacksRef.current.onSendPlayerState({
              x: p.x,
              y: p.y,
              z: p.z,
              yaw: p.yaw,
              pitch: p.pitch,
              speed: horizSpeed,
              isGrounded: p.isGrounded,
              isBracing: inputRef.current.isBracing,
            });
          }
          if (nowMs - p.lastTelemetrySentAt > 120) {
            p.lastTelemetrySentAt = nowMs;
            callbacksRef.current.onSendObjectTelemetry({
              waterLevel: p.localWaterLevel,
              eggsRemaining: p.localEggsRemaining,
              integrity: p.localIntegrity,
            });
          }
        }

        // First-Person Camera position + head-bob + impact shake
        p.shakeMag = Math.max(0, p.shakeMag - dt * 0.45);
        const bobY = Math.sin(p.bobPhase) * 0.045;
        const bobX = Math.cos(p.bobPhase * 0.5) * 0.025;
        const shakeX = (Math.random() - 0.5) * p.shakeMag;
        const shakeY = (Math.random() - 0.5) * p.shakeMag;

        camera.position.set(p.x + bobX + shakeX, p.y + 1.62 + bobY + shakeY, p.z);
        _euler.set(p.pitch, p.yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(_euler);

        // Animate first-person arms grip & brace posture
        fpArms.position.y = Math.sin(p.bobPhase) * 0.018 - (inputRef.current.isBracing ? 0.05 : 0);
        fpArms.position.z = inputRef.current.isBracing ? 0.08 : 0;

        // Keep sun shadow frustum centered near player
        sunLight.position.set(p.x + 28, p.y + 46, p.z + 22);
        sunLight.target.position.set(p.x, p.y, p.z - 15);

        // Render & animate remote partner character
        const players = snap ? Object.values(snap.players) : [];
        const partner = players.find((pl) => pl.uid !== localUidRef.current);
        if (partner) {
          const pSig = `${partner.uid}|${partner.characterId}|${partner.outfitId}|${partner.colorHex}`;
          if (pSig !== partnerSig) {
            partnerSig = pSig;
            if (partnerRig) scene.remove(partnerRig.group);
            partnerRig = buildCharacterModel(
              partner.characterId,
              partner.outfitId,
              partner.colorHex,
            );
            scene.add(partnerRig.group);
          }
          if (partnerRig) {
            partnerRig.group.visible = true;
            partnerRig.group.position.x = THREE.MathUtils.damp(partnerRig.group.position.x, partner.x, 12, dt);
            partnerRig.group.position.y = THREE.MathUtils.damp(partnerRig.group.position.y, partner.y, 12, dt);
            partnerRig.group.position.z = THREE.MathUtils.damp(partnerRig.group.position.z, partner.z, 12, dt);
            partnerRig.group.rotation.y = partner.yaw + Math.PI;
            // Carrying pose: both arms raised forward holding the object!
            partnerRig.leftArm.rotation.x = -1.15;
            partnerRig.rightArm.rotation.x = -1.15;
            const walkSwing = partner.speed > 0.3 ? Math.sin(elapsed * 9) * 0.45 : 0;
            partnerRig.leftLeg.rotation.x = walkSwing;
            partnerRig.rightLeg.rotation.x = -walkSwing;
          }
        } else if (partnerRig) {
          partnerRig.group.visible = false;
        }

        // Update shared carried 3D object transform & internal animated details
        const objNet = snap?.objectState;
        if (objNet) {
          carriedVisual.group.position.x = THREE.MathUtils.damp(carriedVisual.group.position.x, objNet.x, 14, dt);
          carriedVisual.group.position.y = THREE.MathUtils.damp(carriedVisual.group.position.y, objNet.y, 14, dt);
          carriedVisual.group.position.z = THREE.MathUtils.damp(carriedVisual.group.position.z, objNet.z, 14, dt);
          carriedVisual.group.rotation.set(objNet.tiltX, -objNet.yaw, objNet.tiltZ);

          if (carriedVisual.waterMesh) {
            const lvl = Math.max(0.08, (objNet.waterLevel ?? p.localWaterLevel) / 100);
            carriedVisual.waterMesh.scale.y = lvl;
            carriedVisual.waterMesh.rotation.z = Math.sin(objNet.sloshPhase) * 0.14;
            carriedVisual.waterMesh.rotation.x = Math.cos(objNet.sloshPhase * 1.3) * 0.12;
          }
          if (carriedVisual.waterSurface) {
            const lvl = Math.max(0.08, (objNet.waterLevel ?? p.localWaterLevel) / 100);
            carriedVisual.waterSurface.position.y = -0.26 + lvl * 0.51;
            carriedVisual.waterSurface.rotation.y = Math.sin(objNet.sloshPhase) * 0.25;
          }
          if (carriedVisual.eggs) {
            const rem = Math.min(objNet.eggsRemaining, p.localEggsRemaining);
            carriedVisual.eggs.forEach((egg, idx) => {
              egg.visible = idx < rem;
              egg.rotation.z = Math.sin(elapsed * 5 + idx) * (Math.abs(objNet.tiltZ) * 0.9);
            });
          }
          if (carriedVisual.tiers) {
            carriedVisual.tiers.forEach((tier, idx) => {
              tier.position.x = Math.sin(elapsed * 6 + idx) * (Math.abs(objNet.tiltZ) * 0.08 * (idx + 1));
            });
          }
          if (carriedVisual.fish) {
            carriedVisual.fish.forEach((f, idx) => {
              f.position.x = Math.sin(elapsed * 2.2 + idx * 3) * 0.22;
              f.rotation.y = Math.cos(elapsed * 2.2 + idx * 3) > 0 ? 0 : Math.PI;
            });
          }
        }

        // Throttled HUD metrics dispatch (~10Hz)
        if (performance.now() - p.lastHudSentAt > 100) {
          p.lastHudSentAt = performance.now();
          const tiltDeg = objNet
            ? Math.round(THREE.MathUtils.radToDeg(Math.hypot(objNet.tiltX, objNet.tiltZ)))
            : 0;
          const distPartner = partner
            ? Math.hypot(partner.x - p.x, partner.z - p.z)
            : 0;
          const gInfo = sampleGroundAt(world, p.x, p.z);
          callbacksRef.current.onLocalHudUpdate({
            speed: Math.round(Math.hypot(p.vx, p.vz) * 10) / 10,
            tiltDeg,
            waterLevel: Math.round(Math.min(objNet?.waterLevel ?? 100, p.localWaterLevel)),
            eggsRemaining: Math.min(objNet?.eggsRemaining ?? 3, p.localEggsRemaining),
            integrity: Math.round(Math.min(objNet?.integrity ?? 100, p.localIntegrity)),
            distanceToPartner: Math.round(distPartner * 10) / 10,
            surfaceType: gInfo?.surfaceType || 'air',
          });
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      world.disposables.forEach((d) => d.dispose());
      envTex.dispose();
      renderer.dispose();
    };
  }, [inputRef]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden select-none"
      aria-label="TWO TOGETHER 3D Viewport"
    />
  );
};
