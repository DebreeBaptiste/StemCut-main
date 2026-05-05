"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook métronome synchronisé avec la lecture audio.
 *
 * Utilise le Web Audio API avec du scheduling lookahead pour garantir
 * une précision de timing meilleure que setTimeout/setInterval.
 *
 * @param isPlaying   - l'audio est-il en cours de lecture
 * @param currentTimeRef - ref vers le temps audio courant (mis à jour en dehors)
 * @param bpm         - tempo en battements par minute (0 = désactivé)
 * @param speed       - vitesse de lecture (ex: 0.75, 1, 1.25)
 * @param firstBeat   - offset du premier temps dans l'audio (secondes)
 */
export function useMetronome(
  isPlaying: boolean,
  currentTimeRef: React.RefObject<number>,
  bpm: number,
  speed: number,
  firstBeat: number = 0,
) {
  const [enabled, setEnabled] = useState(false);
  const [metroVolume, setMetroVolume] = useState(0.6);

  // Refs for values accessed inside rAF closure (avoid stale closures)
  const enabledRef = useRef(false);
  const metroVolumeRef = useRef(0.6);
  const bpmRef = useRef(bpm);
  const speedRef = useRef(speed);
  const firstBeatRef = useRef(firstBeat);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    metroVolumeRef.current = metroVolume;
  }, [metroVolume]);
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    firstBeatRef.current = firstBeat;
  }, [firstBeat]);

  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const nextBeatRef = useRef(0); // prochain beat en temps AudioContext
  const syncRef = useRef({ audioTime: 0, ctxTime: 0 }); // point de sync

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    return ctxRef.current;
  }, []);

  /** Joue un court clic à l'instant `when` (temps AudioContext). */
  const scheduleClick = useCallback(
    (ctx: AudioContext, when: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(vol, when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
      osc.start(when);
      osc.stop(when + 0.06);
    },
    [],
  );

  /**
   * Recalcule la position du prochain beat à partir du temps audio courant.
   * Tient compte de l'offset `firstBeat` pour aligner la phase.
   */
  const syncMetronome = useCallback((audioTime: number, ctx: AudioContext) => {
    const b = bpmRef.current;
    const s = speedRef.current;
    const fb = firstBeatRef.current;
    if (b <= 0) return;

    const beatIntervalAudio = 60 / b; // durée d'un beat à vitesse normale
    const beatIntervalCtx = beatIntervalAudio / s; // durée ajustée à la vitesse de lecture

    const relTime = audioTime - fb; // temps relatif au premier beat détecté
    const phase =
      ((relTime % beatIntervalAudio) + beatIntervalAudio) % beatIntervalAudio;
    const timeToNextBeat = (beatIntervalAudio - phase) / s;

    syncRef.current = { audioTime, ctxTime: ctx.currentTime };
    nextBeatRef.current = ctx.currentTime + Math.max(0.005, timeToNextBeat);
    // Stocke aussi l'intervalle courant pour éviter de le recalculer dans la boucle
    (nextBeatRef as unknown as { interval: number }).interval = beatIntervalCtx;
  }, []);

  useEffect(() => {
    if (!isPlaying || !enabled || bpm <= 0) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();

    syncMetronome(currentTimeRef.current ?? 0, ctx);

    const LOOKAHEAD = 0.15; // planifier 150 ms à l'avance

    const frame = () => {
      if (!enabledRef.current) return;

      const b = bpmRef.current;
      const s = speedRef.current;
      const now = ctx.currentTime;

      // Détection de seek : comparer temps estimé vs temps réel
      const elapsed = (now - syncRef.current.ctxTime) * s;
      const estimatedAudio = syncRef.current.audioTime + elapsed;
      const actualAudio = currentTimeRef.current ?? 0;

      if (Math.abs(actualAudio - estimatedAudio) > 0.4) {
        syncMetronome(actualAudio, ctx);
      }

      // Planifier les prochains beats dans la fenêtre lookahead
      const beatIntervalCtx = 60 / b / s;
      while (nextBeatRef.current < now + LOOKAHEAD) {
        if (nextBeatRef.current >= now - 0.01) {
          scheduleClick(ctx, nextBeatRef.current, metroVolumeRef.current);
        }
        nextBeatRef.current += beatIntervalCtx;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [
    isPlaying,
    enabled,
    bpm,
    speed,
    getCtx,
    syncMetronome,
    scheduleClick,
    currentTimeRef,
  ]);

  // Libération de l'AudioContext au démontage
  useEffect(() => {
    return () => {
      ctxRef.current?.close();
    };
  }, []);

  return {
    metroEnabled: enabled,
    setMetroEnabled: setEnabled,
    metroVolume,
    setMetroVolume,
  };
}
