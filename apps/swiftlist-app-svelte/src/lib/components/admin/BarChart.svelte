<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart, BarController, BarElement,
		LinearScale, CategoryScale, Tooltip, Legend
	} from 'chart.js';

	Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

	let {
		labels = [] as string[],
		values = [] as number[],
		colors = ['#6366F1', '#22C55E'],
		tooltipSuffix = ''
	}: {
		labels?: string[];
		values?: number[];
		colors?: string[];
		tooltipSuffix?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'bar'> | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [{
					data: values,
					backgroundColor: colors,
					borderRadius: 6,
					barThickness: 40
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						ticks: { color: '#4B5563', font: { size: 11 } },
						grid: { display: false }
					},
					y: {
						beginAtZero: true,
						ticks: { color: '#4B5563', stepSize: 1, font: { size: 10 } },
						grid: { color: 'rgba(0, 0, 0, 0.04)' }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.parsed.y} ${tooltipSuffix}`
						}
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
			chart.update();
		}
	});
</script>

<div class="w-full h-full min-h-[180px]">
	<canvas bind:this={canvas}></canvas>
</div>
