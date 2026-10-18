import { BadRequestException } from '@nestjs/common';
import { Document, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';
import { describe, expect, it } from 'vitest';
import { extractAttachmentText } from './extract.js';

function pdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (const line of lines) doc.text(line);
    doc.end();
  });
}

async function docx(lines: string[]): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: lines.map((text) => new Paragraph(text)) }],
  });
  return Packer.toBuffer(doc);
}

describe('extractAttachmentText', () => {
  it('reads the text of a PDF', async () => {
    const text = await extractAttachmentText(
      'brief.pdf',
      await pdf(['Salt Road', 'A drama set in Accra']),
    );
    expect(text).toContain('Salt Road');
    expect(text).toContain('A drama set in Accra');
  });

  it('reads the text of a Word file', async () => {
    const text = await extractAttachmentText(
      'brief.docx',
      await docx(['Salt Road', 'Comps: The Blue Caftan']),
    );
    expect(text).toContain('Salt Road');
    expect(text).toContain('Comps: The Blue Caftan');
  });

  it('refuses a file whose bytes do not match its extension', async () => {
    await expect(extractAttachmentText('brief.pdf', Buffer.from('just text'))).rejects.toThrow(
      BadRequestException,
    );
    await expect(extractAttachmentText('brief.docx', await pdf(['x']))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses other formats', async () => {
    await expect(extractAttachmentText('brief.doc', Buffer.from('x'))).rejects.toThrow(
      'Only PDF and Word',
    );
  });

  it('says so when a PDF has no text', async () => {
    await expect(extractAttachmentText('scan.pdf', await pdf([]))).rejects.toThrow(
      'no text to read',
    );
  });

  it('cuts text past the attachment cap', async () => {
    const text = await extractAttachmentText('long.docx', await docx(['word '.repeat(50_000)]));
    expect(text.length).toBeLessThanOrEqual(200_000);
  });
});
