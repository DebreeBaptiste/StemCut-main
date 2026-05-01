'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Trash2, ChevronRight, Plus } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { listJobs, deleteJob, type Job } from '@/lib/api'

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(mb: number): string {
  return `${mb.toFixed(2)} MB`
}

export default function BibliothequePage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMb, setTotalMb] = useState(0)

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

  const handleDelete = useCallback(async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    await deleteJob(jobId)
    load()
  }, [load])

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
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map(job => (
              <div
                key={job.job_id}
                onClick={() => router.push(`/mixer/${job.job_id}`)}
                className="flex items-center gap-4 rounded-2xl px-5 py-4 cursor-pointer transition-colors hover:bg-[#16161f]"
                style={{ background: '#111118', border: '1px solid #1e1e2e' }}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
                >
                  <Music size={18} className="text-white" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    Morceau #{job.job_id.slice(0, 8)}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {formatDate(job.created_at)} · {formatSize(job.size_mb)} ·{' '}
                    {job.stems_ready ? (
                      <span className="text-green-400">✓ Prêt</span>
                    ) : (
                      <span className="text-yellow-400">En cours</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => handleDelete(e, job.job_id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="text-gray-600" />
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
