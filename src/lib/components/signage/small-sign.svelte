<script lang="ts">
  import { onMount } from "svelte";
  import type { FacilityListItem, DigitalSign } from "elysia-api";
  import Paw from "$lib/assets/sticker-paw-solid-gold.svelte";
  import type NumberFlowComponent from "@number-flow/svelte";
  import { fetchFacilities, isFull } from "$lib/facilities.js";
  import { fetchSign } from "$lib/signs.js";

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

  let facilities = $state<FacilityListItem[]>();
  let sign = $state<DigitalSign>();
  let fetchError = $state(false);
  let initialized = $state(false);

  const CATEGORY_ORDER: string[] = ["student", "other", "total"];

  const facilitiesList = $derived((sign?.attributes.facilities as string[]) ?? []);
  const overflowFacilities = $derived((sign?.attributes.overflow_facilities as string[]) ?? []);
  const taglineMessage = $derived((sign?.attributes.tagline_message as string) ?? "");
  const splashMessage = $derived((sign?.attributes.splash_message as string) ?? "");
  const enableWayfinding = $derived(sign?.attributes.enable_wayfinding === true);
  const signLatitude = $derived(sign?.latitude ?? 0);
  const signLongitude = $derived(sign?.longitude ?? 0);
  const signCompassHeading = $derived(sign?.compass_heading ?? null);

  function toDisplay(f: FacilityListItem): FacilityDisplay {
    const counts = Object.entries(f.current_occupancy).map(([key, current]) => {
      const max = f.max_occupancy[key] ?? 0;
      return { name: key, value: Math.max(max - Math.max(current, 0), 0), full: isFull(f) };
    });
    counts.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.name);
      const bi = CATEGORY_ORDER.indexOf(b.name);
      const aOrder = ai === -1 ? CATEGORY_ORDER.length : ai;
      const bOrder = bi === -1 ? CATEGORY_ORDER.length : bi;
      return aOrder - bOrder;
    });
    return { name: f.name, count: counts };
  }

  function resolve(name: string): FacilityListItem | undefined {
    return (facilities ?? []).find((r) => r.name === name);
  }

  function computeBearing(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
    const deg2rad = (deg: number) => (deg * Math.PI) / 180;
    const lat1 = deg2rad(fromLat);
    const lat2 = deg2rad(toLat);
    const dLon = deg2rad(toLon - fromLon);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;
    return Math.round(bearing / 25) * 25 % 360;
  }

  let displayFacilities = $derived.by<FacilityDisplay[]>(() => {
    const primary = facilitiesList.flatMap((name) => {
      const f = resolve(name);
      return f ? [toDisplay(f)] : [];
    });

    if (!primary.some((_, i) => isFull(resolve(facilitiesList[i])!))) return primary;

    // Prefer the first non-full overflow not already in the primary list;
    // fall back to the first available overflow if all are full.
    const primarySet = new Set(facilitiesList);
    const candidates = overflowFacilities
      .filter((name) => !primarySet.has(name))
      .flatMap((name) => { const f = resolve(name); return f ? [f] : []; });

    const overflow = candidates.find((f) => !isFull(f)) ?? candidates[0];
    return overflow ? [...primary, toDisplay(overflow)] : primary;
  });

  onMount(() => {
    import("@number-flow/svelte").then((mod) => { NumberFlow = mod.default; });

    async function fetchAll(): Promise<void> {
      try {
        const [signData, facilityData] = await Promise.all([fetchSign(signId), fetchFacilities()]);
        sign = signData;
        facilities = facilityData;
        initialized = true;
        fetchError = false;
      } catch {
        fetchError = true;
      }
    }

    fetchAll();
    const interval = setInterval(async () => {
      fetchAll();
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
    <div id="occupancy" style:--count={displayFacilities.length}>
      {#each displayFacilities as facility (facility.name)}
        <div class="facility">
          <div class="facility-name">
            {#if enableWayfinding && signCompassHeading !== null}
              {@const loc = resolve(facility.name)}
              {#if loc}
                {@const bearing = (computeBearing(signLatitude, signLongitude, loc.latitude, loc.longitude) - signCompassHeading + 360) % 360}
                <span class="facility-name-arrow facility-name-arrow-{bearing >= 180 ? 'left' : 'right'}">
                  <WayfindingArrow degrees={bearing} />
                </span>
              {/if}
            {/if}
            <span class="facility-name-title">{facility.name}</span>
          </div>
          <div class="facility-counts" style="--count-items: {facility.count.length}; flex-direction: {facility.count.length > 1 && displayFacilities.length == 1 ? 'row' : 'column'};">
            {#each facility.count as count (count.name)}
              <div class="facility-count">
                {#if facility.count.length != 1}
                  <div class="facility-count-name text">{count.name}</div>
                {:else}
                  {#if displayFacilities.length == 1}
                    <div class="facility-count-name text">Available Spaces</div>
                  {:else}
                    <div class="facility-count-name text">Available<br>Spaces</div>
                  {/if}
                {/if}
                <div class="facility-count-value text" class:full={count.full}>
                  {#if count.full}
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
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas: "left title right";
    align-items: center;
    border-bottom: 1cqmin solid #b6862c;
    font-weight: bold;
    white-space: nowrap;
  }
  .facility-name-title {
    grid-area: title;
  }
  .facility-name-arrow-left {
    padding-left: 0.2em;
  }
  .facility-name-arrow-right {
    padding: 0.2em;
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
  .facility-count-value.full {
    font-weight: 900;
    letter-spacing: 0.08rem;
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
      font-size: 17cqb;
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
      font-size: 11cqb;
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
