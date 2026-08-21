<script lang="ts">
  import { onMount } from "svelte";
  import { treaty } from "@elysiajs/eden";
  import type { App } from "elysia-api";
  import type { DigitalSign } from "elysia-api";

  interface SignTile {
    id: string;
    name: string;
    href: string;
    width: number;
    height: number;
  }

  interface TileSpec {
    href: string;
    width: number;
    height: number;
  }

  const RESOLUTIONS: Record<string, TileSpec> = {
    "107th Ave": { href: "/signage/large", width: 270, height: 180 },
    "108th Ave": { href: "/signage/small/", width: 180, height: 135 },
    "109th Ave": { href: "/signage/small/", width: 180, height: 135 },
    "112th Ave": { href: "/signage/small/", width: 180, height: 135 },
    "16th St": { href: "/signage/small/", width: 180, height: 135 },
    "16th St Presidents House": { href: "/signage/small/", width: 180, height: 135 },
    "Lot 1 Traffic": { href: "/signage/small/", width: 180, height: 90 },
    "PG3 Wall": { href: "/signage/small/", width: 180, height: 90 },
    "PG5 Wall": { href: "/signage/small/", width: 180, height: 90 },
    "PG6 East": { href: "/signage/small/", width: 180, height: 135 },
    "PG6 West": { href: "/signage/small/", width: 180, height: 135 },
  };

  const DEFAULT_TILE: TileSpec = {
    href: "/signage/small/",
    width: 135,
    height: 90,
  };

  function tileFor(name: string): TileSpec {
    return RESOLUTIONS[name] ?? DEFAULT_TILE;
  }

  let signs = $state<SignTile[] | null>(null);

  onMount(() => {
    const api = treaty<App>(window.location.origin);

    api.api.v1["digital-signs"].get()
      .then(({ data }) => {
        signs = (data as DigitalSign[]).map((s) => {
          const spec = tileFor(s.name);
          const href = spec.href === "/signage/large" ? spec.href : `${spec.href}${s.id}`;
          return {
            id: s.id,
            name: s.name,
            href: href,
            width: spec.width,
            height: spec.height,
          };
        });
      })
      .catch(() => {
        signs = [];
      });
  });
</script>

<main>
  <h1>Digital Signs</h1>
  {#if signs === null}
    <p class="loading">Loading signs…</p>
  {:else}
    <div class="grid">
      {#each signs as sign (sign.id)}
        <a class="tile" href={sign.href} style:width={sign.width}px>
          <iframe
            title={sign.name}
            src={sign.href}
            style:width={sign.width}px
            style:height={sign.height}px
            loading="eager"
            scrolling="no"
          ></iframe>
          <span class="label">{sign.name}</span>
        </a>
      {/each}
    </div>
  {/if}
</main>

<style>
  main {
    min-height: 100vh;
    background-color: #081e3f;
    color: white;
    font-family: "Montserrat Variable", "Montserrat", sans-serif;
    padding: 1rem;
    box-sizing: border-box;
  }
  h1 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .loading {
    color: rgba(255, 255, 255, 0.65);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    text-decoration: none;
  }
  .label {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #ffcc00;
  }
</style>
