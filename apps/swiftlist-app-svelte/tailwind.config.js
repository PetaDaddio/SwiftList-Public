import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				primary: '#00796B',
				'primary-hover': '#00695C',
				secondary: '#2C3E50',
				'secondary-bg': '#EAEAE8',
				'background-light': '#F8F5F0',
				'background-dark': '#201512',
				'text-main': '#2C3E50',
				'text-secondary': '#4B5563',
				charcoal: '#2C3E50',
				'cool-grey': '#4B5563',
				surface: '#FFFFFF',
				'natural-white': '#FDFCF8',
				canvas: '#F9F6F0',
				card: '#FDFBF7',
				'status-success': '#22C55E',
				'status-warning': '#F59E0B',
				'status-error': '#EF4444',
				'status-info': '#3B82F6',
				'status-inactive': '#6B7280'
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				display: ['Inter', 'sans-serif']
			},
			borderRadius: {
				DEFAULT: '0.5rem',
				lg: '0.5rem',
				xl: '0.75rem',
				full: '9999px'
			},
			boxShadow: {
				soft: '0 4px 20px -2px rgba(44, 62, 80, 0.06)',
				glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
				glow: '0 0 20px -5px rgba(0, 121, 107, 0.4)'
			},
			backdropBlur: {
				xs: '2px'
			}
		}
	},
	plugins: [forms]
};
