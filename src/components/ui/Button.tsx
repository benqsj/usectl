import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  href,
  children,
  withArrow = false,
}: {
  href: string;
  children: ReactNode;
  withArrow?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-heading text-sm font-medium text-white transition-colors hover:border-white/40 hover:bg-white/5"
    >
      {children}
      {withArrow && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M3 11L11 3M11 3H4M11 3V10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </Link>
  );
}
