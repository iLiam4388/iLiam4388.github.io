// Shared JSON-powered cards for Downloads and Store. Uses the Photos/Videos gallery CSS.
(async function () {
  const grid = document.getElementById('gallery');
  const status = document.getElementById('gallery-status');
  const kind = document.body.dataset.gallery;
  const isStore = kind === 'store';
  const source = isStore ? 'store.json' : 'downloads.json';
  try {
    const response = await fetch(source, {cache:'no-cache'});
    if (!response.ok) throw new Error(source + ' HTTP ' + response.status);
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error(source + ' must contain an array');
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      if (!item || typeof item.title !== 'string' || typeof item.image !== 'string') continue;
      const target = isStore ? item.gumroad : item.download;
      if (typeof target !== 'string' || !target.trim()) continue;
      const card = document.createElement('article');
      card.className = 'card';
      const mediaBox = document.createElement('div');
      mediaBox.className = 'media';
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.loading = 'lazy';
      mediaBox.append(img);
      const title = document.createElement('div');
      title.className = 'file-name';
      title.textContent = item.title;
      card.append(mediaBox, title);
      if (isStore) {
        const description = document.createElement('p');
        description.className = 'item-description';
        description.textContent = item.description || '';
        const price = document.createElement('div');
        price.className = 'item-price';
        price.textContent = item.price || '';
        card.append(description, price);
      }
      const action = document.createElement('a');
      action.className = 'download-btn';
      action.href = target;
      action.textContent = isStore ? 'BUY NOW' : 'DOWNLOAD';
      if (isStore) {
        action.target = '_blank';
        action.rel = 'noopener noreferrer';
      } else {
        action.setAttribute('download', '');
        action.addEventListener('click', async (event) => {
          event.preventDefault();
          if (action.dataset.loading === 'true') return;
          action.dataset.loading = 'true';
          const previousLabel = action.textContent;
          action.textContent = 'CHECKING...';
          try {
            const url = new URL(target, document.baseURI);
            const response = await fetch(url, { method: 'GET', cache: 'no-store' });
            const type = (response.headers.get('content-type') || '').toLowerCase();
            if (!response.ok || type.includes('text/html')) {
              throw new Error('File unavailable (' + response.status + ')');
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = objectUrl;
            downloadLink.download = decodeURIComponent(url.pathname.split('/').pop()) || 'download';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
          } catch (error) {
            console.error('iLiam download failed:', target, error);
            status.textContent = 'This download is currently unavailable: ' + item.title + '. The file needs to be uploaded.';
          } finally {
            action.dataset.loading = 'false';
            action.textContent = previousLabel;
          }
        });
      }
      card.append(action);
      fragment.append(card);
    }
    grid.replaceChildren(fragment);
    status.textContent = grid.children.length ? '' : 'No items yet.';
  } catch (error) {
    console.error('iLiam gallery error:', error);
    status.textContent = 'The gallery could not load. Please refresh the page.';
  }
})();
