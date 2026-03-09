<script lang="ts">
	/**
	 * ImageUpload Component - Svelte 5
	 * Drag-and-drop image upload with preview
	 */

	import { validateImageFile, validateImageDimensions } from '$lib/validations/jobs';
	import { formatFileSize } from '$lib/utils/upload';

	interface Props {
		onFileSelect: (file: File) => void;
		disabled?: boolean;
	}

	let { onFileSelect, disabled = false }: Props = $props();

	let isDragging = $state(false);
	let preview = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let error = $state<string | null>(null);

	async function handleFile(file: File) {
		error = null;

		// Step 1: Validate type + size (sync, fast)
		const typeCheck = validateImageFile(file);
		if (!typeCheck.valid) {
			error = typeCheck.error!;
			return;
		}

		// Step 2: Validate pixel dimensions (async — decodes the image header)
		const dimCheck = await validateImageDimensions(file);
		if (!dimCheck.valid) {
			error = dimCheck.error!;
			return;
		}

		// Create preview
		const reader = new FileReader();
		reader.onloadend = () => {
			preview = reader.result as string;
		};
		reader.readAsDataURL(file);

		selectedFile = file;
		onFileSelect(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const files = Array.from(e.dataTransfer?.files || []);
		if (files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			handleFile(files[0]);
		}
	}

	function handleRemove() {
		preview = null;
		selectedFile = null;
		error = null;
	}
</script>

{#if preview && selectedFile}
	<div class="w-full">
		<div
			class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200"
		>
			<img src={preview} alt="Upload preview" class="w-full h-full object-contain" />
			<button
				onclick={handleRemove}
				disabled={disabled}
				class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<span class="material-symbols-outlined text-gray-700">close</span>
			</button>
		</div>
		<div class="mt-3 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
			<div class="flex items-center gap-3">
				<span class="material-symbols-outlined text-[#00796B]">image</span>
				<div>
					<p class="text-sm font-medium text-[#2C3E50]">{selectedFile.name}</p>
					<p class="text-xs text-[#4B5563]">{formatFileSize(selectedFile.size)}</p>
				</div>
			</div>
			<span class="material-symbols-outlined text-green-600">check_circle</span>
		</div>
	</div>
{:else}
	<div class="w-full">
		<div
			role="button"
			tabindex="0"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			class={`
				relative flex flex-col items-center justify-center
				w-full h-80 rounded-xl
				border-2 border-dashed
				transition-all duration-300
				${isDragging ? 'border-[#00796B] bg-[#00796B]/5 scale-[1.02]' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'}
				${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
			`}
		>
			<input
				type="file"
				accept="image/jpeg,image/jpg,image/png,image/webp"
				onchange={handleFileInput}
				disabled={disabled}
				class="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
			/>

			<div class="flex flex-col items-center text-center px-6 pointer-events-none">
				<div
					class={`
						mb-4 p-4 rounded-full
						transition-all duration-300
						${isDragging ? 'bg-[#00796B]/20 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}
					`}
				>
					<span
						class={`material-symbols-outlined text-4xl ${isDragging ? 'text-[#00796B]' : 'text-gray-400'}`}
					>
						add_photo_alternate
					</span>
				</div>

				<p class="mb-2 text-sm font-medium text-[#2C3E50]">
					{#if isDragging}
						<span class="text-[#00796B]">Drop your image here</span>
					{:else}
						Drag & drop your product image here or
						<span class="text-[#00796B] underline decoration-primary/30 underline-offset-2">
							click to upload
						</span>
					{/if}
				</p>

				<p class="text-xs text-[#4B5563] mt-2">JPG, PNG, or WebP · Max 10MB · Min 500×500px</p>
			</div>
		</div>

		{#if error}
			<div
				class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
			>
				<span class="material-symbols-outlined text-red-600 text-sm mt-0.5">error</span>
				<p class="text-sm text-red-800">{error}</p>
			</div>
		{/if}
	</div>
{/if}
