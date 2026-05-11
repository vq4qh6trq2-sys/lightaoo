import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Fuse from 'fuse.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cctpFile = formData.get('cctp') as File
    const dpgfFile = formData.get('dpgf') as File

    if (!cctpFile ||!dpgfFile) {
      return NextResponse.json({ error: 'Fichiers manquants' }, { status: 400 })
    }

    // 1. Lire CCTP
    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer())
    const { value: cctpText } = await mammoth.extractRawText({ buffer: cctpBuffer })

    // 2. Extraire lignes CCTP avec n° de lot/article
    const cctpLines = cctpText
     .split('\n')
     .map(l => l.trim())
     .filter(l => l.length > 10 && /^\d/.test(l))

    // 3. Lire DPGF Excel
    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const dpgfData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // 4. Fuzzy matching
    const fuse = new Fuse(cctpLines, { threshold: 0.4, ignoreLocation: true })

    const matchedData = dpgfData.map((row: any[]) => {
      if (!row[0] || row.length === 0) return row

      const libelle = String(row[1] || row[0] || '')
      if (libelle.length < 5) return [...row, '']

      const result = fuse.search(libelle)
      const match = result[0]?.item || ''

      return [...row, match]
    })

    // 5. Ajouter en-tête colonne Match
    if (matchedData[0]) matchedData[0][matchedData[0].length - 1] = 'Match CCTP'

    // 6. Générer Excel
    const newSheet = XLSX.utils.aoa_to_sheet(matchedData)
    const newWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(newWb, newSheet, sheetName)
    const outBuffer = XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(outBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="DPGF_matche.xlsx"'
      }
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
