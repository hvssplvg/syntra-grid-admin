// Measures how many lines a piece of text will wrap to at a given
// font size/width, so templates can stack real text blocks without
// overlapping (Content Studio manual-test Part 4 — "text layers
// overlap and are not laid out professionally", caused by fixed
// y-fractions that were oblivious to actual text length). Uses a plain
// offscreen canvas 2D word-wrap simulation — the same measurement
// technique Konva itself relies on internally, not a guess.

const LINE_HEIGHT_MULTIPLIER = 1.25;

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null; // server-safe no-op (client-only feature)
  if (measureCtx) return measureCtx;
  measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

function wrappedLineCount(text: string, fontSize: number, width: number, bold: boolean): number {
  const ctx = getMeasureContext();
  if (!ctx || !text.trim()) return text.trim() ? 1 : 0;

  ctx.font = `${bold ? "700" : "400"} ${fontSize}px Arial`;

  const words = text.trim().split(/\s+/);
  let lines = 1;
  let lineText = "";

  for (const word of words) {
    const candidate = lineText ? `${lineText} ${word}` : word;
    if (ctx.measureText(candidate).width > width && lineText) {
      lines += 1;
      lineText = word;
    } else {
      lineText = candidate;
    }
  }

  return lines;
}

/** Height (in canvas px) this text will actually occupy once wrapped —
 *  what templates stack against, instead of a fixed fraction of the
 *  canvas that ignores how long the text is. */
export function measureWrappedTextHeight(text: string, fontSize: number, width: number, bold = false): number {
  const lines = wrappedLineCount(text, fontSize, width, bold);
  return lines * fontSize * LINE_HEIGHT_MULTIPLIER;
}
