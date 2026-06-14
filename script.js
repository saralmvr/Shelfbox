'use strict';

const STORAGE_KEY = 'shelfbox_v2';

@returns {AppState} 
function defaultState() {
  return {
    books: [],       
    profile: {
      name: 'Leitor(a)',
      bio: 'Apaixonado(a) por livros e histórias.',
      avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Shelfbox&backgroundColor=14181c'
    },
    goal: {
      total: 20,
      year: new Date().getFullYear()
    },
    ui: {
      filter: 'all',
      sort: 'date-desc',
      search: ''
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const stored = JSON.parse(raw);
    return { ...defaultState(), ...stored };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
}

const AppState = loadState();

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function starsHTML(rating, max = 5) {
  if (!rating) return '';
  let s = '';
  for (let i = 1; i <= max; i++) {
    s += i <= rating ? '★' : '☆';
  }
  return s;
}

const STATUS_LABEL = {
  read: 'Lido',
  reading: 'Lendo',
  want: 'Quero Ler'
};

let toastTimer;
function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show toast--${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 3000);
}

async function fetchCoverUrl(title, author = '') {
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=cover_i&limit=1`);
    const data = await res.json();
    const coverId = data.docs?.[0]?.cover_i;
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  } catch {
    return null;
  }
}

function upsertBook(bookData) {
  const idx = AppState.books.findIndex(b => b.id === bookData.id);
  if (idx >= 0) {
    AppState.books[idx] = bookData;
  } else {
    AppState.books.unshift({ ...bookData, createdAt: new Date().toISOString() });
  }
  saveState();
}

function removeBook(id) {
  AppState.books = AppState.books.filter(b => b.id !== id);
  saveState();
}

function filteredBooks() {
  const { filter, sort, search } = AppState.ui;
  let list = [...AppState.books];

  if (filter !== 'all') list = list.filter(b => b.status === filter);

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    switch (sort) {
      case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
      case 'date-asc':  return new Date(a.createdAt) - new Date(b.createdAt);
      case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
      case 'rating-asc':  return (a.rating || 0) - (b.rating || 0);
      case 'title-asc':   return a.title.localeCompare(b.title);
      default: return 0;
    }
  });

  return list;
}

function calcStats() {
  const books = AppState.books;
  const readBooks  = books.filter(b => b.status === 'read');
  const rated      = readBooks.filter(b => b.rating > 0);
  const avgRating  = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : null;

  return {
    total:   books.length,
    read:    readBooks.length,
    reading: books.filter(b => b.status === 'reading').length,
    want:    books.filter(b => b.status === 'want').length,
    avgRating
  };
}

function render() {
  renderProfile();
  renderStats();
  renderBooksGrid();
  renderDiary();
  renderFavorites();
  renderHeroStack();
}

function renderProfile() {
  const { name, bio, avatar } = AppState.profile;
  const stats = calcStats();

  document.getElementById('profileName').textContent = name;
  document.getElementById('profileBio').textContent  = bio;

  const avatarEl = document.getElementById('profileAvatar');
  avatarEl.src = avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${name}`;

  document.getElementById('statTotalBooks').textContent = stats.total;
  document.getElementById('statReadBooks').textContent  = stats.read;
  document.getElementById('statAvgRating').textContent  = stats.avgRating || '—';
}

function renderStats() {
  const stats = calcStats();
  const goal  = AppState.goal;

  document.getElementById('sTotal').textContent   = stats.total;
  document.getElementById('sRead').textContent    = stats.read;
  document.getElementById('sReading').textContent = stats.reading;
  document.getElementById('sAvg').textContent     = stats.avgRating || '—';
  document.getElementById('sGoalRead').textContent  = stats.read;
  document.getElementById('sGoalTotal').textContent = goal.total;
  document.getElementById('goalYear').textContent   = goal.year;

  const pct = Math.min(100, Math.round((stats.read / goal.total) * 100));
  document.getElementById('goalBarFill').style.width = `${pct}%`;
}

function renderBooksGrid() {
  const grid  = document.getElementById('booksGrid');
  const empty = document.getElementById('emptyState');
  const list  = filteredBooks();

  grid.innerHTML = '';

  if (!list.length) {
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  list.forEach((book, i) => {
    const card = buildBookCard(book);
    card.style.animationDelay = `${i * 0.04}s`;
    grid.appendChild(card);
  });
}

function buildBookCard(book) {
  const el = document.createElement('div');
  el.className = 'book-card';
  el.dataset.id = book.id;

  const stars = starsHTML(book.rating);
  const hasCover = !!book.cover;

  el.innerHTML = `
    <div class="book-card__cover">
      ${hasCover
        ? `<img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=book-card__cover-placeholder>📖<span>${escHtml(book.title)}</span></div>'" />`
        : `<div class="book-card__cover-placeholder">📖<span>${escHtml(book.title)}</span></div>`
      }
      <span class="book-card__status book-card__status--${book.status}">${STATUS_LABEL[book.status]}</span>
      ${book.favorite ? '<span class="book-card__fav book-card__fav--visible">❤️</span>' : '<span class="book-card__fav">❤️</span>'}
      <div class="book-card__overlay">
        <span class="book-card__rating-hover">${stars || 'Sem nota'}</span>
      </div>
    </div>
    <div class="book-card__info">
      <div class="book-card__title">${escHtml(book.title)}</div>
      <div class="book-card__author">${escHtml(book.author)}</div>
      <div class="book-card__meta">
        <span class="book-card__year">${book.year || ''}</span>
        ${stars ? `<span class="book-card__stars">${stars}</span>` : ''}
      </div>
    </div>
  `;

  el.addEventListener('click', () => openEditModal(book.id));
  return el;
}

function escHtml(str = '') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderDiary() {
  const list  = document.getElementById('diaryList');
  const empty = document.getElementById('diaryEmpty');

  const entries = AppState.books
    .filter(b => b.status === 'read' && (b.readDate || b.review))
    .sort((a, b) => {
      const da = a.readDate || a.createdAt;
      const db = b.readDate || b.createdAt;
      return new Date(db) - new Date(da);
    });

  list.innerHTML = '';

  if (!entries.length) {
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  entries.forEach(book => {
    const entry = document.createElement('div');
    entry.className = 'diary-entry';
    entry.innerHTML = `
      <div class="diary-entry__cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${escHtml(book.title)}" loading="lazy" />`
          : '📖'
        }
      </div>
      <div class="diary-entry__body">
        <div class="diary-entry__date">${book.readDate ? formatDate(book.readDate) : 'Data não informada'}</div>
        <div class="diary-entry__title">${escHtml(book.title)}</div>
        <div class="diary-entry__author">${escHtml(book.author)}</div>
        ${book.rating ? `<div class="diary-entry__rating">${starsHTML(book.rating)}</div>` : ''}
        ${book.review ? `<div class="diary-entry__review">${escHtml(book.review)}</div>` : ''}
      </div>
    `;
    entry.style.cursor = 'pointer';
    entry.addEventListener('click', () => openEditModal(book.id));
    list.appendChild(entry);
  });
}

