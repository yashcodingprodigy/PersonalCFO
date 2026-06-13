export function LogoMark({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  // Three ascending ledger bars inside a rounded square — growth under structure.
  const fg = dark ? '#0B2F2A' : '#FFFFFF';
  const bg = dark ? '#DFF5EE' : '#0B2F2A';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="11" fill={bg} />
      <rect x="9" y="22" width="5.5" height="9" rx="1.5" fill={fg} opacity="0.55" />
      <rect x="17.25" y="16" width="5.5" height="15" rx="1.5" fill={fg} opacity="0.78" />
      <rect x="25.5" y="9" width="5.5" height="22" rx="1.5" fill="#2FBC9B" />
    </svg>
  );
}

export function Wordmark({ dark = false, size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className={`inline-flex items-center gap-2.5 ${cls} font-bold tracking-tight ${dark ? 'text-white' : 'text-pine-900'}`}>
      <LogoMark size={size === 'lg' ? 36 : size === 'sm' ? 24 : 28} dark={dark} />
      <span>
        Pay<span className="font-display italic font-medium">Watch</span>
      </span>
    </span>
  );
}
