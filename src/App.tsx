/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CARRY_OBJECTS,
  CarryObjectType,
  COURSE_THEMES,
  CourseModifier,
  CourseThemeId,
  GameSettings,
  RoomNetSnapshot,
  UserProfile,
} from './shared/gameTypes';
import {
  createFirestoreRoom,
  deleteFirestoreRoom,
  findOpenPublicRoom,
  googleSignIn,
  initAuth,
  joinFirestoreRoom,
  loadOrCreateUserProfile,
  logout,
  saveMatchRecordDoc,
  updateFirestoreRoomProgress,
  updateUserProfileDoc,
} from './lib/firebase';
import { soundEngine } from './audio/soundEngine';
import { GameCanvas, LocalInputState } from './components/GameCanvas';
import { TouchControls } from './components/TouchControls';
import { IntroScreen } from './components/IntroScreen';
import { AuthScreen } from './components/AuthScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { WaitingLobbyScreen } from './components/WaitingLobbyScreen';
import { GameplayHud } from './components/GameplayHud';
import {
  CharacterStudioModal,
  JoinRoomModal,
  ProfileModal,
  SettingsModal,
} from './components/LobbyModals';
import { AiTrailModal } from './components/AiTrailModal';
import { GoogleTasksModal } from './components/GoogleTasksModal';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomObjectId(): CarryObjectType {
  const keys = Object.keys(CARRY_OBJECTS) as CarryObjectType[];
  return keys[Math.floor(Math.random() * keys.length)];
}

