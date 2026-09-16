import type { Codepage } from './types';

/**
 * Matnni termal printer kod jadvaliga oʻgirish (kutubxonasiz).
 *
 *  - CP866  — DOS kirill (koʻp Xprinter/Epson modellarida n=17)
 *  - CP1251 — Windows kirill (n=73 koʻp xitoy modellarida; Epson TM da 46 — `codepageCommand(cp, n)` bilan oʻzgartiring)
 *  - ASCII  — faqat lotin; kirill harflari lotinga transliteratsiya qilinadi
 *
 * Har qanday kodlashdan oldin matn normallashtiriladi (`prepareText`):
 *  ʻ ʼ ’ ‘ → '   ·   – — ‒ ― − → -   ·   NBSP/ingichka boʻshliqlar → ' '   ·   “ ” „ → "   ·   … → ...
 * Kod jadvalida yoʻq harf uchun avval yaqin muqobil (Қ→К, Ғ→Г, Ҳ→Х, Ў→У, « → ") sinaladi, boʻlmasa '?'.
 * Natijada har bir belgi = 1 bayt, shuning uchun ustun kengliklarini `.length` bilan hisoblash mumkin.
 */

/** ESC t n — kod jadvali raqamlari (printer modeliga qarab farq qilishi mumkin) */
export const CODEPAGE_NUMBERS: Record<Codepage, number> = { CP866: 17, CP1251: 73, ASCII: 0 };

/** Epson TM seriyasi uchun muqobil raqamlar (WPC1251 = 46) */
export const CODEPAGE_NUMBERS_EPSON: Record<Codepage, number> = { CP866: 17, CP1251: 46, ASCII: 0 };

const ESC = 0x1b;

/** ESC t n */
export function codepageCommand(codepage: Codepage, n: number = CODEPAGE_NUMBERS[codepage]): Uint8Array {
  return new Uint8Array([ESC, 0x74, n & 0xff]);
}

// ── Kod jadvallari: 0x80..0xFF oraligʻi 128 belgili satr sifatida. '�' = aniqlanmagan slot. ──

const CP866_HIGH =
  'АБВГДЕЖЗИЙКЛМНОП' + // 0x80 А..П
  'РСТУФХЦЧШЩЪЫЬЭЮЯ' + // 0x90 Р..Я
  'абвгдежзийклмноп' + // 0xA0 а..п
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' + // 0xB0 ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' + // 0xC0 └┴┬├─┼╞╟╚╔╩╦╠═╬╧
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' + // 0xD0 ╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀
  'рстуфхцчшщъыьэюя' + // 0xE0 р..я
  'ЁёЄєЇїЎў°∙·√№¤■ '; // 0xF0 ЁёЄєЇїЎў°∙·√№¤■NBSP

const CP1251_HIGH =
  'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏ' + // 0x80 ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏ
  'ђ‘’“”•–—�™љ›њќћџ' + // 0x90 ђ‘’“”•–—(-)™љ›њќћџ
  ' ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї' + // 0xA0 NBSP Ўў Ј¤Ґ¦§Ё©Є«¬SHY®Ї
  '°±Ііґµ¶·ё№є»јЅѕї' + // 0xB0 °±Ііґµ¶·ё№є»јЅѕї
  'АБВГДЕЖЗИЙКЛМНОП' + // 0xC0 А..П
  'РСТУФХЦЧШЩЪЫЬЭЮЯ' + // 0xD0 Р..Я
  'абвгдежзийклмноп' + // 0xE0 а..п
  'рстуфхцчшщъыьэюя'; // 0xF0 р..я

function buildTable(high: string): Map<string, number> {
  const chars = Array.from(high);
  if (chars.length !== 128) throw new Error(`codepage table must have 128 entries, got ${chars.length}`);
  const m = new Map<string, number>();
  chars.forEach((ch, i) => {
    if (ch !== '�') m.set(ch, 0x80 + i);
  });
  return m;
}

const TABLES: Record<Exclude<Codepage, 'ASCII'>, Map<string, number>> = {
  CP866: buildTable(CP866_HIGH),
  CP1251: buildTable(CP1251_HIGH),
};

