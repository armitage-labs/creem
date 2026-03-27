<script lang="ts">
  import SegmentGroup from "./SegmentGroup.svelte";

  export type SegmentControlItem = {
    label: string;
    value: string;
    disabled?: boolean;
  };

  interface Props {
    items?: SegmentControlItem[];
    value?: string | null;
    defaultValue?: string;
    disabled?: boolean;
    className?: string;
    onValueChange?: (value: string) => void;
  }

  let {
    items = [],
    value = undefined,
    defaultValue = undefined,
    disabled = false,
    className = "",
    onValueChange,
  }: Props = $props();
</script>

{#if items.length > 1}
  <SegmentGroup
    {items}
    {value}
    {defaultValue}
    {disabled}
    {onValueChange}
    className={className}
  />
{/if}
