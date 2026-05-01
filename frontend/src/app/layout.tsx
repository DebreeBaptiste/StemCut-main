import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StemCut',
  description: 'Isolez chaque instrument de vos morceaux',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
