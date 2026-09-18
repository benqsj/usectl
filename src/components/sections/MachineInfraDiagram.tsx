import Image from "next/image";

// Step 5's ("Run each part independently.") right-column visual: a "Machine: my-project" frame
// holding three green-bordered Pod cards (Website / API / Worker) and, below them, two
// white-bordered service cards (Storage / Database). Built from /public/infrastructur/5text/.
//
// Two things about those assets are worth knowing before editing this file:
//
//   * border.svg is NOT an empty frame — it ships with the worker gear icon AND the "Worker"
//     label baked in (paths 0-15; the green frame itself is only the last four). Using it as the
//     shared pod frame therefore drew two icons in every card. border-frame.svg is that same file
//     with everything but the four frame strokes removed, so each pod can carry its own icon;
//     border.svg is left untouched in case it's wanted whole somewhere else.
//   * white-border.svg is missing its left edge (the drawn path runs bottom -> right -> top and
//     stops), so left-line.svg is laid in at x=0 to close it.
//
// Positions below are the ones border.svg itself uses, read off its own geometry (frame 154x86:
// icon centred at y=34, label block at y=57.8-67.8, i.e. 39.5% / 73% of the height) so the
// composed cards line up with the original artwork. Everything is a percentage of this
// component's 605x312 reference frame, and the font sizes are `cqw` against it, so the whole
// diagram scales with whatever width the server column gives it.
//
// REVEAL: nothing here is visible on its own. Each piece is wrapped in a [data-diagram-item] with
// its own [data-diagram-border] (the drawn frame) and [data-diagram-content] (icons + text), and
// machineScrollAnimation.ts scrubs them in one at a time — frame first, then each pod, then each
// service card, the contents always a beat behind their own border. DOM order IS the reveal
// order, so moving a block here changes when it arrives.

const FRAME_W = 605;
const FRAME_H = 312;
const pctW = (px: number) => `${(px / FRAME_W) * 100}%`;
const pctH = (px: number) => `${(px / FRAME_H) * 100}%`;
// px at the 605-wide reference -> cqw against this component's own container
const cqw = (px: number) => `${((px / FRAME_W) * 100).toFixed(3)}cqw`;

const PAD_X = 24;
const TITLE_TOP = 24;

const POD_W = 152.06;
const POD_H = 84.9;
const POD_GAP = 23;
const POD_TOP = 81;

const SERVICE_W = 196.05;
const SERVICE_H = 73.44;
const SERVICE_GAP = 23;
const SERVICE_TOP = POD_TOP + POD_H + 35;

// Inside a pod card, as a fraction of the card itself — from border.svg's own layout.
const POD_ICON_CENTER_Y = "39.5%";
const POD_LABEL_CENTER_Y = "73%";
// Icons sit at native size against the 154-unit-wide frame, so their height as a share of the
// card is just nativeHeight / 86.
const podIconHeight = (nativeH: number) => `${(nativeH / 86) * 100}%`;

const POD_ITEMS = [
  { key: "website", icon: "/infrastructur/5text/website.svg", label: "Website", w: 34, h: 34 },
  { key: "api", icon: "/infrastructur/5text/api.svg", label: "API", w: 34, h: 34 },
  { key: "worker", icon: "/infrastructur/5text/worker.svg", label: "Worker", w: 41, h: 31 },
] as const;

// storage.svg is drawn at 35x34 per the design; database.svg keeps the same scale factor against
// its own native box (37x42 -> 35x39.7), which is why the two heights differ.
const SERVICE_ITEMS = [
  { key: "storage", icon: "/infrastructur/5text/storage.svg", label: "storage", w: 37, h: 36, drawnH: 34 },
  { key: "database", icon: "/infrastructur/5text/database.svg", label: "database", w: 37, h: 42, drawnH: 39.7 },
] as const;

// SSR/pre-hydration state for every animated piece: hidden, slightly small. GSAP owns these from
// the first frame onwards (see machineScrollAnimation.ts) — kept identical on both sides so
// nothing flashes in before the scroll reaches step 5.
const HIDDEN = { opacity: 0, transform: "scale(0.92)" } as const;

