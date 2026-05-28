'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'

import en from '../../messages/en.json'
import fr from '../../messages/fr.json'
import es from '../../messages/es.json'
import ptBR from '../../messages/pt-BR.json'
import de from '../../messages/de.json'
import ja from '../../messages/ja.json'

export const LOCALES = ['en', 'fr', 'es', 'pt-BR', 'de', 'ja'] as const
export type Locale = (typeof LOCALES)[number]

const MESSAGES: Record<Locale, AbstractIntlMessages> = {
  en: en as AbstractIntlMessages,
  fr: fr as AbstractIntlMessages,
  es: es as AbstractIntlMessages,
  'pt-BR': ptBR as AbstractIntlMessages,
  de: de as AbstractIntlMessages,
  ja: ja as AbstractIntlMessages,
}

type LocaleContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
})

export function useLocaleContext() {
  return useContext(LocaleContext)
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const stored = localStorage.getItem('stemcut-locale') as Locale | null
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      setLocaleState(stored)
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('stemcut-locale', l)
    document.documentElement.lang = l
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}
