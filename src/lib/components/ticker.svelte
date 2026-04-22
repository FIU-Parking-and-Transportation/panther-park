<script lang="ts">
	import { tweened } from 'svelte/motion';
	import { linear } from 'svelte/easing';

	interface Props {
		text?: string;
	}

	let {
		text = 'Welcome Panthers! Please drive safely'
	}: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let textEl: HTMLSpanElement | undefined = $state();
	let needsScroll = $state(false);

	const PADDING_X = 2; // px, applied to both left and right

	const tween = tweened(0, { easing: linear });

	$effect(() => {
		if (!containerEl || !textEl) return;
		void text; // re-run effect when text changes

		tween.set(0, { duration: 0 });

		let running = true;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		async function tick() {
			if (!running || !containerEl || !textEl) return;

			const containerWidth = containerEl.clientWidth - PADDING_X * 2;
			const textWidth = textEl.scrollWidth;
			const distance = textWidth - containerWidth;

			if (distance <= 0) {
				needsScroll = false;
				timeoutId = setTimeout(tick, 1000);
				return;
			}

			needsScroll = true;

			const speed = 60;
			const duration = (distance / speed) * 1000;

			tween.set(0, { duration: 0 });

			await new Promise<void>((resolve) => {
				timeoutId = setTimeout(resolve, 2000);
			});
			if (!running) return;

			await tween.set(distance, { duration });
			if (!running) return;

			await new Promise<void>((resolve) => {
				timeoutId = setTimeout(resolve, 2000);
			});
			if (!running) return;

			tick();
		}

		tick();

		return () => {
			running = false;
			if (timeoutId !== null) clearTimeout(timeoutId);
		};
	});
</script>

<div
	bind:this={containerEl}
	style="overflow: hidden; white-space: nowrap; width: 100%; padding: 0 {PADDING_X}px; text-align: {needsScroll ? 'left' : 'center'};"
>
	<span
		bind:this={textEl}
		style="font-weight: bold; display: inline-block; transform: translateX({-$tween}px);"
	>
		{text}
	</span>
</div>
