<script lang="ts">
  import { cn } from "$lib/utils";
  import { MousePointer2 } from "@lucide/svelte";

  interface Props {
    degrees: number;
    size?: number;
    class?: string;
  }

  let { degrees, size = 48, class: className }: Props = $props();
</script>

<MousePointer2 {size} class={cn(className)} style="width: 1em; height: 1em; transform: rotate({degrees + 45}deg)" />