/** Kodlashdan mustaqil normallashtirish (tipografik belgilar → ASCII) */
const NORMALIZE: Record<string, string> = {
  'ʻ': "'", // ʻ (oʻ, gʻ)
  'ʼ': "'", // ʼ (tutuq)
  '’': "'", // ’
  '‘': "'", // ‘
  'ʹ': "'", // ʹ
  '´': "'", // ´
  '“': '"', // “
  '”': '"', // ”
  '„': '"', // „
  '‟': '"', // ‟
  '–': '-', // –
  '—': '-', // —
  '‒': '-', // ‒
  '―': '-', // ―
  '−': '-', // − (formatMoney manfiy belgisi)
  ' ': ' ', // NBSP
  ' ': ' ', // narrow NBSP
  ' ': ' ', // thin space
  ' ': ' ', // figure space
  '…': '...', // …
  '×': 'x', // ×
  '•': '*', // •
  '→': '->', // →
  '←': '<-', // ←
  '✓': 'v', // ✓
  '✔': 'v', // ✔
  '­': '', // soft hyphen
  '​': '', // zero-width space
  '‌': '', // ZWNJ
  '‍': '', // ZWJ
  '﻿': '', // BOM
  '️': '', // variation selector (emoji)
};

/** Jadvalda boʻlmaganda sinaladigan yaqin muqobillar (oʻzbek kirill harflari va boshqalar) */
const NEAR: Record<string, string> = {
  'Қ': 'К', // Қ → К
  'қ': 'к', // қ → к
  'Ғ': 'Г', // Ғ → Г
  'ғ': 'г', // ғ → г
  'Ҳ': 'Х', // Ҳ → Х
  'ҳ': 'х', // ҳ → х
  'Ў': 'У', // Ў → У
  'ў': 'у', // ў → у
  'Ё': 'Е', // Ё → Е
  'ё': 'е', // ё → е
  'Ґ': 'Г', // Ґ → Г
  'ґ': 'г', // ґ → г
  'Є': 'Е', // Є → Е
  'є': 'е', // є → е
  'Ї': 'І', // Ї → І
  'ї': 'і', // ї → і
  'І': 'И', // І → И
  'і': 'и', // і → и
  '«': '"', // «
  '»': '"', // »
  '‹': '<', // ‹
  '›': '>', // ›
  '№': 'No.', // №
  '°': 'o', // °
  '€': 'EUR', // €
  '£': 'GBP', // £
  '¤': 'o', // ¤
  '§': 'p.', // §
  '©': '(c)', // ©
  '®': '(R)', // ®
  '™': '(TM)', // ™
  '·': '.', // ·
  '∙': '.', // ∙
  '√': 'v', // √
  '■': '#', // ■
  '█': '#', // █
  '▀': '#', // ▀
  '▄': '#', // ▄
  '░': '.', // ░
  '▒': ':', // ▒
  '▓': '#', // ▓
  '─': '-', // ─
  '═': '=', // ═
  '│': '|', // │
  '║': '|', // ║
  'ß': 'ss', // ß
  'ı': 'i', // ı
  'æ': 'ae', // æ
  'Æ': 'AE', // Æ
  'ø': 'o', // ø
  'Ø': 'O', // Ø
  'œ': 'oe', // œ
  'Œ': 'OE', // Œ
  'đ': 'd', // đ
  'Đ': 'D', // Đ
  'ł': 'l', // ł
  'Ł': 'L', // Ł
};

/** Kirill → lotin transliteratsiya (ASCII rejimi). Oʻzbek kirill harflari oʻzbek lotinchasiga. */
const TRANSLIT: Record<string, string> = {
  'а': 'a', // а
  'б': 'b', // б
  'в': 'v', // в
  'г': 'g', // г
  'д': 'd', // д
  'е': 'e', // е
  'ё': 'yo', // ё
  'ж': 'j', // ж
  'з': 'z', // з
  'и': 'i', // и
  'й': 'y', // й
  'к': 'k', // к
  'л': 'l', // л
  'м': 'm', // м
  'н': 'n', // н
  'о': 'o', // о
  'п': 'p', // п
  'р': 'r', // р
  'с': 's', // с
  'т': 't', // т
  'у': 'u', // у
  'ф': 'f', // ф
  'х': 'x', // х
  'ц': 'ts', // ц
  'ч': 'ch', // ч
  'ш': 'sh', // ш
  'щ': 'sch', // щ
  'ъ': "'", // ъ
  'ы': 'i', // ы
  'ь': '', // ь
  'э': 'e', // э
  'ю': 'yu', // ю
  'я': 'ya', // я
  'ў': "o'", // ў
  'қ': 'q', // қ
  'ғ': "g'", // ғ
  'ҳ': 'h', // ҳ
  'є': 'ye', // є
  'ї': 'yi', // ї
  'і': 'i', // і
  'ґ': 'g', // ґ
  'ј': 'j', // ј
  'ђ': 'dj', // ђ
  'љ': 'lj', // љ
  'њ': 'nj', // њ
  'ћ': 'c', // ћ
  'џ': 'dz', // џ
  'ѕ': 'dz', // ѕ
  'ќ': 'k', // ќ
  'ѓ': 'g', // ѓ
};

