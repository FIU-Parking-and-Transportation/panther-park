<script lang="ts">
  import { page } from "$app/state";
  import SmallSign from "$lib/components/signage/small-sign.svelte";

  const slug: string = page.params.slug ?? "";
</script>

<SmallSign signId={slug} />
