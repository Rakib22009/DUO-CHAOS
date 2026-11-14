import React, { useState } from 'react';
import { Brain, Compass, ExternalLink, MapPin, X, Check } from 'lucide-react';
import {
  CARRY_OBJECTS,
  CarryObjectType,
  CourseModifier,
  CourseThemeId,
} from '../shared/gameTypes';
import { soundEngine } from '../audio/soundEngine';

interface AiTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectType: CarryObjectType;
  courseTheme: CourseThemeId;
  currentCheckpoint: number;
  attempts: number;
  failureReason?: string | null;
  onApplyCoursePreset: (preset: CourseModifier) => void;
}

export const AiTrailModal: React.FC<AiTrailModalProps> = ({
  isOpen,
  onClose,
  objectType,
  courseTheme,
  currentCheckpoint,
  attempts,
  failureReason,
  onApplyCoursePreset,
}) => {
  const [tab, setTab] = useState<'coach' | 'trails'>('coach');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

  const [trailQuery, setTrailQuery] = useState('scenic suspension bridge canyon trail');
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState<string | null>(null);
  const [trailResult, setTrailResult] = useState<{
    summary: string;
    conditions: string;
    mapLinks: { title: string; uri: string }[];
    webLinks: { title: string; uri: string }[];
    suggestedPreset: CourseModifier;
  } | null>(null);
  const [appliedPreset, setAppliedPreset] = useState(false);

  if (!isOpen) return null;

  const askCoach = async () => {
    soundEngine.click();
    setCoachLoading(true);
    setCoachError(null);
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectType,
          courseTheme,
          currentCheckpoint,
          attempts,
          failureReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reach Co-op Coach');
      setCoachAdvice(data.advice);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'Unable to generate strategy');
    } finally {
      setCoachLoading(false);
    }
  };

  const searchRealTrails = async () => {
    soundEngine.click();
    setTrailLoading(true);
    setTrailError(null);
    setAppliedPreset(false);

    let lat: number | undefined;
    let lng: number | undefined;
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500 }),
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Geolocation declined or timed out; proceed with query-only grounding
      }
    }

    try {
      const res = await fetch('/api/ai/trail-inspire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trailQuery, lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ground trail data');
      setTrailResult(data);
    } catch (err) {
      setTrailError(err instanceof Error ? err.message : 'Unable to search trails');
    } finally {
      setTrailLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[#f8fafc] text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900">
              AI Co-op Coach & Real-World Trail Explorer
            </h2>
            <p className="text-xs text-slate-600">
              High-Thinking Physics Tactics · Live Google Maps & Search Grounding
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close AI Coach"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-6 pt-4">
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 gap-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                setTab('coach');
              }}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'coach'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span>Physics Strategy Coach</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                setTab('trails');
              }}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'trails'
                  ? 'bg-white text-sky-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Real-World Trail Courses</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {tab === 'coach' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-950">
                <div className="font-semibold">
                  Active Cargo: {CARRY_OBJECTS[objectType].name} · Attempt #{attempts}
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  {CARRY_OBJECTS[objectType].challengeRule}
                </p>
              </div>

              <button
                type="button"
                disabled={coachLoading}
                onClick={askCoach}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Brain className="w-4 h-4" />
                <span>
                  {coachLoading
                    ? 'Deep Thinking on Co-op Physics...'
                    : 'Generate High-Thinking Co-op Strategy'}
                </span>
              </button>

              {coachError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {coachError}
                </div>
              )}

              {coachAdvice && (
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {coachAdvice}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={trailQuery}
                  onChange={(e) => setTrailQuery(e.target.value)}
                  placeholder="e.g. Capilano suspension bridge or Yosemite waterfall trail"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  disabled={trailLoading}
                  onClick={searchRealTrails}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{trailLoading ? 'Scouting...' : 'Scout Real Trails'}</span>
                </button>
              </div>

              {trailError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {trailError}
                </div>
              )}

              {trailResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                    <div className="text-xs font-semibold text-sky-800">
                      Maps & Terrain Grounding
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {trailResult.summary}
                    </p>
                    {trailResult.conditions && (
                      <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                        {trailResult.conditions}
                      </p>
                    )}
                  </div>

                  {/* Mandatory Grounding Links */}
                  {(trailResult.mapLinks.length > 0 || trailResult.webLinks.length > 0) && (
                    <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Verified Google Maps & Search Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {trailResult.mapLinks.map((m, i) => (
                          <a
                            key={`map-${i}`}
                            href={m.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-sky-800 hover:bg-sky-50"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{m.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                        {trailResult.webLinks.map((w, i) => (
                          <a
                            key={`web-${i}`}
                            href={w.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                          >
                            <span>{w.title}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply Course Modifier */}
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-amber-950">
                        {trailResult.suggestedPreset.title}
                      </div>
                      <div className="text-xs text-amber-800">
                        Wind {Math.round(trailResult.suggestedPreset.windStrength * 100)}% · Slipperiness{' '}
                        {Math.round(trailResult.suggestedPreset.slipperiness * 100)}%
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.click();
                        onApplyCoursePreset(trailResult.suggestedPreset);
                        setAppliedPreset(true);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      {appliedPreset ? <Check className="w-4 h-4" /> : null}
                      <span>{appliedPreset ? 'Applied to 3D Course' : 'Apply Trail Modifiers'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
