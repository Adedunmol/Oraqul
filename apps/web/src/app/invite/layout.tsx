import type { ReactNode } from 'react';

// Invite cards are white, so the page behind them is the canvas, like the signed in app.
export default function InviteLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-canvas">{children}</div>;
}
