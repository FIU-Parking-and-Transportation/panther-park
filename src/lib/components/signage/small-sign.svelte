<script lang="ts">
  import { onMount } from "svelte";
  import { treaty } from "@elysiajs/eden";
  import type { App } from "elysia-api";
  import type { FacilityOccupancy } from "elysia-api";
  import paw from "$lib/assets/sticker-paw-solid-gold.svg";

  interface FacilityDisplay {
    name: string;
    count: { name: string; value: number }[];
  }

  interface Props {
    garages: string[];
  }

  let { garages }: Props = $props();

  let rawData = $state<FacilityOccupancy[] | null>(null);

  let facilities = $derived<FacilityDisplay[]>(
    (rawData ?? [])
      .filter((f) => garages.includes(f.name.split(":")[0] || f.name.split(" ")[0]))
      .map((f) => ({
        name: f.name.split(":")[0] ?? f.name.split(" ")[0],
        count: Object.entries(f.occupancy)
          .filter(([key, value]) => !(value <= 0 && (f.max_occupancy[key] ?? 0) <= 0))
          .map(([key, value]) => ({ name: key, value })),
      })),
  );

  onMount(() => {
    const api = treaty<App>(window.location.origin);

    async function fetchOccupancy() {
      const { data, error } = await api.api.v1.facilities.occupancy.get();
      if (error) throw Error;
      return data;
    }

    fetchOccupancy().then((d) => { rawData = d; });

    const interval = setInterval(async () => {
      rawData = await fetchOccupancy();
    }, 3000);
    return () => clearInterval(interval);
  });
</script>

<main>
  <div id="occupancy" style:--count={facilities.length}>
      {#each facilities as facility (facility.name)}
        <div class="facility">
          <div class="facility-name">{facility.name}</div>
          <div class="facility-counts" style="flex-direction: {facility.count.length > 1 && facilities.length == 1 ? "row" : "column"};">
            {#each facility.count as count (count.name)}
              <div class="facility-count">
                <div class="facility-count-name text">{facility.count.length != 1 ? count.name : "Available Spaces"}</div>
                <div class="facility-count-value text">{count.value}</div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
  </div>
  <div id="underline">
    <img class="paw"  src={paw} alt="panther paw icon" />
    Please link your plate!
  </div>
</main>

<style>
  :global(html, body) {
    overflow: hidden;
    background-color: #081e3f;
    color: white;
  }
  main {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
  }
  #occupancy {
    display: flex;
    width: 100%;
    flex-grow: 1;
    container-type: size;
    container-name: occupancy;
  }
  .facility {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1cqb solid #b6862c;
  }
  .facility-name {
    flex-grow: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    border-bottom: 1cqmin solid #b6862c;
    font-weight: bold;
    white-space: nowrap;
  }
  .facility-counts {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
  }
  .facility-count {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    height: 100%;
  }
  .facility-count-value {
    color: #ffcc00;
  }
  .text {
    display: flex;
    flex: 1;
    font-weight: bold;
    height: 100%;
    align-items: center;
    justify-content: center;
    text-align: center;
    text-transform: capitalize;
    width: 100%;
  }
  #underline {
    display: flex;
    font-size: 9cqmin;
    height: 12vh;
    font-stretch: condensed;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }
  .paw {
    position: relative;
    height: 1em;
    width: 1em;
    bottom: 0.1em;
  }
  @container occupancy style(--count: 1) {
    .facility-name {
      font-size: 19cqb;
    }
    .facility-count-name {
      font-size: 15cqb;
    }
    .facility-count-value {
      font-size: 29cqb;
    }
  }
  @container occupancy style(--count: 2) {
    .facility-name {
      font-size: 17cqb;
    }
    .facility-count-name {
      font-size: 10cqb;
    }
    .facility-count-value {
      font-size: 14cqb;
    }
  }
  @container occupancy style(--count: 3) {
    .facility-name {
      font-size: 13cqb;
    }
    .facility-count-name {
      font-size: 9cqb;
    }
    .facility-count-value {
      font-size: 15cqb;
    }
  }
</style>
