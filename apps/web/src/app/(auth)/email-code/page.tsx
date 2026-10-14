import type { Metadata } from 'next';
import { EmailCodeForm } from './email-code-form';

export const metadata: Metadata = { title: 'Email code · Oraqul' };

export default function EmailCodePage() {
  return <EmailCodeForm />;
}
