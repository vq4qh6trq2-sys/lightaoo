import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cctpFile = formData.get('cctp') as File
    const dpgfFile = formData.get('dpgf') as File

    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer())
    await mammoth.extractRawText({ buffer: cctpBuffer })

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer)
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    const results = []
    for (const lot of dpgfData as any[]) {
      const designation = lot['Désignation'] || lot['Designation'] || lot['Libellé'] || lot['description']
      if (!designation) continue

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ 
            role: 'user', 
            content: `Donne le prix moyen HT constaté en France en 2024 pour: ${designation}. Réponds uniquement avec le prix et l'unité comme 450€/m². Pas de phrase.` 
          }],
          temperature: 0.1
        })
      })

      if (!res.ok) {
        console.error('GROQ ERROR:', await res.text())
        results.push({ lot: lot['Lot'] || '', designation, prixEstime: 'Erreur API' })
        continue
      }

      const data = await res.json()
      const prixEstime = data.choices?.[0]?.message?.content?.trim() || 'N/A'
      
      results.push({
        lot: lot['Lot'] || lot['lot'] || '',
        designation,
        prixEstime
      })
    }

    return NextResponse.json({ matches: results })
  } catch (error) {
    console.error('ERREUR API MATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur', details: String(error) }, { status: 500 })
  }
}
