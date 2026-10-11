/*
 * Reads the text out of PDF and Word (.docx) files in the browser, so Smart
 * Planner can send it to the existing preview API as plain text. Nothing is
 * uploaded to a third party and the server needs no new parser.
 *
 * Layout is kept where it matters for schedules: table cells and widely
 * spaced columns become "a | b | c", so a timetable reads like the
 * "Date | Time | Event | Description" lines the planner already understands.
 *
 * Both libraries are loaded on demand, so they add nothing to the page until
 * someone actually picks a PDF or Word file.
 */

export type DocumentKind = "pdf" | "docx";

export type ExtractedDocument = {
  kind: DocumentKind;
  text: string;
  lineCount: number;
  pageCount?: number;
};

export class DocumentReadError extends Error {}

export const DOCUMENT_EXTENSIONS: Record<string, DocumentKind> = {
  pdf: "pdf",
  docx: "docx",
};

const MAX_PDF_PAGES = 60;

/*
 * pdf.js reads PDFs in a web worker. The worker file is copied into /public
 * by the "postinstall" script in package.json, so it always matches the
 * installed pdfjs-dist version and works with Turbopack and webpack alike.
 */
const PDF_WORKER_URL = "/pdf.worker.min.mjs";

export function documentKind(file: File): DocumentKind | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_EXTENSIONS[extension] ?? null;
}

export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const kind = documentKind(file);

  if (!kind) {
    throw new DocumentReadError("Only PDF and Word (.docx) files can be read here.");
  }

  const buffer = await file.arrayBuffer();
  const result = kind === "pdf" ? await readPdf(buffer) : await readDocx(buffer);
  const text = tidy(result.lines);

  if (!text) {
    throw new DocumentReadError(
      kind === "pdf"
        ? "No text was found in this PDF. It may be a scanned image. Try a text based PDF, or type the schedule instead."
        : "No text was found in this Word document.",
    );
  }

  return { kind, text, lineCount: text.split("\n").length, pageCount: result.pageCount };
}

/* =============================================================================
   PDF
============================================================================= */

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

async function readPdf(buffer: ArrayBuffer): Promise<{ lines: string[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  let pdf: Awaited<typeof loadingTask.promise>;

  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") {
      throw new DocumentReadError("This PDF is password protected. Remove the password and try again.");
    }
    throw new DocumentReadError("This PDF could not be opened. It may be damaged.");
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new DocumentReadError(`This PDF has ${pdf.numPages} pages. Smart Planner reads up to ${MAX_PDF_PAGES}.`);
  }

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items.flatMap((item) =>
      "str" in item ? [{ str: item.str, transform: item.transform, width: item.width, height: item.height }] : [],
    );

    lines.push(...pdfItemsToLines(items));
    lines.push("");
    page.cleanup();
  }

  const pageCount = pdf.numPages;
  await loadingTask.destroy();

  return { lines, pageCount };
}

/*
 * PDF text arrives as positioned fragments. Fragments that share a baseline
 * form one line; a wide horizontal gap between fragments is treated as a
 * column break and becomes " | ".
 */
export function pdfItemsToLines(items: PdfTextItem[]): string[] {
  const fragments = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      size: Math.abs(item.transform[3]) || item.height || 10,
    }));

  const rows: Array<{ y: number; size: number; parts: typeof fragments }> = [];

  fragments
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .forEach((fragment) => {
      const row = rows.find((candidate) => Math.abs(candidate.y - fragment.y) <= Math.max(2, candidate.size * 0.35));
      if (row) row.parts.push(fragment);
      else rows.push({ y: fragment.y, size: fragment.size, parts: [fragment] });
    });

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const parts = row.parts.sort((a, b) => a.x - b.x);
      let line = "";
      let cursor: number | null = null;

      parts.forEach((part) => {
        if (cursor !== null) {
          const gap = part.x - cursor;
          if (gap > row.size * 0.8) line += " | ";
          else if (gap > row.size * 0.15 && !line.endsWith(" ") && !part.text.startsWith(" ")) line += " ";
        }
        line += part.text;
        cursor = part.x + part.width;
      });

      return line;
    });
}

/* =============================================================================
   WORD (.docx)
============================================================================= */

async function readDocx(buffer: ArrayBuffer): Promise<{ lines: string[]; pageCount?: number }> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default ?? mammothModule;

  let html: string;

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    html = result.value;
  } catch {
    throw new DocumentReadError("This Word document could not be read. Make sure it is a .docx file, not an older .doc.");
  }

  return { lines: htmlToLines(html) };
}

/*
 * Tables become one line per row with cells joined by " | ". Paragraphs,
 * headings and list items become one line each.
 */
export function htmlToLines(html: string): string[] {
  const document = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
  const lines: string[] = [];
  const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

  const walk = (node: Element) => {
    Array.from(node.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();

      if (tag === "table") {
        child.querySelectorAll("tr").forEach((row) => {
          const cells = Array.from(row.querySelectorAll("th, td")).map((cell) => clean(cell.textContent));
          if (cells.some(Boolean)) lines.push(cells.join(" | "));
        });
        lines.push("");
        return;
      }

      if (tag === "ul" || tag === "ol") {
        child.querySelectorAll(":scope > li").forEach((item) => lines.push(clean(item.textContent)));
        return;
      }

      if (/^(p|h[1-6]|li|blockquote|pre)$/.test(tag)) {
        lines.push(clean(child.textContent));
        return;
      }

      walk(child);
    });
  };

  walk(document.body);
  return lines;
}

/* =============================================================================
   SHARED
============================================================================= */

const HEADER_WORDS =
  /^(date|day|time|start|start time|end|end time|duration|event|title|activity|task|item|description|details|notes|type|priority|location|venue|owner|link|meeting link)$/i;

function tidy(lines: string[]) {
  const output: string[] = [];

  lines.forEach((raw) => {
    const line = raw
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/(\s*\|\s*)+/g, " | ")
      .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
      .trim();

    // Drop bare page numbers such as "3" or "Page 3 of 9".
    if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(line)) return;

    // Drop table header rows such as "Date | Time | Event | Notes".
    const cells = line.split(" | ");
    if (cells.length > 1 && cells.every((cell) => HEADER_WORDS.test(cell))) return;

    if (!line) {
      if (output.length && output[output.length - 1] !== "") output.push("");
      return;
    }

    output.push(line);
  });

  return output.join("\n").trim();
}