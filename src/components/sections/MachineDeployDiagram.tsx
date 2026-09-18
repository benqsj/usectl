import Image from "next/image";

// Step 6's ("Push your code. We'll put it live.") right-column visual: the same
// "Machine: my-project" frame as step 5, now with the deploy chain running into it —
// Github -> Build -> Deploy -> the Website pod (lit green), joined by the wavy connector lines,
// with API / Worker / Storage / Database sitting underneath. Assets: /public/infrastructur/6text/
// for the cards and connectors, plus the three chain icons from the folder above it
// (machine-github / machine-build / machine-deploy).
//
// Unlike 5text, these card SVGs are COMPLETE — border, icon and label are all baked in (website.svg
// even carries its own POD), so each card is a single image. The only overlays are the two POD
// labels on the API and Worker cards, which their own files don't include, and the Github / Build /
// Deploy captions, which sit outside (below) their cards.
//
// Coordinates are read off the approved reference layout and expressed against a 720x388 box —
// the composition's own bounds, from the Github card's left edge to the Machine frame's right —
// so the whole thing scales as one unit. Fonts are `cqw` against that same box.
//
// REVEAL: same contract as MachineInfraDiagram — every piece is a [data-diagram-item] holding a
// [data-diagram-border] and (optionally) a [data-diagram-content], and DOM order is the order
// machineScrollAnimation.ts brings them in: frame, then the chain left to right (card, line, card,
// line, ...), then the pods and the two service cards.

// REF_W carries 16 units of slack past the Machine frame's right edge (which ends at 720). Without
// it the frame's right border sat exactly ON this box's own edge and got shaved off by the clipping
// around it, so the frame rendered with no right-hand line at all.
const REF_W = 736;
const REF_H = 388;
const x = (u: number) => `${(u / REF_W) * 100}%`;
const y = (u: number) => `${(u / REF_H) * 100}%`;
const cqw = (px: number) => `${((px / REF_W) * 100).toFixed(3)}cqw`;

// The Machine frame itself — everything but the Github card sits inside it.
const FRAME = { left: 163, top: 0, width: 557, height: 388 };
const TITLE = { left: 191, centerY: 37.7 };

// Row 1: the deploy chain. github/build/deploy share one 117x77 empty card (build.svg, deploy.svg
// and github.svg are byte-identical frames), so the icon and caption are laid on top.
const CHAIN_CARD = { width: 117, height: 77, top: 73.5 };
const CHAIN_CAPTION_CENTER_Y = 164.6;
const CHAIN = [
  { key: "github", left: 0, icon: "/infrastructur/machine-github.svg", iconW: 38, iconH: 38, size: 34, label: "Github" },
  { key: "build", left: 191.5, icon: "/infrastructur/machine-build.svg", iconW: 38, iconH: 38, size: 34, label: "Build" },
  { key: "deploy", left: 351.7, icon: "/infrastructur/machine-deploy.svg", iconW: 24, iconH: 24, size: 28, label: "Deploy" },
] as const;

// The connectors, each fitted to the gap it bridges (centred on the chain row).
const LINE_TOP = 105.5;
const LINE_H = 13;
const LINES = [
  { key: "l1", src: "/infrastructur/6text/connected-line.svg", left: 119.25, width: 70, w: 70, h: 13 },
  { key: "l2", src: "/infrastructur/6text/second-connect-line.svg", left: 308.5, width: 43.2, w: 44, h: 13 },
  { key: "l3", src: "/infrastructur/6text/second-connect-line.svg", left: 468.7, width: 37.3, w: 44, h: 13 },
] as const;

// The Website pod, lit — its file already includes the green border, the icon, the label and POD.
const WEBSITE = { src: "/infrastructur/6text/website.svg", left: 506, top: 62, width: 156, height: 88 };

// Row 2-3. api.svg / worker.svg are complete cards too, but without the POD tag, so that one gets
// overlaid at the same spot 5text puts it.
const PODS = [
  { key: "api", src: "/infrastructur/6text/api.svg", left: 191.5, top: 190, width: 154, height: 86 },
  { key: "worker", src: "/infrastructur/6text/worker.svg", left: 353, top: 190, width: 154, height: 86 },
] as const;

const SERVICES = [
  { key: "storage", src: "/infrastructur/6text/storage.svg", left: 520, top: 190, width: 150, height: 83 },
  { key: "database", src: "/infrastructur/6text/database.svg", left: 521, top: 287, width: 155, height: 76 },
] as const;

const HIDDEN = { opacity: 0, transform: "scale(0.96)" } as const;

