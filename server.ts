import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  CARRY_OBJECTS,
  CHECKPOINT_POSITIONS,
  COURSE_THEMES,
  CarryObjectType,
  CharacterId,
  CourseModifier,
  CourseThemeId,
  OutfitId,
  PlayerNetState,
  RoomNetSnapshot,
} from './src/shared/gameTypes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ServerRoom {
  snapshot: RoomNetSnapshot;
  sockets: Map<string, WebSocket>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  lastTickMs: number;
}

const rooms = new Map<string, ServerRoom>();

function pickRandomObject(): CarryObjectType {
  const keys = Object.keys(CARRY_OBJECTS) as CarryObjectType[];
  return keys[Math.floor(Math.random() * keys.length)];
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createInitialObjectState(objectType: CarryObjectType, cpIndex: number): RoomNetSnapshot['objectState'] {
  const cp = CHECKPOINT_POSITIONS[cpIndex] || CHECKPOINT_POSITIONS[0];
  return {
    objectType,
    x: cp.x,
    y: cp.y + 1.15,
    z: cp.z,
    tiltX: 0,
    tiltZ: 0,
    yaw: 0,
    integrity: 100,
    waterLevel: 100,
    eggsRemaining: 3,
    sloshPhase: 0,
    failedReason: null,
  };
}

function broadcastRoom(room: ServerRoom, type: string, payload: unknown) {
  const msg = JSON.stringify({ type, payload });
  for (const ws of room.sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function getOrCreateServerRoom(
  roomId: string,
  courseTheme: CourseThemeId = 'sunlit_valley',
  selectedObject?: CarryObjectType,
  courseModifier?: CourseModifier,
): ServerRoom {
  let room = rooms.get(roomId);
  if (!room) {
    const obj = selectedObject || pickRandomObject();
    const mod = courseModifier || COURSE_THEMES[courseTheme] || COURSE_THEMES.sunlit_valley;
    room = {
      snapshot: {
        roomId,
        status: 'waiting',
        courseTheme,
        courseModifier: mod,
        selectedObject: obj,
        currentCheckpoint: 0,
        botPartnerEnabled: false,
        elapsedSec: 0,
        attempts: 1,
        players: {},
        objectState: createInitialObjectState(obj, 0),
      },
      sockets: new Map(),
      disconnectTimers: new Map(),
      lastTickMs: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

function respawnAtCheckpoint(room: ServerRoom, cpIndex: number) {
  const cp = CHECKPOINT_POSITIONS[cpIndex] || CHECKPOINT_POSITIONS[0];
  const players = Object.values(room.snapshot.players);
  players.forEach((p, idx) => {
    const sideOffset = idx === 0 ? -1.4 : 1.4;
    p.x = cp.x + sideOffset;
    p.y = cp.y;
    p.z = cp.z;
    p.speed = 0;
  });
  room.snapshot.objectState = createInitialObjectState(room.snapshot.selectedObject, cpIndex);
  room.snapshot.status = 'playing';
}

// 30Hz authoritative room sync & bot partner kinematics
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    const dt = Math.min((now - room.lastTickMs) / 1000, 0.1);
    room.lastTickMs = now;

    if (room.sockets.size === 0 && Object.keys(room.snapshot.players).length === 0) {
      rooms.delete(roomId);
      continue;
    }

    if (room.snapshot.status === 'playing') {
      room.snapshot.elapsedSec += dt;

      // Update optional solo-practice bot partner if enabled and only 1 human present
      const humanPlayers = Object.values(room.snapshot.players).filter((p) => !p.uid.startsWith('bot-'));
      const botPlayer = Object.values(room.snapshot.players).find((p) => p.uid.startsWith('bot-'));
      if (room.snapshot.botPartnerEnabled && humanPlayers.length === 1 && botPlayer) {
        const leader = humanPlayers[0];
        const targetX = leader.x + 2.55;
        const targetZ = leader.z;
        const targetY = leader.y;
        const lerp = Math.min(1, dt * 5.5);
        const dx = targetX - botPlayer.x;
        const dz = targetZ - botPlayer.z;
        botPlayer.x += dx * lerp;
        botPlayer.z += dz * lerp;
        botPlayer.y += (targetY - botPlayer.y) * lerp;
        botPlayer.yaw = leader.yaw;
        botPlayer.speed = Math.hypot(dx, dz) * 3.0;
        botPlayer.isGrounded = leader.isGrounded;
      }

      // Compute authoritative carried object midpoint & tilt between the two players
      const activePlayers = Object.values(room.snapshot.players);
      if (activePlayers.length >= 2) {
        const p1 = activePlayers[0];
        const p2 = activePlayers[1];
        const spec = CARRY_OBJECTS[room.snapshot.selectedObject];

        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5 + 1.15;
        const midZ = (p1.z + p2.z) * 0.5;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const dist = Math.hypot(dx, dz);

        const targetYaw = Math.atan2(dz, dx);
        const heightDiffTilt = Math.atan2(dy, Math.max(dist, 0.8));
        const speedDiff = (p1.speed - p2.speed) * 0.05 * spec.tiltSensitivity;
        const stretchWarning = Math.max(0, dist - 3.6) * 0.28;
        const windGust =
          Math.sin(room.snapshot.elapsedSec * 1.4) *
          room.snapshot.courseModifier.windStrength *
          0.18;

        const obj = room.snapshot.objectState;
        obj.x = midX;
        obj.y = midY;
        obj.z = midZ;
        obj.yaw = targetYaw;
        obj.tiltZ += (heightDiffTilt + windGust - obj.tiltZ) * Math.min(1, dt * 8);
        obj.tiltX += (speedDiff + stretchWarning - obj.tiltX) * Math.min(1, dt * 8);
        obj.sloshPhase += dt * (2.5 + (p1.speed + p2.speed) * 0.5);

        // If players pull too far apart (> 4.8m), stress integrity
        if (dist > 4.8) {
          obj.integrity = Math.max(0, obj.integrity - dt * 32);
          if (obj.integrity <= 0 && room.snapshot.status === 'playing') {
            room.snapshot.status = 'failed';
            obj.failedReason = 'You stretched too far apart and dropped the ' + spec.name + '!';
            broadcastRoom(room, 'game:failed', {
              reason: obj.failedReason,
              checkpoint: room.snapshot.currentCheckpoint,
            });
          }
        }
      }
    }

    if (room.sockets.size > 0) {
      broadcastRoom(room, 'room:state', room.snapshot);
    }
  }
}, 33);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  // Public waiting rooms fallback / WebSocket matchmaking helper
  app.get('/api/rooms/open', (_req, res) => {
    const open: { roomId: string; courseTheme: CourseThemeId; playerCount: number }[] = [];
    for (const [id, room] of rooms.entries()) {
      const count = Object.keys(room.snapshot.players).length;
      if (room.snapshot.status === 'waiting' && count === 1 && !room.snapshot.botPartnerEnabled) {
        open.push({ roomId: id, courseTheme: room.snapshot.courseTheme, playerCount: count });
      }
    }
    res.json({ openRooms: open });
  });

  // Gemini High Thinking Co-op Strategy Coach (uses gemini-4-hydrogen with ThinkingLevel.HIGH; no maxOutputTokens)
  app.post('/api/ai/coach', async (req, res) => {
    try {
      const { objectType, courseTheme, currentCheckpoint, attempts, failureReason } = req.body as {
        objectType?: CarryObjectType;
        courseTheme?: CourseThemeId;
        currentCheckpoint?: number;
        attempts?: number;
        failureReason?: string;
      };

      const spec = CARRY_OBJECTS[objectType || 'water_glass'] || CARRY_OBJECTS.water_glass;
      const theme = COURSE_THEMES[courseTheme || 'sunlit_valley'] || COURSE_THEMES.sunlit_valley;
      const cp = CHECKPOINT_POSITIONS[currentCheckpoint ?? 0] || CHECKPOINT_POSITIONS[0];

      const prompt = [
        `You are the Co-op Physics Tactician for the 2-player first-person 3D game "TWO TOGETHER: DUO CHAOS".`,
        `Current Carried Object: ${spec.name} (${spec.challengeRule}). Mass factor: ${spec.massFactor}, Tilt limit: ${spec.maxTiltDeg} degrees, Width span: ${spec.spanWidth}m.`,
        `Course Environment: ${theme.title} (Wind: ${Math.round(theme.windStrength * 100)}%, Slipperiness: ${Math.round(theme.slipperiness * 100)}%).`,
        `Current Progress: ${cp.label} (Attempt #${attempts || 1}).`,
        failureReason ? `Latest Failure Cause: "${failureReason}".` : '',
        `Provide a crisp, funny yet deeply practical 3-step co-op physics gameplan for two players holding opposite sides of this object across narrow bridges, moving platforms, and windmill sweepers. Keep it under 140 words.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({
        advice: response.text || 'Match your partner stride, hold Brace on narrow planks, and call out jumps together!',
        model: 'gemini-4-hydrogen (High Thinking)',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('AI Coach error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  // Gemini Search + Maps Grounded Trail Course Explorer (gemini-4-hydrogen)
  app.post('/api/ai/trail-inspire', async (req, res) => {
    try {
      const { query, lat, lng } = req.body as {
        query?: string;
        lat?: number;
        lng?: number;
      };

      const searchTerm = (query || 'scenic suspension bridge hiking trail').trim().slice(0, 140);

      // 1) Google Maps Grounding call (NO responseMimeType/responseSchema allowed; cannot combine with googleSearch)
      const mapsConfig: Record<string, unknown> = {
        tools: [{ googleMaps: {} }],
      };
      if (typeof lat === 'number' && typeof lng === 'number') {
        mapsConfig.toolConfig = {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng },
          },
        };
      }

      const [mapsRes, searchRes] = await Promise.all([
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Find 2 real-world scenic outdoor trails, footbridges, or mountain canyons matching "${searchTerm}". Describe their terrain, bridges, wind/slope feel, and why two people carrying a fragile object across them would face hilarious challenges.`,
          config: mapsConfig,
        }),
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Give a short 2-sentence factual highlight about weather, elevation, or trail conditions for outdoor bridges/trails related to "${searchTerm}".`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
      ]);

      const mapsChunks = mapsRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const searchChunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const mapLinks: { title: string; uri: string }[] = [];
      for (const ch of mapsChunks as Array<{ maps?: { title?: string; uri?: string } }>) {
        if (ch.maps?.uri) {
          mapLinks.push({
            title: ch.maps.title || 'View on Google Maps',
            uri: ch.maps.uri,
          });
        }
      }

      const webLinks: { title: string; uri: string }[] = [];
      for (const ch of searchChunks as Array<{ web?: { title?: string; uri?: string } }>) {
        if (ch.web?.uri) {
          webLinks.push({
            title: ch.web.title || 'Web Source',
            uri: ch.web.uri,
          });
        }
      }

      const combinedText = `${mapsRes.text || ''}\n\n${searchRes.text || ''}`.toLowerCase();
      let suggestedTheme: CourseThemeId = 'sunlit_valley';
      if (/wind|ridge|alpine|suspension|peak|mountain/.test(combinedText)) {
        suggestedTheme = 'alpine_gorge';
      } else if (/river|waterfall|creek|rapids|wet|stream/.test(combinedText)) {
        suggestedTheme = 'river_rapids';
      }

      const baseMod = COURSE_THEMES[suggestedTheme];
      const preset: CourseModifier = {
        ...baseMod,
        title: mapLinks[0]?.title ? `${mapLinks[0].title} Inspired Course` : `${baseMod.title} (${searchTerm})`,
        realWorldRef: mapLinks[0]?.title || searchTerm,
      };

      res.json({
        summary: mapsRes.text || 'Scenic trail inspiration ready.',
        conditions: searchRes.text || '',
        mapLinks,
        webLinks,
        suggestedPreset: preset,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Trail inspire error:', msg);
      res.status(500).json({ error: msg });
    }
  });

  const httpServer = createHttpServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let joinedRoomId: string | null = null;
    let joinedUid: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type: string; payload?: any };
        const p = msg.payload || {};

        if (msg.type === 'room:join') {
          const roomId = String(p.roomId || generateRoomCode()).toUpperCase().slice(0, 6);
          const uid = String(p.uid || `anon-${Math.random().toString(36).slice(2, 8)}`);
          const username = String(p.username || 'Explorer').slice(0, 24);
          const characterId = (p.characterId || 'ranger') as CharacterId;
          const outfitId = (p.outfitId || 'trail') as OutfitId;
          const colorHex = String(p.colorHex || '#1E5631');
          const courseTheme = (p.courseTheme || 'sunlit_valley') as CourseThemeId;
          const selectedObject = p.selectedObject as CarryObjectType | undefined;
          const courseModifier = p.courseModifier as CourseModifier | undefined;

          const room = getOrCreateServerRoom(roomId, courseTheme, selectedObject, courseModifier);

          // Cancel pending disconnect timer if reconnecting
          const existingTimer = room.disconnectTimers.get(uid);
          if (existingTimer) {
            clearTimeout(existingTimer);
            room.disconnectTimers.delete(uid);
          }

          // Enforce 2-player maximum unless reconnecting
          const currentHumans = Object.values(room.snapshot.players).filter((pl) => !pl.uid.startsWith('bot-'));
          if (!room.snapshot.players[uid] && currentHumans.length >= 2) {
            ws.send(JSON.stringify({ type: 'room:error', payload: { message: 'Room is already full (2/2 players).' } }));
            return;
          }

          joinedRoomId = roomId;
          joinedUid = uid;
          room.sockets.set(uid, ws);

          const isHost = currentHumans.length === 0 || room.snapshot.players[uid]?.role === 'host';
          const cp = CHECKPOINT_POSITIONS[room.snapshot.currentCheckpoint] || CHECKPOINT_POSITIONS[0];
          const existingPlayer = room.snapshot.players[uid];

          const playerState: PlayerNetState = existingPlayer
            ? {
                ...existingPlayer,
                username,
                characterId,
                outfitId,
                colorHex,
                connected: true,
              }
            : {
                uid,
                username,
                characterId,
                outfitId,
                colorHex,
                role: isHost ? 'host' : 'guest',
                x: cp.x + (isHost ? -1.4 : 1.4),
                y: cp.y,
                z: cp.z,
                yaw: 0,
                pitch: 0,
                speed: 0,
                isGrounded: true,
                isBracing: false,
                ready: true,
                connected: true,
              };

          room.snapshot.players[uid] = playerState;

          // Remove solo bot if a real 2nd player joins
          if (!isHost && room.snapshot.botPartnerEnabled) {
            for (const key of Object.keys(room.snapshot.players)) {
              if (key.startsWith('bot-')) delete room.snapshot.players[key];
            }
            room.snapshot.botPartnerEnabled = false;
          }

          ws.send(JSON.stringify({ type: 'room:joined', payload: room.snapshot }));
          broadcastRoom(room, 'room:state', room.snapshot);
          return;
        }

        if (!joinedRoomId || !joinedUid) return;
        const room = rooms.get(joinedRoomId);
        if (!room) return;

        if (msg.type === 'room:config') {
          if (p.selectedObject && CARRY_OBJECTS[p.selectedObject as CarryObjectType]) {
            room.snapshot.selectedObject = p.selectedObject;
            room.snapshot.objectState = createInitialObjectState(
              room.snapshot.selectedObject,
              room.snapshot.currentCheckpoint,
            );
          }
          if (p.randomizeObject) {
            room.snapshot.selectedObject = pickRandomObject();
            room.snapshot.objectState = createInitialObjectState(
              room.snapshot.selectedObject,
              room.snapshot.currentCheckpoint,
            );
          }
          if (p.courseModifier) {
            room.snapshot.courseModifier = p.courseModifier;
            room.snapshot.courseTheme = p.courseModifier.themeId || 'sunlit_valley';
          }
          if (typeof p.botPartnerEnabled === 'boolean') {
            const humans = Object.values(room.snapshot.players).filter((pl) => !pl.uid.startsWith('bot-'));
            if (p.botPartnerEnabled && humans.length === 1) {
              room.snapshot.botPartnerEnabled = true;
              const botUid = `bot-${joinedRoomId}`;
              room.snapshot.players[botUid] = {
                uid: botUid,
                username: 'Trail Buddy (Bot)',
                characterId: 'mountaineer',
                outfitId: 'alpine',
                colorHex: '#D97706',
                role: 'guest',
                x: 1.4,
                y: 0,
                z: 0,
                yaw: 0,
                pitch: 0,
                speed: 0,
                isGrounded: true,
                isBracing: false,
                ready: true,
                connected: true,
              };
            } else {
              room.snapshot.botPartnerEnabled = false;
              for (const k of Object.keys(room.snapshot.players)) {
                if (k.startsWith('bot-')) delete room.snapshot.players[k];
              }
            }
          }
          broadcastRoom(room, 'room:state', room.snapshot);
        } else if (msg.type === 'room:start') {
          const totalPlayers = Object.keys(room.snapshot.players).length;
          if (totalPlayers < 2) {
            ws.send(JSON.stringify({ type: 'room:error', payload: { message: 'Need 2 players (or enable Solo Practice Buddy) to start!' } }));
            return;
          }
          room.snapshot.currentCheckpoint = 0;
          room.snapshot.elapsedSec = 0;
          room.snapshot.attempts = 1;
          respawnAtCheckpoint(room, 0);
          broadcastRoom(room, 'game:started', room.snapshot);
        } else if (msg.type === 'player:state') {
          const player = room.snapshot.players[joinedUid];
          if (player && typeof p.x === 'number') {
            player.x = p.x;
            player.y = p.y;
            player.z = p.z;
            player.yaw = p.yaw ?? 0;
            player.pitch = p.pitch ?? 0;
            player.speed = p.speed ?? 0;
            player.isGrounded = Boolean(p.isGrounded);
            player.isBracing = Boolean(p.isBracing);
          }
        } else if (msg.type === 'object:telemetry') {
          // Authoritative host or physics check reports water spill / egg loss / impact
          const obj = room.snapshot.objectState;
          if (typeof p.waterLevel === 'number') {
            obj.waterLevel = Math.min(obj.waterLevel, Math.max(0, p.waterLevel));
          }
          if (typeof p.eggsRemaining === 'number') {
            obj.eggsRemaining = Math.min(obj.eggsRemaining, Math.max(0, p.eggsRemaining));
          }
          if (typeof p.integrity === 'number') {
            obj.integrity = Math.min(obj.integrity, Math.max(0, p.integrity));
          }
        } else if (msg.type === 'game:checkpoint') {
          const nextCp = Number(p.checkpointIndex);
          if (nextCp > room.snapshot.currentCheckpoint && nextCp <= 3) {
            room.snapshot.currentCheckpoint = nextCp;
            broadcastRoom(room, 'game:checkpoint', {
              checkpointIndex: nextCp,
              label: CHECKPOINT_POSITIONS[nextCp]?.label || `Checkpoint ${nextCp}`,
            });
          }
        } else if (msg.type === 'game:fail') {
          if (room.snapshot.status === 'playing') {
            room.snapshot.status = 'failed';
            room.snapshot.objectState.failedReason = String(p.reason || 'Object broke!');
            broadcastRoom(room, 'game:failed', {
              reason: room.snapshot.objectState.failedReason,
              checkpoint: room.snapshot.currentCheckpoint,
            });
          }
        } else if (msg.type === 'game:respawn') {
          room.snapshot.attempts += 1;
          respawnAtCheckpoint(room, room.snapshot.currentCheckpoint);
          broadcastRoom(room, 'game:respawned', room.snapshot);
        } else if (msg.type === 'game:restart_full') {
          room.snapshot.currentCheckpoint = 0;
          room.snapshot.elapsedSec = 0;
          room.snapshot.attempts = 1;
          if (p.randomize) {
            room.snapshot.selectedObject = pickRandomObject();
          }
          respawnAtCheckpoint(room, 0);
          broadcastRoom(room, 'game:started', room.snapshot);
        } else if (msg.type === 'game:victory') {
          if (room.snapshot.status === 'playing') {
            room.snapshot.status = 'victory';
            room.snapshot.currentCheckpoint = 4;
            broadcastRoom(room, 'game:victory', {
              elapsedSec: room.snapshot.elapsedSec,
              attempts: room.snapshot.attempts,
              objectType: room.snapshot.selectedObject,
            });
          }
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (!joinedRoomId || !joinedUid) return;
      const room = rooms.get(joinedRoomId);
      if (!room) return;
      room.sockets.delete(joinedUid);
      const pl = room.snapshot.players[joinedUid];
      if (pl) {
        pl.connected = false;
        broadcastRoom(room, 'room:partner_disconnected', { uid: joinedUid, username: pl.username });
        // Give 15 seconds for reconnection before removing player
        const uidToClean = joinedUid;
        const timer = setTimeout(() => {
          if (room.snapshot.players[uidToClean] && !room.snapshot.players[uidToClean].connected) {
            delete room.snapshot.players[uidToClean];
            broadcastRoom(room, 'room:state', room.snapshot);
          }
          room.disconnectTimers.delete(uidToClean);
        }, 15000);
        room.disconnectTimers.set(joinedUid, timer);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TWO TOGETHER: DUO CHAOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
