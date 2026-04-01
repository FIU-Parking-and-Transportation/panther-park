<script lang="ts">
  import OccupancyRadial from "$lib/components/occupancy-radial.svelte";

  const chartData = [
    { category: "Student", value: 80, maxValue: 100 },
    { category: "Other", value: 17, maxValue: 50 },
  ];
</script>

<h1 style="text-align: center; font-size: 4cqb; font-weight: bold;">PG5</h1>
<OccupancyRadial {chartData} />
