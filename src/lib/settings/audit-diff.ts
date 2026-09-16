/**
 * Audit jurnalidagi `before` / `after` JSON larni yonma-yon koʻrsatish uchun sof yordamchilar
 * (client komponent import qiladi — serverga bogʻliq importlar YOʻQ).
 */

/** Obyekt boʻlsa qaytaradi (massiv va skalyarlar uchun null) */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Kalitlar tartibiga bogʻliq boʻlmagan solishtirish uchun barqaror JSON */
export function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
    .join(',')}}`;
}

/** Chiroyli (2 boʻshliq) JSON; boʻsh qiymat — boʻsh satr */
export function prettyJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

/** Bitta maydon qiymati (jadval koʻrinishi uchun) */
export function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return prettyJson(value);
}

/** Ikki obyektda qiymati farq qiladigan kalitlar (alifbo tartibida) */
export function changedKeys(before: unknown, after: unknown): string[] {
  const b = asRecord(before);
  const a = asRecord(after);
  if (!b && !a) return [];
  const keys = new Set<string>([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
  return [...keys].filter((k) => stableJson(b?.[k]) !== stableJson(a?.[k])).sort();
}

export interface DiffRow {
  key: string;
  /** `undefined` — kalit umuman yoʻq edi */
  before: unknown;
  after: unknown;
  changed: boolean;
  onlyBefore: boolean;
  onlyAfter: boolean;
}

/** Yonma-yon jadval qatorlari: oʻzgargan kalitlar birinchi, keyin qolganlari */
export function diffRows(before: unknown, after: unknown): DiffRow[] {
  const b = asRecord(before);
  const a = asRecord(after);
  if (!b && !a) return [];
  const keys = [...new Set<string>([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])].sort();
  const rows = keys.map<DiffRow>((key) => {
    const hasBefore = Boolean(b) && key in (b ?? {});
    const hasAfter = Boolean(a) && key in (a ?? {});
    return {
      key,
      before: hasBefore ? b?.[key] : undefined,
      after: hasAfter ? a?.[key] : undefined,
      changed: stableJson(b?.[key]) !== stableJson(a?.[key]),
      onlyBefore: hasBefore && !hasAfter,
      onlyAfter: hasAfter && !hasBefore,
    };
  });
  return [...rows.filter((r) => r.changed), ...rows.filter((r) => !r.changed)];
}

/** `before`/`after` ikkalasi ham boʻsh boʻlsa — tafsilotsiz yozuv */
export function hasDiffPayload(before: unknown, after: unknown): boolean {
  return (before !== null && before !== undefined) || (after !== null && after !== undefined);
}

export interface AuditUserOption {
  id: string;
  fullName: string;
  role: string;
}

/**
 * Filtr uchun foydalanuvchilar roʻyxati: xodimlar (`GET /api/users`) va audit javobidagi
 * foydalanuvchilar birlashtiriladi (id boʻyicha takrorlanmaydi, F.I.Sh. boʻyicha tartiblanadi).
 */
export function mergeUserOptions(...lists: readonly (readonly AuditUserOption[] | undefined)[]): AuditUserOption[] {
  const map = new Map<string, AuditUserOption>();
  for (const list of lists) {
    for (const u of list ?? []) {
      if (!u?.id) continue;
      if (!map.has(u.id)) map.set(u.id, { id: u.id, fullName: u.fullName, role: u.role });
    }
  }
  return [...map.values()].sort((x, y) => x.fullName.localeCompare(y.fullName, 'uz'));
}
