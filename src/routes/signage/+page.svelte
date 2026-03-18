<script lang="ts">
import { getFacilityOccupancy, type FacilityOccupancy } from '$lib/facilities/data.remote';

const facilities = await getFacilityOccupancy();
console.log(facilities);
function calcPercentage(facility: FacilityOccupancy, type: "student" | "employee"): number {
  const curr = facility.current_occupancy[type];
  const max = facility.max_occupancy[type];
  if (curr <= 0){
    return 0;
  }
  const perc = Math.ceil(curr/max)
  return perc > 100 ? 100 : perc
}
</script>

{#snippet header()}
  <div class="header">
  </div>
  <div class="header">
    Student
  </div>
  <div class="header">
    Other
  </div>
{/snippet}

{#snippet countRow(name: string, student: number, other: number)}
    <div class="name">
      {name}
    </div>
    <div class="student-count">
      {student}
    </div>
    <div class="other-count">
      {other}
    </div>
{/snippet}

<main>
  <div class="grid grid-cols-3">
    {@render header()}
    {#each facilities as facility}
      {#if facility.name.includes("PG")}
        {@render countRow(facility.name, calcPercentage(facility, "student"), calcPercentage(facility, "employee"))}
      {/if}
    {/each}
  </div>
</main>
