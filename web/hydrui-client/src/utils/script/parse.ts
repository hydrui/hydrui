import {
  AssignOp,
  AssignStatement,
  BinaryNode,
  BinaryOp,
  BlockStatement,
  BooleanNode,
  BreakStatement,
  ConditionalStatement,
  ContinueStatement,
  EmptyStatement,
  ExpressionStatement,
  ForStatement,
  FunctionNode,
  IdentNode,
  KeywordNode,
  LambdaNode,
  LetStatement,
  Node,
  NullNode,
  NumberNode,
  PlaceholderNode,
  ReturnStatement,
  Statement,
  StringNode,
  TernaryNode,
  UnaryNode,
  UnaryOp,
  WhileStatement,
} from "./ast";
import { Scanner, Token, TokenType } from "./lex";
import { Span } from "./span";

const LOOP_LIMIT = 5000;

export class Parser {
  private scanner: Scanner;
  private token: Token | undefined;
  private acceptedSpan: Span = { start: 0, end: 0 };
  private acceptedText: string = "";
  private p = 0;

  constructor(
    private readonly source: string,
    private readonly allowPartial = false,
  ) {
    this.scanner = new Scanner(source);
    if (allowPartial) {
      this.token = this.scanner.scan();
    } else {
      this.token = this.scanner.mustScan();
    }
  }

  private advance() {
    if (!this.token) {
      throw new Error("Advanced past end of token stream");
    }
    const end = this.token.span.end;
    this.token = this.scanner.scan();
    if (this.token) {
      this.p = this.token.span.start;
    } else {
      this.p = end;
    }
  }

  private accept(type: TokenType): boolean {
    if (!this.token || this.token.type !== type) {
      return false;
    }
    this.acceptedSpan = this.token.span;
    const { start, end } = this.token.span;
    this.acceptedText = this.source.slice(start, end);
    this.advance();
    return true;
  }

  private expect(type: TokenType): boolean {
    if (!this.token) {
      if (this.allowPartial) {
        // Just treat it as if the required token(s) were present.
        this.acceptedSpan = { start: this.p, end: this.p };
        this.acceptedText = "";
        return false;
      }
      throw new Error("Unexpected end of expression");
    } else if (this.token.type !== type) {
      if (this.allowPartial) {
        // Just treat it as if the required token(s) were present.
        this.acceptedSpan = { start: this.p, end: this.p };
        this.acceptedText = "";
        return false;
      }
      throw new Error(
        `Unexpected token ${this.token.type} (expected ${type}) at ${this.p}`,
      );
    }
    this.acceptedSpan = this.token.span;
    const { start, end } = this.token.span;
    this.acceptedText = this.source.slice(start, end);
    this.advance();
    return true;
  }

  parseScript(): BlockStatement {
    const start = this.p;
    const statements = this.parseStatementsPart();
    if (this.token !== undefined) {
      throw new Error(`Unexpected token: ${this.token.type}`);
    }
    const end = this.p;
    return new BlockStatement({ start, end }, statements);
  }

  private parseStatementPart(order: number = 0): Statement {
    const start = this.p;
    if (order < 1) {
      if (this.accept(TokenType.LeftBrace)) {
        const statements = this.parseStatementsPart();
        this.expect(TokenType.RightBrace);
        const end = this.p;
        return new BlockStatement({ start, end }, statements);
      }
    }
    if (order < 2) {
      if (this.accept(TokenType.ReturnKeyword)) {
        if (this.accept(TokenType.Semicolon)) {
          return new ReturnStatement({ start, end: this.acceptedSpan.start });
        }
        const value = this.parseExprPart();
        this.expect(TokenType.Semicolon);
        return new ReturnStatement(
          { start, end: this.acceptedSpan.start },
          value,
        );
      }
      if (this.accept(TokenType.BreakKeyword)) {
        this.expect(TokenType.Semicolon);
        return new BreakStatement({ start, end: this.acceptedSpan.start });
      }
      if (this.accept(TokenType.ContinueKeyword)) {
        this.expect(TokenType.Semicolon);
        return new ContinueStatement({ start, end: this.acceptedSpan.start });
      }
      if (this.accept(TokenType.IfKeyword)) {
        this.expect(TokenType.LeftParen);
        const condition = this.parseExprPart();
        this.expect(TokenType.RightParen);
        const block = this.parseStatementPart();
        if (this.accept(TokenType.ElseKeyword)) {
          const alternative = this.parseStatementPart();
          const end = this.p;
          return new ConditionalStatement(
            { start, end },
            condition,
            block,
            alternative,
          );
        } else {
          const end = this.p;
          return new ConditionalStatement({ start, end }, condition, block);
        }
      }
      if (this.accept(TokenType.ForKeyword)) {
        this.expect(TokenType.LeftParen);
        let initializer: Statement | undefined = undefined;
        if (!this.accept(TokenType.Semicolon)) {
          initializer = this.parseDeclOrAssignmentOrCall();
          this.expect(TokenType.Semicolon);
        }
        let condition: Node | undefined = undefined;
        if (!this.accept(TokenType.Semicolon)) {
          condition = this.parseExprPart();
          this.expect(TokenType.Semicolon);
        }
        let iterator: Statement | undefined = undefined;
        if (!this.accept(TokenType.RightParen)) {
          iterator = this.parseAssignmentOrCall();
          this.expect(TokenType.RightParen);
        }
        const body = this.parseStatementPart();
        const end = this.p;
        return new ForStatement(
          { start, end },
          initializer,
          condition,
          iterator,
          body,
        );
      }
      if (this.accept(TokenType.WhileKeyword)) {
        this.expect(TokenType.LeftParen);
        const condition = this.parseExprPart();
        this.expect(TokenType.RightParen);
        const body = this.parseStatementPart();
        const end = this.p;
        return new WhileStatement({ start, end }, condition, body);
      }
    }
    if (order < 3) {
      // Empty statement
      if (this.accept(TokenType.Semicolon)) {
        const end = start;
        return new EmptyStatement({ start, end });
      }
      // Declaration, assignment or call statement.
      const assignment = this.parseDeclOrAssignmentOrCall();
      this.expect(TokenType.Semicolon);
      return assignment;
    }
    throw new Error(`Unexpected token: ${this.token?.type ?? "end of script"}`);
  }

