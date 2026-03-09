<script lang="ts">
	interface DataPoint {
		label: string;
		value: number;
		color?: string;
	}

	interface Props {
		title: string;
		data: DataPoint[];
		unit?: string;
		height?: number;
	}

	let { title, data, unit = '', height = 120 }: Props = $props();

	const maxValue = $derived(Math.max(...data.map(d => d.value), 1));
	const barWidth = $derived(data.length > 0 ? Math.floor(100 / data.length) : 10);
	const gap = 2;
</script>

<div class="rounded-xl p-4">
	<h3 class="text-sm font-semibold text-[#2C3E50] mb-3">{title}</h3>
	<svg viewBox="0 0 {data.length * (barWidth + gap)} {height}" class="w-full" style="height: {height}px;">
		{#each data as point, i}
			{@const barHeight = (point.value / maxValue) * (height - 20)}
			{@const x = i * (barWidth + gap)}
			{@const y = height - 16 - barHeight}
			{@const fill = point.color || '#3B82F6'}

			<!-- Bar -->
			<rect
				{x}
				{y}
				width={barWidth}
				height={Math.max(barHeight, 1)}
				{fill}
				rx="2"
				opacity="0.85"
			/>

			<!-- Value on top -->
			{#if point.value > 0}
				<text
					x={x + barWidth / 2}
					y={y - 3}
					text-anchor="middle"
					fill="#2C3E50"
					font-size="8"
				>
					{point.value >= 1000 ? `${(point.value / 1000).toFixed(1)}k` : point.value.toFixed(unit === '$' ? 2 : 0)}
				</text>
			{/if}

			<!-- Label below -->
			<text
				x={x + barWidth / 2}
				y={height - 3}
				text-anchor="middle"
				fill="#4B5563"
				font-size="7"
			>
				{point.label}
			</text>
		{/each}
	</svg>
	{#if unit}
		<p class="text-[10px] text-[#4B5563] mt-1 text-right">{unit}</p>
	{/if}
</div>
