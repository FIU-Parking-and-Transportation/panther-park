<script lang="ts">
import { getFacilityOccupancy, type FacilityOccupancy } from '$lib/facilities/data.remote';

const facilities = $state(await getFacilityOccupancy());
function calcPercentage(facility: FacilityOccupancy, type: "student" | "other"): number {
  const curr = facility.current_occupancy[type];
  const max = facility.max_occupancy[type];
  if (curr <= 0){
    return 0;
  }
  const perc = Math.ceil(curr/max)
  return perc > 100 ? 100 : perc
}
function getBarColor(percentage: number): string {
  if (percentage < 70) {
    return '#22C55E';
  } else if (percentage < 90) {
    return '#EAB308';
  } else {
    return '#EF4444';
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
      <span class="percent-label">{student}%</span>
    </div>
  </div>
  <div class="count cell">
    <div class="progress-bar">
      <div class="progress-fill" style:width={other}% style:background-color={getBarColor(other)}></div>
      <span class="percent-label">{other}%</span>
    </div>
  </div>
{/snippet}

<main>
  <div class="grid h-screen" style="grid-template-columns: 2fr 1fr 1fr;" >
    {@render header()}
    {#each facilities as facility}
      {#if facility.name.includes("PG")}
        {@render countRow(facility.name, calcPercentage(facility, "student"), calcPercentage(facility, "other"))}
      {/if}
    {/each}
  </div>
</main>

<style>
main {
  background-color: #081E3F;
  overflow: hidden;
  font-size: 6cqb;
  font-family: 'Montserrat Variable', sans-serif;
  padding: 0px 5px 5px 5px;
}
.cell{
  align-items: center;
  font-weight: bold;
  font-stretch: condensed;
  color: white;
  display: flex;
}
.header{
  justify-content: center;
  font-size: 8cqb;
  border-bottom: 3px solid #EAB308;
}
.count-name {
  justify-content: left;
  white-space: nowrap;
  padding-right: 5px;
}
.progress-bar {
  width: 35cqb;
  height: 10cqb;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2cqb;
  position: relative;
}
.progress-fill {
  height: 100%;
  border-radius: 2cqb;
  position: absolute;
  left: 0;
  top: 0;
}
.percent-label {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  color: white;
  font-size: 0.75rem;
  z-index: 1;
}
</style>
