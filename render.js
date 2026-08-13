function getNewsData() {
  return Array.isArray(window.NEWS_DB) ? window.NEWS_DB : [];
}

const NEWS_FILTERS = {
  query: '',
  category: 'all'
};

const NEWS_SORT = {
  mode: 'newest'
};
const SORT_STORAGE_KEY = 'teerapatNewsSortMode';

function loadSortMode() {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    if (stored === 'oldest' || stored === 'newest') {
      NEWS_SORT.mode = stored;
    }
  } catch {
    NEWS_SORT.mode = 'newest';
  }
}

function saveSortMode(mode = NEWS_SORT.mode) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors gracefully.
  }
}

function sortNewsOldestFirst(items = []) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt || a.created_at || a.updatedAt || a.updated_at || null;
    const bTime = b.createdAt || b.created_at || b.updatedAt || b.updated_at || null;

    if (aTime && bTime) {
      return new Date(aTime) - new Date(bTime);
    }

    const aId = String(a.id || '');
    const bId = String(b.id || '');

    if (/^\d+$/.test(aId) && /^\d+$/.test(bId)) {
      return Number(aId) - Number(bId);
    }

    if (Date.parse(aTime || '') && Date.parse(bTime || '')) {
      return new Date(aTime) - new Date(bTime);
    }

    return String(aId).localeCompare(String(bId));
  });
}

function getSortedNews(items = [], mode = NEWS_SORT.mode) {
  if (mode === 'oldest') {
    return sortNewsOldestFirst(items);
  }
  return sortNewsLatestFirst(items);
}

function getActiveNewsSource() {
  const source = isWorldNewsPage() ? getWorldNewsData() : getNewsData();
  return getSortedNews(source, NEWS_SORT.mode);
}

function getCategoryList(items = []) {
  const categories = Array.from(new Set(
    items
      .map((item) => item.categoryLabel || item.category || 'ทั่วไป')
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'th'));

  return ['all', ...categories];
}

function renderCategoryFilters(items = getActiveNewsSource()) {
  const filterEl = document.getElementById('category-filter');
  if (!filterEl) return;

  const categories = getCategoryList(items);
  const labelMap = {
    all: 'ทั้งหมด'
  };

  filterEl.innerHTML = categories.map((category) => {
    const isActive = category === NEWS_FILTERS.category;
    const categoryLabel = category === 'all' ? labelMap.all : category;
    return `<button type="button" class="chip ${isActive ? 'active' : ''}" data-category="${category}">${categoryLabel}</button>`;
  }).join('');

  filterEl.querySelectorAll('.chip').forEach((button) => {
    button.addEventListener('click', () => {
      NEWS_FILTERS.category = button.dataset.category || 'all';
      renderCategoryFilters(getActiveNewsSource());
      applyNewsFilters();
    });
  });
}

function excerptFromBody(item, length = 140) {
  const content = typeof item.body === 'string'
    ? item.body
    : Array.isArray(item.body)
      ? item.body.join(' ')
      : '';
  const text = content.replace(/<[^>]+>/g, '').trim();
  if (!text) return item.summary || '';
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`ตอบกลับไม่ใช่ JSON: ${error.message}`);
  }
}

function renderHero(article) {
  const heroLink = document.getElementById('hero-cta');
  const heroImage = document.getElementById('hero-image');
  const heroTag = document.getElementById('hero-tag');
  const heroTitle = document.getElementById('hero-title');
  const heroSummary = document.getElementById('hero-summary');
  const heroCard = document.querySelector('.hero-card');

  if (!heroImage || !heroTitle || !heroSummary || !article) return;

  if (heroCard) {
    heroCard.classList.remove('is-refreshing');
    void heroCard.offsetWidth;
    heroCard.classList.add('is-refreshing');
  }

  if (heroLink) heroLink.href = `news-article.html?id=${article.id}`;
  heroImage.src = article.image || heroImage.src;
  heroImage.alt = article.title || heroImage.alt;
  heroTag.textContent = article.categoryLabel || article.category || 'เด่น';
  heroTitle.textContent = article.title || heroTitle.textContent;
  heroSummary.textContent = article.summary || excerptFromBody(article, 160) || heroSummary.textContent;

  if (heroCard) {
    window.setTimeout(() => heroCard.classList.remove('is-refreshing'), 260);
  }
}

