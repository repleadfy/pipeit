/** Plain-text docs: monospace, wrapped, whitespace preserved. */
export function TxtRenderer({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {content}
    </pre>
  );
}
