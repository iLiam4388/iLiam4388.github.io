// Shared renderer for videos.json and photos.json.
// Entries need a title, a video/image path, and an optional download path.
(async function () {
  const grid = document.getElementById('gallery');
  const status = document.getElementById('gallery-status');
  const kind = document.body.dataset.gallery;
  const config = kind === 'videos' ? {file:'videos.json',key:'video'} : {file:'photos.json',key:'image'};
  try {
    const response = await fetch(config.file, {cache:'no-cache'});
    if (!response.ok) throw new Error('Could not load '+config.file+' ('+response.status+')');
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error(config.file+' must contain a JSON array');
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      if (!item || typeof item[config.key] !== 'string' || !item[config.key].trim()) continue;
      const path = item[config.key];
      const card = document.createElement('article');
      card.className = 'card';
      const mediaBox = document.createElement('div');
      mediaBox.className = 'media';
      const media = document.createElement(kind === 'videos' ? 'video' : 'img');
      media.src = path;
      if (kind === 'videos') {
        media.controls = true;
        media.preload = 'metadata';
        media.playsInline = true;
      } else {
        media.loading = 'lazy';
        media.alt = item.title || 'iLiam photo';
      }
      mediaBox.append(media);
      const title = document.createElement('div');
      title.className = 'file-name';
      title.textContent = item.title || path.split('/').pop();
      const download = document.createElement('a');
      download.className = 'download-btn';
      download.href = item.download || path;
      download.setAttribute('download','');
      download.textContent = 'DOWNLOAD';
      card.append(mediaBox,title,download);
      fragment.append(card);
    }
    grid.append(fragment);
    status.textContent = grid.children.length ? '' : 'No items yet.';
  } catch (error) {
    console.error('iLiam gallery error:',error);
    status.textContent = 'The gallery could not load. Please refresh the page.';
  }
})();
