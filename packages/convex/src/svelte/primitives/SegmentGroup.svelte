<script lang="ts">
  import { SegmentGroup as ArkSegmentGroup } from "@ark-ui/svelte/segment-group";

  export type SegmentGroupItem = {
    label: string;
    value: string;
    disabled?: boolean;
  };

  interface Props {
    items?: SegmentGroupItem[];
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
  <ArkSegmentGroup.Root
    {value}
    {defaultValue}
    {disabled}
    class={`segment-group ${className}`}
    onValueChange={(details: { value: string }) => onValueChange?.(details.value)}
  >
    <ArkSegmentGroup.Indicator class="segment-group-indicator" />
    {#each items as item (item.value)}
      <ArkSegmentGroup.Item
        value={item.value}
        disabled={item.disabled}
        class="segment-group-item"
      >
        <ArkSegmentGroup.ItemText class="segment-group-item-text label-m">
          {item.label}
        </ArkSegmentGroup.ItemText>
        <ArkSegmentGroup.ItemControl class="segment-group-item-control" />
        <ArkSegmentGroup.ItemHiddenInput />
      </ArkSegmentGroup.Item>
    {/each}
  </ArkSegmentGroup.Root>
{/if}
