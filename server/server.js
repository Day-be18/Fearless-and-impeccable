import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'templates.json');

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, '[]', 'utf8');
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  await ensureDb();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// List templates
app.get('/templates', async (_req, res) => {
  const items = await readDb();
  res.json(items);
});

// Create template
app.post('/templates', async (req, res) => {
  const { name, category, content, favorite } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
  const now = new Date().toISOString();
  const item = {
    id: nanoid(),
    name,
    category: category || 'Без категории',
    content,
    favorite: Boolean(favorite),
    dateCreated: now,
    dateModified: now
  };
  const items = await readDb();
  items.push(item);
  await writeDb(items);
  res.status(201).json(item);
});

// Update template
app.put('/templates/:id', async (req, res) => {
  const id = req.params.id;
  const { name, category, content, favorite } = req.body || {};
  const items = await readDb();
  const idx = items.findIndex(t => String(t.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const updated = {
    ...items[idx],
    ...(name !== undefined ? { name } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(favorite !== undefined ? { favorite: Boolean(favorite) } : {}),
    dateModified: new Date().toISOString()
  };
  items[idx] = updated;
  await writeDb(items);
  res.json(updated);
});

// Delete template
app.delete('/templates/:id', async (req, res) => {
  const id = req.params.id;
  const items = await readDb();
  const next = items.filter(t => String(t.id) !== String(id));
  await writeDb(next);
  res.json({ ok: true });
});

// Bulk import from TXT
app.post('/templates/import-txt', async (req, res) => {
  const { txt, defaultCategory } = req.body || {};
  if (!txt || typeof txt !== 'string') return res.status(400).json({ error: 'txt required' });
  const EOL = /\r?\n/;
  const blocks = txt.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const nowIso = () => new Date().toISOString();
  const parsed = blocks.map((block, index) => {
    const lines = block.split(EOL);
    let name = lines[0]?.trim() || `Шаблон ${index + 1}`;
    let content = lines.slice(1).join('\n').trim();
    if (!content) { content = name; name = `Шаблон ${index + 1}`; }
    return { id: nanoid(), name, category: defaultCategory || 'Импортировано', content, favorite: false, dateCreated: nowIso(), dateModified: nowIso() };
  });
  const items = await readDb();
  items.push(...parsed);
  await writeDb(items);
  res.json({ imported: parsed.length });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Templates API listening on http://localhost:${PORT}`);
});


