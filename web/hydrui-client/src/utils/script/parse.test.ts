import {
  BinaryNode,
  BinaryOp,
  IdentNode,
  NumberNode,
  PlaceholderNode,
  StringNode,
  UnaryNode,
  UnaryOp,
} from "./ast";
import { Parser } from "./parse";

describe("Parser", () => {
  test("can parse an empty partial expression", () => {
    const parser = new Parser("", true);
    expect(parser.parseExpression()).toEqual(
      new PlaceholderNode({ start: 0, end: 0 }),
    );
  });
  test("can parse a basic expression", () => {
    const parser = new Parser("1 + 1");
    expect(parser.parseExpression()).toEqual(
      new BinaryNode(
        new NumberNode({ start: 0, end: 1 }, 1),
        BinaryOp.Add,
        new NumberNode({ start: 4, end: 5 }, 1),
      ),
    );
  });
  test("rejects partial expression", () => {
    const parser = new Parser("1 +");
    expect(() => parser.parseExpression()).toThrow("No expression was parsed");
  });
  test("can parse a partial expression", () => {
    const parser = new Parser("1 + ", true);
    expect(parser.parseExpression()).toEqual(
      new BinaryNode(
        new NumberNode({ start: 0, end: 1 }, 1),
        BinaryOp.Add,
        new PlaceholderNode({ start: 3, end: 3 }),
      ),
    );
  });
  test("can parse a complex expression", () => {
    const parser = new Parser(
      'min(1 + 1) < 0 && this.map["test"] == "\\\\\\"" +-test',
    );
    expect(parser.parseExpression()).toEqual(
      new BinaryNode(
        new BinaryNode(
          new BinaryNode(
            new IdentNode({ start: 0, end: 3 }, "min"),
            BinaryOp.Call,
            new BinaryNode(
              new NumberNode({ start: 4, end: 5 }, 1),
              BinaryOp.Add,
              new NumberNode({ start: 8, end: 9 }, 1),
            ),
          ),
          BinaryOp.Lesser,
          new NumberNode({ start: 13, end: 14 }, 0),
        ),
        BinaryOp.LogicalAnd,
        new BinaryNode(
          new BinaryNode(
            new BinaryNode(
              new IdentNode({ start: 18, end: 22 }, "this"),
              BinaryOp.Member,
              new IdentNode({ start: 23, end: 26 }, "map"),
            ),
            BinaryOp.Subscript,
            new StringNode({ start: 27, end: 33 }, "test"),
          ),
          BinaryOp.Equal,
          new BinaryNode(
            new StringNode({ start: 38, end: 44 }, '\\"'),
            BinaryOp.Add,
            new UnaryNode(
              { start: 46, end: 51 },
              UnaryOp.Negate,
              new IdentNode({ start: 47, end: 51 }, "test"),
            ),
          ),
        ),
      ),
    );
  });
  test("complex partial expression", () => {
    const parser = new Parser('min(1 + 1) < 0 && (this.map["test"].', true);
    expect(parser.parseExpression()).toEqual(
      new BinaryNode(
        new BinaryNode(
          new BinaryNode(
            new IdentNode({ start: 0, end: 3 }, "min"),
            BinaryOp.Call,
            new BinaryNode(
              new NumberNode({ start: 4, end: 5 }, 1),
              BinaryOp.Add,
              new NumberNode({ start: 8, end: 9 }, 1),
            ),
          ),
          BinaryOp.Lesser,
          new NumberNode({ start: 13, end: 14 }, 0),
        ),
        BinaryOp.LogicalAnd,
        new BinaryNode(
          new BinaryNode(
            new BinaryNode(
              new IdentNode({ start: 19, end: 23 }, "this"),
              BinaryOp.Member,
              new IdentNode({ start: 24, end: 27 }, "map"),
            ),
            BinaryOp.Subscript,
            new StringNode({ start: 28, end: 34 }, "test"),
          ),
          BinaryOp.Member,
          new PlaceholderNode({ start: 36, end: 36 }),
        ),
      ),
    );
  });
});
