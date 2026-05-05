'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Library, Settings } from 'lucide-react'
import SettingsModal from './SettingsModal'

export default function Navbar() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-[40px] left-0 right-0 z-50 flex items-center justify-between px-8 py-4">
        <Link href="/" className="no-drag text-xl font-bold text-violet-400 tracking-tight">
          StemCut
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/bibliotheque"
            className="no-drag flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Library size={16} />
            Ma bibliothèque
          </Link>

          <button
            onClick={() => setSettingsOpen(true)}
            className="no-drag w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title="Paramètres"
          >
            <Settings size={15} />
          </button>
        </div>
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
