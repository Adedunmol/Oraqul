import type { CodePurpose, Role } from '@oraqul/schema';
import type { EmailMessage } from './email-sender.js';

const subjects: Record<CodePurpose, string> = {
  signin: 'Your Oraqul sign in code',
  verify: 'Confirm your email for Oraqul',
  reset: 'Reset your Oraqul password',
};

const intros: Record<CodePurpose, string> = {
  signin: 'Use this code to sign in to Oraqul.',
  verify: 'Use this code to confirm your email for Oraqul.',
  reset: 'Use this code to choose a new Oraqul password.',
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The link signs the person in and confirms the address in one click; the code is for another device. */
export function verifyEmail(to: string, code: string, link: string): EmailMessage {
  const intro = 'Welcome to Oraqul. Confirm your email to start projects and send messages.';
  const alt = `Or enter this code on the confirm page: ${code}`;
  const outro =
    'It expires in 10 minutes. If you did not create an account, you can ignore this email.';
  return {
    to,
    subject: subjects.verify,
    text: `${intro}\n\n${link}\n\n${alt}\n\n${outro}`,
    html: `<p>${intro}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#111;color:#fff;text-decoration:none;font-weight:600">Confirm my email</a></p><p>Or enter this code on the confirm page:</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${code}</p><p>${outro}</p>`,
  };
}

export function codeEmail(to: string, purpose: CodePurpose, code: string): EmailMessage {
  const outro = 'It expires in 10 minutes. If you did not ask for it, you can ignore this email.';
  return {
    to,
    subject: subjects[purpose],
    text: `${intros[purpose]}\n\n${code}\n\n${outro}`,
    html: `<p>${intros[purpose]}</p><p style="font-size:24px;font-weight:600;letter-spacing:4px">${code}</p><p>${outro}</p>`,
  };
}

/** Names are typed by users, so they are escaped in the HTML part. */
export function inviteEmail(
  to: string,
  invite: { teamName: string; invitedBy: string; role: Role; link: string; days: number },
): EmailMessage {
  const intro = `${invite.invitedBy} invited you to join ${invite.teamName} on Oraqul as ${invite.role}.`;
  const outro = `The link works once and expires in ${invite.days} days. Sign in with ${to} to accept. If you were not expecting this, you can ignore this email.`;
  return {
    to,
    subject: `${invite.invitedBy} invited you to ${invite.teamName} on Oraqul`,
    text: `${intro}\n\n${invite.link}\n\n${outro}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(invite.link)}">Accept the invite</a></p><p>${escapeHtml(outro)}</p>`,
  };
}