export default function App() {
  const [screen, setScreen] = useState<'intro' | 'auth' | 'lobby' | 'waiting' | 'play'>('intro');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [settings, setSettings] = useState<GameSettings>({
    graphics: 'medium',
    cameraSensitivity: 1.0,
    buttonScale: 1.0,
    muted: false,
    touchControlsEnabled: 'auto',
  });

  const [activeCourse, setActiveCourse] = useState<CourseModifier>(COURSE_THEMES.sunlit_valley);
  const [roomSnapshot, setRoomSnapshot] = useState<RoomNetSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [respawnSignal, setRespawnSignal] = useState(0);
  const [checkpointBanner, setCheckpointBanner] = useState<string | null>(null);
  const [partnerDisconnectedName, setPartnerDisconnectedName] = useState<string | null>(null);

  // Modal states
  const [showProfile, setShowProfile] = useState(false);
  const [showCharStudio, setShowCharStudio] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showAiTrails, setShowAiTrails] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lobbyToast, setLobbyToast] = useState<string | null>(null);

  const [localHud, setLocalHud] = useState({
    speed: 0,
    tiltDeg: 0,
    waterLevel: 100,
    eggsRemaining: 3,
    integrity: 100,
    distanceToPartner: 0,
    surfaceType: 'grass',
  });

  const inputRef = useRef<LocalInputState>({
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    jumpBufferedUntil: 0,
    isBracing: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const roomRef = useRef<RoomNetSnapshot | null>(null);
  roomRef.current = roomSnapshot;

  // Listen to Firebase Auth state
  useEffect(() => {
    return initAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const loaded = await loadOrCreateUserProfile(user);
          setProfile(loaded);
          setAuthError(null);
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : 'Failed to load profile');
        }
      } else {
        setProfile(null);
      }
    });
  }, []);

  // Escape key pauses gameplay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen === 'play') {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const showToast = (msg: string) => {
    setLobbyToast(msg);
    setTimeout(() => setLobbyToast((prev) => (prev === msg ? null : prev)), 3200);
  };

  const connectToRoomSocket = useCallback(
    (params: {
      roomId: string;
      selectedObject?: CarryObjectType;
      courseModifier?: CourseModifier;
    }) => {
      const prof = profileRef.current;
      if (!prof) return;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'room:join',
            payload: {
              roomId: params.roomId,
              uid: prof.uid,
              username: prof.username,
              characterId: prof.characterId,
              outfitId: prof.outfitId,
              colorHex: prof.colorHex,
              courseTheme: params.courseModifier?.themeId || activeCourse.themeId,
              courseModifier: params.courseModifier || activeCourse,
              selectedObject: params.selectedObject,
            },
          }),
        );
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type: string; payload: any };
          if (msg.type === 'room:joined' || msg.type === 'room:state') {
            const snap = msg.payload as RoomNetSnapshot;
            setRoomSnapshot(snap);
            if (msg.type === 'room:joined') {
              setScreen(snap.status === 'playing' ? 'play' : 'waiting');
              if (snap.status === 'playing') {
                setRespawnSignal((s) => s + 1);
              }
            }
            const partner = Object.values(snap.players).find((pl) => pl.uid !== prof.uid);
            if (partner && partner.connected) {
              setPartnerDisconnectedName(null);
            }
          } else if (msg.type === 'game:started') {
            const snap = msg.payload as RoomNetSnapshot;
            setRoomSnapshot(snap);
            setPaused(false);
            setScreen('play');
            setRespawnSignal((s) => s + 1);
          } else if (msg.type === 'game:respawned') {
            const snap = msg.payload as RoomNetSnapshot;
            setRoomSnapshot(snap);
            setRespawnSignal((s) => s + 1);
          } else if (msg.type === 'game:checkpoint') {
            setCheckpointBanner(`${msg.payload.label} Reached!`);
            setTimeout(() => setCheckpointBanner(null), 2800);
          } else if (msg.type === 'game:failed') {
            if (document.pointerLockElement) document.exitPointerLock?.();
            if (profileRef.current) {
              const nextFail = profileRef.current.failures + 1;
              setProfile({ ...profileRef.current, failures: nextFail });
              updateUserProfileDoc(profileRef.current.uid, { failures: nextFail }).catch(() => {});
            }
          } else if (msg.type === 'game:victory') {
            if (document.pointerLockElement) document.exitPointerLock?.();
            const curProf = profileRef.current;
            const curRoom = roomRef.current;
            if (curProf && curRoom) {
              const nextWins = curProf.wins + 1;
              const nextGames = curProf.gamesPlayed + 1;
              const nextBest = Math.max(curProf.bestLevel, 1);
              setProfile({
                ...curProf,
                wins: nextWins,
                gamesPlayed: nextGames,
                bestLevel: nextBest,
              });
              updateUserProfileDoc(curProf.uid, {
                wins: nextWins,
                gamesPlayed: nextGames,
                bestLevel: nextBest,
              }).catch(() => {});

              const localP = curRoom.players[curProf.uid];
              if (localP?.role === 'host') {
                const guest = Object.values(curRoom.players).find((pl) => pl.uid !== curProf.uid);
                updateFirestoreRoomProgress(curRoom.roomId, {
                  roomStatus: 'completed',
                  currentCheckpoint: 4,
                });
                saveMatchRecordDoc({
                  roomId: curRoom.roomId,
                  hostUid: curProf.uid,
                  guestUid: guest?.uid || 'solo-bot',
                  objectType: curRoom.selectedObject,
                  courseTheme: curRoom.courseTheme,
                  outcome: 'victory',
                  durationSec: msg.payload.elapsedSec || curRoom.elapsedSec,
                  checkpointsReached: 4,
                }).catch(() => {});
              }
            }
          } else if (msg.type === 'room:partner_disconnected') {
            setPartnerDisconnectedName(msg.payload.username || 'Partner');
          } else if (msg.type === 'room:error') {
            showToast(msg.payload.message || 'Room error');
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };
    },
    [activeCourse],
  );

  const sendWs = useCallback((type: string, payload: unknown = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const handleStartFromIntro = () => {
    if (firebaseUser && profile) {
      setScreen('lobby');
    } else {
      setScreen('auth');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const { user } = await googleSignIn();
      setFirebaseUser(user);
      const loaded = await loadOrCreateUserProfile(user);
      setProfile(loaded);
      setScreen('lobby');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In cancelled or failed.');
    }
  };

  const handleCreatePrivateRoom = async () => {
    if (!profile) return;
    setBusyAction('create');
    try {
      const roomId = generateRoomCode();
      const obj = randomObjectId();
      await createFirestoreRoom({
        roomId,
        hostUid: profile.uid,
        hostName: profile.username,
        isPublic: false,
        selectedObject: obj,
        courseTheme: activeCourse.themeId,
      });
      connectToRoomSocket({ roomId, selectedObject: obj, courseModifier: activeCourse });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinRoomByCode = async (roomCode: string) => {
    if (!profile) return;
    setJoinError(null);
    try {
      const roomDoc = await joinFirestoreRoom(roomCode, profile.uid, profile.username);
      setShowJoinRoom(false);
      connectToRoomSocket({
        roomId: roomDoc.roomId,
        selectedObject: roomDoc.selectedObject,
        courseModifier: COURSE_THEMES[roomDoc.courseTheme] || activeCourse,
      });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join room');
    }
  };

  const handleRandomMatchmaking = async () => {
    if (!profile) return;
    setBusyAction('random');
    try {
      const openRoom = await findOpenPublicRoom(profile.uid);
      if (openRoom) {
        await joinFirestoreRoom(openRoom.roomId, profile.uid, profile.username);
        connectToRoomSocket({
          roomId: openRoom.roomId,
          selectedObject: openRoom.selectedObject,
          courseModifier: COURSE_THEMES[openRoom.courseTheme] || activeCourse,
        });
        showToast(`Matched into room ${openRoom.roomId}!`);
      } else {
        const roomId = generateRoomCode();
        const obj = randomObjectId();
        await createFirestoreRoom({
          roomId,
          hostUid: profile.uid,
          hostName: profile.username,
          isPublic: true,
          selectedObject: obj,
          courseTheme: activeCourse.themeId,
        });
        connectToRoomSocket({ roomId, selectedObject: obj, courseModifier: activeCourse });
        showToast(`Created public room ${roomId} — waiting for partner...`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Matchmaking error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeaveRoom = async () => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    const curRoom = roomSnapshot;
    const curProf = profile;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (curRoom && curProf) {
      const localP = curRoom.players[curProf.uid];
      if (localP?.role === 'host' && curRoom.status === 'waiting') {
        deleteFirestoreRoom(curRoom.roomId).catch(() => {});
      }
    }
    setRoomSnapshot(null);
    setPaused(false);
    setScreen('lobby');
  };

  const isTouchDevice =
    settings.touchControlsEnabled === 'always' ||
    (settings.touchControlsEnabled === 'auto' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const canvasMode = screen === 'intro' || screen === 'auth' ? 'intro' : screen === 'play' ? 'play' : 'lobby';

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b1912]">
      {/* Persistent Isolated 3D WebGL World */}
      <GameCanvas
        mode={canvasMode}
        settings={settings}
        localUid={profile?.uid || 'local'}
        characterId={profile?.characterId || 'ranger'}
        outfitId={profile?.outfitId || 'trail'}
        colorHex={profile?.colorHex || '#1E5631'}
        courseTheme={roomSnapshot?.courseTheme || activeCourse.themeId}
        selectedObject={roomSnapshot?.selectedObject || 'water_glass'}
        roomSnapshot={roomSnapshot}
        inputRef={inputRef}
        onSendPlayerState={(payload) => sendWs('player:state', payload)}
        onSendObjectTelemetry={(payload) => sendWs('object:telemetry', payload)}
        onCheckpointReached={(cpIdx) => {
          sendWs('game:checkpoint', { checkpointIndex: cpIdx });
          if (roomSnapshot && profile && roomSnapshot.players[profile.uid]?.role === 'host') {
            updateFirestoreRoomProgress(roomSnapshot.roomId, { currentCheckpoint: cpIdx });
          }
        }}
        onFailureTriggered={(reason) => sendWs('game:fail', { reason })}
        onVictoryTriggered={() => sendWs('game:victory', {})}
        onLocalHudUpdate={setLocalHud}
        respawnSignal={respawnSignal}
      />

      {/* Screen 1: Animated Intro */}
      {screen === 'intro' && <IntroScreen onStart={handleStartFromIntro} />}

      {/* Screen 2: Google Sign-In Auth */}
      {screen === 'auth' && (
        <AuthScreen onGoogleSignIn={handleGoogleSignIn} error={authError} />
      )}

      {/* Screen 3: 3D Main Lobby */}
      {screen === 'lobby' && profile && (
        <LobbyScreen
          profile={profile}
          activeCourse={activeCourse}
          busyAction={busyAction}
          onQuickRandomMatch={handleRandomMatchmaking}
          onCreateRoom={handleCreatePrivateRoom}
          onOpenJoinRoom={() => {
            setJoinError(null);
            setShowJoinRoom(true);
          }}
          onOpenProfile={() => setShowProfile(true)}
          onOpenCharacterStudio={() => setShowCharStudio(true)}
          onOpenAiTrails={() => setShowAiTrails(true)}
          onOpenTasks={() => setShowTasks(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Screen 4: 2-Player Waiting Lobby */}
      {screen === 'waiting' && roomSnapshot && profile && (
        <WaitingLobbyScreen
          snapshot={roomSnapshot}
          localUid={profile.uid}
          onSelectObject={(obj) => sendWs('room:config', { selectedObject: obj })}
          onRandomizeObject={() => sendWs('room:config', { randomizeObject: true })}
          onSelectTheme={(themeId) => {
            const mod = COURSE_THEMES[themeId];
            setActiveCourse(mod);
            sendWs('room:config', { courseModifier: mod });
          }}
          onToggleBot={(enabled) => sendWs('room:config', { botPartnerEnabled: enabled })}
          onStartGame={() => {
            updateFirestoreRoomProgress(roomSnapshot.roomId, {
              roomStatus: 'playing',
              selectedObject: roomSnapshot.selectedObject,
              courseTheme: roomSnapshot.courseTheme,
            });
            sendWs('room:start', {});
          }}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Screen 5: First-Person Gameplay HUD + Mobile Touch Controls */}
      {screen === 'play' && roomSnapshot && (
        <>
          <GameplayHud
            snapshot={roomSnapshot}
            localHud={localHud}
            paused={paused}
            muted={settings.muted}
            checkpointBanner={checkpointBanner}
            partnerDisconnectedName={partnerDisconnectedName}
            onTogglePause={() => {
              if (!paused && document.pointerLockElement) document.exitPointerLock?.();
              setPaused((p) => !p);
            }}
            onToggleMute={() => {
              const nextMuted = !settings.muted;
              soundEngine.setMuted(nextMuted);
              setSettings((s) => ({ ...s, muted: nextMuted }));
            }}
            onOpenAiCoach={() => {
              if (document.pointerLockElement) document.exitPointerLock?.();
              setShowAiTrails(true);
            }}
            onRespawnCheckpoint={() => sendWs('game:respawn', {})}
            onRestartFull={() => sendWs('game:restart_full', { randomize: true })}
            onExitLobby={handleLeaveRoom}
          />
          <TouchControls
            inputRef={inputRef}
            buttonScale={settings.buttonScale}
            visible={isTouchDevice && !paused && roomSnapshot.status === 'playing'}
            onInteract={() => setShowAiTrails(true)}
          />
        </>
      )}

      {/* Toast Notice */}
      {lobbyToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-amber-400/50 text-white text-xs font-semibold shadow-xl">
          {lobbyToast}
        </div>
      )}

      {/* Modals */}
      {profile && (
        <>
          <ProfileModal
            isOpen={showProfile}
            profile={profile}
            onClose={() => setShowProfile(false)}
            onSaveUsername={async (username) => {
              await updateUserProfileDoc(profile.uid, { username });
              setProfile({ ...profile, username });
              showToast('Username updated!');
            }}
            onOpenCharacters={() => setShowCharStudio(true)}
            onLogout={async () => {
              await logout();
              setShowProfile(false);
              setScreen('auth');
            }}
          />

          <CharacterStudioModal
            isOpen={showCharStudio}
            profile={profile}
            onClose={() => setShowCharStudio(false)}
            onChangeAppearance={async (updates) => {
              setProfile({ ...profile, ...updates });
              await updateUserProfileDoc(profile.uid, updates);
            }}
          />
        </>
      )}

      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onUpdate={setSettings}
        onClose={() => setShowSettings(false)}
      />

      <JoinRoomModal
        isOpen={showJoinRoom}
        onClose={() => setShowJoinRoom(false)}
        onJoin={handleJoinRoomByCode}
        error={joinError}
      />

      <AiTrailModal
        isOpen={showAiTrails}
        onClose={() => setShowAiTrails(false)}
        objectType={roomSnapshot?.selectedObject || 'water_glass'}
        courseTheme={roomSnapshot?.courseTheme || activeCourse.themeId}
        currentCheckpoint={roomSnapshot?.currentCheckpoint || 0}
        attempts={roomSnapshot?.attempts || 1}
        failureReason={roomSnapshot?.objectState.failedReason}
        onApplyCoursePreset={(preset) => {
          setActiveCourse(preset);
          if (roomSnapshot) {
            sendWs('room:config', { courseModifier: preset });
          }
          showToast(`Course preset applied: ${preset.title}`);
        }}
      />

      <GoogleTasksModal
        isOpen={showTasks}
        onClose={() => setShowTasks(false)}
        onReconnectGoogle={async () => {
          await googleSignIn();
        }}
      />
    </main>
  );
}
