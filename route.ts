'use client'
import { useState } from 'react'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setDownloadUrl('')
    const formData = new FormData(e.currentTarget)
    const res = await fetch('/api/match', { method: 'POST', body: formData })
    const blob = await res.blob()
    setDownloadUrl(URL.createObjectURL(blob))
    setLoading(false)
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h1>LightAO v1 - Match CCTP → DPGF</h1>
      <form onSubmit={handleSubmit}>
        <p><b>1. CCTP.docx</b><br/><input type="file" name="cctp" accept=".docx" required /></p>
        <p><b>2. DPGF.xlsx</b><br/><input type="file" name="dpgf" accept=".xlsx" required /></p>
        <button disabled={loading} style={{ padding: '10px 20px' }}>
          {loading? 'Traitement en cours...' : 'Lancer le matching'}
        </button>
      </form>
      {downloadUrl && <p style={{ marginTop: 20 }}>
        <a href={downloadUrl} download="DPGF_matché.xlsx">📥 Télécharger le DPGF matché</a>
      </p>}
    </main>
  )
}