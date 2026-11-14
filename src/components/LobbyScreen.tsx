import React from 'react';
import {
  Brain,
  CheckSquare,
  KeyRound,
  PlusSquare,
  Settings,
  Shuffle,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';
import { CourseModifier, UserProfile } from '../shared/gameTypes';
import { soundEngine } from '../audio/soundEngine';

interface LobbyScreenProps {
  profile: UserProfile;
  activeCourse: CourseModifier;
  busyAction: string | null;
  onQuickRandomMatch: () => void;
  onCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onOpenProfile: () => void;
  onOpenCharacterStudio: () => void;
  onOpenAiTrails: () => void;
  onOpenTasks: () => void;
  onOpenSettings: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  profile,
  activeCourse,
  busyAction,
  onQuickRandomMatch,
  onCreateRoom,
  onOpenJoinRoom,
  onOpenProfile,
  onOpenCharacterStudio,
  onOpenAiTrails,
  onOpenTasks,
  onOpenSettings,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar (3-zone, unobtrusive over 3D character clearing) */}
      <div className="flex items-center justify-between gap-4 pointer-events-auto">
        <div className="px-4 py-2.5 rounded-2xl bg-slate-950/75 border border-white/15 text-white">
          <div className="font-display font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">
            TWO TOGETHER · DUO CHAOS
          </div>
          <div className="text-xs text-amber-300 truncate max-w-[260px]">
            {activeCourse.title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenProfile();
            }}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <User className="w-4 h-4 text-emerald-400" />
            <span>{profile.username}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenSettings();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-white flex items-center justify-center"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Dock & Multiplayer Action Cluster (keeps center 3D character unobstructed) */}
      <div className="pointer-events-auto w-full max-w-4xl mx-auto space-y-3">
        {/* Primary Multiplayer Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => {
              soundEngine.click();
              onQuickRandomMatch();
            }}
            className="min-h-[54px] px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base shadow-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            <Shuffle className="w-5 h-5" />
            <span>{busyAction === 'random' ? 'Matching...' : 'Play · Random Match'}</span>
          </button>

          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => {
              soundEngine.click();
              onCreateRoom();
            }}
            className="min-h-[54px] px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-display font-bold text-base shadow-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            <PlusSquare className="w-5 h-5" />
            <span>{busyAction === 'create' ? 'Creating...' : 'Create Room'}</span>
          </button>

          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => {
              soundEngine.click();
              onOpenJoinRoom();
            }}
            className="min-h-[54px] px-5 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white font-display font-bold text-base shadow-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            <KeyRound className="w-5 h-5 text-sky-300" />
            <span>Join Room</span>
          </button>
        </div>

        {/* Secondary Feature Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenCharacterStudio();
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            <span>Characters</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenProfile();
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>My Profile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenAiTrails();
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Brain className="w-4 h-4 text-sky-300" />
            <span>AI Coach & Trails</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenTasks();
            }}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/15 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-emerald-300" />
            <span>Google Tasks</span>
          </button>
        </div>
      </div>
    </div>
  );
};