function isWorldNewsPage() {
  return window.location.pathname.toLowerCase().includes('world-news');
}

function shouldRenderDynamicHero() {
  return true;
}

function sortNewsLatestFirst(items = []) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt || a.created_at || a.updatedAt || a.updated_at || null;
    const bTime = b.createdAt || b.created_at || b.updatedAt || b.updated_at || null;

    if (aTime && bTime) {
      return new Date(bTime) - new Date(aTime);
    }

    const aId = String(a.id || '');
    const bId = String(b.id || '');

    if (/^\d+$/.test(aId) && /^\d+$/.test(bId)) {
      return Number(bId) - Number(aId);
    }

    if (Date.parse(aTime || '') && Date.parse(bTime || '')) {
      return new Date(bTime) - new Date(aTime);
    }

    return String(bId).localeCompare(String(aId));
  });
}

function getHeroArticle(items = []) {
  const sorted = sortNewsLatestFirst(items);
  return sorted.length ? sorted[0] : null;
}

function getWorldNewsData() {
  return getSortedNews(getNewsData().filter((item) => {
    const tag = `${item.categoryLabel || item.category || ''}`.trim().toLowerCase();
    return tag === 'รอบโลก' || tag === 'world';
  }), NEWS_SORT.mode);
}

function renderFeed(targetId, items = getNewsData()) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const sourceItems = Array.isArray(items) ? items : [];
  const list = getSortedNews(sourceItems, NEWS_SORT.mode);

  if (window.NEWS_LOADING) {
    container.innerHTML = '<div class="loading-state">กำลังโหลดข่าว...</div>';
    return;
  }

  if (window.NEWS_ERROR && !list.length) {
    container.innerHTML = `<div class="error-state">${window.NEWS_ERROR}</div>`;
    return;
  }

  if (!list.length) {
    container.innerHTML = '<div class="empty-state">ไม่พบข่าวที่ตรงกับคำค้นหานี้</div>';
    return;
  }

  const heroExists = Boolean(document.querySelector('.hero-section'));
  const heroArticle = heroExists ? getHeroArticle(sourceItems.length ? sourceItems : getNewsData()) : null;
  if (heroArticle) {
    renderHero(heroArticle);
  }

  const cards = heroArticle ? list.filter((item) => String(item.id) !== String(heroArticle.id)) : list;
  const rawUser = localStorage.getItem('user') || localStorage.getItem('teerapatAuth');
  let currentUser = null;
  try {
    currentUser = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    currentUser = null;
  }
  const userEmail = String(currentUser?.email || '').toLowerCase();
  const isAdmin = Boolean(currentUser) && (currentUser.role === 'admin' || userEmail === 'admin@teerapatnews.com');

  container.innerHTML = cards.map((item) => `
    <div class="post-card" data-id="${item.id}">
      <a href="news-article.html?id=${item.id}" class="post-card-main">
        <div class="post-card-image">
          <img src="${item.image || ''}" alt="${item.title || ''}" />
        </div>
        <div class="post-card-body">
          <span class="post-card-label">${item.categoryLabel || item.category || 'ทั่วไป'}</span>
          <h3>${item.title || 'ไม่มีหัวข้อ'}</h3>
          <div class="post-card-footer">
            <span>${item.author || 'ทีมข่าว TeerapatNews'}</span>
            <span>·</span>
            <span>${item.timeAgo || 'เมื่อสักครู่'}</span>
          </div>
        </div>
      </a>
      
    </div>
  `).join('');
}

function renderSidebar() {
  const news = sortNewsLatestFirst(getNewsData());
  if (!news.length) return;

  const trendingEl = document.getElementById('trending-list');
  const categoriesEl = document.getElementById('categories-list');
  const tagsEl = document.getElementById('tags-list');

  if (trendingEl) {
    trendingEl.innerHTML = news.slice(0, 4).map((item) => `
      <a href="news-article.html?id=${item.id}" class="sidebar-item">
        <span>${item.title}</span>
        <small>${item.timeAgo || 'เมื่อสักครู่'}</small>
      </a>
    `).join('');
  }

  if (categoriesEl) {
    const categories = Array.from(new Set(news.map((item) => item.categoryLabel || item.category).filter(Boolean))).slice(0, 8);
    categoriesEl.innerHTML = categories.map((label) => `<button class="category-pill">${label}</button>`).join('');
  }

  if (tagsEl) {
    const tags = Array.from(new Set(news.flatMap((item) => [item.categoryLabel || item.category, item.author]).filter(Boolean))).slice(0, 8);
    tagsEl.innerHTML = tags.map((label) => `<button class="tag-pill">${label}</button>`).join('');
  }
}

