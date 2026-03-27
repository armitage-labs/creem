import type { ChangeEvent } from "react";

export const NumberInput = ({
  value = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  compact = false,
  disabled = false,
  className = "",
  onValueChange,
}: {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: number) => void;
}) => {
  const clamp = (candidate: number) => Math.min(max, Math.max(min, candidate));

  const setValue = (candidate: number) => {
    const next = clamp(candidate);
    onValueChange?.(next);
  };

  const decrement = () => setValue((value ?? 0) - step);
  const increment = () => setValue((value ?? 0) + step);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(e.currentTarget.value);
    if (!Number.isFinite(parsed)) return;
    setValue(parsed);
  };

  return (
    <div className={`number-input ${className}`}>
      <button
        type="button"
        aria-label="Decrease value"
        disabled={disabled}
        className="icon-button-sm"
        onClick={decrement}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 256 256"
          fill="currentColor"
          className="h-4 w-4 text-foreground-on-tonal"
        >
          <path d="M216,128a12,12,0,0,1-12,12H52a12,12,0,0,1,0-24H204A12,12,0,0,1,216,128Z" />
        </svg>
      </button>

      <input
        type="number"
        className={`input-ghost ${compact ? "number-input-value-compact" : "number-input-value"} max-w-12 input-no-spinner`}
        value={value}
        disabled={disabled}
        onChange={handleInput}
      />

      <button
        type="button"
        aria-label="Increase value"
        disabled={disabled}
        className="icon-button-sm"
        onClick={increment}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 256 256"
          fill="currentColor"
          className="h-4 w-4 text-foreground-on-tonal"
        >
          <path d="M216,128a12,12,0,0,1-12,12H140v64a12,12,0,0,1-24,0V140H52a12,12,0,0,1,0-24h64V52a12,12,0,0,1,24,0v64h64A12,12,0,0,1,216,128Z" />
        </svg>
      </button>
    </div>
  );
};
