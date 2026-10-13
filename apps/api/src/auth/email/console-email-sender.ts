import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailSender } from './email-sender.js';

/** Used when BREVO_API_KEY is empty, so codes show up in the API console during development. */
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`To ${message.to}: ${message.subject}\n${message.text}`);
  }
}
