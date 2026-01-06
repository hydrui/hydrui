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
  StringNode,
  TernaryNode,
  UnaryNode,
  UnaryOp,
  WhileStatement,
} from "./ast";
import { Break, Continue, Return, flattenGroup } from "./eval";
import { Resolver, ScopeResolver, SpeculativeResolver } from "./resolver";
import { Span } from "./span";
import { fuzzySuggest } from "./suggest";
import {
  BooleanTypeValue,
  BooleanValue,
  FunctionValue,
  NullValue,
  NumberTypeValue,
  NumberValue,
  StringTypeValue,
  StringValue,
  Value,
  Variable,
} from "./value";

class SuggestionContext {
  constructor(readonly suggestPosition?: number) {}
}

class MaybeSuggest {
  constructor(readonly partial: string) {}
}

export class Suggestions {
  constructor(
    readonly identifiers: string[],
    readonly replaceSpan: Span,
  ) {}
}

class SuggestionResolver implements Resolver {
  constructor(private readonly parent: Resolver) {}
  assign(ident: string, value: Value): void {
    this.parent.assign(ident, value);
  }
  resolve(ident: string): Value {
    try {
      return this.parent.resolve(ident);
    } catch {
      // Do nothing.
    }
    throw new MaybeSuggest(ident);
  }
  suggestions(): string[] {
    return this.parent.suggestions();
  }
}

export function getSuggestions(
  resolver: Resolver,
  node: Node,
  suggestPosition: number,
): Suggestions | Error | null {
  try {
    inferPlaceholder(
      new SuggestionContext(suggestPosition),
      new SuggestionResolver(resolver),
      node,
    );
    return null;
  } catch (e) {
    if (e instanceof Suggestions) {
      return e;
    } else if (e instanceof Return) {
      return null;
    } else if (e instanceof Break) {
      return null;
    } else if (e instanceof Continue) {
      return null;
    } else if (e instanceof Error) {
      return e;
    }
    throw e;
  }
}

function inferPlaceholder(
  context: SuggestionContext,
  resolver: Resolver,
  node: Node,
): Value {
  resolver = new SpeculativeResolver(resolver);
  try {
    return inferPlaceholderScoped(context, resolver, node);
  } catch (e) {
    if (e instanceof Return) {
      return e.value;
    } else if (e instanceof Break) {
      return new NullValue(null);
    } else if (e instanceof Continue) {
      return new NullValue(null);
    } else {
      throw e;
    }
  }
}