function renderAdminArticleList() {
  const news = sortNewsLatestFirst(getNewsData());
  const listEl = document.getElementById('article-list');
  const countEl = document.getElementById('count');
  if (!listEl) return;

  if (countEl) {
    countEl.textContent = String(news.length);
  }

  if (!news.length) {
    listEl.innerHTML = '<div class="empty-state">ยังไม่พบข่าวในระบบ</div>';
    return;
  }

  listEl.innerHTML = news.map((item) => `
    <div class="admin-article-row">
      <div class="admin-article-meta">
        <strong>${item.title || 'ไม่มีหัวข้อ'}</strong>
        <span>${item.categoryLabel || item.category || 'ทั่วไป'}</span>
        <small>${item.timeAgo || 'เมื่อสักครู่'}</small>
      </div>
      <div class="admin-article-actions">
        <button type="button" class="button small secondary admin-view-button" data-id="${item.id}">ดู</button>
        <button type="button" class="button small secondary admin-edit-button" data-id="${item.id}">แก้ไข</button>
        <button type="button" class="button small danger admin-delete-button" data-id="${item.id}">ลบ</button>
      </div>
    </div>
  `).join('');
}

function parseArticleBody(text) {
  if (typeof text !== 'string') return [];

  const blocks = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    if (block.startsWith('- ')) {
      const items = block
        .split(/\r?\n/)
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter(Boolean);
      return `__LIST__${items.join('|')}`;
    }
    return block;
  });
}

function formatBodyForTextarea(body) {
  if (typeof body === 'string') return body;
  if (!Array.isArray(body)) return '';

  return body.map((block) => {
    if (typeof block === 'string' && block.startsWith('__LIST__')) {
      return block
        .replace('__LIST__', '')
        .split('|')
        .map((item) => `- ${item.trim()}`)
        .join('\n');
    }
    return block;
  }).join('\n\n');
}

function getArticleById(id) {
  return getNewsData().find((item) => String(item.id) === String(id));
}

