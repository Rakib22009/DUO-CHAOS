import React, { useEffect, useState } from 'react';
import { Check, Copy, LogOut, Save, Volume2, VolumeX, X } from 'lucide-react';
import {
  CHARACTER_OPTIONS,
  COLOR_SWATCHES,
  GameSettings,
  OUTFIT_OPTIONS,
  UserProfile,
} from '../shared/gameTypes';
import { fetchUserMatches, MatchHistoryItem } from '../lib/firebase';
import { soundEngine } from '../audio/soundEngine';

/* ---------------- PROFILE MODAL ---------------- */
export const ProfileModal: React.FC<{
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaveUsername: (name: string) => Promise<void>;
  onOpenCharacters: () => void;
  onLogout: () => Promise<void>;
}> = ({ isOpen, profile, onClose, onSaveUsername, onOpenCharacters, onLogout }) => {
  const [nameInput, setNameInput] = useState(profile.username);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    setNameInput(profile.username);
    if (isOpen) {
      fetchUserMatches(profile.uid).then(setMatches).catch(() => {});
    }
  }, [isOpen, profile.uid, profile.username]);

  if (!isOpen) return null;

  const copyUid = async () => {
    soundEngine.click();
    await navigator.clipboard?.writeText(profile.uid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="font-display font-bold text-xl">My Profile</h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Identity Row */}
          <div className="flex items-center gap-4">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.username}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-300"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl"
                style={{ backgroundColor: profile.colorHex }}
              >
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-slate-900 truncate">{profile.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono-tabular text-slate-600 truncate">
                  UID: {profile.uid}
                </span>
                <button
                  type="button"
                  onClick={copyUid}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-800 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy UID'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Edit Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="username-edit">
              Display Username
            </label>
            <div className="flex gap-2">
              <input
                id="username-edit"
                type="text"
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-sm"
              />
              <button
                type="button"
                disabled={saving || nameInput.trim().length < 2}
                onClick={async () => {
                  soundEngine.click();
                  setSaving(true);
                  await onSaveUsername(nameInput.trim());
                  setSaving(false);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Lifetime Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Games</div>
              <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                {profile.gamesPlayed}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Wins</div>
              <div className="text-xl font-bold font-mono-tabular text-emerald-700 mt-0.5">
                {profile.wins}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Failures</div>
              <div className="text-xl font-bold font-mono-tabular text-rose-600 mt-0.5">
                {profile.failures}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Best Level</div>
              <div className="text-xl font-bold font-mono-tabular text-amber-600 mt-0.5">
                {profile.bestLevel}
              </div>
            </div>
          </div>

          {/* Match History */}
          {matches.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700">Recent Co-Op Runs</div>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {matches.slice(0, 4).map((m) => (
                  <div key={m.matchId} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{m.objectType.replace('_', ' ')}</span>
                      <span className="text-slate-500"> · Room {m.roomId}</span>
                    </div>
                    <div className="font-mono-tabular text-slate-700">
                      {m.outcome === 'victory' ? 'Victory' : 'Ended'} · {m.durationSec}s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                onClose();
                onOpenCharacters();
              }}
              className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              Customize Character
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                onLogout();
              }}
              className="min-h-[44px] px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- CHARACTER STUDIO MODAL (DOCKED SO 3D CHARACTER STAYS VISIBLE) ---------------- */