function renderFavorites() {
  const grid = document.getElementById('favoritesGrid');
  const favs = AppState.books.filter(b => b.favorite);

  grid.innerHTML = '';

  const items = favs.slice(0, 8);

  if (!items.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Nenhum favorito ainda — marque livros como ❤️ favorito ao adicioná-los.</p>';
    return;
  }

  items.forEach(book => {
    const el = document.createElement('div');
    el.className = 'fav-item';
    el.innerHTML = book.cover
      ? `<img src="${book.cover}" alt="${escHtml(book.title)}" loading="lazy" />
         <span class="fav-item__tooltip">${escHtml(book.title)}</span>`
      : `<div class="fav-item__placeholder">📖</div>
         <span class="fav-item__tooltip">${escHtml(book.title)}</span>`;
    el.addEventListener('click', () => openEditModal(book.id));
    grid.appendChild(el);
  });
}

function renderHeroStack() {
  const stack = document.getElementById('heroBookStack');
  const withCovers = AppState.books.filter(b => b.cover).slice(0, 3);

  if (!withCovers.length) {
    stack.innerHTML = `
      <div class="book-stack__item"><div class="book-stack__placeholder">📚</div></div>
      <div class="book-stack__item"><div class="book-stack__placeholder">📖</div></div>
      <div class="book-stack__item"><div class="book-stack__placeholder">📕</div></div>
    `;
    return;
  }

  const items = [...withCovers];
  while (items.length < 3) items.push(null);

  stack.innerHTML = items.map(book =>
    `<div class="book-stack__item">
      ${book
        ? `<img src="${book.cover}" alt="${escHtml(book.title)}" />`
        : `<div class="book-stack__placeholder">📖</div>`
      }
    </div>`
  ).join('');
}

let _editingId = null; // null = novo livro

