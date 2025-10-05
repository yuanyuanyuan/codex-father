export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
