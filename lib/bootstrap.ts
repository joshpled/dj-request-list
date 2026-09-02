export function requireInitialPin(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4,12}$/.test(value)) {
    throw new Error('INITIAL_ADMIN_PIN must be configured with 4–12 digits before initializing a new database.');
  }
  return value;
}
