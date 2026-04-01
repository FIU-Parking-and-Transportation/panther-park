<script lang="ts">
import { insertGarages } from "./data.remote";
let insertStatus: boolean | null = null;
let coord = "";
function findClosestFacility(){
  // TODO: Implement this
}
</script>

<div class="h-screen flex flex-col items-center justify-center">
  <button on:click={async () => {insertGarages().then((status) => {insertStatus = status}).catch(() => {insertStatus = false})}} class="">Insert Garages</button>
  {#if insertStatus === true}
    <p>Garages inserted successfully!</p>
  {:else if insertStatus === false}
    <p class="text-red-500">Garage insertion failed!</p>
  {:else}
    <p></p>
  {/if}
  <div class="flex flex-row">
    <input bind:value={coord}/>
    <button on:click={findClosestFacility}>Find closest parking facility</button>
  </div>
</div>

<style lang="tailwindcss">
@import "tailwindcss";

input {
  @apply m-6 px-4 py-2 bg-gray-200 rounded;
}

button {
  @apply m-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700;
}
</style>
