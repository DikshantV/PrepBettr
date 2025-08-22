import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { readFile } from 'fs/promises';
import { resumeStorageService } from '@/lib/storage';
import { verifyIdToken } from '@/lib/firebase/admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Auth
    const authHeader = req.headers.authorization;
    let decodedToken: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      decodedToken = await verifyIdToken(idToken);
      if (!decodedToken) return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    } else {
      decodedToken = { uid: 'dev-user-001' };
    }

    // Parse multipart form
    const form = new IncomingForm();
    const { files } = await new Promise<{ files: { file?: File[] } }>((resolve, reject) => {
      form.parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        resolve({ files } as { files: { file?: File[] } });
      });
    });

    const file = files?.file?.[0];
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Validate type and size (max 5MB)
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const mime = file.mimetype || 'application/octet-stream';
    if (!allowed.includes(mime)) return res.status(400).json({ error: 'Only JPEG, PNG, WebP allowed' });
    if (file.size > 5 * 1024 * 1024) return res.status(400).json({ error: 'File too large (max 5MB)' });

    const buffer = await readFile(file.filepath);
    const safeName = (file.originalFilename || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `avatars/${decodedToken.uid}/${Date.now()}-${safeName}`;

    // Use storage abstraction directly
    const service = await (await import('@/lib/storage')).getStorageService();
    const meta = await service.upload(buffer, path, mime);

    // Prefer a time-bound URL
    let url: string = meta.url;
    try {
      url = await service.getPublicUrl(path, { accessType: 'read', expiresIn: 24 * 3600 });
    } catch {
      // fallback to meta.url
    }

    return res.status(200).json({ url, path });
  } catch (error: any) {
    console.error('Avatar upload failed:', error);
    return res.status(500).json({ error: 'Failed to upload profile picture' });
  }
}

