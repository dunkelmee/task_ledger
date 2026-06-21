import { useRef } from 'react'

interface ImageUploadProps {
  value: string
  onChange: (base64: string) => void
  initials: string
  size?: 'sm' | 'md'
}

export default function ImageUpload({ value, onChange, initials, size = 'md' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`${dim} rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center cursor-pointer flex-shrink-0 border-2 border-white shadow-sm`}
      onClick={() => inputRef.current?.click()}
      title="Click to upload image"
    >
      {value
        ? <img src={value} alt="" className="w-full h-full object-cover" />
        : <span className={`text-white font-bold ${textSize}`}>{initials}</span>
      }
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
