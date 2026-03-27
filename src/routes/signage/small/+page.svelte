<script>
  import paw from '$lib/assets/sticker-paw-solid-gold.svg';
  let facilities = [
    { name: "PG5", count: [{"name": "student", value: 89}, {"name": "other", value: 90}]},
    { name: "Lot 13", count: [{"name": "total", value: 12}]},
  ];
  let facilityWidth = $state();
  let facilityHeight= $state();
  $inspect(facilityWidth);
</script>

<main>
  <div id="occupancy">
    {#each facilities as facility}
      <div class="facility">
        <div style:font-size="13cqmin" bind:clientWidth={facilityWidth} bind:clientHeight={facilityHeight} class="facility-name">{facility.name}</div>
      {#each facility.count as count}
        <div style:font-size="{facilityWidth/7}px" class="facility-count-name text">{facility.count.length != 1 ? count.name : "Available Spaces"}</div>
        <div style:font-size="{facilityWidth/6}px" class="facility-count-value text">{count.value}</div>
      {/each}
      </div>
    {/each}
  </div>
  <div id="underline">
    <img class="paw" src={paw} alt="panther paw icon"/>
    Lorem ipsum dolor sit amet consectetur. 
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
}
.facility-count-value {
  color: #FFCC00
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
  font-size: 7cqmin;
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
</style>
