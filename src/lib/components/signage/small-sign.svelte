<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
  import { treaty } from "@elysiajs/eden";
  import type { App } from "elysia-api";
  import type { FacilityOccupancy } from "elysia-api";
  import type { DigitalSign } from "elysia-api";
  import Paw from "$lib/assets/sticker-paw-solid-gold.svelte";
  import type NumberFlowComponent from "@number-flow/svelte";

  let NumberFlow: typeof NumberFlowComponent | null = $state(null);
  import Ticker from "$lib/components/ticker.svelte";
  import WayfindingArrow from "../wayfinding-arrow.svelte";

  interface FacilityDisplay {
    name: string;
    count: { name: string; value: number; full: boolean }[];
  }

  interface Props {
    signId: string;
  }

  let { signId }: Props = $props();

  let rawData = $state<FacilityOccupancy[] | null>(null);
  let fetchError = $state(false);
  let initialized = $state(false);
  let facilitiesProp = $state<string[]>([]);
  let overflowFacilitiesProp = $state<string[]>([]);
  let taglineMessage = $state("Please link your plate!");
  let splashMessage = $state("");
  let enableWayfinding = $state(false);
  let signLatitude = $state(0);
  let signLongitude = $state(0);
  let signCompassHeading = $state<number | null>(null);
  let facilityLocations = new SvelteMap<string, { latitude: number; longitude: number }>();

  const decisionCategories = ["student", "total"];

  function isFull(f: FacilityOccupancy): boolean {
    return Object.entries(f.current_occupancy).some(
      ([key, current]) => (f.max_occupancy[key] ?? 0) > 0 && current >= (f.max_occupancy[key] ?? 0) && decisionCategories.includes(key)
    );
  }

  const categoryOrder: string[] = ["student", "other", "total"];

  function toDisplay(f: FacilityOccupancy): FacilityDisplay {
    const counts = Object.entries(f.current_occupancy).map(([key, current]) => {
      const max = f.max_occupancy[key] ?? 0;
      return { name: key, value: Math.max(max - Math.max(current, 0), 0), full: max > 0 && current >= max };
    });
    counts.sort((a, b) => {
      const ai = categoryOrder.indexOf(a.name);
      const bi = categoryOrder.indexOf(b.name);
      const aOrder = ai === -1 ? categoryOrder.length : ai;
      const bOrder = bi === -1 ? categoryOrder.length : bi;
      return aOrder - bOrder;
    });
    return { name: f.name, count: counts };
  }

  function resolve(name: string): FacilityOccupancy | undefined {
    return (rawData ?? []).find((r) => r.name === name);
  }

  function computeBearing(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;
    const dLon = ((toLon - fromLon) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.round(((Math.atan2(y, x) * (180 / Math.PI) + 360) % 360) / 45) * 45) % 360;
  }

  let facilities = $derived.by<FacilityDisplay[]>(() => {
    const primary = facilitiesProp.flatMap((name) => {
      const f = resolve(name);
      return f ? [toDisplay(f)] : [];
    });

    if (!primary.some((_, i) => isFull(resolve(facilitiesProp[i])!))) return primary;

    // Prefer the first non-full overflow not already in the primary list;
    // fall back to the first available overflow if all are full.
    const primarySet = new Set(facilitiesProp);
    const candidates = overflowFacilitiesProp
      .filter((name) => !primarySet.has(name))
      .flatMap((name) => { const f = resolve(name); return f ? [f] : []; });

    const overflow = candidates.find((f) => !isFull(f)) ?? candidates[0];
    return overflow ? [...primary, toDisplay(overflow)] : primary;
  });

  onMount(() => {
    import("@number-flow/svelte").then((mod) => { NumberFlow = mod.default; });

    const api = treaty<App>(window.location.origin);

    async function fetchOccupancy() {
      const { data, error } = await api.api.v1.facilities.occupancy.get();
      if (error) throw Error;
      return data;
    }

    async function fetchSign() {
      const { data, error } = await api.api.v1["digital-signs"]({ id: signId }).get();
      if (error) throw Error;
      return data as DigitalSign;
    }

    async function fetchFacilities() {
      const { data, error } = await api.api.v1.facilities.get();
      if (error) throw Error;
      return data;
    }

    function applySignData(signData: DigitalSign): void {
      const rawFacilities = signData.attributes["facilities"];
      if (Array.isArray(rawFacilities) && rawFacilities.every((item) => typeof item === "string")) {
        facilitiesProp = rawFacilities as string[];
      }
      const rawOverflow = signData.attributes["overflow_facilities"];
      if (Array.isArray(rawOverflow) && rawOverflow.every((item) => typeof item === "string")) {
        overflowFacilitiesProp = rawOverflow as string[];
      }
      const rawTagline = signData.attributes["tagline_message"];
      taglineMessage = (typeof rawTagline === "string" && rawTagline !== "") ? rawTagline : "Please link your plate!";
      const rawSplash = signData.attributes["splash_message"];
      splashMessage = typeof rawSplash === "string" ? rawSplash : "";
      enableWayfinding = signData.attributes["enable_wayfinding"] === true;
      signLatitude = signData.latitude;
      signLongitude = signData.longitude;
      signCompassHeading = signData.compass_heading;
    }

    async function fetchAll(): Promise<void> {
      try {
        const [occupancyData, signData, facilitiesData] = await Promise.all([fetchOccupancy(), fetchSign(), fetchFacilities()]);
        rawData = occupancyData;
        applySignData(signData);
        facilityLocations.clear();
        for (const f of facilitiesData) {
          facilityLocations.set(f.name, { latitude: f.latitude, longitude: f.longitude });
        }
        initialized = true;
        fetchError = false;
      } catch {
        fetchError = true;
      }
    }

    fetchAll();

    const interval = setInterval(async () => {
      try {
        const [occupancyData, signData] = await Promise.all([fetchOccupancy(), fetchSign()]);
        rawData = occupancyData;
        applySignData(signData);
        fetchError = false;
      } catch {
        fetchError = true;
      }
    }, 3000);
    return () => clearInterval(interval);
  });
