// Every piece of search / share copy lives here, so the <head> tags, the link-preview card
// (src/app/opengraph-image.tsx), the JSON-LD block and the sitemap can't drift apart.
//
// Lengths are deliberate: Google cuts titles at ~60 characters and descriptions at ~155-160;
// link-preview cards (Telegram, Messenger, X, Slack, LinkedIn) show roughly the same.

export const SITE_NAME = "UseCTL";
export const SITE_URL = "https://usectl.com";

// <title> on the home page (and og:title). 53 characters.
export const SITE_TITLE = "UseCTL — Managed Kubernetes & AI Agent Infrastructure";

// <meta name="description"> (and og:description). 148 characters.
export const SITE_DESCRIPTION =
  "Deploy apps, databases, workers and AI agents without a DevOps team. UseCTL takes you from code to production on managed Kubernetes, from $15/month.";

// The shorter line the share card shows under the title (some apps truncate hard).
export const SHARE_DESCRIPTION =
  "Build your product. We'll handle the infrastructure. Managed Kubernetes and AI agent hosting with predictable pricing.";

export const SITE_KEYWORDS = [
  "managed Kubernetes",
  "AI agent infrastructure",
  "AI agent hosting",
  "deploy apps",
  "managed databases",
  "background workers",
  "platform as a service",
  "PaaS",
  "DevOps",
  "cloud hosting",
  "UseCTL",
];

// The share card's alt text (screen readers in the apps that render it).
export const SHARE_IMAGE_ALT =
  "UseCTL — Build your product. We'll handle the infrastructure. Managed Kubernetes & AI Agent Infrastructure.";

// The cheapest plan the pricing calculator starts from — used by the JSON-LD offer.
export const STARTING_PRICE_USD = "15";
