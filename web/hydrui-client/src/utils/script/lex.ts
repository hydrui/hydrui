import { Span } from "./span";

export const enum TokenType {
  Identifier = "Identifier",
  Number = "Number",
  Boolean = "Boolean",
  String = "String",
  Null = "Null",

  Assign = "=",
  AddAssign = "+=",
  SubAssign = "-=",
  MulAssign = "*=",
  QuoAssign = "/=",
  RemAssign = "%=",
  AndAssign = "&=",
  OrAssign = "|=",
  XorAssign = "^=",
  ShlAssign = "<<=",
  ShrAssign = ">>=",
  AndNotAssign = "&^=",

  Add = "+",
  Sub = "-",
  Mul = "*",
  Quo = "/",
  Rem = "%",

  And = "&",
  Not = "!",
  Or = "|",
  Xor = "^",
  Shl = "<<",
  Shr = ">>",
  AndNot = "&^",

  LogicalAnd = "&&",
  LogicalOr = "||",

  Equal = "==",
  Lesser = "<",
  Greater = ">",
  NotEqual = "!=",
  LesserEqual = "<=",
  GreaterEqual = ">=",

  LeftParen = "(",
  LeftBracket = "[",
  LeftBrace = "{",
  Comma = ",",
  Period = ".",

  RightParen = ")",
  RightBracket = "]",
  RightBrace = "}",
  Colon = ":",
  Semicolon = ";",
  Ternary = "?",

  BooleanKeyword = "BooleanKeyword",
  NumberKeyword = "NumberKeyword",
  StringKeyword = "StringKeyword",
  LetKeyword = "LetKeyword",
  ReturnKeyword = "ReturnKeyword",
  FunctionKeyword = "FunctionKeyword",
  LambdaKeyword = "LambdaKeyword",
  IfKeyword = "IfKeyword",
  ElseKeyword = "ElseKeyword",
  ForKeyword = "ForKeyword",
  WhileKeyword = "WhileKeyword",
  BreakKeyword = "BreakKeyword",
  ContinueKeyword = "ContinueKeyword",
}

export class Token {
  constructor(
    public readonly type: TokenType,
    public readonly span: Span,
  ) {}
}

export class Scanner {
  private p = 0;
  constructor(public readonly source: string) {}

  get eof() {
    return this.p === this.source.length;
  }

  private peek(): string {
    return this.source.slice(this.p, this.p + 1);
  }

  private peek2(): string {
    return this.source.slice(this.p, this.p + 2);
  }

  private peek3(): string {
    return this.source.slice(this.p, this.p + 3);
  }

  private mustAdvance(): string {
    const ch = this.source[this.p];
    if (this.eof || ch === undefined) {
      throw new Error("Unexpected end of expression");
    }
    this.p++;
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (true) {
      if (isWhitespace(this.peek())) {
        while (isWhitespace(this.peek())) {
          this.p++;
        }
        continue;
      }
      if (this.peek2() === "//") {
        this.p += 2;
        while (this.peek() !== "\n") {
          this.p++;
        }
        continue;
      }
      if (this.peek2() === "/*") {
        this.p += 2;
        while (this.peek2() !== "*/") {
          this.p++;
        }
        this.p += 2;
        continue;
      }
      break;
    }
  }

  private accept(ch: string): boolean {
    if (this.peek() === ch) {
      this.p++;
      return true;
    }
    return false;
  }

  private expect(expect: string): boolean {
    const ch = this.peek();
    if (ch === expect) {
      this.p++;
      return true;
    }
    throw new Error(`Expected ${expect}, got ${ch}`);
  }

  private scanIdent(): Token {
    const start = this.p;
    const ch = this.peek();
    if (!isLetter(ch) && ch != "_") {
      throw new Error(`Invalid identifier character ${ch}`);
    }
    do {
      this.p++;
    } while (isIdent(this.peek()));
    const end = this.p;
    const span = { start, end };
    switch (this.source.slice(start, end)) {
      case "Boolean":
        return { type: TokenType.BooleanKeyword, span };
      case "Number":
        return { type: TokenType.NumberKeyword, span };
      case "String":
        return { type: TokenType.StringKeyword, span };
      case "let":
        return { type: TokenType.LetKeyword, span };
      case "return":
        return { type: TokenType.ReturnKeyword, span };
      case "function":
        return { type: TokenType.FunctionKeyword, span };
      case "lambda":
        return { type: TokenType.LambdaKeyword, span };
      case "if":
        return { type: TokenType.IfKeyword, span };
      case "else":
        return { type: TokenType.ElseKeyword, span };
      case "for":
        return { type: TokenType.ForKeyword, span };
      case "while":
        return { type: TokenType.WhileKeyword, span };
      case "break":
        return { type: TokenType.BreakKeyword, span };
      case "continue":
        return { type: TokenType.ContinueKeyword, span };
      case "true":
        return { type: TokenType.Boolean, span };
      case "false":
        return { type: TokenType.Boolean, span };
      case "null":
        return { type: TokenType.Null, span };
      default:
        return { type: TokenType.Identifier, span };
    }
  }

