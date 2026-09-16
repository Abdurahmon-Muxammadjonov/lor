export type GreetingKey = 'morning' | 'day' | 'evening' | 'night';

/** Soat boʻyicha salomlashuv kaliti: t(`dashboard.greeting.${key}`) */
export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/** F.I.Sh. dan qisqa murojaat: "Karimova Dilnoza Baxtiyorovna" → "Dilnoza" */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[1] ?? parts[0] ?? '';
  return parts[0] ?? '';
}