  private parseDeclOrAssignmentOrCall(): Statement {
    if (this.accept(TokenType.LetKeyword)) {
      const start = this.p;
      this.expect(TokenType.Identifier);
      const ident = this.acceptedText;
      if (!this.token || this.token.type === TokenType.Semicolon) {
        return new LetStatement({ start, end: this.acceptedSpan.start }, ident);
      }
      this.expect(TokenType.Assign);
      const initializer = this.parseExprPart();
      return new LetStatement(
        { start, end: this.acceptedSpan.start },
        ident,
        initializer,
      );
    }
    return this.parseAssignmentOrCall();
  }

  private parseAssignmentOrCall(): Statement {
    const left = this.parseStatementLeft();
    if (left.isCall) {
      return new ExpressionStatement(left.node);
    } else {
      let assignOp: AssignOp;
      if (this.accept(TokenType.Assign)) {
        assignOp = AssignOp.Assign;
      } else if (this.accept(TokenType.AddAssign)) {
        assignOp = AssignOp.AddAssign;
      } else if (this.accept(TokenType.SubAssign)) {
        assignOp = AssignOp.SubAssign;
      } else if (this.accept(TokenType.MulAssign)) {
        assignOp = AssignOp.MulAssign;
      } else if (this.accept(TokenType.QuoAssign)) {
        assignOp = AssignOp.QuoAssign;
      } else if (this.accept(TokenType.RemAssign)) {
        assignOp = AssignOp.RemAssign;
      } else if (this.accept(TokenType.AndAssign)) {
        assignOp = AssignOp.AndAssign;
      } else if (this.accept(TokenType.OrAssign)) {
        assignOp = AssignOp.OrAssign;
      } else if (this.accept(TokenType.XorAssign)) {
        assignOp = AssignOp.XorAssign;
      } else if (this.accept(TokenType.ShlAssign)) {
        assignOp = AssignOp.ShlAssign;
      } else if (this.accept(TokenType.ShrAssign)) {
        assignOp = AssignOp.ShrAssign;
      } else if (this.accept(TokenType.AndNotAssign)) {
        assignOp = AssignOp.AndNotAssign;
      } else {
        if (this.allowPartial) {
          return new ExpressionStatement(left.node);
        }
        throw new Error(
          `Unexpected token: ${this.token?.type ?? "end of script"}; expected assignment operator`,
        );
      }
      const statement = new AssignStatement(
        left.node,
        assignOp,
        this.parseExprPart(),
      );
      return statement;
    }
  }

  private parseStatementsPart(): Statement[] {
    const result: Statement[] = [];
    let i = 0;
    while (this.token && this.token.type !== TokenType.RightBrace) {
      if (i++ > LOOP_LIMIT) {
        throw new Error("Hit loop limit");
      }
      result.push(this.parseStatementPart());
    }
    return result;
  }

