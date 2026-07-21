import type { DocFormat } from "@pipeit/shared";

const LABELS: Record<DocFormat, string> = {
  markdown: "MD",
  html: "HTML",
  txt: "TXT",
  pdf: "PDF",
};

/** Small neutral chip naming a doc's format. Deliberately monochrome (one accent
 *  per page): the badge classifies, the accent stays reserved for actions/state. */
export function FormatBadge({ format, className = "" }: { format: DocFormat; className?: string }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-md border border-hair bg-raise px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted ${className}`}
    >
      {LABELS[format]}
    </span>
  );
}
