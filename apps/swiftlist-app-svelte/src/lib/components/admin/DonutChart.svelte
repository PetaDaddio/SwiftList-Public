<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	let {
		labels = [] as string[],
		values = [] as number[],
		colors = ['#22C55E', '#EF4444', '#F59E0B', '#6366F1'],
		centerText = ''
	}: {
		labels?: string[];
		values?: number[];
		colors?: string[];
		centerText?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'doughnut'> | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{
					data: values,
					backgroundColor: colors,
					borderWidth: 0,
					hoverOffset: 6
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '65%',
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: '#4B5563', padding: 12, usePointStyle: true, font: { size: 11 } }
					}
				}
			}
		});

		return () => {
			chart?.destroy();
			chart = null;
		};
	});

	$effect(() => {
		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = values;
			chart.data.datasets[0].backgroundColor = colors;
			chart.update();
		}
	});
</script>

<div class="relative w-full h-full min-h-[200px]">
	<canvas bind:this={canvas}></canvas>
	{#if centerText}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<span class="text-sm font-semibold text-[#2C3E50] -mt-8">{centerText}</span>
		</div>
	{/if}
</div>
