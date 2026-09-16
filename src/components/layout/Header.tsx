import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { label: "The Machine", href: "#the-machine" },
  { label: "Agents", href: "#agents" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Documentation", href: "#documentation" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex h-24 w-full max-w-[1722px] items-center px-6 lg:px-[99px]">
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
