import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cctpFile = formData.get('cctp') as File
    const dpgfFile = formData.get('dpgf') as File

    // Parse CCTP.docx
    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer())
    const { value: cctpText } = await mammoth.extractRawText({ buffer: cctpBuffer })
    
    // Parse DPGF.xlsx
    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer)
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    // Match + recherche prix
    const results = []
    for (const lot of dpgfData as any[]) {
      const designation = lot['Désignation'] || lot['Designation'] || lot['description']
      
      if (!designation) continue

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // moins cher que gpt-4o
        messages: [{
          role: "user", 
          content: `Prix moyen HT en France 2024 pour : ${designation}. Réponds uniquement avec le prix format: 450€/m²`
        }]
      })
      
      results.push({
        lot: lot['Lot'] || lot['lot'],
        designation: designation,
        prixEstime: completion.choices[0].message.content
      })
    }

    return NextResponse.json({ matches: results })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
