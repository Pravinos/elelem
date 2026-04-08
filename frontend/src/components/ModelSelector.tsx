type ModelSelectorProps = {
  models: string[];
  value: string;
  onChange: (nextModel: string) => void;
  disabled?: boolean;
};

export default function ModelSelector({
  models,
  value,
  onChange,
  disabled,
}: ModelSelectorProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-300">
      <span className="shrink-0 text-slate-400">Model</span>
      <select
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-teal-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || models.length === 0}
      >
        {models.length === 0 ? (
          <option value="">No models found</option>
        ) : null}
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
