/* global require */
/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			keyframes: {
				'logo-fade-in': {
					'0%': {
						opacity: '0',
						transform: 'scale(0.92)'
					},
					'100%': {
						opacity: '1',
						transform: 'scale(1)'
					}
				},
				'logo-soft-pulse': {
					'0%, 100%': {
						opacity: '1',
						transform: 'scale(1)'
					},
					'50%': {
						opacity: '0.97',
						transform: 'scale(1.02)'
					}
				},
				'logo-breathe': {
					'0%, 100%': {
						transform: 'scale(1)'
					},
					'50%': {
						transform: 'scale(1.04)'
					}
				},
				'logo-glow': {
					'0%, 100%': {
						filter: 'drop-shadow(0 0 8px rgba(114, 47, 55, 0.3))'
					},
					'50%': {
						filter: 'drop-shadow(0 0 14px rgba(114, 47, 55, 0.5))'
					}
				}
			},
			animation: {
				'logo-fade-in': 'logo-fade-in 0.7s ease-out forwards',
				'logo-soft-pulse': 'logo-soft-pulse 4s ease-in-out infinite',
				'logo-breathe': 'logo-breathe 3s ease-in-out infinite',
				'logo-glow': 'logo-glow 2.5s ease-in-out infinite'
			},
			colors: {
				maroon: {
					'50': '#fdf2f4',
					'100': '#fce7eb',
					'200': '#f9d0d9',
					'300': '#f4a9b8',
					'400': '#eb7092',
					'500': '#dc446b',
					'600': '#c72e52',
					'700': '#a32643',
					'800': '#722f37',
					'900': '#5c0120',
				},
				primary: {
					'50': '#fdf2f4',
					'100': '#fce7eb',
					'200': '#f9d0d9',
					'300': '#f4a9b8',
					'400': '#eb7092',
					'500': '#dc446b',
					'600': '#c72e52',
					'700': '#a32643',
					'800': '#722f37',
					'900': '#5c0120',
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				accent: {
					'50': '#fff7ed',
					'100': '#ffedd5',
					'500': '#f97316',
					'600': '#ea580c',
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}


