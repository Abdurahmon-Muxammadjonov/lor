'use client';

import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  /** `false` boʻlsa tinglovchi oʻchiriladi */
  enabled?: boolean;
  /** Standart brauzer amalini toʻxtatish (default: true) */
  preventDefault?: boolean;
  /** Input/textarea/contenteditable ichida ham ishlasin (default: false, faqat Escape uchun true) */
  allowInInput?: boolean;
  /** Tinglash nishoni (default: window) */
  target?: Window | Document | HTMLElement | null;
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  plus: '+',
  minus: '-',
  comma: ',',
  period: '.',
  slash: '/',
};

function parseCombo(combo: string): ParsedCombo {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const parsed: ParsedCombo = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: false };
  for (const part of parts) {
    switch (part) {
      case 'mod':
      case 'cmd':
      case 'command':
        parsed.mod = true;
        break;
      case 'ctrl':
      case 'control':
        parsed.ctrl = true;
        break;
      case 'meta':
      case 'win':
      case 'super':
        parsed.meta = true;
        break;
      case 'alt':
      case 'option':
        parsed.alt = true;
        break;
      case 'shift':
        parsed.shift = true;
        break;
      default:
        parsed.key = KEY_ALIASES[part] ?? part;
    }
  }
  return parsed;
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform ?? '') || /mac os/i.test(navigator.userAgent ?? '');
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

export function matchesHotkey(e: KeyboardEvent, combo: ParsedCombo): boolean {
  const mac = isMac();
  const wantCtrl = combo.ctrl || (combo.mod && !mac);
  const wantMeta = combo.meta || (combo.mod && mac);
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.metaKey !== wantMeta) return false;
  if (e.altKey !== combo.alt) return false;
  if (e.shiftKey !== combo.shift) return false;
  const key = e.key.toLowerCase();
  if (key === combo.key) return true;
  // Shift/Alt bilan belgi oʻzgarsa (masalan "?" → "/"), fizik kod boʻyicha ham solishtiramiz
  const code = e.code.toLowerCase();
  if (code === `key${combo.key}` || code === `digit${combo.key}`) return true;
  return false;
}

/**
 * Global klaviatura kombinatsiyasi.
 *
 *   useHotkey('mod+k', () => setOpen(true));
 *   useHotkey('escape', close, { allowInInput: true });
 *
 * `mod` — Mac da ⌘, boshqalarda Ctrl.
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, options: HotkeyOptions = {}): void {
  const { enabled = true, preventDefault = true, allowInInput, target } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const parsed = parseCombo(combo);
    if (!parsed.key) return;
    const inInputOk = allowInInput ?? parsed.key === 'escape';
    const node: Window | Document | HTMLElement | null = target === undefined ? window : target;
    if (!node) return;

    const listener = (ev: Event) => {
      const e = ev as KeyboardEvent;
      if (e.defaultPrevented) return;
      if (!inInputOk && isEditable(e.target)) return;
      if (!matchesHotkey(e, parsed)) return;
      if (preventDefault) e.preventDefault();
      handlerRef.current(e);
    };

    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, [combo, enabled, preventDefault, allowInInput, target]);
}

/** Koʻrsatish uchun: 'mod+k' → '⌘K' (Mac) / 'Ctrl+K' */
export function formatHotkey(combo: string): string {
  const mac = isMac();
  return combo
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .map((p) => {
      switch (p) {
        case 'mod':
          return mac ? '⌘' : 'Ctrl';
        case 'ctrl':
          return mac ? '⌃' : 'Ctrl';
        case 'alt':
          return mac ? '⌥' : 'Alt';
        case 'shift':
          return mac ? '⇧' : 'Shift';
        case 'meta':
          return mac ? '⌘' : 'Win';
        case 'escape':
        case 'esc':
          return 'Esc';
        case 'enter':
          return '↵';
        case 'arrowup':
        case 'up':
          return '↑';
        case 'arrowdown':
        case 'down':
          return '↓';
        case 'arrowleft':
        case 'left':
          return '←';
        case 'arrowright':
        case 'right':
          return '→';
        default:
          return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
      }
    })
    .join(mac ? '' : '+');
}
