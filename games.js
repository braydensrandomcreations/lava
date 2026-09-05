// ========== GAMES ==========
  let games = [];

  async function loadGames(){
    try {
      const res = await fetch('/api/games');
      if(!res.ok) throw new Error('Failed to load games');
      return await res.json();
    } catch(e) {
      console.error('[Games] load failed', e);
      return [];
    }
  }

  function initials(title){
    return title.trim().slice(0, 2).toUpperCase();
  }

  function renderGames(filterText){
    const q = (filterText || '').trim().toLowerCase();
    const filtered = games.filter(g =>
      !q || g.title.toLowerCase().includes(q) || (g.tag || '').toLowerCase().includes(q)
    );

    gamesGrid.innerHTML = '';

    if(games.length === 0){
      gamesEmpty.style.display = 'flex';
      gamesEmptyText.textContent = 'no games yet — add a folder or file to get started';
      return;
    }
    if(filtered.length === 0){
      gamesEmpty.style.display = 'flex';
      gamesEmptyText.textContent = 'no games match "' + filterText + '"';
      return;
    }
    gamesEmpty.style.display = 'none';

    filtered.forEach(g => {
      const card = document.createElement('div');
      card.className = 'game-card';

      const thumb = document.createElement('div');
      thumb.className = 'game-thumb';
      if(g.thumbUrl){
        thumb.style.backgroundImage = 'url(' + JSON.stringify(g.thumbUrl).slice(1,-1) + ')';
      } else {
        thumb.textContent = initials(g.title);
      }

      const info = document.createElement('div');
      info.className = 'game-info';
      const title = document.createElement('div');
      title.className = 'game-title';
      title.textContent = g.title;
      info.appendChild(title);

      const tag = document.createElement('div');
      tag.className = 'game-tag';
      tag.textContent = g.tag || '';
      info.appendChild(tag);

      const del = document.createElement('button');
      del.className = 'game-delete';
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove ' + g.title);
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if(confirm('Remove "' + g.title + '"?')){
          try {
            const res = await fetch('/api/games/' + encodeURIComponent(g.id), { method: 'DELETE' });
            if(!res.ok) throw new Error('Delete failed');
            games = games.filter(x => x.id !== g.id);
            renderGames(gamesSearch.value);
          } catch(err) {
            console.error('[Games] delete failed', err);
            alert('Failed to remove "' + g.title + '". Please try again.');
          }
        }
      });

      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(del);
      card.addEventListener('click', () => playGame(g));

      gamesGrid.appendChild(card);
    });
  }

  function playGame(g){
    playerTitle.textContent = g.title;
    const playUrl = g.playUrl;

    if (!playUrl) {
      alert('This game has no playable file.');
      return;
    }

    playerNewTab.href = playUrl;
    gameFrame.style.display = 'block';
    gameFrame.src = playUrl;
    gamePlayer.classList.add('open');
  }

  function stopGame(){
    gamePlayer.classList.remove('open');
    gameFrame.src = 'about:blank';
  }

  btnPlayerBack.addEventListener('click', stopGame);

  async function openGames(){
    closeAllPanels();
    stopGame();
    gamesPanel.classList.add('open');
    setActiveNav('games');
    games = await loadGames();
    renderGames(gamesSearch.value);
  }

  function closeGames(){
    gamesPanel.classList.remove('open');
    setActiveNav('home');
  }

  navGames.addEventListener('click', openGames);
  btnCloseGames.addEventListener('click', closeGames);

  gamesSearch.addEventListener('input', () => renderGames(gamesSearch.value));

  function openAddGameModal(){
    addGameForm.reset();
    addGameModal.classList.add('open');
    gameTitleInput.focus();
  }
  function closeAddGameModal(){
    addGameModal.classList.remove('open');
  }

  btnAddGame.addEventListener('click', openAddGameModal);
  btnCancelAdd.addEventListener('click', closeAddGameModal);
  addGameModal.addEventListener('click', (e) => {
    if(e.target === addGameModal) closeAddGameModal();
  });

  // Handle local folder and local HTML file selection — uploads the files to the server
  addGameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = gameTitleInput.value.trim();
    const folderInput = document.getElementById('gameFolderInput');
    const fileInput = document.getElementById('gameFileInput');
    const thumbUrl = gameThumbInput.value.trim();
    const tag = gameTagInput.value.trim();

    if(!title) return;

    // Prefer a full folder selection (keeps all assets: css/js/images alongside the html).
    // Fall back to a single file selection.
    let fileList = [];
    if(folderInput.files.length > 0){
      fileList = Array.from(folderInput.files);
    } else if(fileInput.files.length > 0){
      fileList = Array.from(fileInput.files);
    }

    if(fileList.length === 0){
      alert('Please select a valid game folder or HTML file.');
      return;
    }

    // The server expects one 'files' entry per file, plus a matching 'paths' entry
    // with that file's relative path (it strips the top-level folder name itself,
    // so a single flat file just needs its own filename as the path).
    const formData = new FormData();
    formData.append('title', title);
    formData.append('tag', tag);
    formData.append('thumbUrl', thumbUrl);

    fileList.forEach(file => {
      formData.append('files', file);
      formData.append('paths', file.webkitRelativePath || file.name);
    });

    const submitBtn = addGameForm.querySelector('[type="submit"]');
    if(submitBtn){ submitBtn.disabled = true; }

    try {
      const res = await fetch('/api/games', { method: 'POST', body: formData });
      if(!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if(!data.success){ throw new Error(data.error || 'Upload failed'); }

      games.push(data.game);
      closeAddGameModal();
      renderGames(gamesSearch.value);
    } catch(err) {
      console.error('[Games] upload failed', err);
      alert('Failed to add the game. Please check your files and try again.');
    } finally {
      if(submitBtn){ submitBtn.disabled = false; }
    }
  });

  // Initial load
  (async () => {
    games = await loadGames();
    renderGames('');
  })();