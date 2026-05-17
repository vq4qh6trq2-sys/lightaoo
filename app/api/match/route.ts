import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const dpgfFile = formData.get('dpgf') as File

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer)
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    const matches = await Promise.all(
      (dpgfData as any[]).map(async (lot) => {
        const designation = lot['Désignation'] || lot['Designation'] || lot['Libellé']
        if (!designation) return null

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Prix moyen HT France 2024 pour: ${designation}. Réponds uniquement: 450€/m²` }]
        })
        
        return {
          lot: lot['Lot'] || '',
          designation,
          prixEstime: completion.choices[0].message.content
        }
      })
    )

    return NextResponse.json({ matches: matches.filter(Boolean) })
  } catch (e) {
    console.log(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
