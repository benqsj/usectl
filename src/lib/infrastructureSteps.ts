// Content for the two "pinned scroll, content swaps IN PLACE" sequences that sit around the
// standalone "machine" screen section (that screen is a real, separate section — not part of
// this file). Architecture (per 2026-09 discussion):
//
//   [group 1: 4 steps, pinned — eyebrow/heading/paragraph swap as you scroll, layout/image/
//    progress bar stay fixed, no real page scroll happens]
//   -> real scroll transition ->
//   [machine screen — unrelated content, own component]
//   -> real scroll transition ->
//   [group 2: 4 steps, pinned — same mechanism as group 1]
//
// Each step maps 1:1 to a stop along that group's pinned scroll range, and each step's index also
// drives the small statistic-bar progress fill (0/4 -> 4/4 per group, green) once that's wired up.
// Icons are NOT wired up yet (text-only for now, per instruction) — steps 3+4 and steps 7+8
// intentionally repeat the SAME heading/paragraph within their group; they're meant to be
// distinguished only by icon once that's built, not by text.

export interface InfrastructureStep {
  eyebrow: string;
  heading: string;
  paragraph: string;
}

// Steps 1-4 — first pinned sequence. Step 1 is the section's current/existing content
// (InfrastructureSection.tsx as it is today) — steps 2-4 are new.
export const INFRASTRUCTURE_STEPS_GROUP_1: InfrastructureStep[] = [
  {
    eyebrow: "Infrastructure Freedom",
    heading: "You came here to build.",
    paragraph:
      "Your next feature. Your first customer. The idea you can't stop thinking about. usectl handles the infrastructure, giving you more time to move your product forward",
  },
  {
    eyebrow: "Infrastructure Freedom",
    heading: "Your stacks, in one place.",
    paragraph:
      "Run your apps, databases, storage, and background jobs together. Everything stays connected and organized while usectl manages the infrastructure underneath.",
  },
  {
    // NOTE: source copy had "Give every projects it's own space." (plural "projects" + the
    // contraction "it's") — normalized to the grammatical reading ("every project ... its own
    // space", singular + possessive). Flag if a different wording was actually intended.
    eyebrow: "Infrastructure Freedom",
    heading: "Give every project its own space.",
    paragraph:
      "Keep your app and the services it depends on together, with their own resources and access settings. In usectl, we call this project space a Machine.",
  },
  {
    // Step 4: same text as step 3 on purpose — only the (not-yet-built) icon differs. See file
    // header comment.
    eyebrow: "Infrastructure Freedom",
    heading: "Give every project its own space.",
    paragraph:
      "Keep your app and the services it depends on together, with their own resources and access settings. In usectl, we call this project space a Machine.",
  },
];

// Steps 5-8 — second pinned sequence, after the machine screen. Eyebrow label not yet confirmed
// for this group (reused "Infrastructure Freedom" as a placeholder — same as group 1); update once
// the real label is known.
export const INFRASTRUCTURE_STEPS_GROUP_2: InfrastructureStep[] = [
  {
    eyebrow: "Infrastructure Freedom",
    heading: "Run each part independently.",
    paragraph:
      "Your frontend, API, and workers can each have their own resources and deploy separately while staying connected inside the same project. In usectl, each running workload is a Pod.",
  },
  {
    eyebrow: "Infrastructure Freedom",
    heading: "Push your code. We'll put it live.",
    paragraph:
      "Connect your repository and push your next update. usectl builds it, deploys it, and serves it over HTTPS while the rest of your project keeps running.",
  },
  {
    eyebrow: "Infrastructure Freedom",
    heading: "Give your agent a place to work.",
    paragraph:
      "Run AI agents alongside the apps, APIs, databases, and tools they use. Your coding assistant can also deploy updates and inspect logs through the usectl CLI.",
  },
  {
    // Step 8: same text as step 7 on purpose — only the (not-yet-built) icon differs. See file
    // header comment.
    eyebrow: "Infrastructure Freedom",
    heading: "Give your agent a place to work.",
    paragraph:
      "Run AI agents alongside the apps, APIs, databases, and tools they use. Your coding assistant can also deploy updates and inspect logs through the usectl CLI.",
  },
];