function populateArticleForm(article) {
  if (!article) return;

  const editingId = document.getElementById('f-editing-id');
  const titleEl = document.getElementById('f-title');
  const categoryEl = document.getElementById('f-category');
  const imageEl = document.getElementById('f-image');
  const authorEl = document.getElementById('f-author');
  const timeAgoEl = document.getElementById('f-timeago');
  const readTimeEl = document.getElementById('f-readtime');
  const bodyEl = document.getElementById('f-body');
  const formTitle = document.getElementById('form-title');

  if (!editingId || !titleEl || !categoryEl || !imageEl || !authorEl || !timeAgoEl || !readTimeEl || !bodyEl || !formTitle) return;

  editingId.value = String(article.id);
  titleEl.value = article.title || '';
  categoryEl.value = article.category || article.categoryLabel || 'ทั่วไป';
  imageEl.value = article.image || '';
  authorEl.value = article.author || 'ทีมข่าว TeerapatNews';
  timeAgoEl.value = article.timeAgo || 'เมื่อสักครู่';
  readTimeEl.value = article.readTime || '3 นาที';
  bodyEl.value = formatBodyForTextarea(article.body);
  formTitle.textContent = 'แก้ไขข่าว';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function populateCategoryOptions() {
  const categoryEl = document.getElementById('f-category');
  if (!categoryEl) return;

  const categories = Array.from(new Set(
    getNewsData()
      .map((item) => item.categoryLabel || item.category || 'ทั่วไป')
      .filter(Boolean)
  ));

  const options = categories.sort().map((label) => `
      <option value="${escapeHtml(label)}">${escapeHtml(label)}</option>
    `).join('');

  categoryEl.innerHTML = `<option value="ทั่วไป">ทั่วไป</option>${options}`;
}

function resetForm() {
  const editingId = document.getElementById('f-editing-id');
  const titleEl = document.getElementById('f-title');
  const categoryEl = document.getElementById('f-category');
  const imageEl = document.getElementById('f-image');
  const authorEl = document.getElementById('f-author');
  const timeAgoEl = document.getElementById('f-timeago');
  const readTimeEl = document.getElementById('f-readtime');
  const bodyEl = document.getElementById('f-body');
  const formTitle = document.getElementById('form-title');

  if (!editingId || !titleEl || !categoryEl || !imageEl || !authorEl || !timeAgoEl || !readTimeEl || !bodyEl || !formTitle) return;

  editingId.value = '';
  titleEl.value = '';
  categoryEl.value = 'ทั่วไป';
  imageEl.value = '';
  authorEl.value = 'ทีมข่าว TeerapatNews';
  timeAgoEl.value = 'เมื่อสักครู่';
  readTimeEl.value = '3 นาที';
  bodyEl.value = '';
  formTitle.textContent = 'เพิ่มข่าวใหม่';
}

async function saveArticle() {
  const editingId = document.getElementById('f-editing-id');
  const titleEl = document.getElementById('f-title');
  const categoryEl = document.getElementById('f-category');
  const imageEl = document.getElementById('f-image');
  const authorEl = document.getElementById('f-author');
  const timeAgoEl = document.getElementById('f-timeago');
  const readTimeEl = document.getElementById('f-readtime');
  const bodyEl = document.getElementById('f-body');

  if (!editingId || !titleEl || !categoryEl || !imageEl || !authorEl || !timeAgoEl || !readTimeEl || !bodyEl) return;

  const payload = {
    category: categoryEl.value.trim() || 'ทั่วไป',
    categoryLabel: categoryEl.value.trim() || 'ทั่วไป',
    title: titleEl.value.trim(),
    image: imageEl.value.trim(),
    author: authorEl.value.trim() || 'ทีมข่าว TeerapatNews',
    timeAgo: timeAgoEl.value.trim() || 'เมื่อสักครู่',
    readTime: readTimeEl.value.trim() || '3 นาที',
    body: parseArticleBody(bodyEl.value)
  };

  if (!payload.title || !payload.image || payload.body.length === 0) {
    return alert('กรุณากรอกหัวข้อ รูปภาพ และเนื้อหาข่าวให้ครบถ้วน');
  }

  const apiUrl = `/api/news${editingId.value ? `/${editingId.value}` : ''}`;
  const method = editingId.value ? 'PUT' : 'POST';

  try {
    const response = await fetch(apiUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await parseJsonSafe(response);
    if (!response.ok || !result || !result.ok) {
      throw new Error((result && result.message) || 'เกิดข้อผิดพลาดระหว่างบันทึกข่าว');
    }

    alert(result.message || 'บันทึกข่าวสำเร็จ');
    resetForm();
    if (typeof fetchNewsData === 'function') {
      await fetchNewsData();
    }
  } catch (error) {
    console.error('❌ Save Article Error:', error);
    alert(error.message || 'ไม่สามารถบันทึกข่าวได้');
  }
}

async function deleteArticle(id) {
  if (!id) return;
  if (!confirm('ต้องการลบข่าวนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;

  try {
    const response = await fetch(`/api/news/${id}`, {
      method: 'DELETE'
    });

    const result = await parseJsonSafe(response);
    if (!response.ok || !result || !result.ok) {
      throw new Error((result && result.message) || 'เกิดข้อผิดพลาดระหว่างลบข่าว');
    }

    alert(result.message || 'ลบข่าวสำเร็จ');
    if (typeof fetchNewsData === 'function') {
      await fetchNewsData();
    }
  } catch (error) {
    console.error('❌ Delete Article Error:', error);
    alert(error.message || 'ไม่สามารถลบข่าวได้');
  }
}

function syncModalPreview() {
  const preview = document.getElementById('modal-image-preview');
  const imageInput = document.getElementById('modal-f-image');
  if (!preview || !imageInput) return;

  const url = imageInput.value.trim();
  preview.src = url || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
  preview.alt = url ? 'ภาพตัวอย่างข่าว' : 'ภาพรอเลือก';
}

function populateModalArticleForm(article) {
  if (!article) return;

  const modal = document.getElementById('edit-modal');
  if (!modal) return;

  const fields = {
    editingId: document.getElementById('modal-f-editing-id'),
    title: document.getElementById('modal-f-title'),
    category: document.getElementById('modal-f-category'),
    image: document.getElementById('modal-f-image'),
    author: document.getElementById('modal-f-author'),
    timeAgo: document.getElementById('modal-f-timeago'),
    readTime: document.getElementById('modal-f-readtime'),
    body: document.getElementById('modal-f-body')
  };

  if (!fields.editingId || !fields.title || !fields.category || !fields.image || !fields.author || !fields.timeAgo || !fields.readTime || !fields.body) return;

  fields.editingId.value = String(article.id);
  fields.title.value = article.title || '';
  fields.category.value = article.category || article.categoryLabel || 'ทั่วไป';
  fields.image.value = article.image || '';
  fields.author.value = article.author || 'ทีมข่าว TeerapatNews';
  fields.timeAgo.value = article.timeAgo || 'เมื่อสักครู่';
  fields.readTime.value = article.readTime || '3 นาที';
  fields.body.value = formatBodyForTextarea(article.body);
  syncModalPreview();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  fields.title.focus();
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

async function saveModalArticle() {
  const modal = document.getElementById('edit-modal');
  if (!modal) return;

  const fields = {
    editingId: document.getElementById('modal-f-editing-id'),
    title: document.getElementById('modal-f-title'),
    category: document.getElementById('modal-f-category'),
    image: document.getElementById('modal-f-image'),
    author: document.getElementById('modal-f-author'),
    timeAgo: document.getElementById('modal-f-timeago'),
    readTime: document.getElementById('modal-f-readtime'),
    body: document.getElementById('modal-f-body')
  };

  if (!fields.editingId || !fields.title || !fields.category || !fields.image || !fields.author || !fields.timeAgo || !fields.readTime || !fields.body) return;

  const payload = {
    category: fields.category.value.trim() || 'ทั่วไป',
    categoryLabel: fields.category.value.trim() || 'ทั่วไป',
    title: fields.title.value.trim(),
    image: fields.image.value.trim(),
    author: fields.author.value.trim() || 'ทีมข่าว TeerapatNews',
    timeAgo: fields.timeAgo.value.trim() || 'เมื่อสักครู่',
    readTime: fields.readTime.value.trim() || '3 นาที',
    body: parseArticleBody(fields.body.value)
  };

  if (!payload.title || !payload.image || payload.body.length === 0) {
    return alert('กรุณากรอกหัวข้อ รูปภาพ และเนื้อหาข่าวให้ครบถ้วน');
  }

  const articleId = fields.editingId.value;
  if (!articleId) {
    return alert('ไม่พบข้อมูลข่าวที่ต้องการแก้ไข');
  }

  try {
    const response = await fetch(`/api/news/${articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await parseJsonSafe(response);
    if (!response.ok || !result || !result.ok) {
      throw new Error((result && result.message) || 'เกิดข้อผิดพลาดระหว่างบันทึกข่าว');
    }

    alert(result.message || 'บันทึกข่าวสำเร็จ');
    closeEditModal();
    if (typeof fetchNewsData === 'function') {
      await fetchNewsData();
    }
  } catch (error) {
    console.error('❌ Save Modal Article Error:', error);
    alert(error.message || 'ไม่สามารถบันทึกข่าวได้');
  }
}

function handleAdminListClick(event) {
  const viewButton = event.target.closest('.admin-view-button');
  if (viewButton) {
    const id = viewButton.dataset.id;
    if (id) {
      window.location.href = `news-article.html?id=${encodeURIComponent(id)}`;
    }
    return;
  }

  const editButton = event.target.closest('.admin-edit-button');
  if (editButton) {
    const article = getArticleById(editButton.dataset.id);
    populateModalArticleForm(article);
    return;
  }

  const deleteButton = event.target.closest('.admin-delete-button');
  if (deleteButton) {
    deleteArticle(deleteButton.dataset.id);
  }
}

function renderArticlePage() {
  const articleBody = document.getElementById('article-body');
  if (!articleBody) return;

  const articleId = new URLSearchParams(window.location.search).get('id');
  const news = getNewsData();
  const article = news.find((item) => String(item.id) === String(articleId)) || news[0];
  if (!article) return;

  const articleEditButton = document.getElementById('article-edit-button');
  const articleEditButtonVisible = Boolean(articleEditButton);
  if (articleEditButtonVisible) {
    const rawUser = localStorage.getItem('user') || localStorage.getItem('teerapatAuth');
    let currentUser = null;
    try {
      currentUser = rawUser ? JSON.parse(rawUser) : null;
    } catch {
      currentUser = null;
    }

    const userEmail = String(currentUser?.email || '').toLowerCase();
    const isAdmin = Boolean(currentUser) && (currentUser.role === 'admin' || userEmail === 'admin@teerapatnews.com');
    articleEditButton.style.display = isAdmin ? 'inline-flex' : 'none';
    articleEditButton.setAttribute('aria-hidden', String(!isAdmin));
    articleEditButton.dataset.id = String(article.id);
    articleEditButton.onclick = () => {
      if (isAdmin) {
        populateModalArticleForm(article);
      }
    };
  }

  const heroImage = document.getElementById('article-hero-img');
  const category = document.getElementById('article-category');
  const title = document.getElementById('article-title');
  const author = document.getElementById('article-author');
  const time = document.getElementById('article-time');
  const readtime = document.getElementById('article-readtime');
  const nextCard = document.getElementById('read-next-card');

  if (heroImage) heroImage.src = article.image || heroImage.src;
  if (category) category.textContent = article.categoryLabel || article.category || 'ทั่วไป';
  if (title) title.textContent = article.title || title.textContent;
  if (author) author.textContent = `โดย ${article.author || 'ทีมข่าว TeerapatNews'}`;
  if (time) time.textContent = article.timeAgo || 'เมื่อสักครู่';
  if (readtime) readtime.textContent = article.readTime || 'อ่าน 3 นาที';

  let bodyData = article.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      bodyData = article.body;
    }
  }

  if (Array.isArray(bodyData)) {
    articleBody.innerHTML = bodyData.map((block) => {
      if (typeof block === 'string' && block.startsWith('__LIST__')) {
        return `<ul>${block.replace('__LIST__', '').split('|').map((item) => `<li>${item.trim()}</li>`).join('')}</ul>`;
      }
      return `<p>${block}</p>`;
    }).join('');
  } else {
    articleBody.innerHTML = `<p>${bodyData || article.summary || ''}</p>`;
  }

  if (nextCard) {
    const nextArticle = news.find((item) => String(item.id) !== String(article.id)) || article;
    nextCard.href = `news-article.html?id=${nextArticle.id}`;
    nextCard.querySelector('h3').textContent = nextArticle.title || 'บทความต่อไป';
    nextCard.querySelector('p').textContent = nextArticle.summary || excerptFromBody(nextArticle, 90);
    nextCard.querySelector('img').src = nextArticle.image || nextCard.querySelector('img').src;
  }
}

function attachOnce(selector, callback) {
  const element = document.querySelector(selector);
  if (element) return callback(element);

  const observer = new MutationObserver(() => {
    const node = document.querySelector(selector);
    if (node) {
      observer.disconnect();
      callback(node);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function getFilteredNewsByQuery(query, category = 'all') {
  const source = getActiveNewsSource();
  let filtered = source;

  if (category !== 'all') {
    filtered = filtered.filter((item) => (item.categoryLabel || item.category || 'ทั่วไป') === category);
  }

  if (!query) {
    return filtered;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored = filtered.map((item) => {
    const title = `${item.title || ''}`.toLowerCase();
    const body = `${item.summary || ''} ${typeof item.body === 'string' ? item.body : Array.isArray(item.body) ? item.body.join(' ') : ''}`.toLowerCase();
    const meta = `${item.categoryLabel || item.category || ''} ${item.author || ''}`.toLowerCase();

    const titleMatch = terms.every((term) => title.includes(term));
    const bodyMatch = terms.every((term) => body.includes(term));
    const metaMatch = terms.every((term) => meta.includes(term));
    const anyMatch = terms.every((term) => title.includes(term) || body.includes(term) || meta.includes(term));

    const score = (titleMatch ? 100 : 0) + (bodyMatch ? 50 : 0) + (metaMatch ? 20 : 0);

    return { item, score, anyMatch };
  });

  return scored
    .filter((result) => result.anyMatch)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);
}

function applyNewsFilters() {
  const query = NEWS_FILTERS.query;
  const filtered = getFilteredNewsByQuery(query, NEWS_FILTERS.category);
  renderFeed('feed-grid', filtered);

  const summary = document.getElementById('result-summary');
  if (summary) {
    const label = NEWS_FILTERS.category === 'all' ? 'ข่าวทั้งหมด' : `หมวด: ${NEWS_FILTERS.category}`;
    const suffix = query ? ` · ค้นหา: “${query}”` : '';
    summary.textContent = `แสดง ${filtered.length} รายการ ${label}${suffix}`;
  }
}

function initSearch() {
  attachOnce('#search-input', (searchInput) => {
    searchInput.addEventListener('input', (event) => {
      NEWS_FILTERS.query = event.target.value.trim().toLowerCase();
      applyNewsFilters();
    });
  });
}

function initSortControls() {
  loadSortMode();
  document.querySelectorAll('.sort-button').forEach((button) => {
    button.classList.toggle('active', (button.dataset.sort || 'newest') === NEWS_SORT.mode);
  });

  document.querySelectorAll('.sort-button').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.sort || 'newest';
      NEWS_SORT.mode = nextMode;
      saveSortMode(nextMode);

      document.querySelectorAll('.sort-button').forEach((item) => {
        item.classList.toggle('active', item.dataset.sort === nextMode);
      });

      const source = getActiveNewsSource();
      renderCategoryFilters(source);
      applyNewsFilters();
      renderHero(getHeroArticle(getNewsData()));
    });
  });
}

function initThemeToggle() {
  attachOnce('#nav-theme-toggle', (toggle) => {
    const stored = localStorage.getItem('site-theme') || 'light';
    document.documentElement.setAttribute('data-theme', stored);
    toggle.textContent = stored === 'dark' ? 'Light' : 'Dark';

    toggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('site-theme', next);
      toggle.textContent = next === 'dark' ? 'Light' : 'Dark';
    });
  });
}

window.addEventListener('newsLoaded', () => {
  NEWS_FILTERS.query = '';
  NEWS_FILTERS.category = 'all';

  loadSortMode();
  const feedData = getActiveNewsSource();
  renderCategoryFilters(feedData);
  renderFeed('feed-grid', feedData);
  renderSidebar();
  if (typeof renderAdminArticleList === 'function') {
    renderAdminArticleList();
  }
  populateCategoryOptions();
  renderArticlePage();
});

document.addEventListener('DOMContentLoaded', () => {
  loadSortMode();
  initSearch();
  initSortControls();
  initThemeToggle();
  renderCategoryFilters(getActiveNewsSource());

  const articleList = document.getElementById('article-list');
  if (articleList) {
    articleList.addEventListener('click', handleAdminListClick);
  }

  const feedGrid = document.getElementById('feed-grid');
  if (feedGrid) {
    feedGrid.addEventListener('click', (event) => {
      const editButton = event.target.closest('.admin-card-edit-button');
      if (!editButton) return;

      const article = getNewsData().find((item) => String(item.id) === String(editButton.dataset.id));
      if (article) {
        populateModalArticleForm(article);
      }
    });
  }

  const modal = document.getElementById('edit-modal');
  const closeButton = document.getElementById('close-edit-modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeEditModal();
      }
    });
  }
  if (closeButton) {
    closeButton.addEventListener('click', closeEditModal);
  }

  const imageInput = document.getElementById('modal-f-image');
  if (imageInput) {
    imageInput.addEventListener('input', syncModalPreview);
  }

  const modalCategory = document.getElementById('modal-f-category');
  if (modalCategory) {
    populateCategoryOptions();
    const sourceCategory = document.getElementById('f-category');
    if (sourceCategory) {
      modalCategory.innerHTML = sourceCategory.innerHTML;
    }
  }

  const articleEditButton = document.getElementById('article-edit-button');
  if (articleEditButton) {
    articleEditButton.onclick = () => {
      const articleId = new URLSearchParams(window.location.search).get('id');
      const article = getNewsData().find((item) => String(item.id) === String(articleId)) || getNewsData()[0];
      if (article) {
        populateModalArticleForm(article);
      }
    };
  }
});
