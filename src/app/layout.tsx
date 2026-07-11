import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import './globals.css';

const display = Archivo({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '900'] });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Narvoq — Elevá tu juego. Elevá tu nivel.',
  description: 'Reservas, torneos, ranking y entrenamientos de pádel.',
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/icono-app.png',
    apple: '/brand/icono-app.png',
    shortcut: '/brand/icono-app.png'
  }
};
export const viewport: Viewport = { themeColor: '#1747C8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
