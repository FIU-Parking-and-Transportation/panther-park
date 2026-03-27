<script lang="ts">
import * as Chart from "$lib/components/ui/chart/index.js";
import { ArcChart, Text } from "layerchart";

type ChartData = { category: string; value: number; maxValue: number };

interface Props {
  chartData: ChartData[];
  class?: string;
}

let { chartData, class: className }: Props = $props();

function getOccupancyColor(val: number, max: number): string {
  const ratio = val / max;
  if (ratio >= 0.9) return "var(--chart-1)";
  if (ratio >= 0.75) return "var(--chart-4)";
  return "var(--primary)";
}

const chartConfig = {
} satisfies Chart.ChartConfig;
</script>

{#snippet chart(d: ChartData)}
  <div class="chart-cell">
    <Chart.Container config={chartConfig} class="h-full w-full">
      <ArcChart
        label="category"
        value="value"
        outerRadius={-8}
        innerRadius={-12}
        padding={25}
        range={[90, -270]}
        maxValue={d.maxValue}
        cornerRadius={20}
        series={[{
          key: d.category,
          color: getOccupancyColor(d.value, d.maxValue),
          data: [d],
        }]}
        props={{
          arc: { track: { fill: "var(--muted)" }, motion: "tween" },
          tooltip: { context: { hideDelay: 350 } },
        }}
        tooltip={false}
      >
        {#snippet aboveMarks()}
          <Text
            value={String(d.value)}
            textAnchor="middle"
            verticalAnchor="middle"
            class="fill-foreground text-4xl! font-bold"
            dy={3}
          />
          <Text
            value={d.category}
            textAnchor="middle"
            verticalAnchor="middle"
            class="fill-muted-foreground!"
            dy={22}
          />
        {/snippet}
      </ArcChart>
    </Chart.Container>
  </div>
{/snippet}

<div class="occupancy-grid {className ?? ''}">
  {#each chartData as data (data.category)}
    {@render chart(data)}
  {/each}
</div>

<style lang="tailwindcss">
  @import "tailwindcss";

  .occupancy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0;
    width: 100%;
  }

  .chart-cell {
    min-height: 220px;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
</style>