function openAddModal() {
  _editingId = null;
  resetBookForm();
  document.getElementById('modalTitle').textContent = 'Adicionar Livro';
  document.getElementById('deleteBookBtn').style.display = 'none';

  document.getElementById('bookReadDate').value = new Date().toISOString().split('T')[0];

  openModal('bookModalBackdrop');
}

function openEditModal(id) {
  _editingId = id;
  const book = AppState.books.find(b => b.id === id);
  if (!book) return;

  resetBookForm();
  document.getElementById('modalTitle').textContent = 'Editar Livro';
  document.getElementById('deleteBookBtn').style.display = 'inline-flex';

  document.getElementById('bookId').value       = book.id;
  document.getElementById('bookTitle').value    = book.title;
  document.getElementById('bookAuthor').value   = book.author;
  document.getElementById('bookYear').value     = book.year || '';
  document.getElementById('bookCover').value    = book.cover || '';
  document.getElementById('bookStatus').value   = book.status;
  document.getElementById('bookReview').value   = book.review || '';
  document.getElementById('bookFavorite').checked = !!book.favorite;
  document.getElementById('bookReadDate').value = book.readDate || '';
  document.getElementById('bookRating').value   = book.rating || 0;

  setStarRating(book.rating || 0);
  updateCoverPreview(book.cover || '');
  toggleReadDateGroup(book.status);

  openModal('bookModalBackdrop');
}

async function saveBook() {
  const title  = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('bookAuthor').value.trim();
  const status = document.getElementById('bookStatus').value;

  if (!title || !author) {
    toast('Título e autor são obrigatórios.', 'error');
    return;
  }

  let cover = document.getElementById('bookCover').value.trim();

  if (!cover && !_editingId) {
    const btn = document.getElementById('saveBookBtn');
    btn.textContent = 'Buscando capa…';
    btn.disabled = true;
    cover = await fetchCoverUrl(title, author) || '';
    btn.textContent = 'Salvar';
    btn.disabled = false;
  }

  const book = {
    id:       _editingId || uid(),
    title,
    author,
    year:     document.getElementById('bookYear').value.trim(),
    cover,
    status,
    rating:   Number(document.getElementById('bookRating').value) || 0,
    review:   document.getElementById('bookReview').value.trim(),
    favorite: document.getElementById('bookFavorite').checked,
    readDate: document.getElementById('bookReadDate').value || null,
  };

  upsertBook(book);
  closeModal('bookModalBackdrop');
  render();
  toast(_editingId ? 'Livro atualizado!' : 'Livro adicionado à estante!', 'success');
}

function deleteBook() {
  if (!_editingId) return;
  if (!confirm('Tem certeza que deseja remover este livro?')) return;
  removeBook(_editingId);
  closeModal('bookModalBackdrop');
  render();
  toast('Livro removido.', 'default');
}

function resetBookForm() {
  document.getElementById('bookForm').reset();
  document.getElementById('bookId').value   = '';
  document.getElementById('bookRating').value = '0';
  setStarRating(0);
  updateCoverPreview('');
  toggleReadDateGroup('want');
}

function initStarRating() {
  const container = document.getElementById('starRating');

  container.querySelectorAll('.star').forEach(star => {
    // Hover: ilumina até a estrela
    star.addEventListener('mouseenter', () => {
      const val = Number(star.dataset.star);
      highlightStars(val, 'hover');
    });

    star.addEventListener('mouseleave', () => {
      const saved = Number(document.getElementById('bookRating').value);
      highlightStars(saved, 'active');
    });

    star.addEventListener('click', () => {
      const val = Number(star.dataset.star);
      document.getElementById('bookRating').value = val;
      setStarRating(val);
    });
  });
}

/** Define a nota visual */
function setStarRating(value) {
  highlightStars(value, 'active');
  document.getElementById('bookRating').value = value;
}

