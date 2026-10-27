import { emptyResponseSchema, type MeResponse, meResponseSchema } from '@oraqul/schema';
import { clientRequest } from './client';

const accepted = emptyResponseSchema;

/** Makes the account and signs the person in; the confirmation email follows. */
export function signup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<MeResponse> {
  return clientRequest(
    '/auth/signup',
    { method: 'POST', body: input, redirectOn401: false },
    meResponseSchema,
  );
}

export function resendVerification(): Promise<void> {
  return clientRequest('/auth/verification', { method: 'POST' }, accepted);
}

export function requestCode(email: string): Promise<void> {
  return clientRequest(
    '/auth/code',
    { method: 'POST', body: { email }, redirectOn401: false },
    accepted,
  );
}

export function verifyCode(email: string, code: string): Promise<MeResponse> {
  return clientRequest(
    '/auth/code/verify',
    { method: 'POST', body: { email, code }, redirectOn401: false },
    meResponseSchema,
  );
}

export function login(email: string, password: string): Promise<MeResponse> {
  return clientRequest(
    '/auth/login',
    { method: 'POST', body: { email, password }, redirectOn401: false },
    meResponseSchema,
  );
}

export function requestReset(email: string): Promise<void> {
  return clientRequest(
    '/auth/password/reset',
    { method: 'POST', body: { email }, redirectOn401: false },
    accepted,
  );
}

export function confirmReset(input: {
  email: string;
  code: string;
  password: string;
}): Promise<MeResponse> {
  return clientRequest(
    '/auth/password/reset/confirm',
    { method: 'POST', body: input, redirectOn401: false },
    meResponseSchema,
  );
}

export function logout(): Promise<void> {
  return clientRequest('/auth/logout', { method: 'POST' }, accepted);
}

export function updateProfile(name: string): Promise<MeResponse> {
  return clientRequest(
    '/auth/me',
    { method: 'PATCH', body: { name }, redirectOn401: false },
    meResponseSchema,
  );
}

/** `currentPassword` is left out by an account that has no password yet. */
export function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<MeResponse> {
  return clientRequest(
    '/auth/password/change',
    { method: 'POST', body: input, redirectOn401: false },
    meResponseSchema,
  );
}
