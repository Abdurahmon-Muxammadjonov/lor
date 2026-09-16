/** "Oʻzbekistonda ishlab chiqilgan" belgisi — kichik bayroq (inline SVG) + matn. Server-safe. */
export function MadeInUzbekistan({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-base px-2.5 py-1 text-xs text-text-muted">
      <svg viewBox="0 0 24 16" width="18" height="12" aria-hidden="true" className="shrink-0 rounded-[2px]">
        <rect width="24" height="16" fill="#1EB53A" />
        <rect width="24" height="10.6" fill="#FFFFFF" />
        <rect width="24" height="5.3" fill="#0099B5" />
        <rect y="5.05" width="24" height="0.5" fill="#CE1126" />
        <rect y="10.45" width="24" height="0.5" fill="#CE1126" />
        <circle cx="4.2" cy="2.7" r="1.7" fill="#FFFFFF" />
        <circle cx="4.9" cy="2.5" r="1.5" fill="#0099B5" />
      </svg>
      {label}
    </span>
  );
}
