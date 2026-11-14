import React from 'react';
import {
  AlertTriangle,
  Brain,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CARRY_OBJECTS,
  CHECKPOINT_POSITIONS,
  RoomNetSnapshot,
} from '../shared/gameTypes';
import { soundEngine } from '../audio/soundEngine';

interface GameplayHudProps {
  snapshot: RoomNetSnapshot;
  localHud: {
    speed: number;
    tiltDeg: number;
    waterLevel: number;
    eggsRemaining: number;
    integrity: number;
    distanceToPartner: number;
    surfaceType: string;
  };
  paused: boolean;
  muted: boolean;
  checkpointBanner: string | null;
  partnerDisconnectedName: string | null;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onOpenAiCoach: () => void;
  onRespawnCheckpoint: () => void;
  onRestartFull: () => void;
  onExitLobby: () => void;
}

export const GameplayHud: React.FC<GameplayHudProps> = ({
  snapshot,
  localHud,
  paused,
  muted,
  checkpointBanner,
  partnerDisconnectedName,
  onTogglePause,
  onToggleMute,
  onOpenAiCoach,
  onRespawnCheckpoint,
  onRestartFull,
  onExitLobby,
}) => {
  const spec = CARRY_OBJECTS[snapshot.selectedObject];
  const cpLabel = CHECKPOINT_POSITIONS[snapshot.currentCheckpoint]?.label || 'Start';
  const tiltDanger = localHud.tiltDeg > spec.maxTiltDeg * 0.72;

  return (
    <>
      {/* Low-occlusion corner HUD (no backdrop-filter over WebGL!) */}
      <div className="fixed inset-x-0 top-0 z-20 pointer-events-none p-3 sm:p-4 flex items-start justify-between gap-3">
        {/* Top-Left: Object Stability & Specific Metric */}
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/15 text-white min-w-[180px]">
          <div className="text-xs font-bold text-amber-300 truncate">{spec.name}</div>
          <div className="mt-1 flex items-center gap-3 text-xs font-mono-tabular">
            <span className={tiltDanger ? 'text-rose-400 font-bold' : 'text-slate-200'}>
              Tilt {localHud.tiltDeg}° / {spec.maxTiltDeg}°
            </span>
            {spec.hasWater ? (
              <span className={localHud.waterLevel < 40 ? 'text-rose-400 font-bold' : 'text-sky-300'}>
                Water {localHud.waterLevel}%
              </span>
            ) : spec.hasEggs ? (
              <span className={localHud.eggsRemaining < 2 ? 'text-rose-400 font-bold' : 'text-amber-200'}>
                Eggs {localHud.eggsRemaining}/3
              </span>
            ) : (
              <span className={localHud.integrity < 40 ? 'text-rose-400 font-bold' : 'text-emerald-300'}>
                Hull {localHud.integrity}%
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                tiltDanger ? 'bg-rose-500' : 'bg-emerald-400'
              }`}
              style={{
                width: `${Math.max(
                  5,
                  spec.hasWater
                    ? localHud.waterLevel
                    : spec.hasEggs
                      ? (localHud.eggsRemaining / 3) * 100
                      : localHud.integrity,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Top-Center: Checkpoint & Timer */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-950/80 border border-white/15 text-white text-xs">
          <Flag className="w-4 h-4 text-amber-400" />
          <span className="font-semibold">{cpLabel}</span>
          <span className="text-slate-400">·</span>
          <span className="font-mono-tabular text-emerald-300">
            CP {snapshot.currentCheckpoint}/3
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-mono-tabular text-slate-200">
            {Math.floor(snapshot.elapsedSec)}s
          </span>
        </div>

        {/* Top-Right: Partner Distance + Quick Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="hidden md:block px-3 py-2 rounded-xl bg-slate-950/80 border border-white/15 text-xs font-mono-tabular text-slate-200">
            Partner: {localHud.distanceToPartner.toFixed(1)}m
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenAiCoach();
            }}
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-sky-300 text-xs font-semibold flex items-center gap-1.5"
            aria-label="AI Co-op Coach"
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Coach</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-white flex items-center justify-center"
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onTogglePause();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-white flex items-center justify-center"
            aria-label="Pause Game"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtle Center Crosshair */}
      {snapshot.status === 'playing' && !paused && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
        </div>
      )}

      {/* Partner Disconnected Notice */}
      {partnerDisconnectedName && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-rose-900 text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4 text-amber-300" />
          <span>{partnerDisconnectedName} disconnected — waiting up to 15s for reconnect...</span>
        </div>
      )}

      {/* Checkpoint Reached Banner */}
      {checkpointBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl bg-emerald-800 border border-emerald-400 text-white font-display font-bold text-sm shadow-xl">
          {checkpointBanner}
        </div>
      )}

      {/* Pause Modal */}
      {paused && snapshot.status === 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
          <div className="w-full max-w-sm rounded-2xl bg-[#f8fafc] text-slate-900 p-6 shadow-2xl space-y-4">
            <h2 className="font-display font-bold text-2xl">Game Paused</h2>
            <p className="text-xs text-slate-600">
              Room <span className="font-mono-tabular font-bold">{snapshot.roomId}</span> ·{' '}
              {cpLabel}
            </p>
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onTogglePause();
                }}
                className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Resume Expedition</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onRestartFull();
                }}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart From Start</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onExitLobby();
                }}
                className="w-full min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-sm"
              >
                Leave Room to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Checkpoint Failure Modal */}
      {snapshot.status === 'failed' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
          <div className="w-full max-w-md rounded-2xl bg-[#f8fafc] text-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h2 className="font-display font-bold text-2xl">Chaos Disaster!</h2>
            </div>
            <p className="text-sm text-slate-700">
              {snapshot.objectState.failedReason || 'The carried object was lost!'}
            </p>
            <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-600 font-mono-tabular">
              Latest Saved Progress: {cpLabel} · Attempt #{snapshot.attempts}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onRespawnCheckpoint();
                }}
                className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry from Checkpoint {snapshot.currentCheckpoint}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onOpenAiCoach();
                }}
                className="min-h-[48px] px-4 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Brain className="w-4 h-4" />
                <span>Ask AI Coach</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {snapshot.status === 'victory' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
          <div className="w-full max-w-md rounded-2xl bg-[#f8fafc] text-slate-900 p-7 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="font-display font-bold text-2xl text-slate-900">
              Expedition Complete!
            </h2>
            <p className="text-sm text-slate-600">
              You and your partner safely delivered the <span className="font-semibold text-slate-900">{spec.name}</span> to the Sunlit Pavilion!
            </p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="text-xs text-slate-500">Time</div>
                <div className="font-mono-tabular text-lg font-bold text-emerald-700">
                  {Math.round(snapshot.elapsedSec)}s
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200">
                <div className="text-xs text-slate-500">Attempts</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-600">
                  {snapshot.attempts}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onRestartFull();
                }}
                className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm"
              >
                Play New Random Object
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onExitLobby();
                }}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
