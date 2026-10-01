// The header / burger-menu links, shared by Header, MobileMenu, HeroSectionClient and HeroMobile
// so they can't drift apart.
//
// `state` is the index of the page the link lands on. The desktop pinned scene's pages
// (HeroSectionClient's SNAP_TIMES) and the mobile stacked sections run in the SAME order, so one
// number drives both: desktop glides the timeline to that state, mobile scrolls to the section
// carrying that id. Documentation has no target yet — deliberately inert until the page exists.
export type NavLink = { label: string; href: string; state?: number };

export const NAV_LINKS: readonly NavLink[] = [
  { label: "The Machine", href: "#the-machine", state: 3 }, // "Give every project its own space"
  { label: "Agents", href: "#agents", state: 6 }, // "Give your agent a place to work"
  { label: "Features", href: "#features", state: 2 }, // "Your Stacks, in one place"
  { label: "Pricing", href: "#pricing", state: 7 }, // the calculator
  { label: "Documentation", href: "#documentation" },
];

export const NAV_STATE_BY_HASH: Readonly<Record<string, number>> = Object.fromEntries(
  NAV_LINKS.flatMap((link) => (link.state === undefined ? [] : [[link.href, link.state] as const])),
);

// the mobile section that each state index owns an id for (inverse of the map above)
export const NAV_ID_BY_STATE: Readonly<Record<number, string>> = Object.fromEntries(
  NAV_LINKS.flatMap((link) =>
    link.state === undefined ? [] : [[link.state, link.href.slice(1)] as const],
  ),
);
