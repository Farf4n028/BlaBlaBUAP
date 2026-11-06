(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_POSTS = 'blabla_cu2_posts_v1';
  const STORAGE_PROFILE = 'blabla_cu2_profile_v1';
  const STORAGE_LIKES = 'blabla_cu2_likes_v1';
  const STORAGE_THEME = 'blablabuap_theme_v1';

  const themeToggle = $('#theme-toggle');
  function applyTheme(theme, save = true) {
    const selected = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selected;
    if (themeToggle) {
      const icon = $('.theme-toggle-icon', themeToggle);
      if (icon) icon.textContent = selected === 'dark' ? '☀' : '☾';
      const label = selected === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
      themeToggle.setAttribute('aria-label', label);
      themeToggle.setAttribute('title', label);
    }
    if (save) {
      try { localStorage.setItem(STORAGE_THEME, selected); }
      catch (error) { console.warn('No se pudo guardar el tema:', error); }
    }
  }
  let savedTheme = 'light';
  try { savedTheme = localStorage.getItem(STORAGE_THEME) || 'light'; }
  catch (error) { console.warn('No se pudo leer el tema guardado:', error); }
  applyTheme(savedTheme, false);
  themeToggle?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  const samplePosts = [
    { id: 'sample-1', author: 'Sofía Hernández', initials: 'SH', school: 'Estudiante · CU2', origin: 'San Pedro Cholula', route: 'Tomo Periférico y entro por Valsequillo', date: '2026-10-30', time: '07:00', contribution: '25', seats: '2', note: 'Salgo temprano. Podemos acordar un punto cómodo sobre la ruta.', likes: 4, createdAt: 1 },
    { id: 'sample-2', author: 'Diego Martínez', initials: 'DM', school: 'Estudiante · CU2', origin: 'Plaza Dorada', route: 'Paso por 14 Sur y sigo hacia CU2', date: '2026-10-30', time: '08:10', contribution: '15', seats: '3', note: 'Tengo espacio. La aportación es para compartir gasolina.', likes: 2, createdAt: 2 },
    { id: 'sample-3', author: 'Valeria López', initials: 'VL', school: 'Estudiante · CU2', origin: 'Lomas de Angelópolis', route: 'Voy por Vía Atlixcáyotl y Periférico', date: '2026-10-31', time: '09:00', contribution: '', seats: '1', note: 'Podemos ponernos de acuerdo con el punto de encuentro.', likes: 6, createdAt: 3 }
  ];

  function safeRead(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (error) { console.warn('No se pudo leer el almacenamiento local:', error); return fallback; }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { showToast('El navegador no pudo guardar los cambios.'); return false; }
  }
  let posts = safeRead(STORAGE_POSTS, null);
  if (!Array.isArray(posts) || posts.length === 0) { posts = samplePosts; safeWrite(STORAGE_POSTS, posts); }
  let profile = safeRead(STORAGE_PROFILE, null);
  let likedPosts = safeRead(STORAGE_LIKES, []);
  if (!Array.isArray(likedPosts)) likedPosts = [];
  let activeFilter = 'all';

  const authDialog = $('#auth-dialog');
  const postDialog = $('#post-dialog');
  const errorDialog = $('#error-dialog');
  const toast = $('#toast');
  const authForm = $('#auth-form');
  const credentialVerification = $('#credential-verification');
  const sendCredentialsBtn = $('#send-credentials');
  const credentialFiles = {
    ine: { file: null, url: null },
    student: { file: null, url: null }
  };
  let authMode = 'login';
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
  }
  function initials(name) {
    return String(name || 'Usuario').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
  function normalise(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function prettyDate(value) {
    if (!value) return 'Fecha por acordar';
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function updateProfileUI() {
    const loggedOut = $('#logged-out-actions');
    const loggedIn = $('#logged-in-actions');
    const name = $('#profile-name');
    const avatar = $('#profile-avatar');
    const dropdownName = $('#dropdown-profile-name');
    const dropdownEmail = $('#dropdown-profile-email');
    const dropdownAvatar = $('#dropdown-avatar');
    const dropdown = $('#user-dropdown');
    const menuToggle = $('#profile-menu-toggle');
    if (profile) {
      loggedOut?.classList.add('hidden');
      loggedIn?.classList.remove('hidden');
      if (name) name.textContent = profile.name;
      if (avatar) avatar.textContent = initials(profile.name);
      if (dropdownName) dropdownName.textContent = profile.name;
      if (dropdownEmail) dropdownEmail.textContent = profile.email;
      if (dropdownAvatar) dropdownAvatar.textContent = initials(profile.name);
      $$('.needs-profile').forEach(el => { el.disabled = false; el.removeAttribute('aria-disabled'); });
    } else {
      loggedOut?.classList.remove('hidden');
      loggedIn?.classList.add('hidden');
      dropdown?.classList.add('hidden');
      menuToggle?.setAttribute('aria-expanded', 'false');
      $$('.needs-profile').forEach(el => { el.disabled = false; el.removeAttribute('aria-disabled'); });
    }
  }
  function postCard(post) {
    const liked = likedPosts.includes(post.id);
    const likeCount = Number(post.likes ?? post.interests ?? 0) + (liked ? 1 : 0);
    const amount = post.contribution ? `<strong class="price">$${escapeHTML(post.contribution)} <small>MXN</small></strong>` : '<strong class="price flexible">A convenir</strong>';
    const seats = post.seats ? `<span class="meta-item"><span class="meta-icon">♙</span>${escapeHTML(post.seats)} lugares</span>` : '';
    const note = post.note ? `<p class="post-note">${escapeHTML(post.note)}</p>` : '';
    const route = post.route ? `<p class="route-detail">${escapeHTML(post.route)}</p>` : '';
    return `<article class="post-card" data-post-id="${escapeHTML(post.id)}">
      <div class="post-top"><div class="avatar">${escapeHTML(post.initials || initials(post.author))}</div><div class="author"><strong>${escapeHTML(post.author)}</strong><span>${escapeHTML(post.school || 'Comunidad CU2')}</span></div><span class="post-tag">Viaje a CU2</span></div>
      <div class="journey"><div class="journey-point"><span class="dot origin-dot"></span><div><small>SALE DE</small><strong>${escapeHTML(post.origin)}</strong></div></div><div class="journey-line"><span></span></div><div class="journey-point destination"><span class="dot destination-dot"></span><div><small>DESTINO</small><strong>CU2 · BUAP</strong></div></div></div>
      ${route}
      <div class="post-meta"><span class="meta-item"><span class="meta-icon">▦</span>${escapeHTML(prettyDate(post.date))}</span><span class="meta-item"><span class="meta-icon">◷</span>${escapeHTML(post.time || 'Hora por acordar')}</span>${seats}</div>
      ${note}
      <div class="post-bottom"><div class="contribution"><small>APORTACIÓN POR PERSONA</small>${amount}</div><button class="like-btn ${liked ? 'is-liked' : ''}" data-like="${escapeHTML(post.id)}" type="button" aria-label="${liked ? 'Quitar me gusta' : 'Me gusta'}" aria-pressed="${liked ? 'true' : 'false'}" title="${liked ? 'Quitar me gusta' : 'Me gusta'}"><span class="like-heart" aria-hidden="true">${liked ? '♥' : '♡'}</span><span class="like-count">${likeCount}</span></button></div>
    </article>`;
  }
  function renderPosts() {
    const container = $('#posts-container');
    if (!container) return;
    const query = normalise($('#search-input')?.value || '');
    const filtered = posts.filter(post => {
      const searchable = normalise([post.origin, post.route, post.author, post.note].join(' '));
      const matchesQuery = !query || searchable.includes(query);
      const matchesFilter = activeFilter === 'all' || normalise(post.origin).includes(activeFilter);
      return matchesQuery && matchesFilter;
    }).sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
    $('#post-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'viaje publicado' : 'viajes publicados'}`;
    container.innerHTML = filtered.length ? filtered.map(postCard).join('') : `<div class="empty-state"><div class="empty-icon">⌕</div><h3>No encontramos viajes</h3><p>Prueba con otra zona o publica el primer viaje de esta búsqueda.</p><button type="button" class="secondary-btn" id="clear-search">Ver todos</button></div>`;
  }

  function checkFormReadiness() {
    const readyCount = Object.values(credentialFiles).filter(item => item.file).length;
    
    if (sendCredentialsBtn) {
      sendCredentialsBtn.disabled = readyCount < 2;
    }

    const status = $('#verification-status');
    if (status) {
      status.textContent = readyCount === 2
        ? '¡Listo! Ya están seleccionadas las dos fotografías.'
        : `Fotografía ${readyCount} de 2 seleccionada. Falta un documento.`;
      status.classList.toggle('is-complete', readyCount === 2);
    }
  }

  function resetCredentialUploads() {
    Object.entries(credentialFiles).forEach(([type, state]) => {
      if (state.url) URL.revokeObjectURL(state.url);
      state.file = null;
      state.url = null;
      const preview = $(`#${type}-preview`);
      const fileName = $(`#${type}-file-name`);
      const changeButton = $(`[data-change-image="${type}"]`);
      const card = $(`[data-credential-card="${type}"]`);
      if (preview) {
        preview.classList.remove('has-image');
        preview.innerHTML = '<div class="preview-placeholder"><span aria-hidden="true">▧</span><strong>Arrastra o haz clic</strong><small>Tu foto aparecerá aquí</small></div>';
      }
      if (fileName) fileName.textContent = 'Ninguna imagen seleccionada';
      if (changeButton) changeButton.hidden = true;
      if (card) card.classList.remove('is-ready');
      [`#${type}-camera`, `#${type}-gallery`].forEach(selector => {
        const input = $(selector);
        if (input) input.value = '';
      });
    });
    checkFormReadiness();
  }

  function setAuthMode(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    const isRegister = authMode === 'register';
    if (credentialVerification) credentialVerification.hidden = !isRegister;
    authDialog?.classList.toggle('is-register', isRegister);
    $('#auth-kicker').textContent = isRegister ? 'CREA TU PERFIL UNIVERSITARIO' : 'BIENVENIDO A LA COMUNIDAD';
    $('#auth-title').textContent = isRegister ? 'Tu camino empieza aquí.' : 'Hagamos camino.';
    $('#auth-lead').textContent = isRegister
      ? 'Completa tus datos y agrega tus dos credenciales para solicitar la verificación.'
      : 'Agrega tu nombre y correo para entrar a la comunidad.';
    $('#auth-submit').hidden = isRegister;
    $('#auth-submit').textContent = 'Entrar a la demo →';
    $('#auth-fine-print').hidden = isRegister;
    if (isRegister) resetCredentialUploads();
  }

  function openAuth(mode = 'login') {
    if (typeof authDialog.showModal === 'function') {
      authForm?.reset();
      resetCredentialUploads();
      setAuthMode(mode);
      authDialog.showModal();
    } else showToast('Tu navegador no admite esta ventana.');
  }

  function setCredentialImage(type, file) {
    if (!file) return;
    const allowedImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
    if (!allowedImage) {
      showToast('Selecciona un archivo de imagen válido.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('La imagen supera el límite de 12 MB. Elige una más ligera.');
      return;
    }

    const state = credentialFiles[type];
    if (state.url) URL.revokeObjectURL(state.url);
    state.file = file;
    state.url = URL.createObjectURL(file);

    const preview = $(`#${type}-preview`);
    const fileName = $(`#${type}-file-name`);
    const changeButton = $(`[data-change-image="${type}"]`);
    const card = $(`[data-credential-card="${type}"]`);
    
    if (preview) {
      const image = document.createElement('img');
      image.src = state.url;
      image.alt = type === 'ine' ? 'Vista previa de la INE' : 'Vista previa de la credencial de estudiante';
      preview.replaceChildren(image);
      preview.classList.add('has-image');
    }
    if (fileName) fileName.textContent = file.name;
    if (changeButton) changeButton.hidden = false;
    if (card) card.classList.add('is-ready');

    checkFormReadiness();
  }

  function setupDropZone(type) {
    const zone = $(`#${type}-drop-zone`);
    if (!zone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      zone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
      });
    });

    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) setCredentialImage(type, file);
    });
    
    zone.addEventListener('click', () => {
      const input = $(`#${type}-gallery`);
      if (input) input.click();
    });
  }

  function openPost() {
    if (!profile) { openAuth(); showToast('Entra a la demo para publicar tu viaje.'); return; }
    if (typeof postDialog.showModal === 'function') postDialog.showModal();
  }
  function resetDemo() {
    posts = samplePosts.map(post => ({ ...post }));
    profile = null;
    likedPosts = [];
    safeWrite(STORAGE_POSTS, posts); safeWrite(STORAGE_PROFILE, profile); safeWrite(STORAGE_LIKES, likedPosts);
    updateProfileUI(); renderPosts(); showToast('La demostración volvió a su estado inicial.');
  }

  $('#login-button')?.addEventListener('click', () => openAuth('login'));
  $('#register-button')?.addEventListener('click', () => openAuth('register'));
  $('#hero-publish')?.addEventListener('click', openPost);
  $('#rail-publish')?.addEventListener('click', openPost);
  $('#post-dialog-open')?.addEventListener('click', openPost);
  $('#logout-button')?.addEventListener('click', () => { closeUserMenu(); profile = null; safeWrite(STORAGE_PROFILE, profile); updateProfileUI(); showToast('Saliste de la demostración.'); });
  const menuToggle = $('#profile-menu-toggle');
  const userDropdown = $('#user-dropdown');
  function closeUserMenu() {
    userDropdown?.classList.add('hidden');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
  menuToggle?.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = !userDropdown?.classList.contains('hidden');
    userDropdown?.classList.toggle('hidden', isOpen);
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
  });
  userDropdown?.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', event => {
    if (!event.target.closest('.profile-menu')) closeUserMenu();
  });
  $$('.dropdown-item[data-menu-item]').forEach(button => button.addEventListener('click', () => {
    const section = button.dataset.menuItem;
    closeUserMenu();
    showToast(`${section}: esta sección estará disponible próximamente.`);
  }));

  $('#reset-demo')?.addEventListener('click', resetDemo);
  $('#search-input')?.addEventListener('input', renderPosts);

  $$('.filter-btn').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter || 'all';
    $$('.filter-btn').forEach(item => item.classList.toggle('active', item === button));
    renderPosts();
  }));

  document.addEventListener('click', event => {
    const likeButton = event.target.closest('[data-like]');
    if (likeButton) {
      const id = likeButton.dataset.like;
      if (!profile) { openAuth(); showToast('Entra a la demo para dar like.'); return; }
      if (likedPosts.includes(id)) likedPosts = likedPosts.filter(item => item !== id);
      else likedPosts.push(id);
      safeWrite(STORAGE_LIKES, likedPosts);
      renderPosts();
    }
    if (event.target.id === 'clear-search') {
      if ($('#search-input')) $('#search-input').value = '';
      activeFilter = 'all';
      $$('.filter-btn').forEach(item => item.classList.toggle('active', item.dataset.filter === 'all'));
      renderPosts();
    }
  });

  // --- FORMULARIO DE AUTENTICACIÓN (CON VALIDACIÓN Y POP-UP) ---
  authForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('#auth-name').value.trim();
    const email = $('#auth-email').value.trim();
    if (!name || !email) { showToast('Completa tu nombre y correo para continuar.'); return; }

    if (authMode === 'register') {
      const missing = Object.entries(credentialFiles).filter(([, state]) => !state.file).map(([type]) => type);
      if (missing.length) {
        const message = missing.length === 2
          ? 'Agrega la INE y la credencial de estudiante para continuar.'
          : `Falta la fotografía de ${missing[0] === 'ine' ? 'la INE' : 'la credencial de estudiante'}.`;
        showToast(message);
        $(`[data-credential-card="${missing[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const submitBtn = $('#send-credentials');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Verificando credenciales... 🕒';
      submitBtn.disabled = true;

      const formData = new FormData();
      formData.append('nombre', name);
      formData.append('email', email);
      formData.append('ine', credentialFiles.ine.file);
      formData.append('student', credentialFiles.student.file);

      try {
        const response = await fetch('https://blablabuap.onrender.com/api/verificar-credenciales', {
          method: 'POST',
          body: formData
        });

        // Si el servidor responde con un error (ej. nombres no coinciden)
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Error al procesar las credenciales.');
        }

        // Si todo sale bien, creamos el perfil
        profile = { name, email, verificationStatus: 'verificado' };
        safeWrite(STORAGE_PROFILE, profile);
        updateProfileUI();
        authDialog.close();
        showToast(`¡Perfil creado, ${name.split(' ')[0]}! Credenciales verificadas.`);
        
      } catch (error) {
        console.error(error);
        
        if (error.message === 'Failed to fetch') {
          showToast('No se pudo conectar con el servidor. ¿Está encendido Python?');
        } else {
          if (error.message.includes("no coincide")) {
            resetCredentialUploads();
            
            // MOSTRAR VENTANA EMERGENTE
            const errorMsg = $('#error-message');
            if (errorMsg) errorMsg.textContent = error.message;
            if (errorDialog) errorDialog.showModal();
            
          } else {
            showToast(error.message);
          }
        }
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
      return;
    }

    // Login normal (sin fotos)
    profile = { name, email, verificationStatus: 'sin_verificar' };
    safeWrite(STORAGE_PROFILE, profile);
    updateProfileUI();
    authDialog.close();
    showToast(`¡Listo, ${name.split(' ')[0]}! Ya puedes publicar.`);
  });

  $('#post-form')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!profile) { postDialog.close(); openAuth(); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    const post = {
      id: `post-${Date.now()}`,
      author: profile.name,
      initials: initials(profile.name),
      school: 'Estudiante · CU2',
      origin: String(data.get('origin') || '').trim(),
      route: String(data.get('route') || '').trim(),
      date: String(data.get('date') || ''),
      time: String(data.get('time') || ''),
      contribution: String(data.get('contribution') || '').trim(),
      seats: String(data.get('seats') || '').trim(),
      note: String(data.get('note') || '').trim(),
      likes: 0,
      createdAt: Date.now()
    };
    if (!post.origin || !post.date || !post.time) { showToast('Completa origen, fecha y hora.'); return; }
    posts.unshift(post);
    if (safeWrite(STORAGE_POSTS, posts)) {
      form.reset(); postDialog.close();
      activeFilter = 'all';
      $$('.filter-btn').forEach(item => item.classList.toggle('active', item.dataset.filter === 'all'));
      renderPosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('¡Tu viaje ya aparece en el muro!');
    }
  });

  $$('[data-camera]').forEach(button => button.addEventListener('click', () => {
    const input = $(`#${button.dataset.camera}-camera`);
    if (input) input.click();
  }));
  $$('[data-gallery]').forEach(button => button.addEventListener('click', () => {
    const input = $(`#${button.dataset.gallery}-gallery`);
    if (input) input.click();
  }));
  $$('[data-change-image]').forEach(button => button.addEventListener('click', () => {
    const input = $(`#${button.dataset.changeImage}-gallery`);
    if (input) input.click();
  }));
  
  ['ine', 'student'].forEach(type => {
    setupDropZone(type);
    [`#${type}-camera`, `#${type}-gallery`].forEach(selector => {
      const input = $(selector);
      input?.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) setCredentialImage(type, file);
        input.value = '';
      });
    });
  });
  
  authDialog?.addEventListener('close', resetCredentialUploads);

  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => {
    const dialog = button.closest('dialog'); if (dialog) dialog.close();
  }));
  [authDialog, postDialog].forEach(dialog => dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  }));

  const dateField = document.querySelector('#post-form input[name="date"]');
  if (dateField) {
    const now = new Date();
    const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateField.min = localToday;
  }

  updateProfileUI();
  renderPosts();
})();