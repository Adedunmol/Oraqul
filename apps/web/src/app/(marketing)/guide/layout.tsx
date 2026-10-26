import type { ReactNode } from 'react';
import { GuideAssistant } from '../../_marketing/guide/guide-assistant';

export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <GuideAssistant />
    </>
  );
}
