import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('START');
  try {
    const formData = await req.formData();
    const dpgfFile = formData.get('dpgf') as File;

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const designations = (dpgfData as any[])
     .map(lot => lot['Désignation'] || lot['Designation'] || lot['Libellé'] || '')
     .filter(Boolean)
     .slice(0, 5); // MAX 5 LIGNES POUR TEST

    console.log('Nb designations:', designations.length);

    if (!process.env.GROQ_API_KEY) {
      console.log('ERREUR: GROQ_API_KEY manquante');
      return NextResponse.json({ error: 'API key manquante' }, { status: 500 });
    }

    console.log('Call Groq...');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Réponds en JSON: {"resultats":[{"prix":"450€/m²"}]}',
          },
          {
            role: 'user',
            content: `Prix HT pour: ${JSON.stringify(designations)}`,
          },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });

    console.log('Groq status:', res.status);
    const data = await res.json();
    console.log('Groq raw:', JSON.stringify(data).slice(0, 200));

    const content = data.choices[0].message.content;
    const prixData = JSON.parse(content);
    console.log('Groq parse OK');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    designations.forEach((d, i) => {
      const prix = prixData.resultats?.[i]?.prix || 'N/A';
      page.drawText(`${d} : ${prix}`, { x: 50, y, size: 11, font });
      y -= 20;
    });

    const pdfBytes = await pdfDoc.save();
    console.log('PDF OK');
    return new NextResponse(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } });

  } catch (error) {
    console.error('ERREUR FINALE:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
