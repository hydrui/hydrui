import { StreamingArrayParser } from "./streamJson";

interface Event {
  kind: "value" | "delta" | "end";
  index: number;
  key?: string;
  value?: unknown;
}

function collect(): { events: Event[]; parser: StreamingArrayParser } {
  const events: Event[] = [];
  const parser = new StreamingArrayParser({
    onItemValue: (index, key, value) =>
      events.push({ kind: "value", index, key, value }),
    onItemTextDelta: (index, key, value) =>
      events.push({ kind: "delta", index, key, value }),
    onItemEnd: (index, value) => events.push({ kind: "end", index, value }),
  });
  return { events, parser };
}

const ITEM = '{"box_2d": [10, 20, 30, 40], "label": "hello", "label_en": "hi"}';

describe("StreamingArrayParser", () => {
  test("parses a complete array in one push", () => {
    const { events, parser } = collect();
    parser.push(`[${ITEM}]`);
    expect(events).toEqual([
      { kind: "value", index: 0, key: "box_2d", value: [10, 20, 30, 40] },
      { kind: "delta", index: 0, key: "label", value: "hello" },
      { kind: "value", index: 0, key: "label", value: "hello" },
      { kind: "delta", index: 0, key: "label_en", value: "hi" },
      { kind: "value", index: 0, key: "label_en", value: "hi" },
      {
        kind: "end",
        index: 0,
        value: { box_2d: [10, 20, 30, 40], label: "hello", label_en: "hi" },
      },
    ]);
  });

  test("emits box before label when streamed character by character", () => {
    const { events, parser } = collect();
    const text = `[${ITEM}]`;
    for (const ch of text) parser.push(ch);
    expect(events[0]).toEqual({
      kind: "value",
      index: 0,
      key: "box_2d",
      value: [10, 20, 30, 40],
    });
    const deltas = events
      .filter((e) => e.kind === "delta" && e.key === "label")
      .map((e) => e.value)
      .join("");
    expect(deltas).toBe("hello");
    // Per-character pushes produce per-character deltas.
    expect(
      events.filter((e) => e.kind === "delta" && e.key === "label").length,
    ).toBe(5);
  });

  test("streams label deltas before the box when label comes first", () => {
    const { events, parser } = collect();
    const text = '[{"label": "ab", "box_2d": [1, 2, 3, 4]}]';
    for (const ch of text) parser.push(ch);
    const firstBox = events.findIndex((e) => e.key === "box_2d");
    const firstDelta = events.findIndex((e) => e.kind === "delta");
    expect(firstDelta).toBeGreaterThanOrEqual(0);
    expect(firstDelta).toBeLessThan(firstBox);
    expect(events[events.length - 1]).toEqual({
      kind: "end",
      index: 0,
      value: { label: "ab", box_2d: [1, 2, 3, 4] },
    });
  });

  test("tracks indices across multiple items", () => {
    const { events, parser } = collect();
    parser.push('[{"label": "a"}, {"label": "b"}]');
    expect(events.filter((e) => e.kind === "end")).toEqual([
      { kind: "end", index: 0, value: { label: "a" } },
      { kind: "end", index: 1, value: { label: "b" } },
    ]);
  });

  test("decodes escapes split across chunk boundaries", () => {
    const { events, parser } = collect();
    const text = '[{"label": "a\\n\\u00e9\\ud83d\\ude00b"}]';
    for (const ch of text) parser.push(ch);
    const label = events.find((e) => e.kind === "value" && e.key === "label");
    expect(label?.value).toBe("a\né😀b");
    const deltas = events
      .filter((e) => e.kind === "delta")
      .map((e) => e.value)
      .join("");
    expect(deltas).toBe("a\né😀b");
  });

  test("skips a markdown code fence header", () => {
    const { events, parser } = collect();
    parser.push("```json\n");
    parser.push('[{"label": "x"}]\n```');
    expect(events.filter((e) => e.kind === "end")).toEqual([
      { kind: "end", index: 0, value: { label: "x" } },
    ]);
  });

  test("ignores content after the array closes", () => {
    const { events, parser } = collect();
    parser.push('[{"label": "x"}] trailing [{"label": "y"}]');
    expect(events.filter((e) => e.kind === "end")).toHaveLength(1);
  });

  test("does not emit item callbacks for nested structures", () => {
    const { events, parser } = collect();
    parser.push('[{"meta": {"label": "inner"}, "label": "outer"}]');
    expect(
      events.filter((e) => e.kind === "delta").map((e) => e.value),
    ).toEqual(["outer"]);
    expect(events.filter((e) => e.kind === "value")).toEqual([
      { kind: "value", index: 0, key: "meta", value: { label: "inner" } },
      { kind: "value", index: 0, key: "label", value: "outer" },
    ]);
  });

  test("handles numbers, booleans, and null values", () => {
    const { events, parser } = collect();
    parser.push('[{"a": -1.5e2, "b": true, "c": null}]');
    expect(events.find((e) => e.kind === "end")?.value).toEqual({
      a: -150,
      b: true,
      c: null,
    });
  });
});
