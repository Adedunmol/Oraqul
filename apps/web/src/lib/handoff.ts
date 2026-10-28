// The links that open a checked text in a person's own app. Oraqul sends nothing: the person sees
// the text in their own email or WhatsApp and presses send there. The contact is typed on the page,
// used to build the link in the browser and never sent to the API or stored.

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** A `mailto:` link, or null when the address is not one. */
export function mailtoLink(email: string, subject: string, text: string): string | null {
  const to = email.trim();
  if (!EMAIL.test(to)) return null;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** A WhatsApp click to chat link, or null when the number has too few or too many digits. */
export function whatsappLink(phone: string, text: string): string | null {
  const digits = phone.replace(/[\s()+-]/g, '');
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
