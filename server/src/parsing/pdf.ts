export interface ExtractedText {
  text: string;
  numPages: number;
  charsPerPage: number;
  likelyScanned: boolean;
}

/** Raised when a PDF is encrypted and no (or an incorrect) password was given. */
export class PdfPasswordError extends Error {
  readonly needsPassword: boolean;
  constructor(message: string, needsPassword: boolean) {
    super(message);
    this.name = 'PdfPasswordError';
    this.needsPassword = needsPassword;
  }
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

/**
 * Extract text from a PDF buffer using the pure-JS pdfjs build (no native deps).
 * Reconstructs visual rows by grouping text items on their y-transform.
 * Never executes embedded content: pdfjs runs with eval/font-face disabled.
 * If `password` is omitted and the PDF is encrypted, a PdfPasswordError is
 * thrown with `needsPassword: true` so the caller can prompt for one.
 */
export async function extractPdfText(buffer: Buffer, password?: string): Promise<ExtractedText> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data,
      password,
      useSystemFonts: false,
      disableFontFace: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    }).promise;
  } catch (err: any) {
    const name = err?.name ?? '';
    const message = err instanceof Error ? err.message : String(err);
    if (name === 'PasswordException' || /password/i.test(message)) {
      const incorrect = /incorrect/i.test(message) || err?.code === 2;
      throw new PdfPasswordError(
        incorrect ? 'The password for this PDF is incorrect.' : 'This PDF is password-protected.',
        !incorrect,
      );
    }
    throw err;
  }

  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, TextItem[]>();
    for (const item of content.items as TextItem[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] ?? 0);
      const key = Math.round(y / 2) * 2; // bucket by ~2pt to merge same-line items
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(item);
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const items = rows.get(y)!.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
      const line = items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
  }

  const text = lines.join('\n');
  const charsPerPage = doc.numPages > 0 ? text.length / doc.numPages : 0;
  return {
    text,
    numPages: doc.numPages,
    charsPerPage,
    likelyScanned: charsPerPage < 120,
  };
}
