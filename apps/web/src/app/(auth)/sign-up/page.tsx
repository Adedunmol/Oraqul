import type { Metadata } from 'next';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Create account · Oraqul' };

export default function SignUpPage() {
  return <SignUpForm />;
}
