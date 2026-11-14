import React, { useRef, useState } from 'react';
import { ArrowUp, Hand, Shield } from 'lucide-react';
import { LocalInputState } from './GameCanvas';

interface TouchControlsProps {
  inputRef: React.MutableRefObject<LocalInputState>;
  buttonScale: number;
  visible: boolean;
  onInteract: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  inputRef,
  buttonScale,
  visible,
  onInteract,
}) => {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [bracing, setBracing] = useState(false);
  const joyTouchId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  if (!visible) return null;

  const maxRadius = 46 * buttonScale;

  const handleJoyStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    if (!touch || joyTouchId.current !== null) return;
    joyTouchId.current = touch.identifier;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const handleJoyMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        const dx = t.clientX - joyOrigin.current.x;
        const dy = t.clientY - joyOrigin.current.y;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        const kx = Math.cos(angle) * clamped;
        const ky = Math.sin(angle) * clamped;
        setKnobOffset({ x: kx, y: ky });
        inputRef.current.moveX = kx / maxRadius;
        inputRef.current.moveY = -ky / maxRadius;
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnobOffset({ x: 0, y: 0 });
        inputRef.current.moveX = 0;
        inputRef.current.moveY = 0;
      }
    }
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t || lookTouchId.current !== null) return;
    lookTouchId.current = t.identifier;
    lookLast.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        inputRef.current.lookDeltaX += t.clientX - lookLast.current.x;
        inputRef.current.lookDeltaY += t.clientY - lookLast.current.y;
        lookLast.current = { x: t.clientX, y: t.clientY };
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  const btnSize = Math.round(56 * buttonScale);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Right-half Touch Look Zone */}
      <div
        className="absolute right-0 top-14 bottom-0 w-1/2 pointer-events-auto touch-none"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* Left Virtual Joystick */}
      <div
        className="absolute left-6 bottom-6 rounded-full bg-slate-950/45 border-2 border-white/25 flex items-center justify-center pointer-events-auto touch-none"
        style={{
          width: `${Math.round(122 * buttonScale)}px`,
          height: `${Math.round(122 * buttonScale)}px`,
        }}
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
        aria-label="Movement Joystick"
      >
        <div
          className="rounded-full bg-amber-400 border-2 border-white shadow-lg pointer-events-none"
          style={{
            width: `${Math.round(48 * buttonScale)}px`,
            height: `${Math.round(48 * buttonScale)}px`,
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Action Buttons (Jump, Brace, Interact) */}
      <div className="absolute right-6 bottom-6 flex items-end gap-3 pointer-events-auto">
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            const next = !bracing;
            setBracing(next);
            inputRef.current.isBracing = next;
          }}
          onClick={() => {
            const next = !bracing;
            setBracing(next);
            inputRef.current.isBracing = next;
          }}
          style={{ width: btnSize, height: btnSize }}
          className={`rounded-full flex flex-col items-center justify-center border-2 transition-transform active:scale-95 ${
            bracing
              ? 'bg-emerald-600 border-emerald-200 text-white'
              : 'bg-slate-950/60 border-white/30 text-white'
          }`}
          aria-label="Brace Object"
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Brace</span>
        </button>

        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            onInteract();
          }}
          onClick={onInteract}
          style={{ width: btnSize, height: btnSize }}
          className="rounded-full bg-slate-950/60 border-2 border-white/30 text-white flex flex-col items-center justify-center active:scale-95 transition-transform"
          aria-label="Interact"
        >
          <Hand className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-0.5">Tip</span>
        </button>

        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            inputRef.current.jumpBufferedUntil = performance.now() + 140;
          }}
          onClick={() => {
            inputRef.current.jumpBufferedUntil = performance.now() + 140;
          }}
          style={{ width: Math.round(btnSize * 1.15), height: Math.round(btnSize * 1.15) }}
          className="rounded-full bg-amber-500 border-2 border-amber-200 text-slate-950 font-bold flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
          aria-label="Jump"
        >
          <ArrowUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Jump</span>
        </button>
      </div>
    </div>
  );
};
