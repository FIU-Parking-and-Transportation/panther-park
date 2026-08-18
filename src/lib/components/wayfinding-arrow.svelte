<script lang="ts">
  import { cn } from "$lib/utils";
  import { Navigation2 } from "@lucide/svelte";

  interface Props {
    degrees: number;
    size?: number;
    class?: string;
  }

  let { degrees, size = 48, class: className }: Props = $props();
</script>

<Navigation2 {size} class={cn(className)} style="width: 1.0em; height: 0.8em; transform: rotate({degrees}deg);" />
