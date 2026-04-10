import { useEffect, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isDisabled = Boolean(disabled) || models.length === 0;
  const selectedLabel = value || (models.length === 0 ? "no model" : "select model");

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (
    <div
      ref={dropdownRef}
      className={compact ? "relative inline-block min-w-[96px] sm:min-w-[140px]" : "relative w-full"}
    >
      <button
        type="button"
        aria-label="Model selector"
        onClick={() => {
          if (!isDisabled) {
            setOpen((previous) => !previous);
          }
        }}
        disabled={isDisabled}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-[7px] text-left text-[0.82rem] text-white/75 transition",
          "hover:border-white/[0.22] hover:bg-white/[0.09]",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/[0.12] disabled:hover:bg-white/[0.06]",
          compact ? "px-2.5 text-[0.72rem] sm:px-3 sm:text-[0.82rem]" : "",
        ].join(" ")}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="shrink-0 text-[0.72rem] opacity-70" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && models.length > 0 ? (
        <ul className="absolute right-0 top-[calc(100%+6px)] z-[100] m-0 min-w-full list-none rounded-lg border border-white/[0.12] bg-[#1a1a24] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          {models.map((model) => (
            <li key={model}>
              <button
                type="button"
                className={[
                  "block w-full rounded-md px-3 py-2 text-left text-[0.82rem] transition",
                  model === value
                    ? "bg-white/[0.1] text-white"
                    : "text-white/70 hover:bg-white/[0.07] hover:text-white/95",
                ].join(" ")}
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                {model}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
