/**
 * JSON-LD (schema.org) skripti. Faqat oʻzimiz tuzgan obyektlar uzatiladi;
 * `<` belgisi HTML ichida xavfsiz boʻlishi uchun unicode ga almashtiriladi.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
