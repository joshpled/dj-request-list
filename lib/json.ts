export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonObject(source: { json(): Promise<unknown> }): Promise<Record<string, unknown>> {
  const value = await source.json().catch(() => null);
  return isRecord(value) ? value : {};
}

export function errorMessage(value: Record<string, unknown>, fallback: string) {
  return typeof value.error === 'string' ? value.error : fallback;
}
