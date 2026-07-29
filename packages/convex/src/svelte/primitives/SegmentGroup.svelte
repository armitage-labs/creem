<!--
  @component
  Segmented control used by the interval and group selectors.

  Exported so a replacement selector can match the built-in styling.
-->
<script lang="ts">
  import {
    SegmentGroup as ArkSegmentGroup,
    type SegmentGroupValueChangeDetails,
  } from "@ark-ui/svelte/segment-group";

  export type SegmentGroupItem = {
    label: string;
    value: string;
    badge?: string;
    disabled?: boolean;
  };

  interface Props {
    items?: SegmentGroupItem[];
    value?: string | null;
    defaultValue?: string;
    disabled?: boolean;
    className?: string;
    unstyled?: boolean;
    onValueChange?: (value: string) => void;
  }

  let {
    items = [],
    value = undefined,
    defaultValue = undefined,
    disabled = false,
    className = "",
    unstyled = false,
    onValueChange,
  }: Props = $props();

  const resolvedValue = $derived(value ?? undefined);
  const controlKey = $derived(
    `${items.map((item) => item.value).join("|")}::${resolvedValue ?? ""}`,
  );
</script>

{#if items.length > 1}
  {#key controlKey}
    <ArkSegmentGroup.Root
      value={resolvedValue}
      {defaultValue}
      {disabled}
      class={unstyled ? className : `creem-base:segment-group ${className}`}
      onValueChange={(details: SegmentGroupValueChangeDetails) => {
        if (details.value != null) onValueChange?.(details.value);
      }}
    >
      <ArkSegmentGroup.Indicator
        class={unstyled ? "" : "creem-base:segment-group-indicator"}
      />
      {#each items as item (item.value)}
        <ArkSegmentGroup.Item
          value={item.value}
          disabled={item.disabled}
          class={unstyled ? "" : "creem-base:segment-group-item"}
        >
          <ArkSegmentGroup.ItemText
            class={unstyled ? "" : "creem-base:segment-group-item-text creem-base:label-m"}
          >
            {item.label}
            {#if item.badge}
              <span
                class={unstyled
                  ? ""
                  : "creem-base:ml-2 creem-base:rounded-full creem-base:bg-blue-950 creem-base:px-2 creem-base:py-0.5 creem-base:text-xs creem-base:font-medium creem-base:text-blue-100 dark:creem-base:bg-blue-900/70 dark:creem-base:text-blue-100"}
              >
                {item.badge}
              </span>
            {/if}
          </ArkSegmentGroup.ItemText>
          <ArkSegmentGroup.ItemControl
            class={unstyled ? "" : "creem-base:segment-group-item-control"}
          />
          <ArkSegmentGroup.ItemHiddenInput />
        </ArkSegmentGroup.Item>
      {/each}
    </ArkSegmentGroup.Root>
  {/key}
{/if}
