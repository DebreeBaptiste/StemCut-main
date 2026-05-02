'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Music, Trash2, ChevronRight, Plus, Pencil, Check, X,
  Star, Play, Pause, Search,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { listJobs, deleteJob, renameJob, setFavorite, stemStreamUrl, type Job } from '@/lib/api'

type SortKey = 'date' | 'name' | 'size'

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatSize(mb: number): string {
  return `${mb.toFixed(2)} MB`
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function jobDisplayName(job: Job): string {
  return job.name || `Morceau #${job.job_id.slice(0, 8)}`
}

export default function BibliothequePage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMb, setTotalMb] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('date')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async () => {
    try {
      const { jobs } = await listJobs()
      setJobs(jobs)
      setTotalMb(jobs.reduce((acc, j) => acc + j.size_mb, 0))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  const handleDelete = useCallback(async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    if (playingId === jobId) {
      audioRef.current?.pause()
      setPlayingId(null)
    }
    await deleteJob(jobId)
    load()
  }, [load, playingId])

  const startEdit = useCallback((e: React.MouseEvent, job: Job) => {
    e.stopPropagation()
    setEditingId(job.job_id)
    setEditValue(jobDisplayName(job))
    setTimeout(() => inputRef.current?.select(), 0)
  }, [])

  const confirmEdit = useCallback(async (jobId: string) => {
    const trimmed = editValue.trim()
    if (trimmed) {
      await renameJob(jobId, trimmed)
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, name: trimmed } : j))
    }
    setEditingId(null)
  }, [editValue])

  const cancelEdit = useCallback(() => setEditingId(null), [])

  const handleFavorite = useCallback(async (e: React.MouseEvent, job: Job) => {
    e.stopPropagation()
    const newFav = !job.favorite
    await setFavorite(job.job_id, newFav)
    setJobs(prev => prev.map(j => j.job_id === job.job_id ? { ...j, favorite: newFav } : j))
  }, [])

  const togglePlay = useCallback((e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    if (playingId === jobId) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioRef.current?.pause()
    const audio = new Audio(stemStreamUrl(jobId, 'original'))
    audio.onended = () => setPlayingId(null)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingId(jobId)
  }, [playingId])

  const displayedJobs = useMemo(() => {
    const filtered = jobs.filter(j =>
      jobDisplayName(j).toLowerCase().includes(search.toLowerCase())
    )
    filtered.sort((a, b) => {
      if (sort === 'name') return jobDisplayName(a).localeCompare(jobDisplayName(b), 'fr')
      if (sort === 'size') return b.size_mb - a.size_mb
      return b.created_at - a.created_at
    })
    return [
      ...filtered.filter(j => j.favorite),
      ...filtered.filter(j => !j.favorite),
    ]
  }, [jobs, search, sort])

  return (
    <div className="min-h-screen" style={{ background: '#0a0a12' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto pt-28 pb-20 px-4">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-violet-400 mb-1">Ma Bibliothèque</h1>
            <p className="text-gray-500 text-sm">
              {jobs.length} morceau{jobs.length !== 1 ? 'x' : ''} importé{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
          >
            <Plus size={16} />
            Nouveau morceau
          </button>
        </div>

        {!loading && jobs.length > 0 && (
          <div className="flex gap-3 mb-5">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-[#111118] border border-[#1e1e2e] rounded-xl px-3 py-2 text-sm text-gray-400 outline-none focus:border-violet-500/50 cursor-pointer transition-colors"
            >
              <option value="date">Date</option>
              <option value="name">Nom</option>
              <option value="size">Taille</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm">Chargement...</div>
        ) : jobs.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <Music size={32} className="text-violet-500 mx-auto mb-3" />
            <p className="text-gray-400">Aucun morceau importé</p>
            <p className="text-gray-600 text-sm mt-1">
              Importez un fichier audio ou une URL YouTube pour commencer
            </p>
          </div>
        ) : displayedJobs.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            Aucun résultat pour « {search} »
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayedJobs.map(job => (
              <div
                key={job.job_id}
                onClick={() => editingId !== job.job_id && router.push(`/mixer/${job.job_id}`)}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 cursor-pointer transition-colors hover:bg-[#16161f]"
                style={{ background: '#111118', border: '1px solid #1e1e2e' }}
              >
                {/* Play / icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group/play cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
                  onClick={e => togglePlay(e, job.job_id)}
                >
                  {playingId === job.job_id ? (
                    <Pause size={18} className="text-white" />
                  ) : (
                    <>
                      <Music size={18} className="text-white group-hover/play:hidden" />
                      <Play size={18} className="text-white hidden group-hover/play:block" />
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === job.job_id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmEdit(job.job_id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="flex-1 min-w-0 bg-[#1e1e2e] text-white text-sm font-medium rounded-lg px-2 py-0.5 border border-violet-500 outline-none"
                        autoFocus
                      />
                      <button onClick={() => confirmEdit(job.job_id)} className="p-1 text-green-400 hover:text-green-300">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-500 hover:text-gray-300">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/name">
                      <p className="text-white font-medium text-sm truncate">
                        {jobDisplayName(job)}
                      </p>
                      <button
                        onClick={e => startEdit(e, job)}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-gray-600 hover:text-violet-400 transition-all flex-shrink-0"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  <p className="text-gray-500 text-xs mt-0.5">
                    {formatDate(job.created_at)}
                    {job.duration_s != null && ` · ${formatDuration(job.duration_s)}`}
                    {` · ${formatSize(job.size_mb)} · `}
                    {job.stems_ready ? (
                      <span className="text-green-400">✓ Prêt</span>
                    ) : (
                      <span className="text-yellow-400">En cours</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => handleFavorite(e, job)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      job.favorite
                        ? 'text-yellow-400'
                        : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10'
                    }`}
                  >
                    <Star size={16} fill={job.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={e => handleDelete(e, job.job_id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  {editingId !== job.job_id && <ChevronRight size={18} className="text-gray-600" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {jobs.length > 0 && (
          <p className="text-center text-gray-600 text-xs mt-6">
            Espace total utilisé : {totalMb.toFixed(1)} MB
          </p>
        )}
      </main>
    </div>
  )
}
