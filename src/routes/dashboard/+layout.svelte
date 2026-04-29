<script lang="ts">
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { page } from "$app/state";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  const segments: string[] = $derived(
    page.url.pathname
      .split("/")
      .filter((s) => s !== "" && s !== "dashboard")
      .map((s) =>
        s
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
  );
</script>

<Sidebar.Provider>
  <AppSidebar />
  <Sidebar.Inset>
    <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Sidebar.Trigger class="-ms-1" />
      <Separator orientation="vertical" class="me-2 h-4" />
      <Breadcrumb.Root>
        <Breadcrumb.List>
          {#if segments.length === 0}
            <Breadcrumb.Item>
              <Breadcrumb.Page>Panther Park</Breadcrumb.Page>
            </Breadcrumb.Item>
          {:else}
            <Breadcrumb.Item class="hidden md:block">
              <Breadcrumb.Link href="/dashboard">Panther Park</Breadcrumb.Link>
            </Breadcrumb.Item>
            {#each segments as segment, i (i)}
              <Breadcrumb.Separator class="hidden md:block" />
              <Breadcrumb.Item>
                {#if i < segments.length - 1}
                  <Breadcrumb.Link href="#">{segment}</Breadcrumb.Link>
                {:else}
                  <Breadcrumb.Page>{segment}</Breadcrumb.Page>
                {/if}
              </Breadcrumb.Item>
            {/each}
          {/if}
        </Breadcrumb.List>
      </Breadcrumb.Root>
    </header>
    <div class="flex flex-1 flex-col gap-4 p-4">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
