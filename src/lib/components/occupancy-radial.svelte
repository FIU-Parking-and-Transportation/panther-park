<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import * as Chart from "$lib/components/ui/chart/index.js";
import { ArcChart, Text } from "layerchart";

type ChartData = { category: string, value: number, maxValue: number};

interface Props {
  chartData: ChartData[];
}

let { chartData }: Props = $props();

function getOccupancyColor(val: number, max: number): string {
  const ratio = val / max;
  if (ratio >= 0.8) return "var(--chart-1)";
  if (ratio >= 0.4) return "var(--chart-4)";
  return "var(--primary)";
}

const chartConfig = {
} satisfies Chart.ChartConfig;
</script>

{#snippet chart(d: ChartData)}
    <ArcChart
      label="category"
      value="value"
      outerRadius={-20}
      innerRadius={-12}
      padding={40}
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
      {#snippet belowMarks()}
        <circle cx="0" cy="0" r="60" class="fill-background" />
      {/snippet}

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
{/snippet}


<Chart.Container config={chartConfig} class="">
  {#each chartData as data}
    {@render chart(data)}
  {/each}
</Chart.Container>