export function MachineInfraDiagram() {
  return (
    // Wider than the column it sits in: at 90% (and before that at w-full) the whole diagram, icons
    // included, read as too small next to the copy on the left. The overflow goes leftwards into the
    // row's own gap, since the layer that holds this is right-aligned.
    <div
      className="relative w-[105%]"
      style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}`, containerType: "inline-size" }}
    >
      {/* 1) the outer frame + its title */}
      <div data-diagram-item="" className="absolute inset-0">
        <div
          data-diagram-border=""
          className="absolute inset-0"
          style={{ ...HIDDEN, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
        />
        <div
          data-diagram-content=""
          className="absolute font-heading font-light whitespace-nowrap text-white/70"
          style={{
            ...HIDDEN,
            top: pctH(TITLE_TOP),
            left: pctW(PAD_X),
            fontSize: cqw(16),
            lineHeight: "100%",
            letterSpacing: "-0.02em",
          }}
        >
          Machine: my-project
        </div>
      </div>

      {/* 2-4) Website / API / Worker pods — one icon each, on the emptied frame. */}
      {POD_ITEMS.map((item, i) => (
        <div
          key={item.key}
          data-diagram-item=""
          className="absolute"
          style={{
            top: pctH(POD_TOP),
            left: pctW(PAD_X + i * (POD_W + POD_GAP)),
            width: pctW(POD_W),
            aspectRatio: `${POD_W} / ${POD_H}`,
          }}
        >
          <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
            <Image
              src="/infrastructur/5text/border-frame.svg"
              alt=""
              fill
              className="pointer-events-none select-none"
            />
          </div>

          <div data-diagram-content="" className="absolute inset-0" style={HIDDEN}>
            <span
              className="absolute font-heading font-medium text-white/80"
              style={{ top: "14%", right: "8%", fontSize: cqw(12), lineHeight: "100%", letterSpacing: "-0.02em" }}
            >
              POD
            </span>

            <Image
              src={item.icon}
              alt=""
              width={item.w}
              height={item.h}
              className="pointer-events-none absolute left-1/2 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
              style={{ top: POD_ICON_CENTER_Y, height: podIconHeight(item.h) }}
            />

            <span
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-heading font-light whitespace-nowrap text-white/70"
              style={{
                top: POD_LABEL_CENTER_Y,
                fontSize: cqw(14),
                lineHeight: "100%",
                letterSpacing: "-0.02em",
              }}
            >
              {item.label}
            </span>
          </div>
        </div>
      ))}

      {/* 5-6) Storage / Database */}
      {SERVICE_ITEMS.map((item, i) => (
        <div
          key={item.key}
          data-diagram-item=""
          className="absolute"
          style={{
            top: pctH(SERVICE_TOP),
            left: pctW(PAD_X + i * (SERVICE_W + SERVICE_GAP)),
            width: pctW(SERVICE_W),
            aspectRatio: `${SERVICE_W} / ${SERVICE_H}`,
          }}
        >
          <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
            <Image
              src="/infrastructur/5text/white-border.svg"
              alt=""
              fill
              className="pointer-events-none select-none"
            />
            {/* The edge white-border.svg doesn't draw. */}
            <Image
              src="/infrastructur/5text/left-line.svg"
              alt=""
              width={4}
              height={75}
              className="pointer-events-none absolute top-0 left-0 h-full w-auto select-none"
            />
          </div>

          <div
            data-diagram-content=""
            className="absolute inset-0 flex items-center"
            style={{ ...HIDDEN, paddingLeft: "8.4%", gap: "4.4%" }}
          >
            <Image
              src={item.icon}
              alt=""
              width={item.w}
              height={item.h}
              className="w-auto shrink-0 object-contain"
              style={{ height: `${(item.drawnH / SERVICE_H) * 100}%` }}
            />
            <span
              className="font-heading font-light whitespace-nowrap text-white/70"
              style={{ fontSize: cqw(14), lineHeight: "100%", letterSpacing: "-0.02em" }}
            >
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
