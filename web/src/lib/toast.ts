'use client';

// Tiny global toast bus. Any component can fire toast('…'); a single <Toaster/>
// mounted in the app shell renders them. No state library needed.
export function toast(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pw:toast', { detail: message }));
}

// Standard message shown after any document upload/removal that re-runs the
// system recalculation server-side.
export const PROFILE_UPDATED = 'Profile updated — your score and advice have been refreshed.';
