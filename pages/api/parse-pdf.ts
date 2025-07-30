import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { readFile, unlink } from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parsePDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath);
    const { default: pdf } = await import('pdf-parse');
    const data = await pdf(dataBuffer);
    return data.text.trim();
  } finally {
    // Clean up the temporary file
    await unlink(filePath).catch(console.error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new IncomingForm();
    const { files } = await new Promise<{ files: { file?: File[] } }>((resolve, reject) => {
      form.parse(req, (err, _, files) => {
        if (err) return reject(err);
        resolve({ files } as { files: { file?: File[] } });
      });
    });

    const file = files?.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!file.mimetype?.includes('pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    const text = await parsePDF(file.filepath);

    if (!text.trim()) {
      return res.status(400).json({ error: 'Could not extract text from PDF' });
    }

    return res.status(200).json({ success: true, text });

  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ error: 'Failed to process PDF', details: errorMessage });
  }
}

