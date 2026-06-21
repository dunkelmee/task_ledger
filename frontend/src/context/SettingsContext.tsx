import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../api'
import { useAuth } from './AuthContext'
import type { AppSettings } from '../types'

interface SettingsContextValue {
  settings: AppSettings | undefined
  defaultCurrency: string
  ownerFirstName: string
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: undefined,
  defaultCurrency: 'USD',
  ownerFirstName: '',
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60_000,
    enabled: isAuthenticated,
    retry: false,
  })

  const defaultCurrency = settings?.default_currency ?? 'USD'
  const ownerFirstName = settings?.owner_name?.trim().split(/\s+/)[0] ?? ''

  return (
    <SettingsContext.Provider value={{ settings, defaultCurrency, ownerFirstName }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
