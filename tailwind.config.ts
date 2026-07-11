import type { Config } from 'tailwindcss';

// Paleta: cancha de cemento azul + pelota de pádel
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        court: '#1747C8',      // azul cancha (uso residual: superficies)
        courtdark: '#0A1633',  // azul noche
        ball: '#D8F646',       // lima pelota (CTA principal)
        chalk: '#F7F9FC',      // blanco tiza
        sand: '#6B7486',       // gris arena (texto secundario)
        grafito: '#2A2E36',    // gris grafito (fondo de botones cuando lima chocaría)
        grafitolight: '#3A404A'// gris grafito claro
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
