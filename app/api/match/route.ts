import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cctpFile = formData.get('cctp') as File
    const dpgfFile = formData.get('dpgf') as File

    // Parse CCTP.docx
    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer())
    await mammoth.extractRawText({ buffer: cctpBuffer }) // on parse mais on s'en sert pas encore

    // Parse DPGF.xlsx
    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer)
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    // Prix fake pour tester
    const fakePrices = ['450€/m²', '1800€/U', '120€/ml', '85€/m²', '2500€/U']
    
    const results = []
    for (const lot of dpgfData as any[]) {
      const designation = lot['Désignation'] || lot['Designation'] || lot['Libellé'] || lot['description']
      if (!designation) continue

      // Prix aléatoire pour test
      const prixEstime = fakePrices[Math.floor(Math.random() * fakePrices.length)]
      
      results.push({
        lot: lot['Lot'] || lot['lot'] || '',
        designation: designation,
        prixEstime: prixEstime
      })
    }

    return NextResponse.json({ matches: results })
  } catch (error) {
    console.error('ERREUR API MATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur', details: String(error) }, { status: 500 })
  }
}
