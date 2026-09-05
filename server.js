const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Local Folder Setup
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const TEMP_DIR = path.join(__dirname, 'temp');
const GAMES_FILE = path.join(__dirname, 'games.json');

// Ensure local folders exist
fs.ensureDirSync(PUBLIC_DIR);
fs.ensureDirSync(UPLOADS_DIR);
fs.ensureDirSync(TEMP_DIR);

const upload = multer({ dest: TEMP_DIR });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Helper: Format image URLs properly
function formatImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

// Helper: Auto-search internet for game icon/cover
async function autoFetchThumbnail(title) {
  if (!title) return '';
  console.log(`[Auto-Thumb] Searching for "${title}"...`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  try {
    const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(title + ' video game')}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json`;
    const wikiRes = await fetch(wikiApiUrl, { headers });

    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const pages = wikiData.query?.pages;

      if (pages) {
        const firstPage = Object.values(pages)[0];
        let imageUrl = firstPage?.thumbnail?.source;

        if (imageUrl) {
          imageUrl = formatImageUrl(imageUrl);
          const imgRes = await fetch(imageUrl, { headers });
          if (imgRes.ok) {
            const contentType = imgRes.headers.get('content-type') || '';
            let ext = path.extname(imageUrl.split('?')[0]);
            if (!ext || ext.length > 5) {
              ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.png';
            }

            const filename = `thumb-auto-${Date.now()}${ext}`;
            const destPath = path.join(UPLOADS_DIR, filename);
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            await fs.writeFile(destPath, buffer);
            return `/uploads/${filename}`;
          }
        }
      }
    }

    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(title + ' video game')}&format=json`;
    const ddgRes = await fetch(ddgUrl, { headers });

    if (ddgRes.ok) {
      const ddgData = await ddgRes.json();
      if (ddgData.Image) {
        let imgUrl = formatImageUrl(ddgData.Image);
        const imgRes = await fetch(imgUrl, { headers });

        if (imgRes.ok) {
          const filename = `thumb-auto-${Date.now()}.png`;
          const destPath = path.join(UPLOADS_DIR, filename);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          await fs.writeFile(destPath, buffer);
          return `/uploads/${filename}`;
        }
      }
    }
  } catch (err) {
    console.error(`[Auto-Thumb Error]`, err.message);
  }

  return '';
}

// Helpers for JSON + Auto-Directory Scanner

// Plain read of games.json — no filesystem scanning.
// Use this everywhere EXCEPT the GET /api/games route, so that adding/updating/
// deleting a game never triggers the uploads-folder scan (which would otherwise
// auto-index a brand-new game's folder before its real entry is saved, creating
// a duplicate with the folder/id as the title).
async function readGamesFile() {
  try {
    return await fs.readJson(GAMES_FILE);
  } catch {
    return [];
  }
}

async function getGames() {
  let games = await readGamesFile();

  // Automatically scan /public/uploads for unindexed game folders
  try {
    const items = await fs.readdir(UPLOADS_DIR);
    let updated = false;

    for (const item of items) {
      const itemPath = path.join(UPLOADS_DIR, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        const alreadyIndexed = games.some(g => g.id === item || (g.playUrl && g.playUrl.includes(`/${item}/`)));
        
        if (!alreadyIndexed) {
          const subFiles = await fs.readdir(itemPath);
          const htmlFile = subFiles.find(f => f.toLowerCase().endsWith('.html')) || 'index.html';
          
          const cleanTitle = item.replace(/^game-/, '').replace(/[-_]/g, ' ');
          
          games.push({
            id: item,
            title: cleanTitle,
            thumbUrl: '',
            tag: '',
            playUrl: `/uploads/${item}/${htmlFile}`
          });
          updated = true;
        }
      }
    }

    if (updated) {
      await saveGames(games);
    }
  } catch (err) {
    console.error('[Scanner Error]', err);
  }

  return games;
}

async function saveGames(games) {
  await fs.writeJson(GAMES_FILE, games, { spaces: 2 });
}

// GET all games
app.get('/api/games', async (req, res) => {
  try {
    const games = await getGames();
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// POST add game
app.post('/api/games', upload.array('files'), async (req, res) => {
  try {
    const { title } = req.body;
    const tag = typeof req.body.tag === 'string' ? req.body.tag.trim() : '';
    let thumbUrl = req.body.thumbUrl || '';
    let paths = req.body.paths || [];
    if (!Array.isArray(paths)) paths = [paths];

    const gameId = 'game-' + Date.now();
    const gameFolder = path.join(UPLOADS_DIR, gameId);
    await fs.ensureDir(gameFolder);

    let playUrl = '';

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const relPath = paths[i] || file.originalname;
        const pathParts = relPath.split('/').filter(Boolean);
        const cleanRelPath = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts[0];

        const destPath = path.join(gameFolder, cleanRelPath);
        await fs.ensureDir(path.dirname(destPath));
        await fs.move(file.path, destPath, { overwrite: true });

        if (cleanRelPath.toLowerCase() === 'index.html' || (!playUrl && cleanRelPath.endsWith('.html'))) {
          playUrl = `/uploads/${gameId}/${cleanRelPath}`;
        }
      }
    }

    if (!playUrl) playUrl = `/uploads/${gameId}/index.html`;

    if (!thumbUrl) {
      thumbUrl = await autoFetchThumbnail(title);
    }

    const newGame = {
      id: gameId,
      title: title || 'Untitled Game',
      thumbUrl,
      tag,
      playUrl
    };

    const games = await readGamesFile();
    games.push(newGame);
    await saveGames(games);

    await fs.emptyDir(TEMP_DIR);
    res.json({ success: true, game: newGame });
  } catch (err) {
    console.error('Error adding game:', err);
    res.status(500).json({ error: 'Failed to add game' });
  }
});

// PUT update game
app.put('/api/games/:id', upload.single('thumbFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, thumbUrl, tag, autoFetch } = req.body;

    let games = await readGamesFile();
    const gameIndex = games.findIndex(g => g.id === id);

    if (gameIndex === -1) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (title) games[gameIndex].title = title;
    games[gameIndex].tag = typeof tag === 'string' ? tag.trim() : (games[gameIndex].tag || '');

    if (req.file) {
      const thumbFilename = `thumb-${Date.now()}${path.extname(req.file.originalname)}`;
      const destPath = path.join(UPLOADS_DIR, thumbFilename);
      await fs.move(req.file.path, destPath, { overwrite: true });
      games[gameIndex].thumbUrl = `/uploads/${thumbFilename}`;
    } else if (autoFetch === 'true' || autoFetch === true) {
      const fetched = await autoFetchThumbnail(games[gameIndex].title);
      if (fetched) games[gameIndex].thumbUrl = fetched;
    } else if (thumbUrl !== undefined && thumbUrl !== '') {
      games[gameIndex].thumbUrl = thumbUrl;
    }

    await saveGames(games);
    await fs.emptyDir(TEMP_DIR);
    res.json({ success: true, game: games[gameIndex] });
  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ error: 'Failed to update game data' });
  }
});

// DELETE game
app.delete('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let games = await readGamesFile();
    games = games.filter(g => g.id !== id);
    await saveGames(games);

    const gameFolder = path.join(UPLOADS_DIR, id);
    await fs.remove(gameFolder);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting game:', err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Explicit Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Express 5 Safe Catch-all
app.use((req, res) => {
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running locally at http://localhost:${PORT}`);
});