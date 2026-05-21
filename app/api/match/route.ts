import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const maxDuration = 60; // On passe à 60s au lieu de 10s

export async function POST(req: NextRequest) {
  console.log('START');
  try {
    const formData = await req.formData();
    const dpgfFile = formData.get('dpgf') as File;
    if (!dpgfFile) return NextResponse.json({ error: 'DPGF manquant' }, { status: 400 });

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    console.log('Excel lu:', dpgfData.length, 'lignes');

    const designations = (dpgfData as any[])
     .map(lot => lot['Désignation'] || lot['Designation'] || lot['Libellé'] || '')
     .filter(Boolean)
     .slice(0, 20); // On limite à 20 lignes pour tester

    console.log('Call Groq...');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Plus rapide que mixtral
        messages: [
          {
            role: 'system',
            content: 'Tu es économiste BTP. Réponds en JSON: {"resultats":[{"prix":"450€/m²"}]}',
          },
          {
            role: 'user',
            content: `Prix HT pour: ${JSON.stringify(designations)}`,
          },
        ],
        temperature: 0,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    console.log('Groq status:', res.status);
    const data = await res.json();
    const prixData = JSON.parse(data.choices[0].message.content);
    console.log('Groq OK');

    const results = designations.map((d, i) => ({
      lot: '',
      designation: d,
      prixEstime: prixData.resultats?.[i]?.prix || 'N/A',
    }));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    for (const r of results) {
      page.drawText(`${r.designation} : ${r.prixEstime}`, { x: 50, y, size: 11, font });
      y -= 20;
    }

    const pdfBytes = await pdfDoc.save();
    console.log('PDF OK');

    return new NextResponse(pdfBytes, {
      headers: { 'Content-Type': 'application/pdf' },
    });
  } catch (error) {
    console.error('ERREUR:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
