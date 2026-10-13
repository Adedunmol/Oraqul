import { BrevoClient, BrevoError } from '@getbrevo/brevo';
import { BadGatewayException } from '@nestjs/common';
import type { EmailMessage, EmailSender } from './email-sender.js';

export class BrevoEmailSender implements EmailSender {
  private readonly client: BrevoClient;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new BrevoClient({ apiKey });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Oraqul', email: this.from },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      });
    } catch (error) {
      if (error instanceof BrevoError) {
        throw new BadGatewayException('The email could not be sent');
      }
      throw error;
    }
  }
}
