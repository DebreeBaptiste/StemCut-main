'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, Download, Repeat } from 'lucide-react';
import WaveTrack, { type WaveTrackHandle } from '@/components/WaveTrack';
import { getStems, exportMix, type Stems } from '@/lib/api';

const STEMS = [
  { key: 'vocals', label: 'Chant', color: '#f97316' },
  { key: 'drums', label: 'Batterie', color: '#3b82f6' },
  { key: 'bass', label: 'Basse', color: '#22c55e' },
  { key: 'other', label: 'Autre', color: '#8b5cf6' },
] as const;

type StemKey = (typeof STEMS)[number]['key'];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MixerPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();

  const [stems, setStems] = useState<Stems | null>(null);
  const [loadError, setLoadError] = useState('');

  const waveRefs = useRef<Partial<Record<StemKey, WaveTrackHandle>>>({});
  const readyCount = useRef(0);

  const [allReady, setAllReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState<Record<StemKey, boolean>>({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });
  const [solo, setSolo] = useState<Record<StemKey, boolean>>({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  });
  const [volumes, setVolumes] = useState<Record<StemKey, number>>({
    vocals: 0.7,
    drums: 0.7,
    bass: 0.7,
    other: 0.7,
  });
  const [exporting, setExporting] = useState(false);

  // Loop state
  const [loopMode, setLoopMode] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);

  // Refs to avoid stale closures in event handlers
  const durationRef = useRef(0);
  const loopRef = useRef({ enabled: false, start: 0, end: 0 });
  // Live refs updated directly during drag (not waiting for React state)
  const liveLoopStartRef = useRef<number | null>(null);
  const liveLoopEndRef = useRef<number | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const selectingRef = useRef(false);
  const selectAnchorRef = useRef(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    loopRef.current = {
      enabled: loopMode,
      start: loopStart ?? 0,
      end: loopEnd ?? 0,
    };
  }, [loopMode, loopStart, loopEnd]);

  // Fetch stems
  useEffect(() => {
    getStems(jobId)
      .then(({ stems }) => setStems(stems))
      .catch(() =>
        setLoadError('Impossible de charger les stems. Job introuvable.'),
      );
  }, [jobId]);

  // Compute effective volume for a stem considering mute/solo
  const getEffectiveVolume = useCallback(
    (
      key: StemKey,
      muteS: Record<StemKey, boolean>,
      soloS: Record<StemKey, boolean>,
      vols: Record<StemKey, number>,
    ) => {
      if (muteS[key]) return 0;
      const anySolo = STEMS.some((s) => soloS[s.key]);
      if (anySolo && !soloS[key]) return 0;
      return vols[key];
    },
    [],
  );

  // Apply volumes to all wavesurfer instances
  const applyVolumes = useCallback(
    (
      muteS: Record<StemKey, boolean>,
      soloS: Record<StemKey, boolean>,
      vols: Record<StemKey, number>,
    ) => {
      STEMS.forEach(({ key }) => {
        waveRefs.current[key]?.setVolume(
          getEffectiveVolume(key, muteS, soloS, vols),
        );
      });
    },
    [getEffectiveVolume],
  );

  const handleReady = useCallback((key: StemKey) => {
    waveRefs.current[key] = waveRefs.current[key];
    readyCount.current++;
    if (readyCount.current === STEMS.length) {
      const dur = waveRefs.current['vocals']?.getDuration() ?? 0;
      setDuration(dur);
      setAllReady(true);
    }
  }, []);

  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
    const { enabled, start, end } = loopRef.current;
    const dur = durationRef.current;
    if (enabled && end - start > 0.3 && t >= end && dur > 0) {
      STEMS.forEach(({ key }) => waveRefs.current[key]?.seekTo(start / dur));
      setCurrentTime(start);
    }
  }, []);

  const handleFinish = useCallback(() => {
    const { enabled, start } = loopRef.current;
    const dur = durationRef.current;
    if (enabled && dur > 0) {
      STEMS.forEach(({ key }) => waveRefs.current[key]?.seekTo(start / dur));
      setCurrentTime(start);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const all = STEMS.map((s) => waveRefs.current[s.key]).filter(
      Boolean,
    ) as WaveTrackHandle[];
    if (isPlaying) {
      all.forEach((ws) => ws.pause());
      setIsPlaying(false);
    } else {
      // Si une boucle est sélectionnée, repositionner au début de la boucle avant de jouer
      const { enabled, start } = loopRef.current;
      const dur = durationRef.current;
      if (enabled && dur > 0) {
        all.forEach((ws) => ws.seekTo(start / dur));
        setCurrentTime(start);
      }
      all.forEach((ws) => ws.play());
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const setSpeedAll = useCallback((r: number) => {
    setSpeed(r);
    STEMS.forEach(({ key }) => waveRefs.current[key]?.setPlaybackRate(r));
  }, []);

  // Seek all tracks to a given time in seconds
  const seekAllToTime = useCallback((t: number) => {
    const dur = durationRef.current;
    if (!dur) return;
    STEMS.forEach(({ key }) => waveRefs.current[key]?.seekTo(t / dur));
    setCurrentTime(t);
  }, []);

  // Click on a waveform → seek there (unless in loop selection mode)
  // (handleWaveformMouseDown below handles both seek and loop selection)

  // Get audio time from mouse X relative to a DOM rect
  const getTimeFromRect = useCallback((clientX: number, rect: DOMRect): number => {
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return f * durationRef.current;
  }, []);

  // Get audio time from mouse X on the seek bar
  const getTimeFromX = useCallback((clientX: number): number => {
    if (!seekBarRef.current) return 0;
    return getTimeFromRect(clientX, seekBarRef.current.getBoundingClientRect());
  }, [getTimeFromRect]);

  // Ref that stores the bounding rect of the element currently being dragged (seekbar or waveform)
  const activeDragRectRef = useRef<DOMRect | null>(null);

  // Shared logic: start a loop selection or a seek from any element
  const startInteraction = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!allReady) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const t = getTimeFromRect(e.clientX, rect);
      if (loopMode) {
        activeDragRectRef.current = rect;
        selectingRef.current = true;
        selectAnchorRef.current = t;
        liveLoopStartRef.current = t;
        liveLoopEndRef.current = t;
        setLoopStart(t);
        setLoopEnd(t);
      } else {
        seekAllToTime(t);
      }
    },
    [allReady, loopMode, getTimeFromRect, seekAllToTime],
  );

  const loopModeRef = useRef(false);
  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);

  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Window events for loop selection drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!selectingRef.current || !activeDragRectRef.current) return;
      const t = getTimeFromRect(e.clientX, activeDragRectRef.current);
      const anchor = selectAnchorRef.current;
      const start = Math.min(anchor, t);
      const end = Math.max(anchor, t);
      liveLoopStartRef.current = start;
      liveLoopEndRef.current = end;
      setLoopStart(start);
      setLoopEnd(end);
    };
    const onMouseUp = () => {
      if (selectingRef.current) {
        const start = liveLoopStartRef.current;
        const end = liveLoopEndRef.current;
        const dur = durationRef.current;
        if (start !== null && end !== null && end - start > 0.3 && dur > 0) {
          // Boucle valide → seek au début de la boucle
          STEMS.forEach(({ key }) => waveRefs.current[key]?.seekTo(start / dur));
          setCurrentTime(start);
        }
      }
      selectingRef.current = false;
      activeDragRectRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [getTimeFromRect]);

  const handleSeekBarMouseDown = startInteraction;
  const handleWaveformMouseDown = startInteraction;

  const toggleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      if (prev) {
        setLoopStart(null);
        setLoopEnd(null);
      }
      return !prev;
    });
  }, []);

  const toggleMute = useCallback(
    (key: StemKey) => {
      setMuted((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        applyVolumes(next, solo, volumes);
        return next;
      });
    },
    [solo, volumes, applyVolumes],
  );

  const toggleSolo = useCallback(
    (key: StemKey) => {
      setSolo((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        applyVolumes(muted, next, volumes);
        return next;
      });
    },
    [muted, volumes, applyVolumes],
  );

  const handleVolumeChange = useCallback(
    (key: StemKey, v: number) => {
      setVolumes((prev) => {
        const next = { ...prev, [key]: v };
        applyVolumes(muted, solo, next);
        return next;
      });
    },
    [muted, solo, applyVolumes],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const mutedStems = STEMS.filter((s) => muted[s.key]).map((s) => s.key);
      const blob = await exportMix(jobId, mutedStems);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stemcut_mix_${jobId.slice(0, 8)}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [jobId, muted]);

  if (loadError) {
    return (
      <div
        className='min-h-screen flex items-center justify-center'
        style={{ background: '#0a0a12' }}
      >
        <div className='text-center'>
          <p className='text-red-400 mb-4'>{loadError}</p>
          <button
            onClick={() => router.push('/')}
            className='text-violet-400 hover:underline text-sm'
          >
            ← Retour à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  if (!stems) {
    return (
      <div
        className='min-h-screen flex items-center justify-center'
        style={{ background: '#0a0a12' }}
      >
        <p className='text-gray-500 text-sm'>Chargement des stems...</p>
      </div>
    );
  }

  const fraction = duration ? currentTime / duration : 0;
  const hasLoop =
    loopMode &&
    loopStart !== null &&
    loopEnd !== null &&
    loopEnd - loopStart > 0.3 &&
    duration > 0;

  return (
    <div
      className='min-h-screen flex flex-col'
      style={{ background: '#0a0a12' }}
    >
      {/* Header */}
      <header
        className='flex items-center gap-4 px-6 py-4 flex-shrink-0'
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        <button
          onClick={() => router.push('/bibliotheque')}
          className='p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2e] transition-colors'
        >
          <ArrowLeft size={18} />
        </button>

        <div className='flex-1'>
          <p className='text-gray-600 text-xs font-medium tracking-widest uppercase'>
            Projet
          </p>
          <p className='text-white font-semibold text-sm'>Mixer multi-pistes</p>
        </div>

        <div className='flex items-center gap-3'>
          <p className='text-gray-500 text-xs'>
            {allReady
              ? "Les pistes mutées seront silencieuses dans l'export"
              : 'Chargement des waveforms...'}
          </p>
          <button
            onClick={handleExport}
            disabled={exporting || !allReady}
            className='flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity'
            style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
          >
            <Download size={14} />
            {exporting ? 'Export...' : 'Exporter un mix'}
          </button>
        </div>
      </header>

      {/* Tracks */}
      <div className='flex-1 overflow-y-auto py-4 px-6 flex flex-col gap-3'>
        {STEMS.map(({ key, label, color }) => {
          const isMuted = muted[key];
          const isSolo = solo[key];
          const vol = volumes[key];

          return (
            <div
              key={key}
              className='flex items-center gap-4 rounded-2xl px-4 py-3'
              style={{ background: '#111118', border: '1px solid #1e1e2e' }}
            >
              {/* Icon */}
              <div
                className='w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs'
                style={{ background: color }}
              >
                {label[0]}
              </div>

              {/* Label + controls */}
              <div className='flex flex-col gap-1 w-24 flex-shrink-0'>
                <span className='text-white text-sm font-medium'>{label}</span>
                <div className='flex gap-1'>
                  <button
                    onClick={() => toggleMute(key)}
                    className='px-1.5 py-0.5 rounded text-xs font-bold transition-colors'
                    style={{
                      background: isMuted ? '#ef4444' : '#1e1e2e',
                      color: isMuted ? 'white' : '#9ca3af',
                    }}
                  >
                    M
                  </button>
                  <button
                    onClick={() => toggleSolo(key)}
                    className='px-1.5 py-0.5 rounded text-xs font-bold transition-colors'
                    style={{
                      background: isSolo ? '#f59e0b' : '#1e1e2e',
                      color: isSolo ? 'white' : '#9ca3af',
                    }}
                  >
                    S
                  </button>
                </div>
                <div className='flex items-center gap-1'>
                  <input
                    type='range'
                    min={0}
                    max={2}
                    step={0.01}
                    value={vol}
                    onChange={(e) =>
                      handleVolumeChange(key, parseFloat(e.target.value))
                    }
                    className='w-20'
                    style={{ accentColor: color }}
                  />
                  <span
                    className='text-xs w-8 text-right'
                    style={{ color: vol > 1 ? color : '#6b7280' }}
                  >
                    {Math.round(vol * 100)}%
                  </span>
                </div>
              </div>

              {/* Waveform */}
              <div
                className='flex-1 min-w-0'
                style={{
                  position: 'relative',
                  height: 64,
                  cursor: allReady ? (loopMode ? 'crosshair' : 'pointer') : 'default',
                }}
                onMouseDown={handleWaveformMouseDown}
              >
                <WaveTrack
                  ref={(el) => {
                    if (el) waveRefs.current[key] = el;
                  }}
                  url={stems[key as keyof typeof stems]}
                  color={color}
                  onReady={() => handleReady(key)}
                  onTimeUpdate={key === 'vocals' ? handleTimeUpdate : undefined}
                  onFinish={key === 'vocals' ? handleFinish : undefined}
                />
                {/* Overlay: bloque les events du shadow DOM WaveSurfer */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Player bar */}
      <div
        className='flex-shrink-0 px-6 py-4'
        style={{ borderTop: '1px solid #1e1e2e', background: '#0d0d18' }}
      >
        {/* Loop hint */}
        {loopMode && (
          <p className='text-amber-400 text-xs mb-2 text-center'>
            {hasLoop
              ? `⟳ Boucle : ${formatTime(loopStart!)} → ${formatTime(loopEnd!)}`
              : 'Glissez sur la barre pour sélectionner un passage à boucler'}
          </p>
        )}

        {/* Custom seek bar */}
        <div
          ref={seekBarRef}
          className='relative w-full h-2 rounded-full mb-3 select-none'
          style={{
            background: '#2e2e4e',
            cursor: allReady ? (loopMode ? 'crosshair' : 'pointer') : 'default',
            opacity: allReady ? 1 : 0.4,
            pointerEvents: allReady ? 'auto' : 'none',
          }}
          onMouseDown={handleSeekBarMouseDown}
        >
          {/* Playback progress fill */}
          <div
            className='absolute inset-y-0 left-0 rounded-full pointer-events-none'
            style={{
              width: `${fraction * 100}%`,
              background: 'linear-gradient(to right, #7c3aed, #d946ef)',
            }}
          />
          {/* Loop selection highlight */}
          {hasLoop && (
            <div
              className='absolute inset-y-0 pointer-events-none'
              style={{
                left: `${(loopStart! / duration) * 100}%`,
                width: `${((loopEnd! - loopStart!) / duration) * 100}%`,
                background: 'rgba(251, 191, 36, 0.35)',
                borderLeft: '2px solid #fbbf24',
                borderRight: '2px solid #fbbf24',
                borderRadius: '2px',
              }}
            />
          )}
        </div>

        <div className='flex items-center gap-4'>
          {/* Time */}
          <span className='text-gray-500 text-xs w-10 text-right'>
            {formatTime(currentTime)}
          </span>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!allReady}
            className='w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity'
            style={{ background: 'linear-gradient(135deg, #7c3aed, #d946ef)' }}
          >
            {isPlaying ? (
              <Pause size={16} className='text-white' />
            ) : (
              <Play size={16} className='text-white ml-0.5' />
            )}
          </button>

          {/* Duration */}
          <span className='text-gray-500 text-xs'>{formatTime(duration)}</span>

          {/* Spacer */}
          <div className='flex-1' />

          {/* Loop button */}
          <button
            onClick={toggleLoopMode}
            disabled={!allReady}
            title={
              loopMode
                ? 'Désactiver la boucle'
                : 'Mode boucle — sélectionnez un passage'
            }
            className='p-2 rounded-lg transition-colors disabled:opacity-40'
            style={{
              background: loopMode ? 'rgba(251, 191, 36, 0.12)' : 'transparent',
              color: loopMode ? '#fbbf24' : '#6b7280',
              border: `1px solid ${loopMode ? '#fbbf24' : '#2e2e4e'}`,
            }}
          >
            <Repeat size={15} />
          </button>

          {/* Speed */}
          <div
            className='flex items-center gap-1 rounded-xl overflow-hidden'
            style={{ background: '#1e1e2e' }}
          >
            {[0.75, 1, 1.25].map((r) => (
              <button
                key={r}
                onClick={() => setSpeedAll(r)}
                className='px-3 py-1.5 text-xs font-medium transition-colors'
                style={{
                  background:
                    speed === r
                      ? 'linear-gradient(135deg, #7c3aed, #d946ef)'
                      : 'transparent',
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
  );
}
