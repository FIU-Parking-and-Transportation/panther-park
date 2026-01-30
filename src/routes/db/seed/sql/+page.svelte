<script lang="ts">
import { seedDatabase } from "./data.remote";
let seedStatus: boolean | null = null;
</script>

<div class="h-screen flex flex-col items-center justify-center">
  <button on:click={async () => {seedDatabase().then((status) => {seedStatus = status}).catch(() => {seedStatus = false})}} class="m-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Seed Database</button>
  {#if seedStatus === true}
    <p>Database seeded successfully!</p>
  {:else if seedStatus === false}
    <p class="text-red-500">Database seed failed!</p>
  {:else}
    <p></p>
  {/if}
</div>

