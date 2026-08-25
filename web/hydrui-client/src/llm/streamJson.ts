export interface StreamingItemCallbacks {
  onItemValue?(index: number, key: string, value: unknown): void;
  onItemTextDelta?(index: number, key: string, delta: string): void;
  onItemEnd?(index: number, value: unknown): void;
}

type Frame =
  | { kind: "object"; value: Record<string, unknown>; key: string | null }
  | { kind: "array"; value: unknown[] };

const ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

export class StreamingArrayParser {
  private buf = "";
  private i = 0;
  private started = false;
  private done = false;
  private stack: Frame[] = [];
  private itemIndex = -1;

  // String tokenizer state.
  private inString = false;
  private stringIsKey = false;
  private str = "";
  private strEscape = false;
  private strUnicode: string | null = null;

  // Number/true/false/null tokenizer state.
  private literal: string | null = null;

  // Text delta batched for the current push() call.
  private delta = "";
  private deltaKey = "";
  private deltaIndex = -1;

  constructor(private callbacks: StreamingItemCallbacks) {}

  push(chunk: string): void {
    if (this.done) return;
    this.buf += chunk;
    this.scan();
    this.flushDelta();
    if (this.i > 0) {
      this.buf = this.buf.slice(this.i);
      this.i = 0;
    }
  }

  private scan(): void {
    if (!this.started) {
      this.stripFenceHeader();
      const open = this.buf.indexOf("[", this.i);
      if (open === -1) return;
      this.started = true;
      this.stack.push({ kind: "array", value: [] });
      this.i = open + 1;
    }
    while (this.i < this.buf.length && !this.done) {
      const ch = this.buf[this.i]!;
      if (this.inString) {
        this.i++;
        this.stringChar(ch);
        continue;
      }
      if (this.literal !== null) {
        if (/[\s,\]}]/.test(ch)) {
          this.endLiteral();
          continue;
        }
        this.literal += ch;
        this.i++;
        continue;
      }
      this.i++;
      if (ch === "," || ch === ":" || /\s/.test(ch)) continue;
      if (ch === '"') {
        const top = this.stack[this.stack.length - 1];
        this.inString = true;
        this.str = "";
        this.strEscape = false;
        this.strUnicode = null;
        this.stringIsKey = top?.kind === "object" && top.key === null;
        if (!this.stringIsKey) this.beginValue();
        continue;
      }
      if (ch === "{") {
        this.beginValue();
        this.stack.push({ kind: "object", value: {}, key: null });
        continue;
      }
      if (ch === "[") {
        this.beginValue();
        this.stack.push({ kind: "array", value: [] });
        continue;
      }
      if (ch === "}" || ch === "]") {
        const frame = this.stack.pop();
        if (!frame || this.stack.length === 0) {
          // Root array closed (or unbalanced close): stop parsing.
          this.done = true;
          return;
        }
        this.completeValue(frame.value);
        continue;
      }
      this.beginValue();
      this.literal = ch;
    }
  }

  private beginValue(): void {
    if (this.stack.length === 1) this.itemIndex++;
  }

  private completeValue(v: unknown): void {
    const parent = this.stack[this.stack.length - 1]!;
    if (parent.kind === "object") {
      if (parent.key !== null) {
        parent.value[parent.key] = v;
        if (this.stack.length === 2) {
          this.callbacks.onItemValue?.(this.itemIndex, parent.key, v);
        }
        parent.key = null;
      }
      return;
    }
    if (this.stack.length === 1) {
      this.callbacks.onItemEnd?.(this.itemIndex, v);
      return;
    }
    parent.value.push(v);
  }

  private stringChar(ch: string): void {
    if (this.strUnicode !== null) {
      this.strUnicode += ch;
      if (this.strUnicode.length === 4) {
        const code = parseInt(this.strUnicode, 16);
        this.strUnicode = null;
        this.appendStringChar(
          Number.isNaN(code) ? "�" : String.fromCharCode(code),
        );
      }
      return;
    }
    if (this.strEscape) {
      this.strEscape = false;
      if (ch === "u") {
        this.strUnicode = "";
        return;
      }
      this.appendStringChar(ESCAPES[ch] ?? ch);
      return;
    }
    if (ch === "\\") {
      this.strEscape = true;
      return;
    }
    if (ch === '"') {
      this.endString();
      return;
    }
    this.appendStringChar(ch);
  }

  private appendStringChar(c: string): void {
    this.str += c;
    if (this.stringIsKey) return;
    const parent = this.stack[this.stack.length - 1];
    if (parent?.kind !== "object" || parent.key === null) return;
    if (this.stack.length !== 2) return;
    if (this.deltaIndex !== this.itemIndex || this.deltaKey !== parent.key) {
      this.flushDelta();
      this.deltaIndex = this.itemIndex;
      this.deltaKey = parent.key;
    }
    this.delta += c;
  }

  private flushDelta(): void {
    if (this.delta && this.deltaIndex >= 0) {
      this.callbacks.onItemTextDelta?.(
        this.deltaIndex,
        this.deltaKey,
        this.delta,
      );
    }
    this.delta = "";
  }

  private endString(): void {
    this.inString = false;
    if (this.stringIsKey) {
      const top = this.stack[this.stack.length - 1];
      if (top?.kind === "object") top.key = this.str;
      return;
    }
    this.flushDelta();
    this.completeValue(this.str);
  }

  private endLiteral(): void {
    const raw = this.literal!;
    this.literal = null;
    let v: unknown;
    if (raw === "true") v = true;
    else if (raw === "false") v = false;
    else if (raw === "null") v = null;
    else {
      const n = Number(raw);
      v = Number.isFinite(n) ? n : undefined;
    }
    this.completeValue(v);
  }

  private stripFenceHeader(): void {
    while (this.i < this.buf.length && /\s/.test(this.buf[this.i]!)) this.i++;
    if (this.buf.startsWith("```", this.i)) {
      const nl = this.buf.indexOf("\n", this.i + 3);
      if (nl === -1) return;
      this.i = nl + 1;
    }
  }
}
