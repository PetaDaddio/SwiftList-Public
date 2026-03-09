/**
 * Toast Store - Svelte 5
 * Global toast notification system using runes
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
}

let toasts = $state<Toast[]>([]);

export const toastState = {
	get items() {
		return toasts;
	},

	show(message: string, type: ToastType = 'info', duration = 5000) {
		const id = crypto.randomUUID();
		const toast: Toast = { id, message, type, duration };

		toasts = [...toasts, toast];

		if (duration > 0) {
			setTimeout(() => {
				toasts = toasts.filter((t) => t.id !== id);
			}, duration);
		}

		return id;
	},

	success(message: string, duration?: number) {
		return this.show(message, 'success', duration);
	},

	error(message: string, duration?: number) {
		return this.show(message, 'error', duration);
	},

	warning(message: string, duration?: number) {
		return this.show(message, 'warning', duration);
	},

	info(message: string, duration?: number) {
		return this.show(message, 'info', duration);
	},

	dismiss(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
	},

	clear() {
		toasts = [];
	}
};
