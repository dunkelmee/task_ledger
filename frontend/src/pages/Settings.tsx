import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { settingsApi, authApi } from '../api'
import type { AppSettings } from '../types'
import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { CheckCircle } from 'lucide-react'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF']

const PWD_RULES = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function Settings() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [pwdSaved, setPwdSaved] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>()
  const avatarRef = useRef<HTMLInputElement>(null)

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  const { register, handleSubmit, reset, watch, setValue } = useForm<Omit<AppSettings, 'id' | 'must_change_password'>>()
  const { register: regPwd, handleSubmit: handlePwdSubmit, watch: watchPwd, reset: resetPwd } =
    useForm<{ old_password: string; new_password: string; confirm: string }>()

  useEffect(() => {
    if (settings) {
      reset(settings)
      setAvatarPreview(settings.avatar || undefined)
    }
  }, [settings, reset])

  const updateMut = useMutation({
    mutationFn: (data: unknown) => settingsApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target?.result as string
      setAvatarPreview(base64)
      setValue('avatar', base64)
    }
    reader.readAsDataURL(file)
  }

  const newPwd = watchPwd('new_password', '')
  const allRulesMet = PWD_RULES.every(r => r.test(newPwd))

  const changePwdMut = useMutation({
    mutationFn: ({ old_password, new_password }: { old_password: string; new_password: string }) =>
      authApi.changePassword(old_password, new_password),
    onSuccess: () => {
      setPwdSaved(true)
      setPwdError('')
      resetPwd()
      setTimeout(() => setPwdSaved(false), 2500)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPwdError(detail ?? 'Failed to change password.')
    },
  })

  const onPwdSubmit = (data: { old_password: string; new_password: string; confirm: string }) => {
    setPwdError('')
    if (!allRulesMet) { setPwdError('New password does not meet all requirements.'); return }
    if (data.new_password !== data.confirm) { setPwdError('Passwords do not match.'); return }
    changePwdMut.mutate({ old_password: data.old_password, new_password: data.new_password })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your business profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column — profile + business + finance */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit(d => updateMut.mutate(d))} className="space-y-6">
            {/* Owner & Profile */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-3">Owner &amp; Profile</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center cursor-pointer flex-shrink-0"
                  onClick={() => avatarRef.current?.click()}
                  title="Click to change avatar"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-xl">
                      {(watch('owner_name') || watch('business_name') || 'S').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => avatarRef.current?.click()}
                    className="btn-secondary text-sm px-4 py-2"
                  >
                    Upload photo
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setAvatarPreview(undefined); setValue('avatar', '') }}
                      className="ml-2 text-sm text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF · Max 2MB</p>
                </div>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Owner Name</label>
                  <input {...register('owner_name')} className="input" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="label">Position / Title</label>
                  <input {...register('position')} className="input" placeholder="Graphic Designer" />
                </div>
              </div>
            </div>

            {/* Business info */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-3">Business Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Business Name</label>
                  <input {...register('business_name')} className="input" placeholder="Orely Studio" />
                </div>
                <div>
                  <label className="label">VAT / Tax ID</label>
                  <input {...register('vat_id')} className="input" placeholder="VAT number" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input {...register('business_email')} type="email" className="input" placeholder="hello@studio.com" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input {...register('business_phone')} className="input" placeholder="+1 234 567 890" />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input {...register('business_website')} className="input" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea {...register('business_address')} className="input resize-none" rows={2} />
              </div>
            </div>

            {/* Finance */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-3">Finance &amp; Invoicing</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Default Currency</label>
                  <select {...register('default_currency')} className="input">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Default Tax Rate (%)</label>
                  <input {...register('default_tax_rate', { setValueAs: (v: string) => v === '' ? 0 : Number(v) })} type="number" min="0" step="0.01" className="input" />
                </div>
                <div className="col-span-2">
                  <label className="label">Invoice Number Format</label>
                  <input {...register('invoice_number_format')} className="input" placeholder="INV-{year}-{seq:04d}" />
                  <p className="text-xs text-gray-400 mt-1">Variables: {'{year}'}, {'{seq}'}, {'{seq:04d}'}</p>
                </div>
              </div>
              <div>
                <label className="label">Payment Details (shown on invoices)</label>
                <textarea {...register('payment_details')} className="input resize-none" rows={3} placeholder="Bank: ..., IBAN: ..." />
              </div>
              <div>
                <label className="label">Default Invoice Terms</label>
                <textarea {...register('default_terms')} className="input resize-none" rows={3} placeholder="Payment due within 30 days..." />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button type="submit" className="btn-primary px-8" disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving...' : 'Save Settings'}
              </button>
              {saved && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} />
                  Saved successfully
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Right column — security */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b border-gray-100 pb-3">Security</h2>
          <form onSubmit={handlePwdSubmit(onPwdSubmit)} className="space-y-4">
            <div>
              <label className="label">Current password</label>
              <input {...regPwd('old_password', { required: true })} type="password" className="input" />
            </div>
            <div>
              <label className="label">New password</label>
              <input {...regPwd('new_password', { required: true })} type="password" className="input" />
              <ul className="mt-2 space-y-1">
                {PWD_RULES.map(r => (
                  <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(newPwd) ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{r.test(newPwd) ? '✓' : '○'}</span> {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input {...regPwd('confirm', { required: true })} type="password" className="input" />
            </div>
            {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
            <div className="flex items-center gap-4 flex-wrap">
              <button type="submit" className="btn-primary px-6" disabled={changePwdMut.isPending}>
                {changePwdMut.isPending ? 'Updating...' : 'Change Password'}
              </button>
              {pwdSaved && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} />
                  Password updated
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
