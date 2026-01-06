export function fuzzySuggest(input: string, choices: string[]): string[] {
  const trimmedInput = input.trim();
  if (trimmedInput === "") {
    return choices;
  }
  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const choice of choices) {
    if (choice.startsWith(trimmedInput)) {
      startsWith.push(choice);
    } else if (choice.indexOf(trimmedInput) > 0) {
      contains.push(choice);
    }
  }
  return [...startsWith, ...contains];
}
