'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

export interface WaveTrackHandle {
  play: () => void
  pause: () => void
  seekTo: (fraction: number) => void
  setVolume: (v: number) => void
  setPlaybackRate: (r: number) => void
  getCurrentTime: () => number
  getDuration: () => number
}

interface WaveTrackProps {
  url: string
  color: string
  onReady?: () => void
  onTimeUpdate?: (t: number) => void
  onFinish?: () => void
}

const WaveTrack = forwardRef<WaveTrackHandle, WaveTrackProps>(
  ({ url, color, onReady, onTimeUpdate, onFinish }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<import('wavesurfer.js').default | null>(null)
    const gainRef = useRef<GainNode | null>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)

    useImperativeHandle(ref, () => ({
      play: () => {
        audioCtxRef.current?.resume()
        wsRef.current?.play()
      },
      pause: () => wsRef.current?.pause(),
      seekTo: (f) => wsRef.current?.seekTo(Math.max(0, Math.min(1, f))),
      setVolume: (v) => {
        if (gainRef.current) gainRef.current.gain.value = v
      },
      setPlaybackRate: (r) => wsRef.current?.setPlaybackRate(r),
      getCurrentTime: () => wsRef.current?.getCurrentTime() ?? 0,
      getDuration: () => wsRef.current?.getDuration() ?? 0,
    }))

    useEffect(() => {
      if (!containerRef.current) return
      let ws: import('wavesurfer.js').default | null = null

      const init = async () => {
        const WaveSurfer = (await import('wavesurfer.js')).default
        ws = WaveSurfer.create({
          container: containerRef.current!,
          url,
          waveColor: 'rgba(96,165,250,0.5)',
          progressColor: color,
          height: 64,
          normalize: true,
          interact: false,
          cursorWidth: 0,
          barWidth: 2,
          barGap: 1,
          barRadius: 1,
        })

        wsRef.current = ws

        ws.on('ready', () => {
          const audioCtx = new AudioContext()
          const gainNode = audioCtx.createGain()
          const source = audioCtx.createMediaElementSource(ws!.getMediaElement())
          source.connect(gainNode)
          gainNode.connect(audioCtx.destination)
          gainNode.gain.value = 0.7
          gainRef.current = gainNode
          audioCtxRef.current = audioCtx
          onReady?.()
        })
        ws.on('timeupdate', (t: number) => onTimeUpdate?.(t))
        ws.on('finish', () => onFinish?.())
      }

      init()

      return () => {
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        gainRef.current = null
        ws?.destroy()
        wsRef.current = null
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url])

    return <div ref={containerRef} className="w-full" />
  }
)

WaveTrack.displayName = 'WaveTrack'
export default WaveTrack
