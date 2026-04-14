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
    facilitiesProp: string[];
    underlineMessage?: string;
  }

  let { facilitiesProp, underlineMessage = "Please link your plate!" }: Props = $props();

  let rawData = $state<FacilityOccupancy[] | null>(null);

  let facilities = $derived<FacilityDisplay[]>(
    facilitiesProp.flatMap((name) => {
      const f = (rawData ?? []).find((r) => r.name === name);
      if (!f) return [];
      return [{
        name: f.name,
        count: Object.entries(f.current_occupancy)
        .map(([key, value]) => ({ name: key, value: Math.max((f.max_occupancy[key] ?? 0) - Math.max(value, 0), 0) })),
      }];
    }),
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
          <div class="facility-counts" style="--count-items: {facility.count.length}; flex-direction: {facility.count.length > 1 && facilities.length == 1 ? 'row' : 'column'};">
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
    <img id="underline-paw" src={paw} alt="panther paw icon" />
    <div id="underline-message">{underlineMessage}</div>
  </div>
</main>

<style>
  :global(html, body) {
    overflow: hidden;
    background-color: #081e3f;
    color: white;
    font-family: 'Montserrat Variable', sans-serif;
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
    container-type: style;
    container-name: counts;
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
  #underline-paw {
    flex-grow: 0;
    position: relative;
    height: 1em;
    width: 1em;
    left: 0.1em;
    align-items: center;
    justify-content: center;
  }
  #underline-message {
    flex-grow: 1;
    text-align: center;
  }
  @container occupancy style(--count: 1) {
    .facility-name {
      font-size: 30cqb;
      line-height: 1.1em;
    }
    @container counts style(--count-items: 1) {
      .facility-count-name { font-size: 15cqb; }
      .facility-count-value { font-size: 29cqb; }
    }
    @container counts style(--count-items: 2) {
      .facility-count-name { font-size: 16cqb; }
      .facility-count-value { font-size: 28cqb; }
    }
  }
  @container occupancy style(--count: 2) {
    .facility-name {
      font-size: 20cqb;
      line-height: 1.3em;
    }
    @container counts style(--count-items: 1) {
      .facility-count-name { font-size: 12cqb; }
      .facility-count-value { font-size: 19cqb; }
    }
    @container counts style(--count-items: 2) {
      .facility-count-name { font-size: 10cqb; }
      .facility-count-value { font-size: 14cqb; }
    }
  }
  @container occupancy style(--count: 3) {
    .facility-name {
      font-size: 17cqb;
    }
    @container counts style(--count-items: 1) {
      .facility-count-name { font-size: 9cqb; }
      .facility-count-value { font-size: 15cqb; }
    }
    @container counts style(--count-items: 2) {
      .facility-count-name { font-size: 10cqb; }
      .facility-count-value { font-size: 13cqb; }
    }
  }
</style>
