import type { Metadata } from 'next'
import './globals.css'
import { LocaleProvider } from '@/lib/locale'

export const metadata: Metadata = {
  title: 'StemCut',
  description: 'Isolate every instrument from your tracks',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Zone drag Electron — safe area macOS traffic lights */}
        <div
          className="titlebar fixed top-0 left-0 right-0 z-[9999]"
          style={{ height: '40px', background: 'transparent' }}
        />
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}
