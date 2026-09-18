import Image from "next/image";

// Step 8's ("Give your agent a place to work.", second half) right-column visual: an Assistant CLI
// terminal on the left, "Deploy ->" going into the Machine, and "<- Logs" coming back out of it,
// with the Machine itself holding the Website and API pods wired to the DEVO Agent.
//
// The Machine half is deliberately the SAME thing the pricing calculator draws in its first column
// (PricingCalculatorSectionClient.tsx) — same assets from /public/pricesection and the same
// geometry that file derives: pods 163x107, a 44px gap between them so line.svg (83x151) spans
// exactly pod-centre to pod-centre, and the 163x124 agent pod centred on that connector's own
// midpoint. It is re-expressed here in percentages rather than the fixed px that file uses, because
// this diagram has to scale down into the server column; the numbers themselves are unchanged.
// The CLI card, the arrows and the captions are the new part, measured off the supplied reference.
//
// Everything is positioned against a 964x444 box — the composition's own bounds, from the CLI
// card's left edge to the Machine frame's right — and fonts are `cqw` against that same box.
//
// REVEAL: same contract as the other two diagrams — [data-diagram-item] wrappers holding a
// [data-diagram-border] and an optional [data-diagram-content]; DOM order is the order
// machineScrollAnimation.ts plays them in.

// REF_W carries 16 units of slack past the Machine frame's right edge (which ends at 964). Without
// it the frame's right border sat exactly ON this box's own edge and got shaved off by the
// clipping around it — "მარჯვენა line არ აქვს". Same fix as MachineDeployDiagram.tsx.
const REF_W = 980;
const REF_H = 444;
const x = (u: number) => `${(u / REF_W) * 100}%`;
const y = (u: number) => `${(u / REF_H) * 100}%`;
const cqw = (px: number) => `${((px / REF_W) * 100).toFixed(3)}cqw`;

// --- the Machine, i.e. the pricing calculator's own diagram ---------------------------------
const POD_W = 163;
const POD_H = 107;
const POD_GAP = 44;
const LINE_W = 83;
const LINE_H = 151;
const AGENT_H = 124;

const FRAME = { left: 420, top: 0, width: 544, height: 444 };
const TITLE = { left: 458, centerY: 54 };
// Cluster origin inside the frame (41 in from its left edge, 100 down from its top).
const CLUSTER = { left: 461, top: 100 };
const API_TOP = CLUSTER.top + POD_H + POD_GAP; // 251
const API_CENTER_Y = API_TOP + POD_H / 2; // 304.5 — where the Logs line lands
const AGENT_LEFT = CLUSTER.left + POD_W + LINE_W; // 707
const AGENT_TOP = CLUSTER.top + (POD_H * 2 + POD_GAP - AGENT_H) / 2; // 167

// Inside a pod, as a share of the pod itself — matching the reference.
const POD_ICON_CENTER_Y = "36%";
const POD_LABEL_CENTER_Y = "75%";

// --- the Assistant CLI card -------------------------------------------------------------------
// LEFT_SHIFT moves the card and both captions right, closing the gap to the Machine; the Logs line
// is anchored to the API pod, so it shortens by the same amount on its own. Tried at 40 and put
// back to 0 — that was too far right, and it pushed the card past the left edge.
const LEFT_SHIFT = 0;
const CLI = { left: LEFT_SHIFT, top: 104, width: 303, height: 260 };
// All three lines share one left offset — the header was briefly given its own, smaller one and
// that's been reverted: they line up. (Careful when editing: the header is positioned INSIDE the
// card, so its offset has to be worked out as a share of the CARD's width, while the two lines
// below are placed at composition level — same number, two different denominators.)
const CLI_PAD_X = 42;
const CLI_HEADER_Y = 31; // from the card's top
const CLI_DIVIDER_Y = 56;
const CLI_COMMAND_Y = 91;
const CLI_RESULT_Y = 134.5;
const CLI_BG = "#1E1D1D";
const CLI_FONT = 13; // spec'd: Space Grotesk Light 13/100%, -2% tracking, for all three lines

// --- the two captions between CLI and Machine ---------------------------------------------------
// Deploy also sits a little higher than the reference put it, per the same feedback.
const DEPLOY = { textLeft: 323 + LEFT_SHIFT, arrowLeft: 393 + LEFT_SHIFT, arrowW: 17, centerY: 175 };
const LOGS = {
  arrowLeft: 303 + LEFT_SHIFT,
  arrowW: 21,
  textLeft: 335 + LEFT_SHIFT,
  lineLeft: 383 + LEFT_SHIFT,
  lineRight: CLUSTER.left,
};

const GREEN = "#11A32A";
const HIDDEN = { opacity: 0, transform: "scale(0.96)" } as const;

