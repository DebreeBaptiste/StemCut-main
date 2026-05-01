import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StemCut',
  description: 'Isolez chaque instrument de vos morceaux',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Zone drag Electron — safe area macOS traffic lights */}
        <div
          className="titlebar fixed top-0 left-0 right-0 z-[9999]"
          style={{ height: '40px', background: 'transparent' }}
        />
        {children}
      </body>
    </html>
  )
}