function inferPlaceholderScoped(
  context: SuggestionContext,
  resolver: Resolver,
  node: Node,
): Value {
  // Statement Nodes
  if (node instanceof BlockStatement) {
    for (const statement of node.statements) {
      inferPlaceholderScoped(context, resolver, statement);
    }
    return new NullValue(null);
  } else if (node instanceof ExpressionStatement) {
    return inferPlaceholderScoped(context, resolver, node.expr);
  } else if (node instanceof AssignStatement) {
    inferPlaceholderAssign(context, resolver, node);
    return new NullValue(null);
  } else if (node instanceof LetStatement) {
    let initial: Value;
    if (node.initializer) {
      initial = inferPlaceholderScoped(context, resolver, node.initializer);
    } else {
      initial = new NullValue(null);
    }
    resolver.assign(node.ident, new Variable(initial));
    return new NullValue(null);
  } else if (node instanceof ReturnStatement) {
    throw new Return(
      node.value
        ? inferPlaceholderScoped(context, resolver, node.value)
        : new NullValue(null),
    );
  } else if (node instanceof ConditionalStatement) {
    if (
      BooleanValue.into(
        inferPlaceholderScoped(context, resolver, node.condition),
      ).value
    ) {
      inferPlaceholderScoped(context, resolver, node.branch);
    } else if (node.alternate) {
      inferPlaceholderScoped(context, resolver, node.alternate);
    }
    return new NullValue(null);
  } else if (node instanceof ForStatement) {
    inferPlaceholderScoped(context, resolver, node.body);
    return new NullValue(null);
  } else if (node instanceof WhileStatement) {
    inferPlaceholderScoped(context, resolver, node.body);
    return new NullValue(null);
  } else if (node instanceof EmptyStatement) {
    return new NullValue(null);
  } else if (node instanceof BreakStatement) {
    throw new Break();
  } else if (node instanceof ContinueStatement) {
    throw new Continue();
  }

  // Expression Nodes
  if (node instanceof IdentNode) {
    try {
      return resolver.resolve(node.ident);
    } catch (e) {
      if (e instanceof MaybeSuggest) {
        if (context.suggestPosition) {
          // The suggest position is within the operand bounds.
          if (
            context.suggestPosition >= node.span.start &&
            context.suggestPosition <= node.span.end
          ) {
            throw new Suggestions(
              fuzzySuggest(e.partial, resolver.suggestions()),
              node.span,
            );
          }
        }
      }
      throw e;
    }
  } else if (node instanceof KeywordNode) {
    switch (node.keyword) {
      case "Boolean":
        return new BooleanTypeValue();
      case "Number":
        return new NumberTypeValue();
      case "String":
        return new StringTypeValue();
    }
  } else if (node instanceof NumberNode) {
    return new NumberValue(node.value);
  } else if (node instanceof BooleanNode) {
    return new BooleanValue(node.value);
  } else if (node instanceof StringNode) {
    return new StringValue(node.value);
  } else if (node instanceof NullNode) {
    return new NullValue(node.value);
  } else if (node instanceof UnaryNode) {
    return inferPlaceholderUnary(context, resolver, node);
  } else if (node instanceof BinaryNode) {
    return inferPlaceholderBinary(context, resolver, node);
  } else if (node instanceof TernaryNode) {
    return inferPlaceholderTernary(context, resolver, node);
  } else if (node instanceof FunctionNode) {
    return new FunctionValue(
      async () => {
        throw new Error("Unexpected real execution of speculative procedure");
      },
      (args) => {
        const scoped = new ScopeResolver(resolver);
        for (const [i, name] of Object.entries(node.args)) {
          const arg = args[Number(i)];
          if (arg) {
            scoped.assign(name, arg);
          }
        }
        return inferPlaceholder(context, scoped, node.block);
      },
    );
  } else if (node instanceof LambdaNode) {
    return new FunctionValue(
      async () => {
        throw new Error("Unexpected real execution of speculative procedure");
      },
      (args) => {
        const scoped = new ScopeResolver(resolver);
        for (const [i, name] of Object.entries(node.args)) {
          const arg = args[Number(i)];
          if (arg) {
            scoped.assign(name, arg);
          }
        }
        return inferPlaceholder(context, scoped, node.expr);
      },
    );
  } else if (node instanceof PlaceholderNode) {
    return new NullValue(null);
  } else {
    throw new Error(`Unknown node type ${node}`);
  }
}

function inferPlaceholderAssign(
  context: SuggestionContext,
  resolver: Resolver,
  node: AssignStatement,
): void {
  const operandAValue = inferPlaceholderScoped(
    context,
    resolver,
    node.operandA,
  );
  const operandBValue = inferPlaceholderScoped(
    context,
    resolver,
    node.operandB,
  );
  switch (node.operator) {
    case AssignOp.Assign:
      return operandAValue.assign(operandBValue);
    case AssignOp.AddAssign:
      return operandAValue.assign(operandAValue.add(operandBValue));
    case AssignOp.SubAssign:
      return operandAValue.assign(operandAValue.sub(operandBValue));
    case AssignOp.MulAssign:
      return operandAValue.assign(operandAValue.mul(operandBValue));
    case AssignOp.QuoAssign:
      return operandAValue.assign(operandAValue.div(operandBValue));
    case AssignOp.RemAssign:
      return operandAValue.assign(operandAValue.rem(operandBValue));
    case AssignOp.AndAssign:
      return operandAValue.assign(operandAValue.and(operandBValue));
    case AssignOp.OrAssign:
      return operandAValue.assign(operandAValue.or(operandBValue));
    case AssignOp.XorAssign:
      return operandAValue.assign(operandAValue.xor(operandBValue));
    case AssignOp.ShlAssign:
      return operandAValue.assign(operandAValue.lsh(operandBValue));
    case AssignOp.ShrAssign:
      return operandAValue.assign(operandAValue.rsh(operandBValue));
    case AssignOp.AndNotAssign:
      return operandAValue.assign(operandAValue.andNot(operandBValue));
  }
}

