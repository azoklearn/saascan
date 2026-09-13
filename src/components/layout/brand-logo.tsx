import { brand } from "@/config/brand";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <span className="brand-logo"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M9 3H4a1 1 0 0 0-1 1v5M19 3h5a1 1 0 0 1 1 1v5M3 19v5a1 1 0 0 0 1 1h5M25 19v5a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"/><path d="m8 17 4-6 4 6 4-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>{!compact && <span>{brand.name}</span>}</span>;
}
