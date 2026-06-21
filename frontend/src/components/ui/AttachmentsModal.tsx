import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Download, Trash2, UploadCloud } from 'lucide-react'
import { attachmentsApi } from '../../api'
import type { Attachment } from '../../types'
import Modal from './Modal'

interface Props {
  invoiceId?: number
  paymentId?: number
  expenseId?: number
  label: string
  onClose: () => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentsModal({ invoiceId, paymentId, expenseId, label, onClose }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const params: Record<string, string> = invoiceId !== undefined
    ? { invoice_id: String(invoiceId) }
    : paymentId !== undefined
      ? { payment_id: String(paymentId) }
      : { expense_id: String(expenseId) }

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ['attachments', params],
    queryFn: () => attachmentsApi.list(params),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', params] }),
  })

  const uploadFiles = async (files: File[]) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) return
    setUploading(true)
    try {
      for (const file of pdfs) {
        await attachmentsApi.upload(file, params)
      }
      qc.invalidateQueries({ queryKey: ['attachments', params] })
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files))
  }

  const handleDownload = async (att: Attachment) => {
    const blob = await attachmentsApi.download(att.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = att.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal title={`Attachments — ${label}`} onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-brand-400 bg-brand-50'
              : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
          }`}
        >
          <UploadCloud size={24} className="mx-auto text-gray-300 mb-2" />
          {uploading ? (
            <p className="text-sm text-gray-500">Uploading…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-600">Drop PDFs here or click to browse</p>
              <p className="text-xs text-gray-400 mt-0.5">PDF only · max 20 MB per file</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* File list */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No attachments yet.</p>
        ) : (
          <div className="space-y-1">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5"
              >
                <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 truncate">{att.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(att.size)}</span>
                <button
                  onClick={() => handleDownload(att)}
                  title="Download"
                  className="text-gray-400 hover:text-brand-500 transition-colors"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => deleteMut.mutate(att.id)}
                  title="Delete"
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
