type ModelSelectorProps = {
  models: string[];
  value: string;
  onChange: (nextModel: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function ModelSelector({
  models,
  value,
  onChange,
  disabled,
  compact,
}: ModelSelectorProps) {
  const select = (
    <div className={compact ? "relative inline-flex items-center" : "relative inline-block w-full"}>
      <select
        aria-label="Model selector"
        className={[
          "w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pr-9 text-slate-100 outline-none transition focus:border-teal-400",
          compact
            ? "w-[96px] border border-white/[0.12] bg-white/[0.06] px-2.5 py-[7px] pr-7 text-[0.72rem] text-white/75 hover:border-white/[0.22] hover:bg-white/[0.09] focus:border-white/[0.3] sm:min-w-[140px] sm:px-3 sm:pr-8 sm:text-[0.82rem]"
            : "",
        ].join(" ")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || models.length === 0}
      >
        {models.length === 0 ? <option value="">no model</option> : null}
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <span
        className={[
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400",
          compact ? "right-3 text-[0.7rem] opacity-50" : "right-3",
        ].join(" ")}
        aria-hidden="true"
      >
        v
      </span>
    </div>
  );

  if (compact) {
    return select;
  }

  return (
    <label className="flex items-center gap-3 text-sm text-slate-300">
      <span className="shrink-0 text-slate-400">Model</span>
      {select}
    </label>
  );
}
