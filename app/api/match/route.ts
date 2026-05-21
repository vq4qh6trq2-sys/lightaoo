import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('START');
  try {
    const formData = await req.formData();
    const dpgfFile = formData.get('dpgf') as File;
    if (!dpgfFile) return NextResponse.json({ error: 'DPGF manquant' }, { status: 400 });

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const designations = (dpgfData as any[])
    .map(lot => lot['Désignation'] || lot['Designation'] || lot['Libellé'] || lot['Description'] || '')
    .filter(Boolean)
    .slice(0, 5);

    console.log('Nb designations:', designations.length);

    if (!process.env.GROQ_API_KEY) {
      console.log('ERREUR: GROQ_API_KEY manquante');
      return NextResponse.json({ error: 'Clé API Groq manquante sur Vercel' }, { status: 500 });
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
            content: 'Tu es économiste BTP France. Tu réponds UNIQUEMENT en JSON valide. Format exact: {"resultats":[{"prix":"450€/m²"}]}. Aucun texte avant ou après. Pour chaque élément de la liste donnée, donne un prix HT moyen BTP France.',
          },
          {
            role: 'user',
            content: `Liste: ${JSON.stringify(designations)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log('Groq HTTP Error:', res.status, errorText);
      return NextResponse.json({ error: `Groq erreur ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    console.log('Groq raw:', content);

    let prixData;
    try {
      prixData = JSON.parse(content);
    } catch (e) {
      console.log('Groq a pas renvoyé du JSON:', content);
      return NextResponse.json({ error: 'Groq a renvoyé un format invalide. Réessaie.' }, { status: 500 });
    }

    console.log('Groq parse OK');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    page.drawText('DPGF Chiffré - LightAO', { x: 50, y, size: 18, font: fontBold });
    y -= 40;

    designations.forEach((d, i) => {
      const prix = prixData.resultats?.[i]?.prix || 'Non estimé';
      const line = `${d.slice(0, 50)} : ${prix}`;
      page.drawText(line, { x: 50, y, size: 11, font });
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
