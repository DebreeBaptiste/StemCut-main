'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, Pause, Download } from 'lucide-react'
import WaveTrack, { type WaveTrackHandle } from '@/components/WaveTrack'
import { getStems, exportMix, type Stems } from '@/lib/api'

const STEMS = [
  { key: 'vocals', label: 'Chant', color: '#f97316' },
  { key: 'drums', label: 'Batterie', color: '#3b82f6' },
  { key: 'bass', label: 'Basse', color: '#22c55e' },
  { key: 'other', label: 'Autre', color: '#8b5cf6' },
] as const

type StemKey = typeof STEMS[number]['key']

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MixerPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const router = useRouter()

  const [stems, setStems] = useState<Stems | null>(null)
  const [loadError, setLoadError] = useState('')

  const waveRefs = useRef<Partial<Record<StemKey, WaveTrackHandle>>>({})
  const readyCount = useRef(0)

  const [allReady, setAllReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [muted, setMuted] = useState<Record<StemKey, boolean>>({
    vocals: false, drums: false, bass: false, other: false,
  })
  const [solo, setSolo] = useState<Record<StemKey, boolean>>({
    vocals: false, drums: false, bass: false, other: false,
  })
  const [volumes, setVolumes] = useState<Record<StemKey, number>>({
    vocals: 0.7, drums: 0.7, bass: 0.7, other: 0.7,
  })
  const [exporting, setExporting] = useState(false)

  // Fetch stems
  useEffect(() => {
    getStems(jobId)
      .then(({ stems }) => setStems(stems))
      .catch(() => setLoadError('Impossible de charger les stems. Job introuvable.'))
  }, [jobId])

  // Compute effective volume for a stem considering mute/solo
  const getEffectiveVolume = useCallback(
    (key: StemKey, muteS: Record<StemKey, boolean>, soloS: Record<StemKey, boolean>, vols: Record<StemKey, number>) => {
      if (muteS[key]) return 0
      const anySolo = STEMS.some(s => soloS[s.key])
      if (anySolo && !soloS[key]) return 0
      return vols[key]
    },
    []
  )

  // Apply volumes to all wavesurfer instances
  const applyVolumes = useCallback(
    (muteS: Record<StemKey, boolean>, soloS: Record<StemKey, boolean>, vols: Record<StemKey, number>) => {
      STEMS.forEach(({ key }) => {
        waveRefs.current[key]?.setVolume(getEffectiveVolume(key, muteS, soloS, vols))
      })
    },
    [getEffectiveVolume]
  )

  const handleReady = useCallback((key: StemKey) => {
    waveRefs.current[key] = waveRefs.current[key]
    readyCount.current++
    if (readyCount.current === STEMS.length) {
      const dur = waveRefs.current['vocals']?.getDuration() ?? 0
      setDuration(dur)
      setAllReady(true)
    }
  }, [])

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t)
  }, [])

  const handleFinish = useCallback(() => {
    setIsPlaying(false)
    setCurrentTime(0)
  }, [])

  const togglePlay = useCallback(() => {
    const all = STEMS.map(s => waveRefs.current[s.key]).filter(Boolean) as WaveTrackHandle[]
    if (isPlaying) {
      all.forEach(ws => ws.pause())
      setIsPlaying(false)
    } else {
      all.forEach(ws => ws.play())
      setIsPlaying(true)
    }
  }, [isPlaying])

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    const f = Math.max(0, Math.min(1, fraction))
    STEMS.forEach(({ key }) => waveRefs.current[key]?.seekTo(f))
    setCurrentTime(f * duration)
  }, [duration])

  const setSpeedAll = useCallback((r: number) => {
    setSpeed(r)
    STEMS.forEach(({ key }) => waveRefs.current[key]?.setPlaybackRate(r))
  }, [])

  const toggleMute = useCallback((key: StemKey) => {
    setMuted(prev => {
      const next = { ...prev, [key]: !prev[key] }
      applyVolumes(next, solo, volumes)
      return next
    })
  }, [solo, volumes, applyVolumes])

  const toggleSolo = useCallback((key: StemKey) => {
    setSolo(prev => {
      const next = { ...prev, [key]: !prev[key] }
      applyVolumes(muted, next, volumes)
      return next
    })
  }, [muted, volumes, applyVolumes])

  const handleVolumeChange = useCallback((key: StemKey, v: number) => {
    setVolumes(prev => {
      const next = { ...prev, [key]: v }
      applyVolumes(muted, solo, next)
      return next
    })
  }, [muted, solo, applyVolumes])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const mutedStems = STEMS.filter(s => muted[s.key]).map(s => s.key)
      const blob = await exportMix(jobId, mutedStems)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stemcut_mix_${jobId.slice(0, 8)}.mp3`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [jobId, muted])

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{loadError}</p>
          <button onClick={() => router.push('/')} className="text-violet-400 hover:underline text-sm">
            ← Retour à l&apos;accueil
          </button>
        </div>
      </div>
    )
  }

  if (!stems) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <p className="text-gray-500 text-sm">Chargement des stems...</p>
      </div>
    )
  }

  const fraction = duration ? currentTime / duration : 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a12' }}>
      {/* Header */}
      <header
        className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        <button
          onClick={() => router.push('/bibliotheque')}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2e] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1">
          <p className="text-gray-600 text-xs font-medium tracking-widest uppercase">Projet</p>
          <p className="text-white font-semibold text-sm">Mixer multi-pistes</p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-gray-500 text-xs">
            {allReady
              ? 'Les pistes mutées seront silencieuses dans l\'export'
              : 'Chargement des waveforms...'}
          </p>
          <button
            onClick={handleExport}
            disabled={exporting || !allReady}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
          >
            <Download size={14} />
            {exporting ? 'Export...' : 'Exporter un mix'}
          </button>
        </div>
      </header>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto py-4 px-6 flex flex-col gap-3">
        {STEMS.map(({ key, label, color }) => {
          const isMuted = muted[key]
          const isSolo = solo[key]
          const vol = volumes[key]

          return (
            <div
              key={key}
              className="flex items-center gap-4 rounded-2xl px-4 py-3"
              style={{ background: '#111118', border: '1px solid #1e1e2e' }}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                style={{ background: color }}
              >
                {label[0]}
              </div>

              {/* Label + controls */}
              <div className="flex flex-col gap-1 w-24 flex-shrink-0">
                <span className="text-white text-sm font-medium">{label}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleMute(key)}
                    className="px-1.5 py-0.5 rounded text-xs font-bold transition-colors"
                    style={{
                      background: isMuted ? '#ef4444' : '#1e1e2e',
                      color: isMuted ? 'white' : '#9ca3af',
                    }}
                  >
                    M
                  </button>
                  <button
                    onClick={() => toggleSolo(key)}
                    className="px-1.5 py-0.5 rounded text-xs font-bold transition-colors"
                    style={{
                      background: isSolo ? '#f59e0b' : '#1e1e2e',
                      color: isSolo ? 'white' : '#9ca3af',
                    }}
                  >
                    S
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={vol}
                    onChange={e => handleVolumeChange(key, parseFloat(e.target.value))}
                    className="w-20"
                    style={{ accentColor: color }}
                  />
                  <span className="text-xs w-8 text-right" style={{ color: vol > 1 ? color : '#6b7280' }}>
                    {Math.round(vol * 100)}%
                  </span>
                </div>
              </div>

              {/* Waveform */}
              <div className="flex-1 min-w-0">
                <WaveTrack
                  ref={el => { if (el) waveRefs.current[key] = el }}
                  url={stems[key as keyof typeof stems]}
                  color={color}
                  onReady={() => handleReady(key)}
                  onTimeUpdate={key === 'vocals' ? handleTimeUpdate : undefined}
                  onFinish={key === 'vocals' ? handleFinish : undefined}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Player bar */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ borderTop: '1px solid #1e1e2e', background: '#0d0d18' }}
      >
        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full mb-3 cursor-pointer"
          style={{ background: '#1e1e2e' }}
          onClick={seekTo}
        >
          <div
            className="h-1.5 rounded-full"
            style={{
              width: `${fraction * 100}%`,
              background: 'linear-gradient(to right, #7c3aed, #d946ef)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Time */}
          <span className="text-gray-500 text-xs w-10 text-right">{formatTime(currentTime)}</span>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!allReady}
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
          >
            {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
          </button>

          {/* Duration */}
          <span className="text-gray-500 text-xs">{formatTime(duration)}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Speed */}
          <div className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ background: '#1e1e2e' }}>
            {[0.75, 1, 1.25].map(r => (
              <button
                key={r}
                onClick={() => setSpeedAll(r)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: speed === r ? 'linear-gradient(135deg, #7c3aed, #d946ef)' : 'transparent',
                  color: speed === r ? 'white' : '#9ca3af',
                }}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
