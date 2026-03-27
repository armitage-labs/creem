import { SegmentGroup as ArkSegmentGroup } from "@ark-ui/react/segment-group";

export type SegmentGroupItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

export const SegmentGroup = ({
  items = [],
  value,
  defaultValue,
  disabled = false,
  className = "",
  onValueChange,
}: {
  items?: SegmentGroupItem[];
  value?: string | null;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) => {
  if (items.length <= 1) return null;

  return (
    <ArkSegmentGroup.Root
      value={value ?? undefined}
      defaultValue={defaultValue}
      disabled={disabled}
      className={`segment-group ${className}`}
      onValueChange={(details: { value: string | null }) => {
        if (details.value != null) onValueChange?.(details.value);
      }}
    >
      <ArkSegmentGroup.Indicator className="segment-group-indicator" />
      {items.map((item) => (
        <ArkSegmentGroup.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className="segment-group-item"
        >
          <ArkSegmentGroup.ItemText className="segment-group-item-text label-m">
            {item.label}
          </ArkSegmentGroup.ItemText>
          <ArkSegmentGroup.ItemControl className="segment-group-item-control" />
          <ArkSegmentGroup.ItemHiddenInput />
        </ArkSegmentGroup.Item>
      ))}
    </ArkSegmentGroup.Root>
  );
};
