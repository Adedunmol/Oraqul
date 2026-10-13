import { z } from 'zod';

export const codePurposes = ['signin', 'signup', 'reset'] as const;
export type CodePurpose = (typeof codePurposes)[number];
export const oauthProviders = ['google'] as const;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const passwordSchema = z.string().min(8).max(200);
export const codeSchema = z.string().regex(/^\d{6}$/);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const codeRequestSchema = z.object({ email: emailSchema });
export const codeVerifySchema = z.object({ email: emailSchema, code: codeSchema });
export const resetRequestSchema = z.object({ email: emailSchema });
export const resetConfirmSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  password: passwordSchema,
});

/** Only same-site paths, so a sign-in redirect cannot leave the web app. */
export const nextPathSchema = z
  .string()
  .max(500)
  .refine((path) => path.startsWith('/') && !path.startsWith('//') && !path.includes('\\'));

export const meResponseSchema = z.object({
  user: z.object({ id: z.uuid(), email: z.email(), name: z.string() }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

/** For routes that answer 202 or 204 with no body. */
export const emptyResponseSchema = z.undefined();
