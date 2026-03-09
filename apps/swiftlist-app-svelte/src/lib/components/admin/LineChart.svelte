<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart, LineController, LineElement, PointElement,
		LinearScale, CategoryScale, Tooltip, Legend, Filler
	} from 'chart.js';

	Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

	interface DatasetConfig {
		label: string;
		data: number[];
		color: string;
		fill?: boolean;
	}

	let {
		labels = [] as string[],
		datasets = [] as DatasetConfig[],
		title = ''
	}: {
		labels?: string[];
		datasets?: DatasetConfig[];
		title?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart<'line'> | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: datasets.map(ds => ({
					label: ds.label,
					data: ds.data,
					borderColor: ds.color,
					backgroundColor: ds.fill ? `${ds.color}1A` : 'transparent',
					fill: ds.fill ?? false,
					tension: 0.3,
					pointRadius: ds.fill ? 2 : 0,
					borderWidth: ds.fill ? 2 : 1.5
				}))
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				scales: {
					x: {
						ticks: { color: '#4B5563', maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } },
						grid: { color: 'rgba(0, 0, 0, 0.04)' }
					},
					y: {
						beginAtZero: true,
						ticks: { color: '#4B5563', stepSize: 1, font: { size: 10 } },
						grid: { color: 'rgba(0, 0, 0, 0.04)' }
					}
				},
				plugins: {
					legend: {
						labels: { color: '#4B5563', usePointStyle: true, padding: 12, font: { size: 11 } }
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
			datasets.forEach((ds, i) => {
				if (chart!.data.datasets[i]) {
					chart!.data.datasets[i].data = ds.data;
				}
			});
			chart.update();
		}
	});
</script>

<div class="w-full h-full min-h-[200px]">
	{#if title}
		<p class="text-xs font-semibold text-[#2C3E50] mb-2">{title}</p>
	{/if}
	<canvas bind:this={canvas}></canvas>
</div>
