<script lang="ts">
import { onMount } from "svelte";
import { treaty } from "@elysiajs/eden";
import type { App } from "elysia-api";
import type { FacilityListItem } from "elysia-api";

let facilities = $state<FacilityListItem[] | null>(null);

onMount(() => {
  const api = treaty<App>(window.location.origin);

  async function fetchFacilities() {
    const { data, error } = await api.api.v1.facilities.get();
    if (error) throw Error;
    return data as FacilityListItem[];
  }

  fetchFacilities().then((d) => { facilities = d; });

  const interval = setInterval(async () => {
    facilities = await fetchFacilities();
  }, 3000);
  return () => clearInterval(interval);
});

function calcPercentage(facility: FacilityListItem, type: "student" | "other"): number {
  const curr = facility.current_occupancy[type];
  const max = facility.max_occupancy[type];
  if (curr <= 0 || max <= 0) {
    return 0;
  }
  const percentage = Math.ceil((curr / max) * 100);
  return Math.min(percentage, 100);
}

function getBarColor(percentage: number): string {
  if (percentage < 70) {
    return "#22C55E";
  } else if (percentage < 90) {
    return "#D1A644";
  } else {
    return "#EF4444";
  }
}
</script>

{#snippet header()}
  <div class="header cell">
    Garages
  </div>
  <div class="header cell">
    Student
  </div>
  <div class="header cell">
    Other
  </div>
{/snippet}

{#snippet countRow(name: string, student: number, other: number)}
  <div class="count-name cell">
    {name}
  </div>
  <div class="count cell">
    <div class="progress-bar">
      <div class="progress-fill" style:width={student}% style:background-color={getBarColor(student)}></div>
      <span class="percent-label">{student >= 100 ? "Full" : student + "%"}</span>
    </div>
  </div>
  <div class="count cell">
    <div class="progress-bar">
      <div class="progress-fill" style:width={other}% style:background-color={getBarColor(other)}></div>
      <span class="percent-label">{other >= 100 ? "Full" : other + "%"}</span>
    </div>
  </div>
{/snippet}

<main>
  <div class="grid h-screen" style="grid-template-columns: 2fr 1fr 1fr;">
    {@render header()}
    {#each facilities ?? [] as facility (facility.name)}
      {#if facility.name.includes("PG")}
        {@render countRow(facility.full_name, calcPercentage(facility, "student"), calcPercentage(facility, "other"))}
      {/if}
    {/each}
  </div>
</main>

<style>
:global(body), :global(html) {
  overflow: hidden;
}
main {
  background-color: #081E3F;
  font-size: 6cqb;
  font-family: "Montserrat Variable", sans-serif;
  padding: 0px 5px 5px 5px;
}
.cell {
  align-items: center;
  font-weight: bold;
  font-stretch: condensed;
  color: white;
  display: flex;
}
.header {
  justify-content: center;
  font-size: 8cqb;
  border-bottom: 3px solid #EAB308;
}
.count-name {
  justify-content: left;
  white-space: nowrap;
  padding-right: 5px;
}
.count {
  justify-content: center;
}
.progress-bar {
  width: 95%;
  height: 10cqb;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 2cqb;
  position: relative;
}
.progress-fill {
  height: 100%;
  border-radius: 2cqb;
}
.percent-label {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-45%);
  text-align: center;
  color: white;
  font-size: 9.5cqb;
  z-index: 1;
}
</style>
