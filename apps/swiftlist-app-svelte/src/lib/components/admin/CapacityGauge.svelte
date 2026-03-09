<script lang="ts">
	interface Props {
		label: string;
		current: number;
		limit: number;
		unit?: string;
		decimals?: number;
		circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
	}

	let { label, current, limit, unit = '', decimals = 0, circuitState }: Props = $props();

	const percentage = $derived(limit > 0 ? Math.min((current / limit) * 100, 120) : 0);
	const displayPercentage = $derived(Math.min(percentage, 100));

	const color = $derived(
		circuitState === 'OPEN' ? '#EF4444' :
		circuitState === 'HALF_OPEN' ? '#F59E0B' :
		percentage >= 85 ? '#EF4444' :
		percentage >= 60 ? '#F59E0B' :
		'#22C55E'
	);

	const zoneName = $derived(
		circuitState === 'OPEN' ? 'Circuit Open' :
		circuitState === 'HALF_OPEN' ? 'Testing' :
		percentage >= 85 ? 'Critical' :
		percentage >= 60 ? 'Warning' :
		'Healthy'
	);

	// SVG semicircle arc math
	const radius = 60;
	const strokeWidth = 10;
	const cx = 70;
	const cy = 70;
	// Arc from 180° (left) to 0° (right), going clockwise
	const startAngle = Math.PI;
	const endAngle = 0;

	function polarToCartesian(angle: number) {
		return {
			x: cx + radius * Math.cos(angle),
			y: cy - radius * Math.sin(angle)
		};
	}

	const arcStart = polarToCartesian(startAngle);
	const arcEnd = polarToCartesian(endAngle);

	// Background arc (full semicircle)
	const bgPath = `M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;

	// Value arc (partial)
	const valueAngle = $derived(startAngle - (displayPercentage / 100) * Math.PI);
	const valueEnd = $derived(polarToCartesian(valueAngle));
	const largeArc = $derived(displayPercentage > 50 ? 1 : 0);
	const valuePath = $derived(
		`M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`
	);

	const formattedCurrent = $derived(
		decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString()
	);
	const formattedLimit = $derived(limit.toLocaleString());
</script>

<div class="flex flex-col items-center">
	<svg viewBox="0 0 140 85" class="w-full max-w-[180px]">
		<!-- Background arc -->
		<path d={bgPath} fill="none" stroke="#E2E8F0" stroke-width={strokeWidth} stroke-linecap="round" />
		<!-- Value arc -->
		{#if current > 0}
			<path d={valuePath} fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" />
		{/if}
		<!-- Center text -->
		<text x={cx} y={cy - 8} text-anchor="middle" fill="#2C3E50" font-size="18" font-weight="bold">
			{formattedCurrent}
		</text>
		<text x={cx} y={cy + 8} text-anchor="middle" fill="#4B5563" font-size="10">
			/ {formattedLimit}{unit ? ` ${unit}` : ''}
		</text>
	</svg>
	<div class="text-center -mt-1">
		<p class="text-xs font-medium text-[#2C3E50]">{label}</p>
		{#if circuitState === 'OPEN'}
			<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 animate-pulse">
				CIRCUIT OPEN
			</span>
		{:else if circuitState === 'HALF_OPEN'}
			<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
				TESTING
			</span>
		{:else}
			<span
				class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
				style="background-color: {color}20; color: {color};"
			>
				{zoneName} ({Math.round(percentage)}%)
			</span>
		{/if}
	</div>
</div>
