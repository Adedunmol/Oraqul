import type { Metadata } from 'next';
import { VerifyForm } from './verify-form';

export const metadata: Metadata = { title: 'Enter your code · Oraqul' };

export default function VerifyPage() {
  return <VerifyForm />;
}
