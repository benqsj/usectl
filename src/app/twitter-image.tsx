// X / Twitter card image (twitter:image). The card itself lives in
// _og/card.tsx; opengraph-image.tsx renders the same one.
import { renderShareCard, OG_SIZE } from "./_og/card";
import { SHARE_IMAGE_ALT } from "@/lib/seo";

export const alt = SHARE_IMAGE_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderShareCard();
}
