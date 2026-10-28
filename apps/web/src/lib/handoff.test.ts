import { describe, expect, it } from 'vitest';
import { mailtoLink, whatsappLink } from './handoff';

describe('mailtoLink', () => {
  it('puts the subject and the text in the link, encoded', () => {
    const link = mailtoLink(
      ' hello@brand.com ',
      'Night Ferry: working with Brand',
      'Hello,\n\nA line & more.',
    );
    expect(link).toBe(
      'mailto:hello@brand.com?subject=Night%20Ferry%3A%20working%20with%20Brand&body=Hello%2C%0A%0AA%20line%20%26%20more.',
    );
  });
  it.each(['', 'nobody', 'a@b', 'a@b.c', 'two@x.com, three@y.com'])('refuses %j', (email) => {
    expect(mailtoLink(email, 's', 't')).toBeNull();
  });
});

describe('whatsappLink', () => {
  it('uses the digits only', () => {
    expect(whatsappLink('+234 (803) 555-0100', 'Hi there')).toBe(
      'https://wa.me/2348035550100?text=Hi%20there',
    );
  });
  it.each(['', '12345', 'call me', '1'.repeat(16)])('refuses %j', (phone) => {
    expect(whatsappLink(phone, 't')).toBeNull();
  });
});
