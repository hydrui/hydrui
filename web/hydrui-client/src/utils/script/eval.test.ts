import { evaluate } from "./eval";
import { Parser } from "./parse";
import { StandardResolver } from "./resolver";
import { ListValue, StringValue } from "./value";

describe("evaluate", () => {
  test("can evaluate a basic expression", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser("1 + 1").parseExpression(),
        )
      ).raw(),
    ).toEqual(2);
  });
  test("can evaluate an advanced expression", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(
            new Map([["list", new ListValue([new StringValue("test")])]]),
          ),
          new Parser(
            "0, Number(list[0].length + 1 == 5) + 1",
          ).parseExpression(),
        )
      ).raw(),
    ).toEqual(2);
  });
  test("can evaluate an eagerly-called function", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            "(function(a, b) { return a + b; })(1, 2)",
          ).parseExpression(),
        )
      ).raw(),
    ).toEqual(3);
  });
  test("can evaluate a script", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            `
              /*********************
               * multiline comment *
               *********************/
              let i = 0; // end of line comment
              for (i = 1; i < 8; i+=1) {
                if (i == 4) {
                  continue;
                }
                if (i >= 4) {
                  break;
                }
              }
              return i;
            `,
          ).parseScript(),
        )
      ).raw(),
    ).toEqual(5);
  });
  test("test function locals", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            `
              let a = 1;
              let fn = function () {
                let b = 2;
                a = b;
              };
              let fn2 = function () {
                return fn();
              };
              fn2();
              return a;
            `,
          ).parseScript(),
        )
      ).raw(),
    ).toEqual(2);
  });
  test("while loop", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            "let i = 0; while (i < 10) i += 1; return i;",
          ).parseScript(),
        )
      ).raw(),
    ).toEqual(10);
  });
  test("while loop", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            "let i = 0; while (i < 10) i += 1; return i;",
          ).parseScript(),
        )
      ).raw(),
    ).toEqual(10);
  });
  test("lexical scopes", async () => {
    expect(
      (
        await evaluate(
          new StandardResolver(new Map()),
          new Parser(
            `
              let fn = function () {
                let a = 2;
                return function () {
                  return a;
                };
              };
              let fn2 = fn();
              // fn2 can still access a from its outer scope
              return fn2();
            `,
          ).parseScript(),
        )
      ).raw(),
    ).toEqual(2);
  });
});
