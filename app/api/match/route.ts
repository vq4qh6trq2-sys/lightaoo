import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const cctpFile = formData.get('cctp') as File
    const dpgfFile = formData.get('dpgf') as File

    if (!cctpFile ||!dpgfFile) {
      return NextResponse.json({ error: 'Fichiers manquants' }, { status: 400 })
    }

    // Parse CCTP.docx
    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer())
    await mammoth.extractRawText({ buffer: cctpBuffer })

    // Parse DPGF.xlsx
    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer())
    const workbook = XLSX.read(dpgfBuffer)
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    const results = []
    for (const lot of dpgfData as any[]) {
