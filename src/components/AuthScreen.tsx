import React, { useState } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface AuthScreenProps {
  onGoogleSignIn: () => Promise<void>;
  error: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onGoogleSignIn, error }) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    soundEngine.click();
    setBusy(true);
    try {
      await onGoogleSignIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75">
      <div className="w-full max-w-md rounded-2xl bg-[#f8fafc] text-slate-900 p-7 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl leading-tight text-slate-900">
              Sign in to Play Co-Op
            </h1>
            <p className="text-xs text-slate-600">
              Persistent Player UID · 3D Avatar · Online Rooms
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Sign in with your Google account to save your character customization, track co-op stats, join two-player rooms, and sync optional challenge missions to Google Tasks.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={handleClick}
          className="gsi-material-button w-full"
        >
          <div className="gsi-material-button-state" />
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              {busy ? 'Connecting Account...' : 'Sign in with Google'}
            </span>
          </div>
        </button>

        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Secured with Firebase Authentication & Cloud Firestore</span>
        </div>
      </div>
    </div>
  );
};