  private parseStatementLeft(depth: number = 0): {
    node: Node;
    isCall: boolean;
  } {
    let n: Node;
    let isCall = false;

    if (this.accept(TokenType.Identifier)) {
      n = new IdentNode(this.acceptedSpan, this.acceptedText);
    } else {
      throw new Error(
        `Lvalue cannot start with ${this.token?.type ?? "end of script"}`,
      );
    }

    const binary = (op: BinaryOp, depth: number) => {
      if (n === undefined) {
        throw new Error("Unexpected binary operator");
      }
      const a = n;
      const b = this.parseExprPart(depth);
      n = new BinaryNode(a, op, b);
    };

    let i = 0;
    while (true) {
      if (i++ > LOOP_LIMIT) {
        throw new Error("Hit loop limit");
      }
      if (depth >= 2) {
        break;
      }
      if (n !== undefined && this.accept(TokenType.Period)) {
        binary(BinaryOp.Member, 2);
        continue;
      }
      if (n !== undefined && this.accept(TokenType.LeftParen)) {
        isCall = true;
        if (this.accept(TokenType.RightParen)) {
          const start = this.p;
          const end = this.p;
          n = new BinaryNode(n, BinaryOp.Call, new NullNode({ start, end }));
          continue;
        }
        binary(BinaryOp.Call, 1);
        continue;
      }
      if (n !== undefined && this.accept(TokenType.LeftBracket)) {
        binary(BinaryOp.Subscript, 1);
        continue;
      }
      break;
    }
    return { node: n, isCall };
  }

  parseExpression(): Node {
    const result = this.parseExprPart();
    if (this.token !== undefined) {
      throw new Error(`Unexpected token: ${this.token.type}`);
    }
    return result;
  }

  private parseExprPart(depth: number = 0): Node {
    const start = this.p;
    let n: Node | undefined = undefined;

    const unary = (op: UnaryOp, depth: number) => {
      const operand = this.parseExprPart(depth);
      const end = this.p;
      const span = { start, end };
      n = new UnaryNode(span, op, operand);
    };

    const binary = (op: BinaryOp, depth: number) => {
      if (n === undefined) {
        throw new Error("Unexpected binary operator");
      }
      const a = n;
      const b = this.parseExprPart(depth);
      n = new BinaryNode(a, op, b);
    };

    const ternary = (depth: number) => {
      if (n === undefined) {
        throw new Error("Unexpected ternary operator");
      }
      const a = n;
      const b = this.parseExprPart(depth);
      this.expect(TokenType.Colon);
      const c = this.parseExprPart(depth);
      n = new TernaryNode(a, b, c);
    };

    if (this.accept(TokenType.Identifier)) {
      n = new IdentNode(this.acceptedSpan, this.acceptedText);
    } else if (this.accept(TokenType.BooleanKeyword)) {
      n = new KeywordNode(this.acceptedSpan, "Boolean");
    } else if (this.accept(TokenType.NumberKeyword)) {
      n = new KeywordNode(this.acceptedSpan, "Number");
    } else if (this.accept(TokenType.StringKeyword)) {
      n = new KeywordNode(this.acceptedSpan, "String");
    } else if (this.accept(TokenType.FunctionKeyword)) {
      return this.parseFunctionExpressionTail();
    } else if (this.accept(TokenType.LambdaKeyword)) {
      return this.parseLambdaExpressionTail();
    } else if (this.accept(TokenType.Number)) {
      n = new NumberNode(this.acceptedSpan, Number(this.acceptedText));
    } else if (this.accept(TokenType.Boolean)) {
      n = new BooleanNode(this.acceptedSpan, Boolean(this.acceptedText));
    } else if (this.accept(TokenType.String)) {
      n = new StringNode(this.acceptedSpan, JSON.parse(this.acceptedText));
    } else if (this.accept(TokenType.Null)) {
      n = new NullNode(this.acceptedSpan);
    } else if (this.accept(TokenType.LeftParen)) {
      n = this.parseExprPart(1);
      this.expect(TokenType.RightParen);
    }

    let i = 0;
    while (true) {
      if (i++ > LOOP_LIMIT) {
        throw new Error("Hit loop limit");
      }
      if (depth >= 8) {
        break;
      }
      if (n !== undefined && this.accept(TokenType.Period)) {
        binary(BinaryOp.Member, 8);
        continue;
      }
      if (n !== undefined && this.accept(TokenType.LeftParen)) {
        if (this.accept(TokenType.RightParen)) {
          const start = this.p;
          const end = this.p;
          n = new BinaryNode(n, BinaryOp.Call, new NullNode({ start, end }));
          continue;
        }
        binary(BinaryOp.Call, 1);
        this.expect(TokenType.RightParen);
        continue;
      }
      if (n !== undefined && this.accept(TokenType.LeftBracket)) {
        binary(BinaryOp.Subscript, 1);
        this.expect(TokenType.RightBracket);
        continue;
      }
      if (n === undefined && this.accept(TokenType.Add)) {
        unary(UnaryOp.Plus, 7);
      }
      if (n === undefined && this.accept(TokenType.Sub)) {
        unary(UnaryOp.Negate, 7);
      }
      if (n === undefined && this.accept(TokenType.Not)) {
        unary(UnaryOp.Not, 7);
      }
      if (n === undefined && this.accept(TokenType.Xor)) {
        unary(UnaryOp.BitNot, 7);
      }
      if (depth >= 7) {
        break;
      }
      if (this.accept(TokenType.Mul)) {
        binary(BinaryOp.Mul, 7);
        continue;
      }
      if (this.accept(TokenType.Quo)) {
        binary(BinaryOp.Div, 7);
        continue;
      }
      if (this.accept(TokenType.Rem)) {
        binary(BinaryOp.Rem, 7);
        continue;
      }
      if (this.accept(TokenType.Shl)) {
        binary(BinaryOp.Lsh, 7);
        continue;
      }
      if (this.accept(TokenType.Shr)) {
        binary(BinaryOp.Rsh, 7);
        continue;
      }
      if (this.accept(TokenType.And)) {
        binary(BinaryOp.And, 7);
        continue;
      }
      if (depth >= 6) {
        break;
      }
      if (this.accept(TokenType.Add)) {
        binary(BinaryOp.Add, 6);
        continue;
      }
      if (this.accept(TokenType.Sub)) {
        binary(BinaryOp.Sub, 6);
        continue;
      }
      if (this.accept(TokenType.Or)) {
        binary(BinaryOp.Or, 6);
        continue;
      }
      if (this.accept(TokenType.Xor)) {
        binary(BinaryOp.Xor, 6);
        continue;
      }
      if (depth >= 5) {
        break;
      }
      if (this.accept(TokenType.Equal)) {
        binary(BinaryOp.Equal, 5);
        continue;
      }
      if (this.accept(TokenType.NotEqual)) {
        binary(BinaryOp.NotEqual, 5);
        continue;
      }
      if (this.accept(TokenType.Lesser)) {
        binary(BinaryOp.Lesser, 5);
        continue;
      }
      if (this.accept(TokenType.LesserEqual)) {
        binary(BinaryOp.LesserEqual, 5);
        continue;
      }
      if (this.accept(TokenType.Greater)) {
        binary(BinaryOp.Greater, 5);
        continue;
      }
      if (this.accept(TokenType.GreaterEqual)) {
        binary(BinaryOp.GreaterEqual, 5);
        continue;
      }
      if (depth >= 4) {
        break;
      }
      if (this.accept(TokenType.LogicalAnd)) {
        binary(BinaryOp.LogicalAnd, 4);
        continue;
      }
      if (depth >= 3) {
        break;
      }
      if (this.accept(TokenType.LogicalOr)) {
        binary(BinaryOp.LogicalOr, 3);
        continue;
      }
      if (this.accept(TokenType.Ternary)) {
        ternary(3);
        continue;
      }
      if (depth >= 2) {
        break;
      }
      if (this.accept(TokenType.Comma)) {
        binary(BinaryOp.Group, 2);
        continue;
      }
      break;
    }
    if (n === undefined) {
      if (this.allowPartial) {
        return new PlaceholderNode({ start: this.p, end: this.p });
      }
      throw new Error("No expression was parsed");
    }
    return n;
  }

