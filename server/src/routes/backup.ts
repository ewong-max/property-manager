import { Router, Request, Response } from 'express';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const router = Router();

function getDataPaths() {
  const isPkg = !!(process as any).pkg;

  if (isPkg) {
    const exeDir = path.dirname(process.execPath);
    return {
      dbPath: path.join(exeDir, 'data.db'),
      uploadsDir: path.join(exeDir, 'uploads'),
    };
  }

  // Dev: DATABASE_URL = "file:./prisma/dev.db", resolved relative to schema.prisma at server/prisma/
  const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const dbRelPath = dbUrl.replace(/^file:/, '');
  const schemaDir = path.join(__dirname, '../../prisma'); // server/src/routes → server/prisma

  return {
    dbPath: path.isAbsolute(dbRelPath)
      ? dbRelPath
      : path.resolve(schemaDir, dbRelPath),
    uploadsDir: path.join(__dirname, '../../uploads'), // server/uploads
  };
}

function addUploadsToZip(zip: AdmZip, uploadsDir: string) {
  if (!fs.existsSync(uploadsDir)) return;

  function walk(dir: string, zipFolder: string) {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'tmp') continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full, `${zipFolder}/${name}`);
      } else {
        zip.addLocalFile(full, zipFolder);
      }
    }
  }

  walk(uploadsDir, 'uploads');
}

// GET /api/backup/download
router.get('/download', (_req: Request, res: Response) => {
  const { dbPath, uploadsDir } = getDataPaths();

  const zip = new AdmZip();

  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, '', 'data.db');
  }

  addUploadsToZip(zip, uploadsDir);

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const filename = `PropertyManager-backup-${date}-${time}.zip`;

  const buffer = zip.toBuffer();
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// POST /api/backup/restore
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

router.post('/restore', upload.single('backup'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No backup file provided' });
  }

  const { dbPath, uploadsDir } = getDataPaths();

  try {
    // Disconnect Prisma so we can safely overwrite the database file
    const { default: prisma } = await import('../lib/prisma');
    await prisma.$disconnect();

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    let dbRestored = false;
    let filesRestored = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      if (entry.entryName === 'data.db') {
        fs.writeFileSync(dbPath, entry.getData());
        dbRestored = true;
      } else if (entry.entryName.startsWith('uploads/')) {
        const relPath = entry.entryName.slice('uploads/'.length);
        if (!relPath) continue;
        const destPath = path.join(uploadsDir, relPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(destPath, entry.getData());
        filesRestored++;
      }
    }

    if (!dbRestored) {
      return res.status(400).json({ error: 'Invalid backup — no database found in ZIP' });
    }

    res.json({
      success: true,
      filesRestored,
      message: `Restore complete. ${filesRestored} attachment${filesRestored !== 1 ? 's' : ''} recovered.`,
    });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Restore failed', detail: String(err) });
  }
});

export default router;
