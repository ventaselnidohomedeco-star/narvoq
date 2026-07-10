import type { Config } from 'tailwindcss';

// Paleta: cancha de cemento azul + pelota de pádel
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        court: '#1747C8',      // azul cancha
        courtdark: '#0A1633',  // azul noche (portal complejo)
        ball: '#D8F646',       // lima pelota (CTA)
        chalk: '#F7F9FC',      // blanco tiza
        sand: '#6B7486'        // gris arena (texto secundario)
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui'],
        body: ['var(--font-body)', 'system-ui']
      }
    }
  },
  plugins: []
};
export default config;
