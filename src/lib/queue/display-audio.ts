import type { Locale } from '@/i18n/config';

/**
 * TV tablo ovozi (client): Web Audio ikki tonli signal + speechSynthesis eʼlon.
 * AudioContext foydalanuvchi harakati (click/touch) dan keyin ochiladi — `unlock()` ni bosish ichida chaqiring.
 */

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class DisplayAudio {
  private ctx: AudioContext | null = null;

  get supported(): boolean {
    return audioContextCtor() !== null;
  }

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Foydalanuvchi harakati ichida: kontekstni yaratish/ishga tushirish */
  async unlock(): Promise<boolean> {
    const Ctor = audioContextCtor();
    if (!Ctor) return false;
    try {
      if (!this.ctx) this.ctx = new Ctor();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      // iOS: birinchi ovoz jim boʻlishi mumkin — juda qisqa jim bufer
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  /** Ikki tonli "ding-dong" (E5 → C5), ~0.7 s */
  chime(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + start);
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.05);
    };
    tone(659.25, 0, 0.45, 0.35);
    tone(523.25, 0.28, 0.6, 0.35);
  }

  close(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

// ── Nutq ──

/** Lotin oʻzbekcha → kirill (ruscha ovoz oʻzbek matnini yaxshiroq oʻqiydi) */
export function toUzCyrillic(text: string): string {
  const pairs: [RegExp, string][] = [
    [/oʻ|o'|o’/gi, 'ў'],
    [/gʻ|g'|g’/gi, 'ғ'],
    [/sh/gi, 'ш'],
    [/ch/gi, 'ч'],
    [/ng/gi, 'нг'],
    [/ya/gi, 'я'],
    [/yo/gi, 'ё'],
    [/yu/gi, 'ю'],
    [/ye/gi, 'е'],
    [/ts/gi, 'ц'],
  ];
  let out = text;
  for (const [re, rep] of pairs) {
    out = out.replace(re, (m) => {
      const first = m.charAt(0);
      return first !== first.toLowerCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
    });
  }
  const map: Record<string, string> = {
    a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', ʼ: 'ъ', "'": 'ъ',
  };
  return out.replace(/[a-zʼ']/gi, (ch) => {
    const lower = ch.toLowerCase();
    const rep = map[lower];
    if (!rep) return ch;
    return ch === lower ? rep : rep.toUpperCase();
  });
}

/** "A-012" → "A 0 1 2" — raqamlar alohida oʻqiladi ("A minus oʻn ikki" boʻlmasin) */
export function spellNumber(number: string): string {
  return number.replace('-', ' ').split('').join(' ').replace(/\s+/g, ' ').trim();
}

export function pickVoice(locale: Locale, voices: SpeechSynthesisVoice[]): { voice: SpeechSynthesisVoice | null; lang: string; cyrillic: boolean } {
  const byLang = (prefix: string) => voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix));
  if (locale === 'uz') {
    const uz = byLang('uz');
    if (uz.length) return { voice: uz[0] ?? null, lang: 'uz-UZ', cyrillic: (uz[0]?.lang ?? '').toLowerCase().includes('cyrl') };
    const ru = byLang('ru');
    if (ru.length) return { voice: ru[0] ?? null, lang: 'ru-RU', cyrillic: true };
    return { voice: null, lang: 'ru-RU', cyrillic: true };
  }
  const ru = byLang('ru');
  return { voice: ru[0] ?? null, lang: 'ru-RU', cyrillic: false };
}

export interface SpeakOptions {
  locale: Locale;
  /** Tayyor matn (masalan "A-012 raqam, 3-xona") */
  text: string;
  rate?: number;
}

/** speechSynthesis orqali eʼlon; qoʻllab-quvvatlanmasa false */
export function speakAnnouncement({ locale, text, rate = 0.95 }: SpeakOptions): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try {
    const synth = window.speechSynthesis;
    const { voice, lang, cyrillic } = pickVoice(locale, synth.getVoices());
    const utter = new SpeechSynthesisUtterance(locale === 'uz' && cyrillic ? toUzCyrillic(text) : text);
    utter.lang = lang;
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = 1;
    synth.cancel();
    synth.speak(utter);
    return true;
  } catch {
    return false;
  }
}
