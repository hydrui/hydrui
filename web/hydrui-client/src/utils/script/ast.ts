import { Span } from "./span";

export const enum UnaryOp {
  Plus = "+",
  Negate = "-",
  Not = "!",
  BitNot = "^",
}

export const enum BinaryOp {
  LogicalOr = "||",
  LogicalAnd = "&&",
  Equal = "==",
  NotEqual = "!=",
  Lesser = "<",
  LesserEqual = "<=",
  Greater = ">",
  GreaterEqual = ">=",
  Add = "+",
  Sub = "-",
  Or = "|",
  Xor = "^",
  Mul = "*",
  Div = "/",
  Rem = "%",
  Lsh = "<<",
  Rsh = ">>",
  And = "&",
  AndNot = "&^",
  Member = ".",
  Call = "()",
  Subscript = "[]",
  Group = ",",
}

export const enum AssignOp {
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
}

export interface Node {
  readonly span: Span;
  readonly source: string;
}

export class PlaceholderNode implements Node {
  constructor(public readonly span: Span) {}
  get source() {
    return "";
  }
}

export class IdentNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly ident: string,
  ) {}
  get source() {
    return this.ident;
  }
}

export class KeywordNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly keyword: "Boolean" | "Number" | "String",
  ) {}
  get source() {
    return this.keyword;
  }
}

export class NumberNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly value: number,
  ) {}
  get source() {
    return this.value.toString();
  }
}

export class BooleanNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly value: boolean,
  ) {}
  get source() {
    return this.value.toString();
  }
}

export class StringNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly value: string,
  ) {}
  get source() {
    return JSON.stringify(this.value);
  }
}

export class NullNode implements Node {
  constructor(public readonly span: Span) {}
  readonly value = null;
  readonly source = "null";
}

export class UnaryNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly operator: UnaryOp,
    public readonly operand: Node,
  ) {}
  get source() {
    return this.operator + this.operand.source;
  }
}

export class BinaryNode implements Node {
  public readonly span: Span;
  constructor(
    public readonly operandA: Node,
    public readonly operator: BinaryOp,
    public readonly operandB: Node,
  ) {
    this.span = {
      start: operandA.span.start,
      end: operandB.span.end,
    };
  }
  get source() {
    switch (this.operator) {
      case BinaryOp.Member:
        return `${this.operandA.source}.${this.operandB.source}`;
      case BinaryOp.Call:
        return `${this.operandA.source}(${this.operandB.source})`;
      case BinaryOp.Subscript:
        return `${this.operandA.source}[${this.operandB.source}]`;
      case BinaryOp.Group:
        return `${this.operandA.source}, ${this.operandB.source}`;
      default:
        return `${this.operandA.source} ${this.operator} ${this.operandB.source}`;
    }
  }
}

export class TernaryNode implements Node {
  public readonly span: Span;
  constructor(
    public readonly operandA: Node,
    public readonly operandB: Node,
    public readonly operandC: Node,
  ) {
    this.span = {
      start: operandA.span.start,
      end: operandC.span.end,
    };
  }
  get source() {
    return `${this.operandA.source} ? ${this.operandB} : ${this.operandC.source}`;
  }
}

export class LambdaNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly args: string[],
    public readonly expr: Node,
  ) {}
  get source() {
    return `lambda ${this.args.join(", ")}: ${this.expr.source}`;
  }
}

export class FunctionNode implements Node {
  constructor(
    public readonly span: Span,
    public readonly args: string[],
    public readonly block: BlockStatement,
  ) {}
  get source() {
    return `function(${this.args.join(", ")}) ${this.block.source}`;
  }
}

export abstract class Statement implements Node {
  public abstract readonly span: Span;
  abstract get source(): string;
}

export class ExpressionStatement extends Statement {
  public readonly span: Span;
  constructor(public readonly expr: Node) {
    super();
    this.span = {
      start: expr.span.start,
      end: expr.span.end,
    };
  }
  get source() {
    return this.expr.source;
  }
}

export class AssignStatement extends Statement {
  public readonly span: Span;
  constructor(
    public readonly operandA: Node,
    public readonly operator: AssignOp,
    public readonly operandB: Node,
  ) {
    super();
    this.span = {
      start: operandA.span.start,
      end: operandB.span.end,
    };
  }
  get source() {
    return `${this.operandA.source} ${this.operator} ${this.operandB.source}`;
  }
}

export class LetStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly ident: string,
    public readonly initializer?: Node,
  ) {
    super();
  }
  get source() {
    if (this.initializer) {
      return `let ${this.ident} = ${this.initializer.source}`;
    } else {
      return `let ${this.ident}`;
    }
  }
}

export class ReturnStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly value?: Node,
  ) {
    super();
  }
  get source() {
    if (this.value) {
      return `return ${this.value.source}`;
    } else {
      return `return`;
    }
  }
}

export class BreakStatement extends Statement {
  constructor(public readonly span: Span) {
    super();
  }
  get source() {
    return `break`;
  }
}

export class ContinueStatement extends Statement {
  constructor(public readonly span: Span) {
    super();
  }
  get source() {
    return `continue`;
  }
}

function withSemicolon(source: string): string {
  if (source.endsWith("}")) {
    return source;
  }
  return source + ";";
}

export class BlockStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly statements: Statement[],
  ) {
    super();
  }
  get source() {
    return (
      "{\n" +
      this.statements
        .map(
          (statement) =>
            withSemicolon(
              statement.source
                .split("\n")
                .map((line) => "\t" + line)
                .join("\n"),
            ) + "\n",
        )
        .join("") +
      "}"
    );
  }
}

export class ConditionalStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly condition: Node,
    public readonly branch: Statement,
    public readonly alternate?: Statement,
  ) {
    super();
  }
  get source() {
    if (this.alternate) {
      return `if (${this.condition.source}) ${withSemicolon(this.branch.source)} else ${this.alternate.source}`;
    } else {
      return `if (${this.condition.source}) ${this.branch.source}`;
    }
  }
}

export class ForStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly initializer: Statement | undefined,
    public readonly condition: Node | undefined,
    public readonly iterator: Node | undefined,
    public readonly body: Statement,
  ) {
    super();
  }
  get source() {
    return `for (${this.initializer?.source ?? ""}; ${this.condition?.source ?? ""}; ${this.iterator?.source ?? ""}) ${this.body.source}`;
  }
}

export class WhileStatement extends Statement {
  constructor(
    public readonly span: Span,
    public readonly condition: Node,
    public readonly body: Statement,
  ) {
    super();
  }
  get source() {
    return `while (${this.condition.source}) ${this.body.source}`;
  }
}

export class EmptyStatement extends Statement {
  constructor(public readonly span: Span) {
    super();
  }
  get source() {
    return "";
  }
}
