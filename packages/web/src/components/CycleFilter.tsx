interface CycleFilterProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CycleFilter({ label, options, value, onChange }: CycleFilterProps) {
  const idx = options.indexOf(value);
  const next = options[(idx + 1) % options.length];
  const active = value !== options[0];

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${label}: ${value} (tap to cycle)`}
      className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-lg text-xs font-medium transition ${
        active
          ? "bg-accent-soft text-accent border border-accent/40"
          : "bg-raise text-muted border border-hair hover:text-ink"
      }`}
    >
      <span className="opacity-70">{label}</span>
      {value} &#x21bb;
    </button>
  );
}