  private parseBlockPart() {
    const start = this.p;
    this.expect(TokenType.LeftBrace);
    const statements = this.parseStatementsPart();
    this.expect(TokenType.RightBrace);
    const end = this.p;
    return new BlockStatement({ start, end }, statements);
  }

  private parseFunctionExpressionTail() {
    const start = this.p;
    const args: string[] = [];
    if (this.expect(TokenType.LeftParen)) {
      if (!this.accept(TokenType.RightParen)) {
        let i = 0;
        while (true) {
          if (i++ > LOOP_LIMIT) {
            throw new Error("Hit loop limit");
          }
          if (this.allowPartial && !this.token) {
            break;
          }
          this.expect(TokenType.Identifier);
          args.push(this.acceptedText);
          if (this.accept(TokenType.RightParen)) {
            break;
          }
          this.expect(TokenType.Comma);
        }
      }
    }
    const block = this.parseBlockPart();
    const end = this.p;
    return new FunctionNode({ start, end }, args, block);
  }

  parseLambdaExpressionTail() {
    const start = this.p;
    const args: string[] = [];
    let i = 0;
    while (true) {
      if (i++ > LOOP_LIMIT) {
        throw new Error("Hit loop limit");
      }
      if (!this.expect(TokenType.Identifier)) {
        break;
      }
      args.push(this.acceptedText);
      if (this.accept(TokenType.Colon)) {
        break;
      }
      if (!this.expect(TokenType.Comma)) {
        break;
      }
    }
    const expr = this.parseExprPart();
    const end = this.p;
    return new LambdaNode({ start, end }, args, expr);
  }
}
