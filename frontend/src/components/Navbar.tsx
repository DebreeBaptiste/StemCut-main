'use client'

import Link from 'next/link'
import { Library } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4">
      <Link href="/" className="text-xl font-bold text-violet-400 tracking-tight">
        StemCut
      </Link>
      <Link
        href="/bibliotheque"
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <Library size={16} />
        Ma bibliothèque
      </Link>
    </nav>
  )
}
