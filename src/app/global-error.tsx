'use client';

/**
 * Root layout darajasidagi xato — provayderlar, globals.css va i18n mavjud emas.
 * Shuning uchun faqat inline uslublar va ikki tilli statik matn.
 */
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const styles = {
  body: {
    margin: 0,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#060810',
    color: '#EAF0FF',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: '24px',
    boxSizing: 'border-box' as const,
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px',
    borderRadius: '16px',
    background: '#0D1220',
    border: '1px solid #1F2A40',
    boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6)',
    textAlign: 'center' as const,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'rgba(255,77,109,0.12)',
    border: '1px solid rgba(255,77,109,0.3)',
    color: '#FF4D6D',
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: 1,
  },
  h1: {
    margin: '20px 0 6px',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  sub: {
    margin: '0 0 4px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#EAF0FF',
    opacity: 0.85,
  },
  p: {
    margin: '12px 0 0',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#8A99B8',
  },
  code: {
    display: 'inline-block',
    marginTop: '14px',
    padding: '3px 8px',
    borderRadius: '6px',
    background: '#131A2B',
    border: '1px solid #1F2A40',
    color: '#8A99B8',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    justifyContent: 'center',
    marginTop: '28px',
  },
  primary: {
    appearance: 'none' as const,
    border: 0,
    cursor: 'pointer',
    height: '44px',
    padding: '0 22px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #00D4FF 0%, #7C5CFF 100%)',
    color: '#060810',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  secondary: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '44px',
    padding: '0 22px',
    borderRadius: '10px',
    background: 'transparent',
    border: '1px solid #1F2A40',
    color: '#EAF0FF',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="uz-Latn" style={{ colorScheme: 'dark' }}>
      <body style={styles.body}>
        <main style={styles.card} role="alert">
          <div style={styles.badge} aria-hidden="true">
            !
          </div>
          <h1 style={styles.h1}>Xatolik yuz berdi</h1>
          <p style={styles.sub} lang="ru">
            Произошла ошибка
          </p>
          <p style={styles.p}>
            Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab koʻring.
            <br />
            <span lang="ru">Возникла непредвиденная ошибка. Попробуйте перезагрузить страницу.</span>
          </p>
          {error.digest ? <code style={styles.code}>{error.digest}</code> : null}
          <div style={styles.actions}>
            <button type="button" onClick={reset} style={styles.primary}>
              Qayta urinish · Повторить
            </button>
            <a href="/" style={styles.secondary}>
              Bosh sahifa · Главная
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
