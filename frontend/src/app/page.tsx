'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Drum,
  Music,
  Piano,
  CloudUpload,
  Youtube,
  Scissors,
  Repeat,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { uploadFile, importYoutube } from '@/lib/api';

type State = 'idle' | 'processing';

const BADGES = [
  { icon: Mic, label: 'Voix' },
  { icon: Drum, label: 'Batterie' },
  { icon: Music, label: 'Basse' },
  { icon: Piano, label: 'Autres' },
];

const FEATURES = [
  {
    icon: Scissors,
    title: '4 stems isolés',
    description:
      'Séparation IA en voix, batterie, basse et instruments. Chaque piste est indépendante.',
    color: '#7c3aed',
  },
  {
    icon: Repeat,
    title: "Boucle d'apprentissage",
    description:
      'Sélectionnez un passage sur la timeline et répétez-le en boucle pour maîtriser un solo.',
    color: '#f59e0b',
  },
  {
    icon: SlidersHorizontal,
    title: 'Mixage par piste',
    description:
      'Volume, mute et solo par stem. Créez votre backing track en quelques clics.',
    color: '#3b82f6',
  },
  {
    icon: Download,
    title: 'Export personnalisé',
    description:
      'Téléchargez votre mix sans les pistes de votre choix, directement en MP3.',
    color: '#22c55e',
  },
];

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const startProcessing = useCallback(
    async (fn: () => Promise<{ job_id: string }>) => {
      setState('processing');
      setProgress(0);
      setProgressMsg('Initialisation...');
      setError('');

      try {
        const { job_id } = await fn();

        const pollStatus = async () => {
          try {
            const res = await fetch(`/api/status/${job_id}`);
            if (!res.ok) throw new Error('Status fetch failed');
            const data: { status: string; progress: number; message: string } =
              await res.json();

            setProgress(data.progress ?? 0);
            setProgressMsg(data.message ?? '');

            if (data.status === 'completed') {
              router.push(`/mixer/${job_id}`);
            } else if (data.status === 'error') {
              setState('idle');
              setProgress(0);
              setError(data.message || 'Une erreur est survenue');
            } else {
              setTimeout(pollStatus, 1000);
            }
          } catch {
            setTimeout(pollStatus, 2000);
          }
        };

        setTimeout(pollStatus, 500);
      } catch (err: unknown) {
        setState('idle');
        setProgress(0);
        setError(
          err instanceof Error ? err.message : 'Une erreur est survenue',
        );
      }
    },
    [router],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('audio')) {
        setError('Format non supporté. Utilisez MP3, WAV ou FLAC.');
        return;
      }
      startProcessing(() => uploadFile(file));
    },
    [startProcessing],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleYoutubeImport = useCallback(() => {
    if (!ytUrl.trim()) return;
    startProcessing(() => importYoutube(ytUrl.trim()));
  }, [ytUrl, startProcessing]);

  return (
    <div
      className='min-h-screen'
      style={{
        background:
          'radial-gradient(ellipse at 50% 60%, #1a0a2e 0%, #0a0a12 60%)',
      }}
    >
      <Navbar />

      <main className='flex flex-col items-center pt-32 pb-20 px-4'>
        {/* Hero */}
        <div className='text-center mb-10 max-w-xl'>
          <h1 className='text-5xl font-extrabold leading-tight mb-4'>
            Isolez chaque{' '}
            <span className='bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent'>
              instrument
            </span>
            <br />
            de vos morceaux
          </h1>
          <p className='text-gray-400 text-base leading-relaxed'>
            StemCut sépare vos pistes audio en 4 stems : voix, batterie, basse
            et instruments. Parfait pour pratiquer, remixer ou créer des backing
            tracks.
          </p>
        </div>

        {/* Badges */}
        <div className='flex flex-wrap justify-center gap-3 mb-10'>
          {BADGES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className='flex items-center gap-2 px-4 py-2 rounded-full text-sm text-gray-300'
              style={{ background: '#1a1a28', border: '1px solid #2e2e4e' }}
            >
              <Icon size={14} className='text-violet-400' />
              {label}
            </span>
          ))}
        </div>

        {/* Processing state */}
        {state === 'processing' ? (
          <div
            className='w-full max-w-lg rounded-2xl p-8'
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <p className='text-center text-gray-300 mb-5 font-medium'>
              {progressMsg || 'Séparation des stems avec Demucs...'}
            </p>
            <div
              className='w-full h-2 rounded-full mb-3'
              style={{ background: '#2e2e4e' }}
            >
              <div
                className='h-2 rounded-full transition-all duration-500'
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(to right, #7c3aed, #d946ef)',
                }}
              />
            </div>
            <p className='text-center text-gray-500 text-sm'>{progress}%</p>
            <p className='text-center text-gray-600 text-xs mt-3'>
              Cela peut prendre 1 à 5 minutes selon votre machine
            </p>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              className='w-full max-w-lg rounded-2xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 mb-5'
              style={{
                border: `2px dashed ${isDragging ? '#7c3aed' : '#2e2e4e'}`,
                background: isDragging
                  ? 'rgba(124,58,237,0.05)'
                  : 'transparent',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div
                className='w-14 h-14 rounded-2xl flex items-center justify-center'
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #d946ef)',
                }}
              >
                <CloudUpload size={24} className='text-white' />
              </div>
              <p className='text-white font-medium'>
                Glissez-déposez un fichier audio
              </p>
              <p className='text-gray-500 text-sm'>
                MP3, WAV, FLAC • Traitement via Demucs
              </p>
              <input
                ref={fileInputRef}
                type='file'
                accept='audio/*'
                className='hidden'
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            </div>

            {/* YouTube import */}
            <div
              className='w-full max-w-lg rounded-2xl p-5'
              style={{ background: '#111118', border: '1px solid #1e1e2e' }}
            >
              <p className='text-gray-500 text-xs mb-3 flex items-center gap-2'>
                <Youtube size={14} className='text-red-500' />
                Ou importez depuis YouTube
              </p>
              <div className='flex gap-2'>
                <input
                  type='text'
                  placeholder='https://www.youtube.com/watch?v=...'
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleYoutubeImport()}
                  className='flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none'
                  style={{ background: '#0d0d18', border: '1px solid #2e2e4e' }}
                />
                <button
                  onClick={handleYoutubeImport}
                  disabled={!ytUrl.trim()}
                  className='px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity'
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #d946ef)',
                  }}
                >
                  Importer
                </button>
              </div>
            </div>

            {error && (
              <p className='mt-4 text-red-400 text-sm text-center'>{error}</p>
            )}
          </>
        )}

        {/* Feature cards */}
        <div className='w-full max-w-lg mt-16'>
          <p className='text-gray-600 text-xs font-medium tracking-widest uppercase text-center mb-6'>
            Fonctionnalités
          </p>
          <div className='grid grid-cols-2 gap-3'>
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className='rounded-2xl p-4 flex flex-col gap-2'
                style={{ background: '#111118', border: '1px solid #1e1e2e' }}
              >
                <div
                  className='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0'
                  style={{ background: `${color}22` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <p className='text-white text-sm font-semibold leading-tight'>
                  {title}
                </p>
                <p className='text-gray-500 text-xs leading-relaxed'>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className='py-8 text-center'
        style={{ borderTop: '1px solid #1e1e2e' }}
      >
        <p className='text-gray-600 text-xs'>
          StemCut — Traitement 100 % local · Aucune donnée partagée
        </p>
      </footer>
    </div>
  );
}
