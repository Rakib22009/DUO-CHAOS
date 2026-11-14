import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface IntroScreenProps {
  onStart: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onStart }) => {
  const [progress, setProgress] = useState(0);
  const ready = progress >= 100;

  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    let raf = 0;
    const step = (now: number) => {
      const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ready && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        soundEngine.click();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, onStart]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-between px-6 py-10 bg-gradient-to-b from-[#07130d]/85 via-[#07130d]/45 to-[#07130d]/90">
      {/* Top quiet subtitle */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-xs font-medium tracking-widest uppercase text-amber-300/90"
      >
        First-Person 3D Online Cooperative Physics
      </motion.div>

      {/* Center Bespoke SVG Title Lockup */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center max-w-2xl"
      >
        <svg
          viewBox="0 0 420 130"
          className="w-full max-w-[420px] h-auto drop-shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
          aria-label="TWO TOGETHER: DUO CHAOS"
        >
          <defs>
            <linearGradient id="sunGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="55%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="forestLeaf" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>
          {/* Twin cooperative silhouette beams */}
          <path
            d="M45 34 L375 26"
            stroke="url(#sunGold)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="48" cy="34" r="7" fill="#38BDF8" />
          <circle cx="372" cy="26" r="7" fill="#FBBF24" />
          <text
            x="210"
            y="74"
            textAnchor="middle"
            fill="#F8FAFC"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="44"
            letterSpacing="2"
          >
            TWO TOGETHER
          </text>
          <rect x="128" y="88" width="164" height="28" rx="6" fill="url(#forestLeaf)" />
          <text
            x="210"
            y="108"
            textAnchor="middle"
            fill="#052E16"
            fontFamily="Outfit, sans-serif"
            fontWeight="800"
            fontSize="16"
            letterSpacing="4"
          >
            DUO CHAOS
          </text>
        </svg>

        <p className="mt-4 text-sm sm:text-base text-slate-200/90 max-w-md text-balance leading-relaxed">
          Grab one end, shout instructions, and haul fragile disasters across timber bridges together.
        </p>
      </motion.div>

      {/* Bottom Loading Bar & Start CTA */}
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        {!ready ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300 font-mono-tabular">
              <span>Preparing 3D Valley & Physics</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-900/90 border border-white/15 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            type="button"
            onClick={() => {
              soundEngine.click();
              soundEngine.startAmbientForest();
              onStart();
            }}
            className="w-full min-h-[52px] px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-lg shadow-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] transition-all"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Start Game</span>
          </motion.button>
        )}

        <p className="text-xs text-slate-300/80 text-center">
          WASD or Joystick Move · Space Jump · E or Brace Stabilize · Esc Pause
        </p>
      </div>
    </div>
  );
};
