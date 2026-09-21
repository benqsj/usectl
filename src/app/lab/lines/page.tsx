import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LabLinesClient } from "./LabLinesClient";

// Not linked from anywhere, not indexable, and gone entirely from a production build — this is a
// workbench for picking the background grid's glow values (see grid-glow.md, Stage A), not a page
// of the site.
export const metadata: Metadata = {
  title: "Grid lab",
  robots: { index: false, follow: false },
};

export default function LabLinesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LabLinesClient />;
}
