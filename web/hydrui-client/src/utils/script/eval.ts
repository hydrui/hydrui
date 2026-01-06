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
  ReturnStatement,
  StringNode,
  TernaryNode,
  UnaryNode,
  UnaryOp,
  WhileStatement,
} from "./ast";
import { Resolver, ScopeResolver } from "./resolver";
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

export class Return {
  constructor(readonly value: Value) {}
}

export class Break {
  constructor() {}
}

export class Continue {
  constructor() {}
}

export async function evaluate(resolver: Resolver, node: Node): Promise<Value> {
  resolver = new ScopeResolver(resolver);
  try {
    return await evaluateScoped(resolver, node);
  } catch (e) {
    if (e instanceof Return) {
      return e.value;
    } else if (e instanceof Break) {
      throw new Error("Unexpected break outside of loop");
    } else if (e instanceof Continue) {
      throw new Error("Unexpected continue outside of loop");
    } else {
      throw e;
    }
  }
}

async function evaluateScoped(resolver: Resolver, node: Node): Promise<Value> {
  // Statement Nodes
  if (node instanceof BlockStatement) {
    for (const statement of node.statements) {
      await evaluateScoped(resolver, statement);
    }
    return new NullValue(null);
  } else if (node instanceof ExpressionStatement) {
    return await evaluateScoped(resolver, node.expr);
  } else if (node instanceof AssignStatement) {
    evaluateAssign(resolver, node);
    return new NullValue(null);
  } else if (node instanceof LetStatement) {
    let initial: Value;
    if (node.initializer) {
      initial = await evaluateScoped(resolver, node.initializer);
    } else {
      initial = new NullValue(null);
    }
    resolver.assign(node.ident, new Variable(initial));
    return new NullValue(null);
  } else if (node instanceof ReturnStatement) {
    throw new Return(
      node.value
        ? await evaluateScoped(resolver, node.value)
        : new NullValue(null),
    );
  } else if (node instanceof ConditionalStatement) {
    if (
      BooleanValue.into(await evaluateScoped(resolver, node.condition)).value
    ) {
      await evaluateScoped(resolver, node.branch);
    } else if (node.alternate) {
      await evaluateScoped(resolver, node.alternate);
    }
    return new NullValue(null);
  } else if (node instanceof ForStatement) {
    for (
      node.initializer && (await evaluateScoped(resolver, node.initializer));
      !node.condition ||
      BooleanValue.into(await evaluateScoped(resolver, node.condition)).value;
      node.iterator && (await evaluateScoped(resolver, node.iterator))
    ) {
      try {
        await evaluateScoped(resolver, node.body);
      } catch (e) {
        if (e instanceof Break) {
          break;
        } else if (e instanceof Continue) {
          continue;
        } else {
          throw e;
        }
      }
    }
    return new NullValue(null);
  } else if (node instanceof WhileStatement) {
    while (
      BooleanValue.into(await evaluateScoped(resolver, node.condition)).value
    ) {
      try {
        await evaluateScoped(resolver, node.body);
      } catch (e) {
        if (e instanceof Break) {
          break;
        } else if (e instanceof Continue) {
          continue;
        } else {
          throw e;
        }
      }
    }
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
    return resolver.resolve(node.ident);
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
    return evaluateUnary(resolver, node);
  } else if (node instanceof BinaryNode) {
    return evaluateBinary(resolver, node);
  } else if (node instanceof TernaryNode) {
    return evaluateTernary(resolver, node);
  } else if (node instanceof FunctionNode) {
    return new FunctionValue(
      async (args) => {
        const scoped = new ScopeResolver(resolver);
        for (const [i, name] of Object.entries(node.args)) {
          const arg = args[Number(i)];
          if (arg) {
            scoped.assign(name, arg);
          }
        }
        return evaluate(scoped, node.block);
      },
      () => {
        throw new Error(
          "Unexpected speculative execution of runtime procedure",
        );
      },
    );
  } else if (node instanceof LambdaNode) {
    return new FunctionValue(
      async (args) => {
        const scoped = new ScopeResolver(resolver);
        for (const [i, name] of Object.entries(node.args)) {
          const arg = args[Number(i)];
          if (arg) {
            scoped.assign(name, arg);
          }
        }
        return evaluate(scoped, node.expr);
      },
      () => {
        throw new Error(
          "Unexpected speculative execution of runtime procedure",
        );
      },
    );
  } else {
    throw new Error(`Unknown node type ${node}`);
  }
}

async function evaluateAssign(
  resolver: Resolver,
  node: AssignStatement,
): Promise<void> {
  const operandAValue = await evaluateScoped(resolver, node.operandA);
  const operandBValue = await evaluateScoped(resolver, node.operandB);
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

async function evaluateUnary(
  resolver: Resolver,
  node: UnaryNode,
): Promise<Value> {
  const operandValue = await evaluateScoped(resolver, node.operand);
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

async function evaluateBinary(
  resolver: Resolver,
  node: BinaryNode,
): Promise<Value> {
  const operandAValue = await evaluateScoped(resolver, node.operandA);
  const operandB = node.operandB;
  switch (node.operator) {
    case BinaryOp.Call:
      return await operandAValue.call(await fnArgs(resolver, operandB));
    case BinaryOp.Member:
      if (!(operandB instanceof IdentNode)) {
        throw new Error("Expected identifier after dot operator");
      }
      return operandAValue.dot(operandB.ident);
  }
  const operandBValue = await evaluateScoped(resolver, operandB);
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

async function evaluateTernary(
  resolver: Resolver,
  node: TernaryNode,
): Promise<Value> {
  const conditional = BooleanValue.from(
    await evaluateScoped(resolver, node.operandA),
  );
  if (conditional.value) {
    return evaluateScoped(resolver, node.operandB);
  } else {
    return evaluateScoped(resolver, node.operandC);
  }
}

async function fnArgs(resolver: Resolver, node: Node): Promise<Value[]> {
  return await evaluateNodes(resolver, flattenGroup(node));
}

async function evaluateNodes(resolver: Resolver, n: Node[]): Promise<Value[]> {
  return await Promise.all(n.map((n) => evaluateScoped(resolver, n)));
}

export function flattenGroup(n: Node): Node[] {
  if (n instanceof BinaryNode) {
    if (n.operator === BinaryOp.Group) {
      return [...flattenGroup(n.operandA), ...flattenGroup(n.operandB)];
    }
  }
  return [n];
}