function Pod({
  border,
  icon,
  iconW,
  iconH,
  label,
  labelSize,
  badge,
  width,
  height,
  left,
  top,
}: {
  border: string;
  icon: string;
  iconW: number;
  iconH: number;
  label: string;
  labelSize: number;
  badge?: boolean;
  width: number;
  height: number;
  left: number;
  top: number;
}) {
  return (
    <div
      data-diagram-item=""
      className="absolute"
      style={{ left: x(left), top: y(top), width: x(width), aspectRatio: `${width} / ${height}` }}
    >
      <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
        <Image src={border} alt="" fill className="pointer-events-none select-none" />
      </div>
      <div data-diagram-content="" className="absolute inset-0" style={HIDDEN}>
        <Image
          src={icon}
          alt=""
          width={iconW}
          height={iconH}
          className="pointer-events-none absolute left-1/2 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
          style={{ top: POD_ICON_CENTER_Y, height: `${(iconH / height) * 100}%` }}
        />
        {badge && (
          <span
            className="absolute font-heading font-medium whitespace-nowrap text-white/60"
            style={{ top: "13%", right: "5.5%", fontSize: cqw(12), lineHeight: "100%", letterSpacing: "-0.02em" }}
          >
            POD
          </span>
        )}
        <span
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-heading font-light whitespace-nowrap text-foreground"
          style={{
            top: POD_LABEL_CENTER_Y,
            fontSize: cqw(labelSize),
            lineHeight: "100%",
            letterSpacing: "-0.02em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function MachineAgentDiagram() {
  return (
    <div
      className="relative w-[115%]"
      style={{ aspectRatio: `${REF_W} / ${REF_H}`, containerType: "inline-size" }}
    >
      {/* 1) the Machine frame + title */}
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
          className="absolute font-heading font-light whitespace-nowrap text-white/50"
          style={{
            ...HIDDEN,
            left: x(TITLE.left),
            top: y(TITLE.centerY),
            marginTop: `-${cqw(11)}`,
            fontSize: cqw(22),
            lineHeight: "100%",
            letterSpacing: "-0.02em",
          }}
        >
          Machine: my-project
        </div>
      </div>

      {/* 2-3) the two pods */}
      <Pod
        border="/pricesection/websiteborder.svg"
        icon="/pricesection/website.svg"
        iconW={48}
        iconH={48}
        label="Website"
        labelSize={14}
        badge
        width={POD_W}
        height={POD_H}
        left={CLUSTER.left}
        top={CLUSTER.top}
      />
      <Pod
        border="/pricesection/api-broder.svg"
        icon="/pricesection/api.svg"
        iconW={48}
        iconH={48}
        label="API"
        labelSize={14}
        badge
        width={POD_W}
        height={POD_H}
        left={CLUSTER.left}
        top={API_TOP}
      />

      {/* 4) the connector — gray base with the green line over it, exactly as the pricing card
             stacks them (there the green one is scrubbed in; here the whole piece just arrives). */}
      <div
        data-diagram-item=""
        className="absolute"
        style={{
          left: x(CLUSTER.left + POD_W),
          top: y(CLUSTER.top + POD_H / 2),
          width: x(LINE_W),
          height: y(LINE_H),
        }}
      >
        <div data-diagram-border="" className="absolute inset-0" style={HIDDEN}>
          <Image src="/pricesection/line-gray.svg" alt="" fill className="pointer-events-none select-none" />
          <Image src="/pricesection/line.svg" alt="" fill className="pointer-events-none select-none" />
        </div>
      </div>

      {/* 5) the agent */}
      <Pod
        border="/pricesection/agentborder.svg"
        icon="/pricesection/devoagent.svg"
        iconW={36}
        iconH={57}
        label="DEVO Agent"
        labelSize={12}
        width={POD_W}
        height={AGENT_H}
        left={AGENT_LEFT}
        top={AGENT_TOP}
      />

      {/* 6) the Assistant CLI card — its frame and header arrive first */}
      <div
        data-diagram-item=""
        className="absolute"
        style={{ left: x(CLI.left), top: y(CLI.top), width: x(CLI.width), height: y(CLI.height) }}
      >
        <div
          data-diagram-border=""
          className="absolute inset-0"
          style={{
            ...HIDDEN,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            background: CLI_BG,
          }}
        />
        <div data-diagram-content="" className="absolute inset-0" style={HIDDEN}>
          <span
            className="absolute font-heading font-light whitespace-nowrap text-white/70"
            style={{
              left: `${(CLI_PAD_X / CLI.width) * 100}%`,
              top: `${(CLI_HEADER_Y / CLI.height) * 100}%`,
              transform: "translateY(-50%)",
              fontSize: cqw(CLI_FONT),
              lineHeight: "100%",
              letterSpacing: "-0.02em",
            }}
          >
            Assistant CLI
          </span>
          <div
            className="absolute right-0 left-0"
            style={{
              top: `${(CLI_DIVIDER_Y / CLI.height) * 100}%`,
              height: 1,
              background: "rgba(255,255,255,0.10)",
            }}
          />
        </div>
      </div>

      {/* 7) the command */}
      <div
        data-diagram-item=""
        className="absolute"
        style={{ left: x(CLI.left + CLI_PAD_X), top: y(CLI.top + CLI_COMMAND_Y) }}
      >
        <div
          data-diagram-border=""
          className="font-heading font-light whitespace-nowrap text-white/85"
          style={{
            ...HIDDEN,
            marginTop: `-${cqw(CLI_FONT / 2)}`,
            fontSize: cqw(CLI_FONT),
            lineHeight: "100%",
            letterSpacing: "-0.02em",
          }}
        >
          $ usectl deploy -- agent
        </div>
      </div>

      {/* 8) its result */}
      <div
        data-diagram-item=""
        className="absolute flex items-center"
        style={{ left: x(CLI.left + CLI_PAD_X), top: y(CLI.top + CLI_RESULT_Y), gap: cqw(8) }}
      >
        <div
          data-diagram-border=""
          className="flex items-center"
          style={{ ...HIDDEN, marginTop: `-${cqw(CLI_FONT / 2)}`, gap: cqw(8) }}
        >
          <Image
            src="/infrastructur/8text/ok.svg"
            alt=""
            width={9}
            height={10}
            className="pointer-events-none select-none"
            style={{ width: cqw(9), height: "auto" }}
          />
          <span
            className="font-heading font-light whitespace-nowrap text-white/85"
            style={{ fontSize: cqw(CLI_FONT), lineHeight: "100%", letterSpacing: "-0.02em" }}
          >
            deployed&nbsp;&nbsp;(1.2s)
          </span>
        </div>
      </div>

      {/* 9) Deploy -> */}
      <div
        data-diagram-item=""
        className="absolute flex items-center"
        style={{ left: x(DEPLOY.textLeft), top: y(DEPLOY.centerY), gap: cqw(14) }}
      >
        <div
          data-diagram-border=""
          className="flex items-center"
          style={{ ...HIDDEN, marginTop: `-${cqw(CLI_FONT / 2)}`, gap: cqw(14) }}
        >
          <span
            className="font-heading font-light whitespace-nowrap"
            style={{ color: GREEN, fontSize: cqw(CLI_FONT), lineHeight: "100%", letterSpacing: "-0.02em" }}
          >
            Deploy
          </span>
          <Image
            src="/infrastructur/8text/right-arrow.svg"
            alt=""
            width={DEPLOY.arrowW}
            height={8}
            className="pointer-events-none select-none"
            style={{ width: cqw(DEPLOY.arrowW), height: "auto" }}
          />
        </div>
      </div>

      {/* 10) <- Logs ————, landing on the API pod's left edge */}
      <div
        data-diagram-item=""
        className="absolute"
        style={{
          left: x(LOGS.arrowLeft),
          top: y(API_CENTER_Y),
          width: x(LOGS.lineRight - LOGS.arrowLeft),
          transform: "translateY(-50%)",
        }}
      >
        <div data-diagram-border="" className="relative flex items-center" style={HIDDEN}>
          <Image
            src="/infrastructur/8text/left-arrow.svg"
            alt=""
            width={LOGS.arrowW}
            height={8}
            className="pointer-events-none select-none"
            style={{ width: cqw(LOGS.arrowW), height: "auto" }}
          />
          <span
            className="absolute font-heading font-light whitespace-nowrap"
            style={{
              left: `${((LOGS.textLeft - LOGS.arrowLeft) / (LOGS.lineRight - LOGS.arrowLeft)) * 100}%`,
              transform: "translateY(-50%)",
              top: "50%",
              color: GREEN,
              fontSize: cqw(CLI_FONT),
              lineHeight: "100%",
              letterSpacing: "-0.02em",
            }}
          >
            Logs
          </span>
          {/* line.svg is 53x1 — stretched across whatever gap is left between the caption and the
              pod, which is what makes the two ends actually meet. */}
          <Image
            src="/infrastructur/8text/line.svg"
            alt=""
            width={53}
            height={1}
            className="pointer-events-none absolute top-1/2 select-none"
            style={{
              left: `${((LOGS.lineLeft - LOGS.arrowLeft) / (LOGS.lineRight - LOGS.arrowLeft)) * 100}%`,
              width: `${((LOGS.lineRight - LOGS.lineLeft) / (LOGS.lineRight - LOGS.arrowLeft)) * 100}%`,
              height: 1,
              objectFit: "fill",
            }}
          />
        </div>
      </div>
    </div>
  );
}