export function MachineDeployDiagram() {
  return (
    // Slightly wider than the column: the Github card hangs off to the left of the Machine frame,
    // and this keeps the frame itself about the size it was in step 5 rather than shrinking it to
    // fit the chain in.
    <div
      className="relative w-[108%]"
      style={{ aspectRatio: `${REF_W} / ${REF_H}`, containerType: "inline-size" }}
    >
      {/* 1) the Machine frame + its title */}
      <div data-diagram-item="" className="absolute inset-0">
        <div
          data-diagram-border=""
          className="absolute"
          style={{
            ...HIDDEN,
            left: x(FRAME.left),
            top: y(FRAME.top),
            width: x(FRAME.width),
            height: y(FRAME.height),
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
          }}
        />
        <div
          data-diagram-content=""
          className="absolute font-heading font-light whitespace-nowrap text-white/70"
          style={{
            ...HIDDEN,
            left: x(TITLE.left),
            top: y(TITLE.centerY),
            marginTop: `-${cqw(8)}`,
            fontSize: cqw(16),
            lineHeight: "100%",
            letterSpacing: "-0.02em",
          }}
        >
          Machine: my-project
        </div>
      </div>

      {/* 2-7) the chain, left to right: Github -> line -> Build -> line -> Deploy -> line */}
      {CHAIN.map((card, i) => (
        <div key={card.key}>
          <div
            data-diagram-item=""
            className="absolute"
            style={{
              left: x(card.left),
              top: y(CHAIN_CARD.top),
              width: x(CHAIN_CARD.width),
              aspectRatio: `${CHAIN_CARD.width} / ${CHAIN_CARD.height}`,
            }}
          >
            <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
              <Image
                src="/infrastructur/6text/build.svg"
                alt=""
                fill
                className="pointer-events-none select-none"
              />
            </div>
            <div data-diagram-content="" className="absolute inset-0" style={HIDDEN}>
              <Image
                src={card.icon}
                alt=""
                width={card.iconW}
                height={card.iconH}
                className="pointer-events-none absolute top-[48%] left-1/2 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
                style={{ height: `${(card.size / CHAIN_CARD.height) * 100}%` }}
              />
            </div>
          </div>

          {/* The caption sits below its card, outside it — hence its own item wrapper. */}
          <div
            data-diagram-item=""
            className="absolute"
            style={{
              left: x(card.left),
              top: y(CHAIN_CAPTION_CENTER_Y),
              width: x(CHAIN_CARD.width),
              marginTop: `-${cqw(7)}`,
            }}
          >
            <div
              data-diagram-border=""
              className="text-center font-heading font-light whitespace-nowrap text-white/70"
              style={{ ...HIDDEN, fontSize: cqw(14), lineHeight: "100%", letterSpacing: "-0.02em" }}
            >
              {card.label}
            </div>
          </div>

          {LINES[i] && (
            <div
              data-diagram-item=""
              className="absolute"
              style={{
                left: x(LINES[i].left),
                top: y(LINE_TOP),
                width: x(LINES[i].width),
                height: y(LINE_H),
              }}
            >
              <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
                <Image
                  src={LINES[i].src}
                  alt=""
                  width={LINES[i].w}
                  height={LINES[i].h}
                  className="pointer-events-none h-full w-full select-none"
                  style={{ objectFit: "fill" }}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 8) the lit Website pod the chain lands on */}
      <div
        data-diagram-item=""
        className="absolute"
        style={{
          left: x(WEBSITE.left),
          top: y(WEBSITE.top),
          width: x(WEBSITE.width),
          aspectRatio: `${WEBSITE.width} / ${WEBSITE.height}`,
        }}
      >
        <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
          <Image src={WEBSITE.src} alt="" fill className="pointer-events-none select-none" />
        </div>
      </div>

      {/* 9-10) API / Worker — complete cards, POD laid on top */}
      {PODS.map((pod) => (
        <div
          key={pod.key}
          data-diagram-item=""
          className="absolute"
          style={{
            left: x(pod.left),
            top: y(pod.top),
            width: x(pod.width),
            aspectRatio: `${pod.width} / ${pod.height}`,
          }}
        >
          <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
            <Image src={pod.src} alt="" fill className="pointer-events-none select-none" />
          </div>
          <div data-diagram-content="" className="absolute inset-0" style={HIDDEN}>
            <span
              className="absolute font-heading font-medium text-white/80"
              style={{ top: "14%", right: "8%", fontSize: cqw(12), lineHeight: "100%", letterSpacing: "-0.02em" }}
            >
              POD
            </span>
          </div>
        </div>
      ))}

      {/* 11-12) Storage / Database */}
      {SERVICES.map((service) => (
        <div
          key={service.key}
          data-diagram-item=""
          className="absolute"
          style={{
            left: x(service.left),
            top: y(service.top),
            width: x(service.width),
            aspectRatio: `${service.width} / ${service.height}`,
          }}
        >
          <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
            <Image src={service.src} alt="" fill className="pointer-events-none select-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
