import {
  InvalidConversionError,
  InvalidOperationError,
  NoSuchMemberError,
  TypeMismatchError,
} from "./errors";

function required(args: Value[], n: number): Value {
  if (!args[n]) {
    throw new Error(`Required argument ${n} missing`);
  }
  return args[n];
}

export interface Value {
  name: string;

  raw(): unknown;

  negate(): Value;
  not(): Value;
  bitNot(): Value;
  dot(ident: string): Value;
  dotSuggest(): string[];

  logicalOr(rhs: Value): Value;
  logicalAnd(rhs: Value): Value;
  equal(rhs: Value): Value;
  notEqual(rhs: Value): Value;
  lesser(rhs: Value): Value;
  lesserEqual(rhs: Value): Value;
  greater(rhs: Value): Value;
  greaterEqual(rhs: Value): Value;
  add(rhs: Value): Value;
  sub(rhs: Value): Value;
  or(rhs: Value): Value;
  xor(rhs: Value): Value;
  mul(rhs: Value): Value;
  div(rhs: Value): Value;
  rem(rhs: Value): Value;
  lsh(rhs: Value): Value;
  rsh(rhs: Value): Value;
  and(rhs: Value): Value;
  andNot(rhs: Value): Value;
  index(rhs: Value): Value;
  call(args: Value[]): Promise<Value>;
  callPlaceholder(args: Value[]): Value;

  assign(value: Value): void;
}

export abstract class BaseValue<T> implements Value {
  abstract name: string;

  constructor(readonly value: T) {}
  raw() {
    return this.value;
  }