</script>

{#if splashMessage}
  <main>
    {@html splashMessage}
  </main>
{:else if fetchError && !initialized}
  <main>
    {@html `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:2px solid #D1A644;box-sizing:border-box;"><p style="color:white;font-size:14vmin;font-weight:bold;text-transform:uppercase;margin:0;line-height:1.4;text-align:center;max-width:80%;">We &#x2764;&#xFE0F; Our Panthers<br>Please Drive Carefully</p></div>`}
  </main>
{:else}
  <main>
    <div id="occupancy" style:--count={facilities.length}>
      {#each facilities as facility (facility.name)}
        <div class="facility">
          <div class="facility-name">
            {#if enableWayfinding && signCompassHeading !== null}
              {@const loc = facilityLocations.get(facility.name)}
              {#if loc}
                {@const bearing = (computeBearing(signLatitude, signLongitude, loc.latitude, loc.longitude) - signCompassHeading + 360) % 360}
                {#if bearing >= 180}
                  <WayfindingArrow degrees={bearing} />
                {/if}
                {facility.name}
                {#if bearing < 180}
                  <WayfindingArrow degrees={bearing} />
                {/if}
              {:else}
                {facility.name}
              {/if}
            {:else}
              {facility.name}
            {/if}
          </div>
          <div class="facility-counts" style="--count-items: {facility.count.length}; flex-direction: {facility.count.length > 1 && facilities.length == 1 ? 'row' : 'column'};">
            {#each facility.count as count (count.name)}
              <div class="facility-count">
                {#if facility.count.length != 1}
                  <div class="facility-count-name text">{count.name}</div>
                {:else}
                  {#if facilities.length == 1}
                    <div class="facility-count-name text">Available Spaces</div>
                  {:else}
                    <div class="facility-count-name text">Available<br>Spaces</div>
                  {/if}
                {/if}
                <div class="facility-count-value text">
                  {#if count.full || count.value < 10}
                    Full
                  {:else if NumberFlow}
                    <NumberFlow value={count.value} format={{ useGrouping: false }} />
                  {:else}
                    {count.value}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <div id="tagline">
      <Paw />
      <Ticker text={taglineMessage} />
    </div>
  </main>
{/if}

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
  #tagline {
    display: flex;
    font-size: 9cqmin;
    height: 12vh;
    font-stretch: condensed;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }
  @container occupancy style(--count: 1) {
    .facility-name {
      font-size: 33cqb;
      line-height: 1.1em;
    }
    @container counts style(--count-items: 1) {
      .facility-count-name { font-size: 15cqb; }
      .facility-count-value { font-size: 26cqb; }
    }
    @container counts style(--count-items: 2) {
      .facility-count-name { font-size: 16cqb; }
      .facility-count-value { font-size: 20cqb; }
    }
  }
  @container occupancy style(--count: 2) {
    .facility-name {
      font-size: 20cqb;
      line-height: 1.3em;
    }
    @container counts style(--count-items: 1) {
      .facility-count-name { font-size: 13cqb; }
      .facility-count-value { font-size: 21cqb; }
    }
    @container counts style(--count-items: 2) {
      .facility-count-name { font-size: 11cqb; }
      .facility-count-value { font-size: 13cqb; }
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
