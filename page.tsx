'use client'
import { useState } from 'react'

export default function Page() {
  const [cctp, setCctp] = useState<File | null>(null)
  const [dpgf, setDpgf] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cctp ||!dpgf) return alert('Upload CCTP et DPGF')

    setLoading(true)
    const formData = new FormData()
    formData.append('cctp', cctp)
    formData.append('dpgf', dpgf)

    const res = await fetch('/api/match', { method: 'POST', body: formData })

    if (res.ok) {
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'DPGF_matche.xlsx'
      a.click()
    } else {
      alert('Erreur matching')
    }
    setLoading(false)
  }

  return (
    <main style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>LightAO</h1>
      <p>Matche ton CCTP avec ton DPGF en 1 clic</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label>CCTP.docx</label><br/>
          <input type="file" accept=".docx" onChange={e => setCctp(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label>DPGF.xlsx</label><br/>
          <input type="file" accept=".xlsx" onChange={e => setDpgf(e.target.files?.[0] || null)} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '12px', fontSize: '16px', cursor: 'pointer' }}>
          {loading? 'Matching en cours...' : 'Lancer le matching'}
        </button>
      </form>
    </main>
  )
}