export const CharacterStudioModal: React.FC<{
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onChangeAppearance: (updates: {
    characterId: UserProfile['characterId'];
    outfitId: UserProfile['outfitId'];
    colorHex: string;
  }) => Promise<void>;
}> = ({ isOpen, profile, onClose, onChangeAppearance }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-4 right-4 z-40 w-full max-w-sm flex flex-col rounded-2xl bg-[#f8fafc]/95 text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
        <div>
          <h2 className="font-display font-bold text-lg">Character Studio</h2>
          <p className="text-xs text-slate-500">Drag the 3D character on screen to rotate</p>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.click();
            onClose();
          }}
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
          aria-label="Close Character Studio"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto space-y-5">
        {/* Character Archetype */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">3D Character</div>
          <div className="grid grid-cols-2 gap-2">
            {CHARACTER_OPTIONS.map((c) => {
              const active = profile.characterId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onChangeAppearance({
                      characterId: c.id,
                      outfitId: profile.outfitId,
                      colorHex: profile.colorHex,
                    });
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500'
                  }`}
                >
                  <div className="text-xs font-bold">{c.label}</div>
                  <div className={`text-[11px] mt-0.5 ${active ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {c.role}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Outfit */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Outfit Gear</div>
          <div className="grid grid-cols-2 gap-2">
            {OUTFIT_OPTIONS.map((o) => {
              const active = profile.outfitId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onChangeAppearance({
                      characterId: profile.characterId,
                      outfitId: o.id,
                      colorHex: profile.colorHex,
                    });
                  }}
                  className={`min-h-[42px] px-3 rounded-xl border text-xs font-semibold ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Swatches */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">Trail Jacket Color</div>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_SWATCHES.map((sw) => {
              const active = profile.colorHex.toLowerCase() === sw.hex.toLowerCase();
              return (
                <button
                  key={sw.hex}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onChangeAppearance({
                      characterId: profile.characterId,
                      outfitId: profile.outfitId,
                      colorHex: sw.hex,
                    });
                  }}
                  className={`min-h-[42px] px-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                    active ? 'border-slate-900 bg-white ring-2 ring-emerald-600' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-black/15"
                    style={{ backgroundColor: sw.hex }}
                  />
                  <span className="truncate">{sw.name.split(' ')[1] || sw.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => {
            soundEngine.click();
            onClose();
          }}
          className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
};

/* ---------------- SETTINGS MODAL ---------------- */
export const SettingsModal: React.FC<{
  isOpen: boolean;
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onClose: () => void;
}> = ({ isOpen, settings, onUpdate, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-md rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="font-display font-bold text-xl">Game & Mobile Settings</h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Graphics Quality */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">3D Graphics Quality</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onUpdate({ ...settings, graphics: q });
                  }}
                  className={`min-h-[42px] rounded-xl border text-xs font-semibold capitalize ${
                    settings.graphics === q
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Sensitivity */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Camera Sensitivity</span>
              <span className="font-mono-tabular">{settings.cameraSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.0"
              step="0.1"
              value={settings.cameraSensitivity}
              onChange={(e) =>
                onUpdate({ ...settings, cameraSensitivity: parseFloat(e.target.value) })
              }
              className="w-full accent-emerald-700"
            />
          </div>

          {/* Touch Button Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Touch Button Size</span>
              <span className="font-mono-tabular">{Math.round(settings.buttonScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={settings.buttonScale}
              onChange={(e) =>
                onUpdate({ ...settings, buttonScale: parseFloat(e.target.value) })
              }
              className="w-full accent-emerald-700"
            />
          </div>

          {/* On-Screen Touch Controls */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">Mobile Touch Controls</div>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'always', 'off'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onUpdate({ ...settings, touchControlsEnabled: t });
                  }}
                  className={`min-h-[42px] rounded-xl border text-xs font-semibold capitalize ${
                    settings.touchControlsEnabled === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Mute */}
          <button
            type="button"
            onClick={() => {
              const nextMuted = !settings.muted;
              soundEngine.setMuted(nextMuted);
              if (!nextMuted) soundEngine.click();
              onUpdate({ ...settings, muted: nextMuted });
            }}
            className="w-full min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white flex items-center justify-between text-sm font-semibold text-slate-800"
          >
            <span>Sound Effects & Forest Ambience</span>
            {settings.muted ? (
              <span className="flex items-center gap-1.5 text-rose-600">
                <VolumeX className="w-4 h-4" /> Muted
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Volume2 className="w-4 h-4" /> Active
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- JOIN ROOM MODAL ---------------- */
export const JoinRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => Promise<void>;
  error: string | null;
}> = ({ isOpen, onClose, onJoin, error }) => {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-sm rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="font-display font-bold text-xl">Join Room</h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close Join Room"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Enter your friend&rsquo;s 6-character Room ID to connect via Firebase & live physics sync.
          </p>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABC123"
            className="w-full min-h-[52px] px-4 rounded-xl border border-slate-300 bg-white text-center font-mono-tabular text-2xl font-bold tracking-[0.25em] uppercase"
          />
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={code.length !== 6 || joining}
            onClick={async () => {
              soundEngine.click();
              setJoining(true);
              try {
                await onJoin(code);
              } finally {
                setJoining(false);
              }
            }}
            className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            {joining ? 'Connecting...' : 'Join 2-Player Room'}
          </button>
        </div>
      </div>
    </div>
  );
};
