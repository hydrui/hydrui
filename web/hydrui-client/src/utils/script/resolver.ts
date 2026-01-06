import { FileTypeValue } from "./file";
import { Value, Variable } from "./value";

// Resolver is an interface for namespaces.
export interface Resolver {
  assign(ident: string, value: Value): void;
  resolve(ident: string): Value;
  suggestions(): string[];
}

// StandardResolver implements the global namespace.
export class StandardResolver implements Resolver {
  public locals = new Map<string, Value>();
  constructor(private readonly globals: Map<string, Value>) {}
  assign(ident: string, value: Value): void {
    this.locals.set(ident, value);
  }
  resolve(ident: string): Value {
    const local = this.locals.get(ident);
    if (local !== undefined) {
      return local;
    }
    const global = this.globals.get(ident);
    if (global !== undefined) {
      return global;
    }
    // Built-ins
    switch (ident) {
      case "File":
        return new FileTypeValue();
    }
    throw new Error(`No such value ${ident}`);
  }
  suggestions(): string[] {
    return [...new Set([...this.locals.keys(), ...this.globals.keys()])];
  }
}

// ScopeResolver implements a local namespace.
export class ScopeResolver implements Resolver {
  public locals = new Map<string, Value>();
  constructor(private readonly parent: Resolver) {}
  assign(ident: string, value: Value): void {
    this.locals.set(ident, value);
  }
  resolve(ident: string): Value {
    const local = this.locals.get(ident);
    if (local !== undefined) {
      return local;
    }
    return this.parent.resolve(ident);
  }
  suggestions(): string[] {
    return [...new Set([...this.locals.keys(), ...this.parent.suggestions()])];
  }
}

// SpeculativeResolver implements a shadow resolver for speculative execution.
// A SpeculativeResolver will store shadows of each global.
export class SpeculativeResolver implements Resolver {
  public shadows = new Map<string, Value>();
  constructor(private readonly parent: Resolver) {}
  assign(ident: string, value: Value): void {
    this.shadows.set(ident, value);
  }
  resolve(ident: string): Value {
    let shadow = this.shadows.get(ident);
    if (shadow !== undefined) {
      return shadow;
    }
    const global = this.parent.resolve(ident);
    shadow = new Variable(global);
    this.shadows.set(ident, shadow);
    return shadow;
  }
  suggestions(): string[] {
    return [...new Set([...this.shadows.keys(), ...this.parent.suggestions()])];
  }
}