  private scanNumber(): Token {
    const start = this.p;
    const ch = this.mustAdvance();
    if (!isNumber(ch) && ch !== "-") {
      throw new Error(`Invalid number character ${ch}`);
    }
    while (isNumber(this.peek())) {
      this.p++;
    }
    const end = this.p;
    const span = { start, end };
    return { type: TokenType.Number, span };
  }

  private scanString(): Token {
    const start = this.p;
    this.expect('"');
    while (true) {
      if (this.accept('"')) {
        break;
      }
      if (this.accept("\\")) {
        this.mustAdvance();
        continue;
      }
      this.mustAdvance();
    }
    const end = this.p;
    const span = { start, end };
    return { type: TokenType.String, span };
  }

  scan(): Token | undefined {
    try {
      return this.scanToken();
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`Index ${this.p}: ${e.message}`);
      }
      throw e;
    }
  }

  private scanToken(): Token | undefined {
    this.skipWhitespaceAndComments();
    const start = this.p;
    const makeToken = (type: TokenType) => {
      const end = this.p;
      const span = { start, end };
      return { type, span };
    };
    if (this.eof) {
      return;
    }
    const c = this.peek();
    const cc = this.peek2();
    const ccc = this.peek3();
    if (isLetter(c)) {
      return this.scanIdent();
    }
    if (isDecimal(c) || ((c === "-" || c === ".") && isDecimal(cc.slice(1)))) {
      return this.scanNumber();
    }
    if (c === '"') {
      return this.scanString();
    }
    this.p += 3;
    switch (ccc) {
      case "<<=":
        return makeToken(TokenType.ShlAssign);
      case ">>=":
        return makeToken(TokenType.ShrAssign);
      case "&^=":
        return makeToken(TokenType.AndNotAssign);
    }
    this.p--;
    switch (cc) {
      case "&&":
        return makeToken(TokenType.LogicalAnd);
      case "&^":
        return makeToken(TokenType.AndNot);
      case "||":
        return makeToken(TokenType.LogicalOr);
      case "<=":
        return makeToken(TokenType.LesserEqual);
      case "<<":
        return makeToken(TokenType.Shl);
      case ">=":
        return makeToken(TokenType.GreaterEqual);
      case ">>":
        return makeToken(TokenType.Shr);
      case "==":
        return makeToken(TokenType.Equal);
      case "!=":
        return makeToken(TokenType.NotEqual);
      case "+=":
        return makeToken(TokenType.AddAssign);
      case "-=":
        return makeToken(TokenType.SubAssign);
      case "*=":
        return makeToken(TokenType.MulAssign);
      case "/=":
        return makeToken(TokenType.QuoAssign);
      case "%=":
        return makeToken(TokenType.RemAssign);
      case "&=":
        return makeToken(TokenType.AndAssign);
      case "|=":
        return makeToken(TokenType.OrAssign);
      case "^=":
        return makeToken(TokenType.XorAssign);
    }
    this.p--;
    switch (c) {
      case "=":
        return makeToken(TokenType.Assign);
      case "+":
        return makeToken(TokenType.Add);
      case "-":
        return makeToken(TokenType.Sub);
      case "*":
        return makeToken(TokenType.Mul);
      case "/":
        return makeToken(TokenType.Quo);
      case "%":
        return makeToken(TokenType.Rem);
      case "&":
        return makeToken(TokenType.And);
      case "|":
        return makeToken(TokenType.Or);
      case "^":
        return makeToken(TokenType.Xor);
      case "<":
        return makeToken(TokenType.Lesser);
      case ">":
        return makeToken(TokenType.Greater);
      case "!":
        return makeToken(TokenType.Not);
      case "(":
        return makeToken(TokenType.LeftParen);
      case "[":
        return makeToken(TokenType.LeftBracket);
      case "{":
        return makeToken(TokenType.LeftBrace);
      case ",":
        return makeToken(TokenType.Comma);
      case ".":
        return makeToken(TokenType.Period);
      case ")":
        return makeToken(TokenType.RightParen);
      case "]":
        return makeToken(TokenType.RightBracket);
      case "}":
        return makeToken(TokenType.RightBrace);
      case ":":
        return makeToken(TokenType.Colon);
      case ";":
        return makeToken(TokenType.Semicolon);
      case "?":
        return makeToken(TokenType.Ternary);
    }
    this.p--;
    throw new Error(`Unhandled character: '${c}'`);
  }

  mustScan(): Token {
    const token = this.scan();
    if (token === undefined) {
      throw new Error("Unexpected end of expression");
    }
    return token;
  }
}

function isDecimal(ch: string): boolean {
  return "0" <= ch && ch <= "9";
}

function isHex(ch: string): boolean {
  return (
    ("0" <= ch && ch <= "9") ||
    ("a" <= ch && ch <= "f") ||
    ("A" <= ch && ch <= "F")
  );
}

function isLetter(ch: string): boolean {
  return ("a" <= ch && ch <= "z") || ("A" <= ch && ch <= "Z");
}

function isNumber(ch: string): boolean {
  return isDecimal(ch) || isHex(ch) || ch === "." || ch === "x" || ch === "X";
}

function isIdent(ch: string): boolean {
  return isLetter(ch) || isDecimal(ch) || ch === "_";
}

function isWhitespace(ch: string): boolean {
  return ch == " " || ch == "\t" || ch == "\n";
}