function highlightStars(value, cls) {
  const container = document.getElementById('starRating');
  container.querySelectorAll('.star').forEach(star => {
    star.classList.remove('active', 'hover');
    if (Number(star.dataset.star) <= value) {
      star.classList.add(cls);
    }
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function toggleReadDateGroup(status) {
  const group = document.getElementById('readDateGroup');
  group.style.display = status === 'read' ? 'flex' : 'none';
}

function updateCoverPreview(url) {
  const img   = document.getElementById('coverPreview');
  const ph    = document.getElementById('coverPlaceholder');

  if (url) {
    img.src = url;
    img.classList.add('show');
    ph.style.display = 'none';
    img.onerror = () => {
      img.classList.remove('show');
      ph.style.display = '';
    };
  } else {
    img.classList.remove('show');
    ph.style.display = '';
  }
}

function openProfileModal() {
  const p = AppState.profile;
  document.getElementById('profileNameInput').value   = p.name;
  document.getElementById('profileBioInput').value    = p.bio;
  document.getElementById('profileAvatarInput').value = p.avatar || '';
  openModal('profileModalBackdrop');
}

function saveProfile() {
  const name   = document.getElementById('profileNameInput').value.trim() || 'Leitor(a)';
  const bio    = document.getElementById('profileBioInput').value.trim();
  const avatar = document.getElementById('profileAvatarInput').value.trim();

  AppState.profile = { name, bio, avatar };
  saveState();
  closeModal('profileModalBackdrop');
  render();
  toast('Perfil atualizado!', 'success');
}

function openGoalModal() {
  document.getElementById('goalInput').value = AppState.goal.total;
  document.getElementById('goalYear').textContent = AppState.goal.year;
  openModal('goalModalBackdrop');
}

function saveGoal() {
  const total = parseInt(document.getElementById('goalInput').value, 10);
  if (!total || total < 1) { toast('Informe uma meta válida.', 'error'); return; }
  AppState.goal.total = total;
  AppState.goal.year  = new Date().getFullYear();
  saveState();
  closeModal('goalModalBackdrop');
  render();
  toast('Meta atualizada!', 'success');
}

function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const overlay   = document.getElementById('overlay');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('navbar--scrolled', window.scrollY > 20);
  }, { passive: true });

  function toggleMobile(force) {
    const open = force ?? !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
  }

  hamburger.addEventListener('click', () => toggleMobile());
  overlay.addEventListener('click',   () => toggleMobile(false));

  document.querySelectorAll('.mobile-menu .nav-link').forEach(l =>
    l.addEventListener('click', () => toggleMobile(false))
  );

  const sections = document.querySelectorAll('section[id]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.nav-link').forEach(l => {
          l.classList.toggle('active', l.dataset.section === e.target.id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => io.observe(s));
}

function initSearch() {
  const bar    = document.getElementById('searchBar');
  const input  = document.getElementById('searchInput');
  const toggle = document.getElementById('searchToggle');
  const close  = document.getElementById('searchClose');

  toggle.addEventListener('click', () => {
    bar.classList.add('open');
    input.focus();
  });

  close.addEventListener('click', () => {
    bar.classList.remove('open');
    input.value = '';
    AppState.ui.search = '';
    renderBooksGrid();
  });

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      AppState.ui.search = input.value;
      renderBooksGrid();
      document.getElementById('livros').scrollIntoView({ behavior: 'smooth' });
    }, 250);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      bar.classList.remove('open');
      input.value = '';
      AppState.ui.search = '';
      renderBooksGrid();
    }
  });
}

function initFilters() {
  document.getElementById('filterChips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
    chip.classList.add('chip--active');
    AppState.ui.filter = chip.dataset.filter;
    renderBooksGrid();
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    AppState.ui.sort = e.target.value;
    renderBooksGrid();
  });
}

function initBookModalEvents() {
  document.getElementById('fetchCoverBtn').addEventListener('click', async () => {
    const title  = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    if (!title) { toast('Preencha o título primeiro.', 'error'); return; }

    const btn = document.getElementById('fetchCoverBtn');
    btn.textContent = '…';
    btn.disabled = true;

    const url = await fetchCoverUrl(title, author);
    btn.textContent = 'Buscar';
    btn.disabled = false;

    if (url) {
      document.getElementById('bookCover').value = url;
      updateCoverPreview(url);
      toast('Capa encontrada!', 'success');
    } else {
      toast('Capa não encontrada. Insira a URL manualmente.', 'error');
    }
  });

  document.getElementById('bookCover').addEventListener('input', e => {
    updateCoverPreview(e.target.value.trim());
  });

  document.getElementById('bookStatus').addEventListener('change', e => {
    toggleReadDateGroup(e.target.value);
  });

  document.getElementById('saveBookBtn').addEventListener('click', saveBook);

  document.getElementById('deleteBookBtn').addEventListener('click', deleteBook);

  ['modalClose', 'cancelModalBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () => closeModal('bookModalBackdrop'))
  );

  document.getElementById('bookModalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'bookModalBackdrop') closeModal('bookModalBackdrop');
  });
}

function initAddBookButtons() {
  ['addBookBtn', 'addBookBtnMobile', 'heroAddBtn', 'emptyAddBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openAddModal);
  });
}

