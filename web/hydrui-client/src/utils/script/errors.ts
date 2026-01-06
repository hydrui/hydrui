interface NamedType {
  name: string;
}

export class NoSuchMemberError extends Error {
  constructor(value: NamedType, member: string) {
    super(`Type ${value.name} has no member ${member}`);
    this.name = "NoSuchMemberError";
  }
}

export class InvalidOperationError extends Error {
  constructor(value: NamedType, operation: string) {
    super(`Operation ${operation} is invalid for type ${value.name}`);
    this.name = "InvalidOperationError";
  }
}

export class TypeMismatchError extends Error {
  constructor(expected: string, got: string) {
    super(`Expected type ${expected}, but found ${got}.`);
    this.name = "TypeMismatchError";
  }
}

export class InvalidConversionError extends Error {
  constructor(from: string, to: string) {
    super(`Can not convert from type ${from} to ${to}.`);
    this.name = "InvalidConversionError";
  }
}