  negate(): Value {
    throw new InvalidOperationError(this, "negate");
  }
  not(): Value {
    throw new InvalidOperationError(this, "not");
  }
  bitNot(): Value {
    throw new InvalidOperationError(this, "bitNot");
  }
  dot(ident: string): Value {
    throw new NoSuchMemberError(this, ident);
  }
  dotSuggest(): string[] {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logicalOr(_rhs: Value): Value {
    throw new InvalidOperationError(this, "logicalOr");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  logicalAnd(_rhs: Value): Value {
    throw new InvalidOperationError(this, "logicalAnd");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  equal(_rhs: Value): Value {
    throw new InvalidOperationError(this, "equal");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notEqual(_rhs: Value): Value {
    throw new InvalidOperationError(this, "notEqual");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lesser(_rhs: Value): Value {
    throw new InvalidOperationError(this, "lesser");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lesserEqual(_rhs: Value): Value {
    throw new InvalidOperationError(this, "lesserEqual");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  greater(_rhs: Value): Value {
    throw new InvalidOperationError(this, "greater");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  greaterEqual(_rhs: Value): Value {
    throw new InvalidOperationError(this, "greaterEqual");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  add(_rhs: Value): Value {
    throw new InvalidOperationError(this, "add");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sub(_rhs: Value): Value {
    throw new InvalidOperationError(this, "sub");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  or(_rhs: Value): Value {
    throw new InvalidOperationError(this, "or");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  xor(_rhs: Value): Value {
    throw new InvalidOperationError(this, "xor");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mul(_rhs: Value): Value {
    throw new InvalidOperationError(this, "mul");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  div(_rhs: Value): Value {
    throw new InvalidOperationError(this, "div");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rem(_rhs: Value): Value {
    throw new InvalidOperationError(this, "rem");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lsh(_rhs: Value): Value {
    throw new InvalidOperationError(this, "lsh");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rsh(_rhs: Value): Value {
    throw new InvalidOperationError(this, "rsh");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  and(_rhs: Value): Value {
    throw new InvalidOperationError(this, "and");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  andNot(_rhs: Value): Value {
    throw new InvalidOperationError(this, "andNot");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  index(_rhs: Value): Value {
    throw new InvalidOperationError(this, "index");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  call(_args: Value[]): Promise<Value> {
    throw new InvalidOperationError(this, "call");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  callPlaceholder(_args: Value[]): Value {
    throw new InvalidOperationError(this, "call");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assign(_value: Value): void {
    throw new InvalidOperationError(this, "assign");
  }
}

export class BooleanValue extends BaseValue<boolean> {
  name = "Boolean";

  static from(n: Value): BooleanValue {
    if (n instanceof Variable) {
      return BooleanValue.from(n.value);
    } else if (n instanceof BooleanValue) {
      return n;
    } else {
      throw new TypeMismatchError(this.name, n.name);
    }
  }

  static into(n: Value): BooleanValue {
    if (n instanceof Variable) {
      return BooleanValue.into(n.value);
    } else if (n instanceof BooleanValue) {
      return n;
    } else if (n instanceof NumberValue) {
      return new BooleanValue(Boolean(n.value));
    } else if (n instanceof StringValue) {
      return new BooleanValue(Boolean(n.value));
    } else {
      throw new InvalidConversionError(n.name, this.name);
    }
  }

  override not(): Value {
    return new BooleanValue(!this.value);
  }
  override logicalOr(rhs: Value): Value {
    return new BooleanValue(this.value || BooleanValue.from(rhs).value);
  }
  override logicalAnd(rhs: Value): Value {
    return new BooleanValue(this.value && BooleanValue.from(rhs).value);
  }
  override equal(rhs: Value): Value {
    return new BooleanValue(this.value === BooleanValue.from(rhs).value);
  }
  override notEqual(rhs: Value): Value {
    return new BooleanValue(this.value !== BooleanValue.from(rhs).value);
  }
}

export class NumberValue extends BaseValue<number> {
  name = "Number";

  static from(n: Value): NumberValue {
    if (n instanceof Variable) {
      return NumberValue.from(n.value);
    } else if (n instanceof NumberValue) {
      return n;
    } else {
      throw new TypeMismatchError(this.name, n.name);
    }
  }

  static into(n: Value): NumberValue {
    if (n instanceof Variable) {
      return NumberValue.into(n.value);
    } else if (n instanceof NumberValue) {
      return n;
    } else if (n instanceof BooleanValue) {
      return new NumberValue(Number(n.value));
    } else if (n instanceof StringValue) {
      return new NumberValue(Number(n.value));
    } else {
      throw new InvalidConversionError(n.name, this.name);
    }
  }

  override negate(): Value {
    return new NumberValue(-this.value);
  }
  override not(): Value {
    return new BooleanValue(!this.value);
  }
  override bitNot(): Value {
    return new NumberValue(~this.value);
  }
  override equal(rhs: Value): Value {
    return new BooleanValue(this.value === NumberValue.from(rhs).value);
  }
  override notEqual(rhs: Value): Value {
    return new BooleanValue(this.value !== NumberValue.from(rhs).value);
  }
  override lesser(rhs: Value): Value {
    return new BooleanValue(this.value < NumberValue.from(rhs).value);
  }
  override lesserEqual(rhs: Value): Value {
    return new BooleanValue(this.value <= NumberValue.from(rhs).value);
  }
  override greater(rhs: Value): Value {
    return new BooleanValue(this.value > NumberValue.from(rhs).value);
  }
  override greaterEqual(rhs: Value): Value {
    return new BooleanValue(this.value >= NumberValue.from(rhs).value);
  }
  override add(rhs: Value): Value {
    return new NumberValue(this.value + NumberValue.from(rhs).value);
  }
  override sub(rhs: Value): Value {
    return new NumberValue(this.value - NumberValue.from(rhs).value);
  }
  override or(rhs: Value): Value {
    return new NumberValue(this.value | NumberValue.from(rhs).value);
  }
  override xor(rhs: Value): Value {
    return new NumberValue(this.value ^ NumberValue.from(rhs).value);
  }
  override mul(rhs: Value): Value {
    return new NumberValue(this.value * NumberValue.from(rhs).value);
  }
  override div(rhs: Value): Value {
    return new NumberValue(this.value / NumberValue.from(rhs).value);
  }
  override rem(rhs: Value): Value {
    return new NumberValue(this.value % NumberValue.from(rhs).value);
  }
  override lsh(rhs: Value): Value {
    return new NumberValue(this.value << NumberValue.from(rhs).value);
  }
  override rsh(rhs: Value): Value {
    return new NumberValue(this.value >> NumberValue.from(rhs).value);
  }
  override and(rhs: Value): Value {
    return new NumberValue(this.value & NumberValue.from(rhs).value);
  }
  override andNot(rhs: Value): Value {
    return new NumberValue(this.value & ~NumberValue.from(rhs).value);
  }
  override dot(ident: string): Value {
    switch (ident) {
      case "string":
        return new StringValue(this.value.toString());
      default:
        return super.dot(ident);
    }
  }
  override dotSuggest(): string[] {
    return [...super.dotSuggest(), "string"];
  }
}

export class StringValue extends BaseValue<string> {
  name = "String";

  static from(n: Value): StringValue {
    if (n instanceof Variable) {
      return StringValue.from(n.value);
    } else if (n instanceof StringValue) {
      return n;
    } else {
      throw new TypeMismatchError(this.name, n.name);
    }
  }

  static into(n: Value): StringValue {
    if (n instanceof Variable) {
      return StringValue.into(n.value);
    } else if (n instanceof StringValue) {
      return n;
    } else if (n instanceof NumberValue) {
      return new StringValue(String(n.value));
    } else if (n instanceof BooleanValue) {
      return new StringValue(String(n.value));
    } else {
      throw new InvalidConversionError(n.name, this.name);
    }
  }

  override negate(): Value {
    return new NumberValue(-this.value);
  }
  override not(): Value {
    return new BooleanValue(!this.value);
  }
  override bitNot(): Value {
    return new NumberValue(~this.value);
  }
  override equal(rhs: Value): Value {
    return new BooleanValue(this.value === StringValue.from(rhs).value);
  }
  override notEqual(rhs: Value): Value {
    return new BooleanValue(this.value !== StringValue.from(rhs).value);
  }
  override lesser(rhs: Value): Value {
    return new BooleanValue(this.value < StringValue.from(rhs).value);
  }
  override lesserEqual(rhs: Value): Value {
    return new BooleanValue(this.value <= StringValue.from(rhs).value);
  }
  override greater(rhs: Value): Value {
    return new BooleanValue(this.value > StringValue.from(rhs).value);
  }
  override greaterEqual(rhs: Value): Value {
    return new BooleanValue(this.value >= StringValue.from(rhs).value);
  }
  override add(rhs: Value): Value {
    return new StringValue(this.value + StringValue.from(rhs).value);
  }
  override dot(ident: string): Value {
    switch (ident) {
      case "length":
        return new NumberValue(this.value.length);
      case "padStart":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new StringValue(
              this.value.padStart(
                NumberValue.from(required(args, 0)).value,
                args[1] ? StringValue.from(args[1]).value : undefined,
              ),
            ),
        );
      case "startsWith":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new BooleanValue(
              this.value.startsWith(StringValue.from(required(args, 0)).value),
            ),
        );
      case "endsWith":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new BooleanValue(
              this.value.endsWith(StringValue.from(required(args, 0)).value),
            ),
        );
      case "contains":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new BooleanValue(
              this.value.indexOf(StringValue.from(required(args, 0)).value) !==
                -1,
            ),
        );
      case "substring":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new StringValue(
              this.value.substring(
                NumberValue.from(required(args, 0)).value,
                args[1] ? NumberValue.from(args[1]).value : undefined,
              ),
            ),
        );
      case "match":
        return FunctionValue.fromPureSync(
          (args: Value[]) =>
            new BooleanValue(
              !!this.value.match(StringValue.from(required(args, 0)).value),
            ),
        );
      default:
        return super.dot(ident);
    }
  }
  override dotSuggest(): string[] {
    return [
      ...super.dotSuggest(),
      "length",
      "padStart",
      "startsWith",
      "endsWith",
      "contains",
      "substring",
      "match",
    ];
  }
}

async function asyncSome<T>(
  array: T[],
  callback: (arg: T) => Promise<boolean>,
): Promise<boolean> {
  for (const element of array) {
    const result = await callback(element);
    if (result) {
      return true;
    }
  }
  return false;
}

async function asyncEvery<T>(
  array: T[],
  callback: (arg: T) => Promise<boolean>,
): Promise<boolean> {
  for (const element of array) {
    const result = await callback(element);
    if (!result) {
      return false;
    }
  }
  return true;
}

export abstract class BaseListValue<T> extends BaseValue<T[]> {
  name = "List";
  abstract itemValue(v: T): Value;
  override index(rhs: Value): Value {
    const indexValue = NumberValue.from(rhs);
    let index = indexValue.value;
    if (index < 0) {
      index += this.index.length + 1;
    }
    const item = this.value[index];
    if (!item) {
      throw new Error(`Index ${index} not found in List`);
    }
    return this.itemValue(item);
  }
  override dot(ident: string): Value {
    switch (ident) {
      case "length":
        return new NumberValue(this.value.length);
      case "some":
        return new FunctionValue(
          async (args) => {
            // Real implementation
            if (!args[0]) {
              throw new Error("List.some requires an argument");
            }
            const predicate = FunctionValue.from(args[0]);
            return new BooleanValue(
              await asyncSome(this.value, async (item) => {
                const value = await predicate.call([this.itemValue(item)]);
                if (!(value instanceof BooleanValue)) {
                  throw new Error(
                    `Expected boolean value from predicate, got ${value.name}`,
                  );
                }
                return value.value;
              }),
            );
          },
          (args) => {
            // Placeholder implementation
            if (!args[0]) {
              throw new Error("List.some requires an argument");
            }
            const predicate = FunctionValue.from(args[0]);
            return new BooleanValue(
              this.value.some((item) => {
                const value = predicate.callPlaceholder([this.itemValue(item)]);
                if (!(value instanceof BooleanValue)) {
                  throw new Error(
                    `Expected boolean value from predicate, got ${value.name}`,
                  );
                }
                return value.value;
              }),
            );
          },
        );
      case "every":
        return new FunctionValue(
          async (args) => {
            // Real implementation
            if (!args[0]) {
              throw new Error("List.every requires an argument");
            }
            const predicate = FunctionValue.from(args[0]);
            return new BooleanValue(
              await asyncEvery(this.value, async (item) => {
                const value = await predicate.call([this.itemValue(item)]);
                if (!(value instanceof BooleanValue)) {
                  throw new Error(
                    `Expected boolean value from predicate, got ${value.name}`,
                  );
                }
                return value.value;
              }),
            );
          },
          (args) => {
            // Placeholder implementation
            if (!args[0]) {
              throw new Error("List.every requires an argument");
            }
            const predicate = FunctionValue.from(args[0]);
            return new BooleanValue(
              this.value.every((item) => {
                const value = predicate.callPlaceholder([this.itemValue(item)]);
                if (!(value instanceof BooleanValue)) {
                  throw new Error(
                    `Expected boolean value from predicate, got ${value.name}`,
                  );
                }
                return value.value;
              }),
            );
          },
        );
      default:
        return super.dot(ident);
    }
  }
  override dotSuggest(): string[] {
    return [...super.dotSuggest(), "length", "some", "every"];
  }
}

export class StringListValue extends BaseListValue<string> {
  override itemValue(v: string): Value {
    return new StringValue(v);
  }
  override dot(ident: string): Value {
    switch (ident) {
      case "contains":
        return FunctionValue.fromPureSync((args) => {
          return new BooleanValue(
            this.value.indexOf(StringValue.from(required(args, 0)).value) !==
              -1,
          );
        });
      default:
        return super.dot(ident);
    }
  }
  override dotSuggest(): string[] {
    return [...super.dotSuggest(), "contains"];
  }
}

export class ListValue extends BaseListValue<Value> {
  override itemValue(v: Value): Value {
    return v;
  }
}

export class FunctionValue extends BaseValue<
  (args: Value[]) => Promise<Value>
> {
  name = "Function";
  constructor(
    value: (args: Value[]) => Promise<Value>,
    readonly placeholderValue: (args: Value[]) => Value,
  ) {
    super(value);
  }
  static fromPureSync(value: (args: Value[]) => Value): FunctionValue {
    return new FunctionValue(async (args: Value[]) => value(args), value);
  }
  static from(n: Value): FunctionValue {
    if (n instanceof Variable) {
      return FunctionValue.from(n.value);
    } else if (n instanceof FunctionValue) {
      return n;
    } else {
      throw new TypeMismatchError(this.name, n.name);
    }
  }
  override call(args: Value[]): Promise<Value> {
    return this.value(args);
  }
  override callPlaceholder(args: Value[]): Value {
    return this.placeholderValue(args);
  }
}

export class NullValue extends BaseValue<null> {
  name = "Null";
}

export class NumberTypeValue extends BaseValue<void> {
  name = "Number";
  override async call(args: Value[]): Promise<Value> {
    if (!args[0]) {
      throw new Error("Missing argument in Number() call");
    }
    return NumberValue.into(args[0]);
  }
}

export class BooleanTypeValue extends BaseValue<void> {
  name = "Boolean";
  override async call(args: Value[]): Promise<Value> {
    if (!args[0]) {
      throw new Error("Missing argument in Boolean() call");
    }
    return BooleanValue.into(args[0]);
  }
}

export class StringTypeValue extends BaseValue<void> {
  name = "String";
  override async call(args: Value[]): Promise<Value> {
    if (!args[0]) {
      throw new Error("Missing argument in String() call");
    }
    return StringValue.into(args[0]);
  }
}

export class Variable implements Value {
  name: string;

  constructor(public value: Value = new NullValue(null)) {
    this.name = value.name;
  }
  raw() {
    return this.value.raw();
  }

  negate(): Value {
    return this.value.negate();
  }
  not(): Value {
    return this.value.not();
  }
  bitNot(): Value {
    return this.value.bitNot();
  }
  dot(ident: string): Value {
    return this.value.dot(ident);
  }
  dotSuggest(): string[] {
    return this.value.dotSuggest();
  }
  logicalOr(rhs: Value): Value {
    return this.value.logicalOr(rhs);
  }
  logicalAnd(rhs: Value): Value {
    return this.value.logicalAnd(rhs);
  }
  equal(rhs: Value): Value {
    return this.value.equal(rhs);
  }
  notEqual(rhs: Value): Value {
    return this.value.notEqual(rhs);
  }
  lesser(rhs: Value): Value {
    return this.value.lesser(rhs);
  }
  lesserEqual(rhs: Value): Value {
    return this.value.lesserEqual(rhs);
  }
  greater(rhs: Value): Value {
    return this.value.greater(rhs);
  }
  greaterEqual(rhs: Value): Value {
    return this.value.greaterEqual(rhs);
  }
  add(rhs: Value): Value {
    return this.value.add(rhs);
  }
  sub(rhs: Value): Value {
    return this.value.sub(rhs);
  }
  or(rhs: Value): Value {
    return this.value.or(rhs);
  }
  xor(rhs: Value): Value {
    return this.value.xor(rhs);
  }
  mul(rhs: Value): Value {
    return this.value.mul(rhs);
  }
  div(rhs: Value): Value {
    return this.value.div(rhs);
  }
  rem(rhs: Value): Value {
    return this.value.rem(rhs);
  }
  lsh(rhs: Value): Value {
    return this.value.lsh(rhs);
  }
  rsh(rhs: Value): Value {
    return this.value.rsh(rhs);
  }
  and(rhs: Value): Value {
    return this.value.and(rhs);
  }
  andNot(rhs: Value): Value {
    return this.value.andNot(rhs);
  }
  index(rhs: Value): Value {
    return this.value.index(rhs);
  }
  call(args: Value[]): Promise<Value> {
    return this.value.call(args);
  }
  callPlaceholder(args: Value[]): Value {
    return this.value.callPlaceholder(args);
  }

  assign(value: Value): void {
    this.value = value;
    this.name = value.name;
  }
}
