import { BadRequestException } from '@nestjs/common';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';

/** The schema's cap on an attachment's text; a longer file is cut, not refused. */
export const MAX_TEXT_CHARS = 200_000;

const PDF_MAGIC = '%PDF-';
// A .docx is a zip archive, which starts with these two bytes.
const ZIP_MAGIC = 'PK';

function startsWith(bytes: Buffer, magic: string): boolean {
  return bytes.subarray(0, magic.length).toString('latin1') === magic;
}

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The extension picks the reader and the first bytes must agree with it, so a renamed file never
 * reaches a parser. Throws a plain reason for a scanned PDF, which has no text layer.
 */
export async function extractAttachmentText(name: string, bytes: Buffer): Promise<string> {
  const lower = name.toLowerCase();
  let raw: string;
  try {
    if (lower.endsWith('.pdf') && startsWith(bytes, PDF_MAGIC)) {
      const { text } = await extractText(new Uint8Array(bytes), { mergePages: true });
      raw = text;
    } else if (lower.endsWith('.docx') && startsWith(bytes, ZIP_MAGIC)) {
      raw = (await mammoth.extractRawText({ buffer: bytes })).value;
    } else {
      throw new BadRequestException('Only PDF and Word (.docx) files can be read.');
    }
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(`${name} could not be read. Try exporting it again.`);
  }
  const text = tidy(raw);
  if (!text) {
    throw new BadRequestException(
      `${name} has no text to read. A scanned file needs to be typed out or run through text recognition first.`,
    );
  }
  return text.slice(0, MAX_TEXT_CHARS);
}
