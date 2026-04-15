<script lang="ts">
  import { page } from "$app/state";
  import { treaty } from "@elysiajs/eden";
  import type { App } from "elysia-api";
  import type { DigitalSign } from "elysia-api";
  import SmallSign from "$lib/components/signage/small-sign.svelte";
  import { onMount } from "svelte";

  const api = treaty<App>(page.url.origin);

  const slug: string = page.params.slug ?? "";

  let facilities = $state<string[]>([]);

  onMount(async () => {
    const { data, error } = await api.api.v1["digital-signs"]({ id: slug }).get();
    if (!error && data) {
      const sign = data as DigitalSign;
      const raw = sign.attributes["facilities"];
      if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
        facilities = raw as string[];
      }
    }
  })
</script>

<SmallSign facilitiesProp={facilities} />
