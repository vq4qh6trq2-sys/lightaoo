'use client';
import { useState } from 'react';

export default function Home() {
  const [cctpFile, setCctpFile] = useState<File | null>(null);
  const [dpgfFile, setDpgfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!dpgfFile) {
      alert('Sélectionne au moins le DPGF.xlsx');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (cctpFile) formData.append('cctp', cctpFile);
    formData.append('dpgf', dpgfFile);

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Erreur: ${err.error || 'Serveur'}`);
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dpgf_chiffre.pdf';
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (e) {
      alert('Erreur réseau');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>LightAO</h1>
      <p>Matche ton CCTP avec ton DPGF + prix moyens web</p>

      <div style={{ margin: '20px 0' }}>
        <label>CCTP.docx</label><br />
        <input
          type="file"
          accept=".docx"
          onChange={(e) => setCctpFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ margin: '20px 0' }}>
        <label>DPGF.xlsx</label><br />
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setDpgfFile(e.target.files?.[0] || null)}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: loading? 'wait' : 'pointer',
          width: '100%'
        }}
      >
        {loading? 'Calcul en cours...' : 'Lancer le matching'}
      </button>
    </main>
  );
}
