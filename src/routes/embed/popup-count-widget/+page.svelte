<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { treaty } from "@elysiajs/eden";
  import type { App } from "elysia-api";
  import type { FacilityOccupancy } from "elysia-api";

  // Parse requested facility names from query string: ?facilities=PG1,PG2,PG3
  const requestedNames: string[] = (page.url.searchParams.get("facilities") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let allFacilities = $state<FacilityOccupancy[] | null>(null);

  interface AvailableCount {
    label: string;
    value: number;
  }

  interface FacilityCard {
    name: string;
    fullName: string;
    counts: AvailableCount[] | null; // null = facility not found in data yet
  }

  const cards = $derived<FacilityCard[]>(
    requestedNames.map((name) => {
      const match = allFacilities?.find((f) => f.name === name) ?? null;
      if (!match) {
        return { name, fullName: name, counts: null };
      }
      const keys = Object.keys(match.max_occupancy);
      const hasStudentOther =
        keys.includes("student") && keys.includes("other");
      if (hasStudentOther) {
        return {
          name: match.name,
          fullName: match.full_name,
          counts: [
            {
              label: "Student",
              value: Math.max(
                (match.max_occupancy["student"] ?? 0) -
                  Math.max(match.current_occupancy["student"] ?? 0, 0),
                0,
              ),
            },
            {
              label: "Other",
              value: Math.max(
                (match.max_occupancy["other"] ?? 0) -
                  Math.max(match.current_occupancy["other"] ?? 0, 0),
                0,
              ),
            },
          ],
        };
      }
      // Single-count facility (e.g. { total: n })
      const maxTotal = Object.values(match.max_occupancy).reduce(
        (a, b) => a + b,
        0,
      );
      const currTotal = Object.values(match.current_occupancy).reduce(
        (a, b) => a + b,
        0,
      );
      return {
        name: match.name,
        fullName: match.full_name,
        counts: [
          { label: "Total", value: Math.max(maxTotal - currTotal, 0) },
        ],
      };
    })
  );

  onMount(() => {
    const api = treaty<App>(window.location.origin);

    async function fetchOccupancy(): Promise<FacilityOccupancy[] | null> {
      const { data, error } = await api.api.v1.facilities.occupancy.get();
      if (error) return null;
      return data as FacilityOccupancy[];
    }

    fetchOccupancy().then((d) => {
      allFacilities = d;
    });

    const interval = setInterval(async () => {
      const d = await fetchOccupancy();
      if (d !== null) allFacilities = d;
    }, 3000);

    return () => clearInterval(interval);
  });
</script>

<div class="widget">
  {#if allFacilities === null}
    <div class="loading">
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
      <span class="loading-dot"></span>
    </div>
  {:else}
    <div class="cards">
      {#each cards as card (card.name)}
        <div class="card">
          <div class="card-name">Spaces Available</div>
          {#if card.counts === null}
            <div class="card-count">—</div>
            <div class="card-label">Available Spaces</div>
          {:else if card.counts.length === 1}
            <div class="card-count">{card.counts[0].value}</div>
            <div class="card-label">{card.counts[0].label}</div>
          {:else}
            <div class="card-split">
              {#each card.counts as c (c.label)}
                <div class="card-split-item">
                  <div class="card-count">{c.value}</div>
                  <div class="card-label">{c.label}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .widget {
    font-family: "Montserrat Variable", "Montserrat", sans-serif;
    color: white;
    padding: 12px;
    display: inline-block;
    min-width: 160px;
    width: 100%;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 16px;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #b6862c;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .loading-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 8px;
  }

  .card {
    background-color: #081e3f;
    border: 2px solid #b6862c;
    border-radius: 6px;
    padding: 10px 14px;
    text-align: center;
    min-width: 140px;
  }

  .card-name {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #b6862c;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-count {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
    color: #ffcc00;
    margin-bottom: 4px;
  }

  .card-split {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .card-split-item {
    flex: 1;
  }

  .card-split-item .card-count {
    font-size: 1.5rem;
  }

  .card-label {
    font-size: 0.6rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.65);
  }
</style>
