import type { CodePurpose } from '@oraqul/schema';
import type { EmailMessage } from './email-sender.js';

const subjects: Record<CodePurpose, string> = {
  signin: 'Your Oraqul sign in code',
  signup: 'Confirm your Oraqul account',
  reset: 'Reset your Oraqul password',
};

const intros: Record<CodePurpose, string> = {
  signin: 'Use this code to sign in to Oraqul.',
  signup: 'Use this code to confirm your email and finish creating your Oraqul account.',
  reset: 'Use this code to choose a new Oraqul password.',
};

export function codeEmail(to: string, purpose: CodePurpose, code: string): EmailMessage {
  const outro = 'It expires in 10 minutes. If you did not ask for it, you can ignore this email.';
  return {
    to,
    subject: subjects[purpose],
    text: `${intros[purpose]}\n\n${code}\n\n${outro}`,
    html: `<p>${intros[purpose]}</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${code}</p><p>${outro}</p>`,
  };
}
