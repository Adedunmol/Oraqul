import type { LaunchPlan, Output } from '@oraqul/schema';
import { Document, FootnoteReferenceRun, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

// Exports of a launch plan (PRD O3): the plan as a document a team sends to distributors and
// partners. Lines backed by audience data carry a footnote to where it came from; the sources
// close the document. Raw Qloo responses stay out until Qloo confirms what may be shared (PRD O4).

export const exportFormats = ['md', 'docx', 'pdf'] as const;
export type ExportFormat = (typeof exportFormats)[number];

interface DocLine {
  text: string;
  /** Footnote numbers of the sources behind the line. */
  refs: number[];
}

interface DocSection {
  title: string;
  groups: { name: string | null; lines: DocLine[] }[];
}

/** One shape for every format, so the Markdown, the Word file and the PDF read the same. */
interface PlanDoc {
  title: string;
  byline: string;
  inBrief: DocLine[];
  sections: DocSection[];
  sharpen: string[];
  sources: { n: number; text: string; from: string }[];
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function planDoc(output: Output, plan: LaunchPlan): PlanDoc {
  // Footnotes are numbered in the order the plan first cites them, as on the Plan tab.
  const order = new Map<string, number>();
  for (const line of plan.sections.flatMap((s) => s.lines)) {
    for (const id of [...line.findingIds, ...line.sourceIds]) {
      if (!order.has(id)) order.set(id, order.size + 1);
    }
  }
  const docLine = (l: LaunchPlan['sections'][number]['lines'][number]): DocLine => ({
    text: l.text,
    refs: [...l.findingIds, ...l.sourceIds].flatMap((id) => order.get(id) ?? []),
  });
  const groups = (lines: LaunchPlan['sections'][number]['lines']) => {
    const out: DocSection['groups'] = [];
    for (const l of lines) {
      const last = out.at(-1);
      if (last && last.name === l.group) last.lines.push(docLine(l));
      else out.push({ name: l.group, lines: [docLine(l)] });
    }
    return out;
  };
  return {
    title: output.title,
    byline: `Launch plan · ${output.createdBy} · ${day(output.createdAt)}`,
    inBrief: (plan.sections.find((s) => s.key === 'bottom-line')?.lines ?? []).map(docLine),
    sections: plan.sections
      .filter((s) => s.key !== 'bottom-line' && s.key !== 'gaps')
      .map((s) => ({ title: s.title, groups: groups(s.lines) })),
    sharpen: (plan.sections.find((s) => s.key === 'gaps')?.lines ?? []).map((l) => l.text),
    sources: [...order].flatMap(([id, n]) => {
      const web = plan.sources.find((src) => src.id === id);
      if (web) return [{ n, text: web.fact, from: `${web.title}, ${web.url}` }];
      const finding = plan.findings.find((f) => f.id === id);
      if (!finding) return [];
      const receipt = output.receipts.find((r) => r.lineId === id);
      const from =
        receipt?.source === 'demo'
          ? 'Demo data, not Qloo.'
          : `Qloo taste data, ${receipt ? day(receipt.calledAt) : day(output.createdAt)}.`;
      return [{ n, text: finding.text, from }];
    }),
  };
}

const IN_BRIEF = 'In brief';
const SHARPEN = 'To sharpen this plan';
const SOURCES = 'Sources';

/** The plan as Markdown, for email, Slack or Notion. */
export function toMarkdown(output: Output): string {
  if (!output.plan) return `# ${output.title}\n\n${output.summary}\n`;
  const doc = planDoc(output, output.plan);
  const line = (l: DocLine) => `${l.text}${l.refs.map((n) => `[^${n}]`).join('')}`;
  const out: string[] = [`# ${doc.title}`, '', `_${doc.byline}_`, ''];
  out.push(`## ${IN_BRIEF}`, '', ...doc.inBrief.map((l, i) => `${i + 1}. ${line(l)}`), '');
  for (const s of doc.sections) {
    out.push(`## ${s.title}`, '');
    for (const g of s.groups) {
      if (g.name) out.push(`**${g.name}**`, '');
      out.push(...g.lines.map((l) => `- ${line(l)}`), '');
    }
  }
  if (doc.sharpen.length) out.push(`## ${SHARPEN}`, '', ...doc.sharpen.map((t) => `- ${t}`), '');
  if (doc.sources.length) {
    out.push(`## ${SOURCES}`, '', ...doc.sources.map((s) => `[^${s.n}]: ${s.text} ${s.from}`));
  }
  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

/** The plan as a Word document, for teams that edit and merge plans. */
export async function toDocx(output: Output): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: output.title, heading: HeadingLevel.TITLE }),
  ];
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  if (!output.plan) {
    children.push(...output.summary.split('\n').map((t) => new Paragraph({ text: t })));
  } else {
    const doc = planDoc(output, output.plan);
    for (const s of doc.sources) {
      footnotes[s.n] = { children: [new Paragraph(`${s.text} ${s.from}`)] };
    }
    const runs = (l: DocLine) => [
      new TextRun(l.text),
      ...l.refs.map((n) => new FootnoteReferenceRun(n)),
    ];
    children.push(new Paragraph({ children: [new TextRun({ text: doc.byline, italics: true })] }));
    children.push(new Paragraph({ text: IN_BRIEF, heading: HeadingLevel.HEADING_1 }));
    children.push(
      ...doc.inBrief.map(
        (l) => new Paragraph({ numbering: { reference: 'moves', level: 0 }, children: runs(l) }),
      ),
    );
    for (const s of doc.sections) {
      children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }));
      for (const g of s.groups) {
        if (g.name) children.push(new Paragraph({ text: g.name, heading: HeadingLevel.HEADING_3 }));
        children.push(
          ...g.lines.map((l) => new Paragraph({ bullet: { level: 0 }, children: runs(l) })),
        );
      }
    }
    if (doc.sharpen.length) {
      children.push(new Paragraph({ text: SHARPEN, heading: HeadingLevel.HEADING_1 }));
      children.push(...doc.sharpen.map((t) => new Paragraph({ text: t, bullet: { level: 0 } })));
    }
  }
  const document = new Document({
    title: output.title,
    creator: 'Oraqul',
    footnotes,
    numbering: {
      config: [
        {
          reference: 'moves',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(document);
}

// The PDF's standard fonts cover Latin text only, so a sign they lack is spelled out.
const pdfSafe = (text: string) =>
  [...text.replace(/₦/g, 'NGN ')]
    .filter((ch) => ch.charCodeAt(0) <= 0xff || '‘’“”–—•…'.includes(ch))
    .join('');

/** The plan as a PDF, laid out as a document, for distributors, financiers and partners. */
export function toPdf(output: Output): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: { Title: output.title, Creator: 'Oraqul' },
  });
  const chunks: Buffer[] = [];
  pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    pdf.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const ink = '#111114';
  const muted = '#5a5a63';
  const accent = '#2f3d7a';
  const heading = (text: string) => {
    pdf.moveDown(1.1);
    pdf.font('Helvetica-Bold').fontSize(14).fillColor(ink).text(pdfSafe(text));
    pdf.moveDown(0.4);
  };
  const line = (l: DocLine, lead: string) => {
    const indent = 14;
    const x = pdf.page.margins.left;
    const y = pdf.y;
    pdf.font('Helvetica').fontSize(10.5).fillColor(ink).text(lead, x, y, { width: indent });
    pdf
      .text(pdfSafe(l.text), x + indent, y, {
        width: pdf.page.width - pdf.page.margins.left - pdf.page.margins.right - indent,
        continued: l.refs.length > 0,
        lineGap: 2,
      })
      .fillColor(accent);
    if (l.refs.length) pdf.fontSize(7.5).text(` ${l.refs.join(',')}`, { lineGap: 2 });
    pdf.fillColor(ink).fontSize(10.5);
    pdf.x = x;
    pdf.moveDown(0.35);
  };

  pdf.font('Helvetica-Bold').fontSize(24).fillColor(ink).text(pdfSafe(output.title));
  pdf.moveDown(0.2);
  if (!output.plan) {
    pdf.font('Helvetica').fontSize(11).text(pdfSafe(output.summary));
    pdf.end();
    return done;
  }
  const doc = planDoc(output, output.plan);
  pdf.font('Helvetica').fontSize(10).fillColor(muted).text(pdfSafe(doc.byline));

  heading(IN_BRIEF);
  doc.inBrief.forEach((l, i) => {
    line(l, `${i + 1}.`);
  });
  for (const s of doc.sections) {
    heading(s.title);
    for (const g of s.groups) {
      if (g.name) {
        pdf.moveDown(0.2);
        pdf.font('Helvetica-Bold').fontSize(10.5).fillColor(muted).text(pdfSafe(g.name));
        pdf.moveDown(0.2);
      }
      for (const l of g.lines) line(l, '•');
    }
  }
  if (doc.sharpen.length) {
    heading(SHARPEN);
    for (const t of doc.sharpen) line({ text: t, refs: [] }, '•');
  }
  if (doc.sources.length) {
    heading(SOURCES);
    pdf.font('Helvetica').fontSize(8.5).fillColor(muted);
    for (const s of doc.sources) {
      pdf.text(pdfSafe(`${s.n}. ${s.text} ${s.from}`), { lineGap: 1.5 });
      pdf.moveDown(0.25);
    }
  }
  pdf.end();
  return done;
}

/** A file name from the output's title. */
export function fileName(output: Output, format: ExportFormat): string {
  const base = output.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'plan';
  return `${base}.${format}`;
}
