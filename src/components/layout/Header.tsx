import Image from "next/image";
import Link from "next/link";
import { ColumnLines } from "@/components/layout/BackgroundLines";
import { INSET_VW, s, HEADER_HIDE_WIDE, HEADER_HIDE_NARROW } from "@/lib/grid";

const NAV_LINKS = [
  { label: "The Machine", href: "#the-machine" },
  { label: "Agents", href: "#agents" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Documentation", href: "#documentation" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-md">
      {/* Rendered here (a child of <header>, above its own bg-background/60 + backdrop-blur-md
          layer) rather than in BackgroundLines.tsx's fixed background — at this grid's real
          opacity, sitting behind the header's blur washes the lines out to fully invisible. See
          BackgroundLines.tsx's own note at the removed call site. */}
      <ColumnLines
        hideWide={HEADER_HIDE_WIDE}
        hideNarrow={HEADER_HIDE_NARROW}
        className="pointer-events-none absolute top-0 h-24"
        style={{ left: INSET_VW, right: INSET_VW }}
      />
      <div
        className="relative flex h-24 w-full items-center"
        style={
          /* Was hardcoded "6.770833vw" / "5.15625vw" — the same 130px / 99px at the 1920 reference,
             but in raw vw they kept shrinking past the 1280 floor while the grid they line up with
             stopped. Both go through the shared scale now. */
          { paddingLeft: s(130), paddingRight: INSET_VW }
        }
      >
        <Link href="/" aria-label="usectl home" className="shrink-0">
          <Image src="/logo/logo.svg" alt="usectl" width={150} height={24} priority />
        </Link>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 md:block"
        >
          <ul className="flex items-center gap-8 font-heading text-base text-white/80">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
