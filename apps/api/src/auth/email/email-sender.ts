export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  /** Throws a 502 when the provider refuses the message. */
  send(message: EmailMessage): Promise<void>;
}
