// Full-viewport loading state that paints the themed background from the first
// frame, so resolving async auth never flashes an unstyled white screen.
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app text-ink">
      <div
        className="size-6 rounded-full border-2 border-hair border-t-accent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
