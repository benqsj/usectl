import Image from "next/image";
import Link from "next/link";
import { ColumnLines } from "@/components/layout/BackgroundLines";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { INSET_VW, s, HEADER_HIDE_WIDE, HEADER_HIDE_NARROW, LINE_COLOR, LINE_THICKNESS_PX } from "@/lib/grid";
import { NAV_LINKS } from "@/lib/nav";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full overflow-x-clip border-b border-white/10 bg-background/60 backdrop-blur-md">
      {/* Rendered here (a child of <header>, above its own bg-background/60 + backdrop-blur-md
          layer) rather than in BackgroundLines.tsx's fixed background — at this grid's real
          opacity, sitting behind the header's blur washes the lines out to fully invisible. See
          BackgroundLines.tsx's own note at the removed call site. */}
      <ColumnLines
        hideWide={HEADER_HIDE_WIDE}
        hideNarrow={HEADER_HIDE_NARROW}
        className="header-cols pointer-events-none absolute top-0 h-16 max-lg:hidden lg:h-24"
        style={{ left: INSET_VW, right: INSET_VW }}
      />
      {/* < 1024: the phone/tablet grid (globals.css --grid-*), masked clear of the logo and the
          burger so no line runs through either */}
      <div
        aria-hidden="true"
        className="header-cols-m pointer-events-none absolute inset-y-0 lg:hidden"
        style={{
          left: "var(--grid-inset)",
          right: "calc(var(--grid-inset) - var(--grid-edge))",
          backgroundImage: `repeating-linear-gradient(to right, ${LINE_COLOR} 0, ${LINE_COLOR} ${LINE_THICKNESS_PX}px, transparent ${LINE_THICKNESS_PX}px, transparent var(--grid-pitch))`,
          backgroundPositionX: `-${LINE_THICKNESS_PX / 2}px`,
        }}
      />
      <div
        className="relative flex h-16 w-full items-center max-lg:px-(--grid-inset)! lg:h-24"
        style={
          /* Was hardcoded "6.770833vw" / "5.15625vw" — the same 130px / 99px at the 1920 reference,
             but in raw vw they kept shrinking past the 1280 floor while the grid they line up with
             stopped. Both go through the shared scale now. */
          { paddingLeft: s(130), paddingRight: INSET_VW }
        }
      >
        <Link href="/" aria-label="usectl home" className="shrink-0">
          <Image src="/logo/logo.svg" alt="usectl" width={150} height={24} priority className="h-auto w-[120px] lg:w-[150px]" />
        </Link>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 lg:block"
        >
          <ul className="flex items-center gap-8 whitespace-nowrap font-heading text-base text-white/80 max-[1279.98px]:gap-6 max-[1279.98px]:text-[15px]">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                {/* hover: the label warms to the brand green while a green rule sweeps in from
                    the left under it (the page's own accent, not a plain white highlight) */}
                <Link
                  href={link.href}
                  className="group relative inline-block py-1 transition-colors duration-300 ease-out hover:text-brand"
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-brand transition-transform duration-300 ease-out group-hover:scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <MobileMenu links={NAV_LINKS} />
      </div>
    </header>
  );
}
