import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a12',
        surface: '#111118',
        border: '#1e1e2e',
      },
    },
  },
}

export default config