function inferPlaceholderUnary(
  context: SuggestionContext,
  resolver: Resolver,
  node: UnaryNode,
): Value {
  const operandValue = inferPlaceholderScoped(context, resolver, node.operand);
  switch (node.operator) {
    case UnaryOp.Plus:
      return operandValue;
    case UnaryOp.Negate:
      return operandValue.negate();
    case UnaryOp.Not:
      return operandValue.not();
    case UnaryOp.BitNot:
      return operandValue.bitNot();
  }
}

function inferPlaceholderBinary(
  context: SuggestionContext,
  resolver: Resolver,
  node: BinaryNode,
): Value {
  const { operandA, operandB } = node;
  const operandAValue = inferPlaceholderScoped(context, resolver, operandA);
  switch (node.operator) {
    case BinaryOp.Call:
      return operandAValue.callPlaceholder(
        fnArgsPlaceholder(context, resolver, operandB),
      );
    case BinaryOp.Member:
      if (context.suggestPosition) {
        // The suggest position is within the operand bounds.
        if (
          context.suggestPosition >= operandA.span.end &&
          context.suggestPosition <= operandB.span.end
        ) {
          if (operandB instanceof IdentNode) {
            throw new Suggestions(
              fuzzySuggest(operandB.ident, operandAValue.dotSuggest()),
              operandB.span,
            );
          } else {
            throw new Suggestions(operandAValue.dotSuggest(), operandB.span);
          }
        }
      }
      if (!(operandB instanceof IdentNode)) {
        throw new Error("Expected identifier after dot operator");
      }
      return operandAValue.dot(operandB.ident);
  }
  const operandBValue = inferPlaceholderScoped(context, resolver, operandB);
  switch (node.operator) {
    case BinaryOp.LogicalOr:
      return operandAValue.logicalOr(operandBValue);
    case BinaryOp.LogicalAnd:
      return operandAValue.logicalAnd(operandBValue);
    case BinaryOp.Equal:
      return operandAValue.equal(operandBValue);
    case BinaryOp.NotEqual:
      return operandAValue.notEqual(operandBValue);
    case BinaryOp.Lesser:
      return operandAValue.lesser(operandBValue);
    case BinaryOp.LesserEqual:
      return operandAValue.lesserEqual(operandBValue);
    case BinaryOp.Greater:
      return operandAValue.greater(operandBValue);
    case BinaryOp.GreaterEqual:
      return operandAValue.greaterEqual(operandBValue);
    case BinaryOp.Add:
      return operandAValue.add(operandBValue);
    case BinaryOp.Sub:
      return operandAValue.sub(operandBValue);
    case BinaryOp.Or:
      return operandAValue.or(operandBValue);
    case BinaryOp.Xor:
      return operandAValue.xor(operandBValue);
    case BinaryOp.Mul:
      return operandAValue.mul(operandBValue);
    case BinaryOp.Div:
      return operandAValue.div(operandBValue);
    case BinaryOp.Rem:
      return operandAValue.rem(operandBValue);
    case BinaryOp.Lsh:
      return operandAValue.lsh(operandBValue);
    case BinaryOp.Rsh:
      return operandAValue.rsh(operandBValue);
    case BinaryOp.And:
      return operandAValue.and(operandBValue);
    case BinaryOp.AndNot:
      return operandAValue.andNot(operandBValue);
    case BinaryOp.Subscript:
      return operandAValue.index(operandBValue);
    case BinaryOp.Group:
      return operandBValue;
  }
}

function inferPlaceholderTernary(
  context: SuggestionContext,
  resolver: Resolver,
  node: TernaryNode,
): Value {
  const conditional = BooleanValue.from(
    inferPlaceholderScoped(context, resolver, node.operandA),
  );
  if (conditional.value) {
    return inferPlaceholderScoped(context, resolver, node.operandB);
  } else {
    return inferPlaceholderScoped(context, resolver, node.operandC);
  }
}

function fnArgsPlaceholder(
  context: SuggestionContext,
  resolver: Resolver,
  node: Node,
): Value[] {
  return inferPlaceholderNodes(context, resolver, flattenGroup(node));
}

function inferPlaceholderNodes(
  context: SuggestionContext,
  resolver: Resolver,
  n: Node[],
): Value[] {
  return n.map((n) => inferPlaceholderScoped(context, resolver, n));
}
