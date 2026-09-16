import { ImageResponse } from 'next/og';
import { SITE } from '@/data/landing-content';

/**
 * OpenGraph rasmi (1200×630) — ijtimoiy tarmoqlarda ulashilganda koʻrinadi.
 * Satori standart shrifti faqat lotin belgilarni qamrab oladi, shuning uchun matn apostrofsiz lotin uz da.
 */
export const runtime = 'edge';
export const alt = 'LOR CRM';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TITLE_1 = 'LOR klinikalari uchun';
const TITLE_2 = 'zamonaviy CRM';
const SUBTITLE = 'Elektron navbat va talon printeri, 4 narxli muolaja kalkulyatori (0.5 qadam), kassa va chek, hisobotlar, SMS eslatmalar.';
const PILLS = ['Navbat + talon', 'Kalkulyator', 'Kassa + chek', 'Hisobotlar', 'SMS / Telegram'];
const FOOTER = '14 kunlik bepul sinov · Karta talab qilinmaydi';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #060810 0%, #0D1220 55%, #131A2B 100%)',
          color: '#EAF0FF',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(0,212,255,0.28) 0%, rgba(0,212,255,0) 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -220,
            left: 200,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(124,92,255,0.26) 0%, rgba(124,92,255,0) 70%)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #00D4FF, #7C5CFF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#060810',
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            L
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
            <span style={{ color: '#00D4FF' }}>LOR</span>
            <span style={{ marginLeft: 10 }}>CRM</span>
          </div>
          <div style={{ display: 'flex', marginLeft: 'auto', fontSize: 22, color: '#8A99B8' }}>{SITE.url.replace('https://', '')}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>{TITLE_1}</span>
            <span style={{ color: '#00D4FF' }}>{TITLE_2}</span>
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#8A99B8', maxWidth: 980, lineHeight: 1.35 }}>{SUBTITLE}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {PILLS.map((p) => (
              <div
                key={p}
                style={{
                  display: 'flex',
                  padding: '10px 18px',
                  borderRadius: 9999,
                  border: '1px solid rgba(0,212,255,0.35)',
                  background: 'rgba(0,212,255,0.10)',
                  color: '#EAF0FF',
                  fontSize: 22,
                }}
              >
                {p}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#8A99B8' }}>
          <span>{FOOTER}</span>
          <span>UZ · RU</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
