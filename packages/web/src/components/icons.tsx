/** Shared icon set. One family, one stroke weight (1.5) — no unicode/emoji
 *  glyphs mixed in with SVGs anywhere in the app. */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = { size?: number; className?: string };

function icon(paths: React.ReactNode) {
  return function Icon({ size = 16, className }: IconProps) {
    return (
      <svg {...base} width={size} height={size} className={className} aria-hidden="true">
        {paths}
      </svg>
    );
  };
}

export const UploadIcon = icon(
  <>
    <path d="M12 15V4M12 4 8 8M12 4l4 4" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </>,
);

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const DownloadIcon = icon(
  <>
    <path d="M12 4v10M8 12l4 4 4-4" />
    <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
  </>,
);

export const MenuIcon = icon(<path d="M4 7h16M4 12h16M4 17h10" />);

export const CloseIcon = icon(<path d="m6 6 12 12M18 6 6 18" />);

export const CheckIcon = icon(<path d="m5 13 4 4L19 7" />);

export const ArrowLeftIcon = icon(<path d="M19 12H5m0 0 6-6m-6 6 6 6" />);

export const ArrowRightIcon = icon(<path d="M5 12h14m0 0-6-6m6 6-6 6" />);

export const SunIcon = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </>,
);

export const MoonIcon = icon(<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />);

export const TrashIcon = icon(
  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
);

export const BookmarkIcon = icon(
  <>
    <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
    <path d="M12 6.5v13" />
  </>,
);

export const LockIcon = icon(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);

export const CycleIcon = icon(<path d="M4 10a8 8 0 0 1 14-3l2 2M20 5v4h-4M20 14a8 8 0 0 1-14 3l-2-2M4 19v-4h4" />);

export const FileUpIcon = icon(
  <>
    <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
    <path d="M13 3v6h6" />
    <path d="M12 17v-4m0 0-2 2m2-2 2 2" />
  </>,
);

export const AlertIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4.5M12 15.8v.2" />
  </>,
);

export const DocIcon = icon(
  <>
    <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
    <path d="M13 3v6h6M9 13h6M9 17h4" />
  </>,
);

export const EyeIcon = icon(
  <>
    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const EyeOffIcon = icon(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.7 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.4 3.3" />
    <path d="M6.2 6.2A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 3.6-.7" />
  </>,
);

/** GitHub mark, filled with currentColor. Brand glyph, not a stroke icon. */
export function GithubIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size} className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Small spinning arc for inline loading states. */
export function SpinnerIcon({ size = 16, className = "" }: IconProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border-2 border-hair border-t-accent motion-safe:animate-spin ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** The pipeit mark — the same three-bars glyph as the favicon, in currentColor
 *  so it re-inks per skin/mode. Do not restyle: this is the brand icon. */
export function LogoMark({ size = 18, className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" width={size} height={size} className={className} aria-hidden="true">
      <rect x="14" y="10" width="6" height="44" rx="3" fill="currentColor" />
      <rect x="29" y="10" width="6" height="44" rx="3" fill="currentColor" opacity="0.6" />
      <rect x="44" y="10" width="6" height="44" rx="3" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
