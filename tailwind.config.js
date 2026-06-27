/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        brand:      '#C26330', // terracotta
        'brand-dk': '#A5522A', // terracotta escuro (hover)
        sand:       '#F7F3EE', // fundo areia
        'sand-md':  '#EDE8E2', // areia médio (bordas/divisores)
      },
    },
  },
  plugins: [],
}
