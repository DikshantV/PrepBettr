import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { parseResume } from '@/lib/utils/parseResume';
import { ParseResumeResponse } from '@/types/auto-apply';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(process.cwd(), '/uploads');
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing the files:', err);
      return res.status(500).json({ message: 'Error parsing the files' });
    }

    const file = files.file as formidable.File;

    try {
      const response: ParseResumeResponse = await parseResume(file.filepath);
      res.status(200).json(response);
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ message: 'Error processing file' });
    } finally {
      fs.unlinkSync(file.filepath); // Remove file after parsing
    }
  });
}

