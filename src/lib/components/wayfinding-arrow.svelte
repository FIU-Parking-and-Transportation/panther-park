<script lang="ts">
  import { cn } from "$lib/utils";
  import { ArrowUp } from "@lucide/svelte";

  interface Props {
    degrees: number;
    size?: number;
    class?: string;
  }

  let { degrees, size = 48, class: className }: Props = $props();
</script>

<ArrowUp {size} class={cn(className)} style="width: 1.3em; height: 1.25em; transform: rotate({degrees}deg) translateY(-0.05em)" />
