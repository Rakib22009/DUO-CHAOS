import React, { useState } from 'react';
import { Bot, Check, Copy, Play, Shuffle, Users, X } from 'lucide-react';
import {
  CARRY_OBJECTS,
  CarryObjectType,
  COURSE_THEMES,
  CourseThemeId,
  RoomNetSnapshot,
} from '../shared/gameTypes';
import { soundEngine } from '../audio/soundEngine';

interface WaitingLobbyScreenProps {
  snapshot: RoomNetSnapshot;
  localUid: string;
  onSelectObject: (obj: CarryObjectType) => void;
  onRandomizeObject: () => void;
  onSelectTheme: (theme: CourseThemeId) => void;
  onToggleBot: (enabled: boolean) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const WaitingLobbyScreen: React.FC<WaitingLobbyScreenProps> = ({
  snapshot,
  localUid,
  onSelectObject,
  onRandomizeObject,
  onSelectTheme,
  onToggleBot,
  onStartGame,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);

  const players = Object.values(snapshot.players);
  const localPlayer = snapshot.players[localUid];
  const isHost = localPlayer?.role === 'host';
  const objSpec = CARRY_OBJECTS[snapshot.selectedObject];
  const readyToStart = players.length >= 2;

  const copyRoomId = async () => {
    soundEngine.click();
    await navigator.clipboard?.writeText(snapshot.roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900">
              2-Player Waiting Lobby
            </h2>
            <p className="text-xs text-slate-600">
              Share your Room ID or wait for a random partner to connect
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onLeaveRoom();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Leave Room"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Room ID Banner */}
          <div className="p-4 rounded-xl bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-emerald-300 font-medium">Room ID (Max 2 Players)</div>
              <div className="font-mono-tabular text-3xl font-bold tracking-[0.22em] mt-0.5">
                {snapshot.roomId}
              </div>
            </div>
            <button
              type="button"
              onClick={copyRoomId}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Room ID Copied' : 'Copy Room ID'}</span>
            </button>
          </div>

          {/* 2 Player Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1].map((slotIdx) => {
              const p = players[slotIdx];
              return (
                <div
                  key={slotIdx}
                  className={`p-4 rounded-xl border ${
                    p ? 'bg-white border-emerald-300' : 'bg-slate-100 border-dashed border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Player {slotIdx + 1}</span>
                    <span>{p ? (p.role === 'host' ? 'Host' : 'Partner') : 'Waiting...'}</span>
                  </div>
                  {p ? (
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="w-9 h-9 rounded-xl shrink-0 border border-black/15"
                        style={{ backgroundColor: p.colorHex }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {p.username}
                        </div>
                        <div className="text-xs text-slate-600 capitalize">
                          {p.characterId} · {p.outfitId}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Users className="w-4 h-4" />
                      <span>Waiting for Player 2 to join...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Solo Practice Buddy Option (when waiting alone) */}
          {isHost && players.filter((pl) => !pl.uid.startsWith('bot-')).length === 1 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-950">
                    Practice Co-op Solo with Trail Buddy Bot
                  </div>
                  <div className="text-[11px] text-amber-800">
                    Test 2-player carrying physics immediately; replaced automatically if a friend joins.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onToggleBot(!snapshot.botPartnerEnabled);
                }}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-bold shrink-0 ${
                  snapshot.botPartnerEnabled
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-amber-300 text-amber-950'
                }`}
              >
                {snapshot.botPartnerEnabled ? 'Bot Active' : 'Enable Bot'}
              </button>
            </div>
          )}

          {/* Carried Object & Course Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Random Carrying Object</span>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.click();
                      onRandomizeObject();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Reroll</span>
                  </button>
                )}
              </div>
              <select
                disabled={!isHost}
                value={snapshot.selectedObject}
                onChange={(e) => {
                  soundEngine.click();
                  onSelectObject(e.target.value as CarryObjectType);
                }}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 disabled:opacity-75"
              >
                {Object.values(CARRY_OBJECTS).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.difficulty})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-600 leading-relaxed">{objSpec.challengeRule}</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
              <div className="text-xs font-semibold text-slate-700">3D Course Environment</div>
              <select
                disabled={!isHost}
                value={snapshot.courseTheme}
                onChange={(e) => {
                  soundEngine.click();
                  onSelectTheme(e.target.value as CourseThemeId);
                }}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 disabled:opacity-75"
              >
                {Object.values(COURSE_THEMES).map((t) => (
                  <option key={t.themeId} value={t.themeId}>
                    {t.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-600 leading-relaxed">
                {snapshot.courseModifier.subtitle}
              </p>
            </div>
          </div>

          {/* Start CTA */}
          {isHost ? (
            <button
              type="button"
              disabled={!readyToStart}
              onClick={() => {
                soundEngine.click();
                onStartGame();
              }}
              className="w-full min-h-[52px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-display font-bold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>
                {readyToStart ? 'Start Co-Op Expedition' : 'Waiting for Player 2 (or Enable Bot)'}
              </span>
            </button>
          ) : (
            <div className="text-center py-3 rounded-xl bg-slate-200/70 text-sm font-semibold text-slate-700">
              Waiting for host to launch the expedition...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
