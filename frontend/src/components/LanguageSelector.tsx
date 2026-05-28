'use client'

import { useLocaleContext, LOCALES, type Locale } from '@/lib/locale'

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  'pt-BR': 'PT',
  de: 'DE',
  ja: 'JA',
}

export default function LanguageSelector() {
  const { locale, setLocale } = useLocaleContext()

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="bg-transparent text-gray-400 hover:text-white text-xs rounded-lg px-2 py-1 outline-none cursor-pointer transition-colors"
      style={{ border: '1px solid #2e2e4e', background: '#0d0d18' }}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} style={{ background: '#111118' }}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  )
}
