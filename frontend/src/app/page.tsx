'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('home');
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
      setProgressMsg(t('processingInit'));
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
              setError(data.message || t('errorGeneric'));
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
          err instanceof Error ? err.message : t('errorGeneric'),
        );
      }
    },
    [router, t],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('audio')) {
        setError(t('errorFormat'));
        return;
      }
      startProcessing(() => uploadFile(file));
    },
    [startProcessing, t],
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
            {t('heroPrefix')}{' '}
            <span className='bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent'>
              {t('heroHighlight')}
            </span>
            <br />
            {t('heroSuffix')}
          </h1>
        </div>

        {/* Processing state */}
        {state === 'processing' ? (
          <div
            className='w-full max-w-lg rounded-2xl p-8'
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <p className='text-center text-gray-300 mb-5 font-medium'>
              {progressMsg || t('processingDefault')}
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
              {t('processingHint')}
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
                {t('dropzoneLabel')}
              </p>
              <p className='text-gray-500 text-sm'>
                {t('dropzoneHint')}
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
                {t('youtubeLabel')}
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
                  {t('youtubeButton')}
                </button>
              </div>
            </div>

            {error && (
              <p className='mt-4 text-red-400 text-sm text-center'>{error}</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
