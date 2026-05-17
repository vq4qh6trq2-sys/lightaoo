'use client'
import { useState } from 'react'

type Match = {
  lot: string
  designation: string
  prixEstime: string
}

export default function Page() {
  const [cctp, setCctp] = useState<File | null>(null)
  const [dpgf, setDpgf] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cctp ||!dpgf) return alert('Upload CCTP et DPGF')

    setLoading(true)
    setMatches([])
    const formData = new FormData()
    formData.append('cctp', cctp)
    formData.append('dpgf', dpgf)

    const res = await fetch('/api/match', { method: 'POST', body: formData })

    if (res.ok) {
      const data = await res.json()
      setMatches(data.matches)
    } else {
      alert('Erreur matching')
    }
    setLoading(false)
  }

  return (
    <main style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>LightAO</h1>
      <p>Matche ton CCTP avec ton DPGF + prix moyens web</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        <div>
          <label>CCTP.docx</label><br/>
          <input type="file" accept=".docx" onChange={e => setCctp(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label>DPGF.xlsx</label><br/>
          <input type="file" accept=".xlsx" onChange={e => setDpgf(e.target.files?.[0] || null)} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '12px', fontSize: '16px', cursor: 'pointer' }}>
          {loading? 'Recherche des prix...' : 'Lancer le matching'}
        </button>
      </form>

      {matches.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Lot</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Désignation</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Prix estimé HT</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{m.lot}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{m.designation}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{m.prixEstime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
