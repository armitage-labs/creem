import { SegmentGroup, type SegmentGroupItem } from "./SegmentGroup.js";

export type SegmentControlItem = SegmentGroupItem;

export const SegmentControl = ({
  items = [],
  value,
  defaultValue,
  disabled = false,
  className = "",
  onValueChange,
}: {
  items?: SegmentControlItem[];
  value?: string | null;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}) => {
  if (items.length <= 1) return null;

  return (
    <SegmentGroup
      items={items}
      value={value}
      defaultValue={defaultValue}
      disabled={disabled}
      onValueChange={onValueChange}
      className={className}
    />
  );
};