const CYRILLIC = /[Ѐ-ӿ]/;
const COMBINING = /[̀-ͯ]/g;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function isUpperCyr(ch: string | undefined): boolean {
  return !!ch && CYRILLIC.test(ch) && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}
function isLowerCyr(ch: string | undefined): boolean {
  return !!ch && CYRILLIC.test(ch) && ch !== ch.toUpperCase() && ch === ch.toLowerCase();
}

/**
 * Bitta kirill harfini lotinga oʻgiradi; koʻp harfli natija ("Sh") uchun soʻz butunlay katta harfda boʻlsa
 * ("ЧЕК" → "CHEK") toʻliq katta, aks holda ("Чек" → "Chek") faqat bosh harf katta.
 */
function translitChar(ch: string, prev: string | undefined, next: string | undefined): string | undefined {
  const lower = ch.toLowerCase();
  const base = TRANSLIT[lower];
  if (base === undefined) return undefined;
  if (ch === lower) return base;
  if (base.length <= 1) return base.toUpperCase();
  const allCaps = isUpperCyr(next) || (isUpperCyr(prev) && !isLowerCyr(next));
  return allCaps ? base.toUpperCase() : base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Matnni tanlangan kod jadvalida 1 belgi = 1 bayt boʻladigan koʻrinishga keltiradi.
 * Boshqaruv belgilari (\n, \t …) va ASCII oʻzgarishsiz qoladi.
 */
export function prepareText(text: string, codepage: Codepage): string {
  const table = codepage === 'ASCII' ? null : TABLES[codepage];
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? '';
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      out += ch;
      continue;
    }
    const norm = NORMALIZE[ch];
    if (norm !== undefined) {
      out += norm;
      continue;
    }
    if (table?.has(ch)) {
      out += ch;
      continue;
    }
    if (codepage === 'ASCII') {
      const tr = translitChar(ch, chars[i - 1], chars[i + 1]);
      if (tr !== undefined) {
        out += tr;
        continue;
      }
    }
    const near = NEAR[ch];
    if (near !== undefined) {
      // muqobil ham tekshiriladi (CP866 da Қ→К bor; ASCII da К→K transliteratsiya)
      out += prepareText(near, codepage);
      continue;
    }
    // Umumiy diakritika: "é" → "e" (NFD dekompozitsiya, belgilarni tashlab)
    const stripped = ch.normalize('NFD').replace(COMBINING, '');
    if (stripped !== ch && stripped.length > 0) {
      out += prepareText(stripped, codepage);
      continue;
    }
    if (code >= 0x1f000 || PICTOGRAPHIC.test(ch)) continue; // emoji — tashlab yuboriladi
    out += '?';
  }
  return out;
}

/** Matn → printer baytlari (kod jadvali boʻyicha). Har bir belgi 1 bayt. */
export function encodeText(text: string, codepage: Codepage): Uint8Array {
  const prepared = prepareText(text, codepage);
  const table = codepage === 'ASCII' ? null : TABLES[codepage];
  const bytes = new Uint8Array(prepared.length);
  for (let i = 0; i < prepared.length; i++) {
    const c = prepared.charCodeAt(i);
    if (c < 0x80) {
      bytes[i] = c;
      continue;
    }
    const mapped = table?.get(prepared.charAt(i));
    bytes[i] = mapped ?? 0x3f; // '?'
  }
  return bytes;
}

/** Berilgan belgi ushbu kod jadvalida bevosita mavjudmi (normallashtirishsiz) */
export function isEncodable(ch: string, codepage: Codepage): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return true;
  return codepage === 'ASCII' ? false : TABLES[codepage].has(ch);
}

/** Baytlar → matn (testlar/debug uchun teskari jadval) */
export function decodeBytes(bytes: Uint8Array, codepage: Codepage): string {
  const table = codepage === 'ASCII' ? null : TABLES[codepage];
  const reverse = new Map<number, string>();
  table?.forEach((b, ch) => reverse.set(b, ch));
  let s = '';
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : (reverse.get(b) ?? '?');
  return s;
}
