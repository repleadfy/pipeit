interface CycleFilterProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function CycleFilter({ options, value, onChange }: CycleFilterProps) {
  const idx = options.indexOf(value);
  const next = options[(idx + 1) % options.length];

  return (
    <button
      onClick={() => onChange(next)}
      className={`px-2 py-1 rounded text-xs font-medium transition ${
        value === options[0]
          ? "bg-gray-800 text-gray-400"
          : "bg-indigo-900/50 text-indigo-300 border border-indigo-800"
      }`}
    >
      {value} &#x21bb;
    </button>
  );
}