function initProfileEvents() {
  document.getElementById('editProfileBtn').addEventListener('click', openProfileModal);
  document.getElementById('editAvatarBtn').addEventListener('click', openProfileModal);

  ['profileModalClose', 'cancelProfileBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () => closeModal('profileModalBackdrop'))
  );

  document.getElementById('profileModalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'profileModalBackdrop') closeModal('profileModalBackdrop');
  });

  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

  document.getElementById('editGoalBtn').addEventListener('click', openGoalModal);

  ['goalModalClose', 'cancelGoalBtn'].forEach(id =>
    document.getElementById(id).addEventListener('click', () => closeModal('goalModalBackdrop'))
  );

  document.getElementById('goalModalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'goalModalBackdrop') closeModal('goalModalBackdrop');
  });

  document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
}



function seedDemoData() {
  if (AppState.books.length > 0) return;

  const demo = [
    {
      id: uid(), title: 'Dom Casmurro', author: 'Machado de Assis', year: '1899',
      cover: 'https://covers.openlibrary.org/b/id/8226198-M.jpg',
      status: 'read', rating: 5, review: 'Uma obra-prima da literatura brasileira. A narrativa de Bentinho é envolvente e o questionamento sobre Capitu permanece como um dos maiores enigmas da ficção.',
      favorite: true, readDate: '2024-03-15', createdAt: new Date(Date.now() - 9e6).toISOString()
    },
    {
      id: uid(), title: 'O Senhor dos Anéis', author: 'J.R.R. Tolkien', year: '1954',
      cover: 'https://covers.openlibrary.org/b/id/8743220-M.jpg',
      status: 'read', rating: 5, review: 'Uma jornada épica e inesquecível. A construção de mundo de Tolkien é incomparável.',
      favorite: true, readDate: '2024-01-20', createdAt: new Date(Date.now() - 8e6).toISOString()
    },
    {
      id: uid(), title: '1984', author: 'George Orwell', year: '1949',
      cover: 'https://covers.openlibrary.org/b/id/8575708-M.jpg',
      status: 'read', rating: 5, review: 'Distopia perturbadora e extremamente relevante. Orwell foi profético.',
      favorite: true, readDate: '2024-02-10', createdAt: new Date(Date.now() - 7e6).toISOString()
    },
    {
      id: uid(), title: 'Cem Anos de Solidão', author: 'Gabriel García Márquez', year: '1967',
      cover: 'https://covers.openlibrary.org/b/id/8290680-M.jpg',
      status: 'read', rating: 4, review: 'O realismo mágico de García Márquez é de arrepiar. Uma saga familiar que transcende o tempo.',
      favorite: false, readDate: '2023-12-05', createdAt: new Date(Date.now() - 6e6).toISOString()
    },
    {
      id: uid(), title: 'O Nome do Vento', author: 'Patrick Rothfuss', year: '2007',
      cover: 'https://covers.openlibrary.org/b/id/7915477-M.jpg',
      status: 'reading', rating: 0, review: '',
      favorite: false, readDate: null, createdAt: new Date(Date.now() - 5e6).toISOString()
    },
    {
      id: uid(), title: 'Crime e Castigo', author: 'Fiódor Dostoiévski', year: '1866',
      cover: 'https://covers.openlibrary.org/b/id/8290681-M.jpg',
      status: 'want', rating: 0, review: '',
      favorite: false, readDate: null, createdAt: new Date(Date.now() - 4e6).toISOString()
    },
    {
      id: uid(), title: 'A Revolução dos Bichos', author: 'George Orwell', year: '1945',
      cover: 'https://covers.openlibrary.org/b/id/8225266-M.jpg',
      status: 'read', rating: 4, review: 'Alegoria política brilhante, leitura rápida e impactante.',
      favorite: false, readDate: '2023-11-12', createdAt: new Date(Date.now() - 3e6).toISOString()
    },
    {
      id: uid(), title: 'Sapiens', author: 'Yuval Noah Harari', year: '2011',
      cover: 'https://covers.openlibrary.org/b/id/8406786-M.jpg',
      status: 'want', rating: 0, review: '',
      favorite: false, readDate: null, createdAt: new Date(Date.now() - 2e6).toISOString()
    },
  ];

  AppState.books = demo;
  saveState();
}

function init() {
  seedDemoData();
  initNavbar();
  initSearch();
  initFilters();
  initStarRating();
  initBookModalEvents();
  initAddBookButtons();
  initProfileEvents();

  render();

  console.log('%cShelfbox 📚 carregado!', 'color:#674ea7;font-size:1.2rem;font-weight:bold');
}

document.addEventListener('DOMContentLoaded', init);