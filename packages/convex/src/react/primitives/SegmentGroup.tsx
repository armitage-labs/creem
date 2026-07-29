import { SegmentGroup as ArkSegmentGroup } from "@ark-ui/react/segment-group";

/**
 * A single option inside `SegmentGroup`.
 */
export type SegmentGroupItem = {
  label: string;
  value: string;
  badge?: string;
  disabled?: boolean;
};

/**
 * Segmented control used by the interval and group selectors.
 *
 * Exported so a replacement selector can match the built-in styling.
 */
export const SegmentGroup = ({
  items = [],
  value,
  defaultValue,
  disabled = false,
  className = "",
  unstyled = false,
  onValueChange,
}: {
  items?: SegmentGroupItem[];
  value?: string | null;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  unstyled?: boolean;
  onValueChange?: (value: string) => void;
}) => {
  if (items.length <= 1) return null;

  const resolvedValue = value ?? undefined;
  const controlKey = `${items.map((item) => item.value).join("|")}::${resolvedValue ?? ""}`;

  return (
    <ArkSegmentGroup.Root
      key={controlKey}
      value={resolvedValue}
      defaultValue={defaultValue}
      disabled={disabled}
      className={unstyled ? className : `creem-base:segment-group ${className}`}
      onValueChange={(details: { value: string | null }) => {
        if (details.value != null) onValueChange?.(details.value);
      }}
    >
      <ArkSegmentGroup.Indicator
        className={unstyled ? "" : "creem-base:segment-group-indicator"}
      />
      {items.map((item) => (
        <ArkSegmentGroup.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className={unstyled ? "" : "creem-base:segment-group-item"}
        >
          <ArkSegmentGroup.ItemText
            className={
              unstyled
                ? ""
                : "creem-base:segment-group-item-text creem-base:label-m"
            }
          >
            {item.label}
            {item.badge ? (
              <span
                className={
                  unstyled
                    ? ""
                    : "creem-base:ml-2 creem-base:rounded-full creem-base:bg-blue-950 creem-base:px-2 creem-base:py-0.5 creem-base:text-xs creem-base:font-medium creem-base:text-blue-100 dark:creem-base:bg-blue-900/70 dark:creem-base:text-blue-100"
                }
              >
                {item.badge}
              </span>
            ) : null}
          </ArkSegmentGroup.ItemText>
          <ArkSegmentGroup.ItemControl
            className={unstyled ? "" : "creem-base:segment-group-item-control"}
          />
          <ArkSegmentGroup.ItemHiddenInput />
        </ArkSegmentGroup.Item>
      ))}
    </ArkSegmentGroup.Root>
  );
};
