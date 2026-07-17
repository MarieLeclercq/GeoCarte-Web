// ========== APP STATE ==========
let currentUser = null;
let maps = [];
let currentMap = null;
let selectedStyle = null;

const MAP_STYLES = [
    { id: 'political', name: 'Politique', icon: '🌍', bg: 'linear-gradient(135deg, #90EE90, #87CEEB)' },
    { id: 'physical', name: 'Physique', icon: '⛰️', bg: 'linear-gradient(135deg, #DEB887, #90EE90, #87CEEB)' },
    { id: 'satellite', name: 'Satellite', icon: '🛰️', bg: 'linear-gradient(135deg, #2F4F4F, #1a1a2e)' },
    { id: 'blank', name: 'Muette', icon: '📄', bg: '#FFFFFF' },
    { id: 'relief', name: 'Relief', icon: '🏔️', bg: 'linear-gradient(135deg, #D2691E, #90EE90)' },
    { id: 'shadedRelief', name: 'Relief ombré', icon: '🌄', bg: 'linear-gradient(135deg, #8B4513, #228B22)' },
    { id: 'topographic', name: 'Topographique', icon: '📊', bg: 'linear-gradient(135deg, #F0E68C, #98FB98)' },
    { id: 'simplified', name: 'Simplifiée', icon: '🗺️', bg: '#F5F5F5' },
    { id: 'countries', name: 'Pays', icon: '🏳️', bg: 'linear-gradient(135deg, #FFB6C1, #ADD8E6, #90EE90)' },
    { id: 'continents', name: 'Continents', icon: '🌐', bg: 'linear-gradient(135deg, #87CEEB, #98FB98)' },
    { id: 'oceans', name: 'Océans', icon: '🌊', bg: 'linear-gradient(135deg, #006994, #87CEEB)' },
    { id: 'rivers', name: 'Fleuves', icon: '💧', bg: 'linear-gradient(135deg, #E0F0FF, #87CEEB)' },
    { id: 'climate', name: 'Climatique', icon: '🌡️', bg: 'linear-gradient(135deg, #FF6347, #FFD700, #87CEEB)' },
    { id: 'density', name: 'Densités', icon: '👥', bg: 'linear-gradient(135deg, #DDA0DD, #87CEEB)' },
    { id: 'biomes', name: 'Biomes', icon: '🌿', bg: 'linear-gradient(135deg, #228B22, #DEB887, #87CEEB)' }
];

const PROJECTIONS = [
    { id: 'mercator', name: 'Mercator', icon: '🗺️' },
    { id: 'peters', name: 'Peters', icon: '📊' },
    { id: 'robinson', name: 'Robinson', icon: '🔵' },
    { id: 'polar', name: 'Polaire', icon: '❄️' },
    { id: 'azimuthal', name: 'Azimutale', icon: '☀️' },
    { id: 'orthographic', name: 'Orthographique', icon: '🌍' },
    { id: 'globe3D', name: 'Globe 3D', icon: '🌐' }
];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash').style.display = 'none';
            initApp();
        }, 300);
    }, 1500);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
});

function initApp() {
    loadData();
    if (currentUser) {
        showApp();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
    }
    initStyleGrid();
    initProjectionList();
}

// ========== AUTH ==========
let isSignUp = false;

function toggleAuth() {
    isSignUp = !isSignUp;
    document.getElementById('signup-fields').classList.toggle('hidden', !isSignUp);
    document.getElementById('role-selector').classList.toggle('hidden', !isSignUp);
    document.getElementById('auth-btn').textContent = isSignUp ? 'Créer un compte' : 'Se connecter';
    document.getElementById('toggle-auth').textContent = isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte';
}

document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

function authenticate() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) { showToast('Remplissez tous les champs'); return; }

    if (isSignUp) {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const role = document.querySelector('.seg-btn.active').dataset.role;
        if (!firstName || !lastName) { showToast('Remplissez votre nom et prénom'); return; }
        currentUser = { email, firstName, lastName, role, createdAt: new Date().toISOString() };
    } else {
        const saved = localStorage.getItem('geocarte_user');
        if (saved) {
            const u = JSON.parse(saved);
            if (u.email === email) { currentUser = u; } else { showToast('Email non trouvé'); return; }
        } else { showToast('Aucun compte trouvé. Créez-en un.'); return; }
    }

    saveData();
    showApp();
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-avatar').textContent = currentUser.firstName[0];
    document.getElementById('user-name').textContent = currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('user-role').textContent = currentUser.role === 'teacher' ? 'Enseignant' : 'Élève';

    document.querySelectorAll('.teacher-only').forEach(el => el.style.display = currentUser.role === 'teacher' ? '' : 'none');
    document.querySelectorAll('.student-only').forEach(el => el.style.display = currentUser.role === 'student' ? '' : 'none');

    renderMaps();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('geocarte_user');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
}

// ========== TABS ==========
function switchTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + tab).classList.add('active');
    const titles = { maps: 'Mes Cartes', library: 'Bibliothèque', classes: 'Mes Classes', work: 'Mes Travaux', settings: 'Réglages' };
    document.getElementById('page-title').textContent = titles[tab] || 'GeoCarte';
}

// ========== MAPS ==========
function renderMaps() {
    const grid = document.getElementById('maps-grid');
    const empty = document.getElementById('empty-maps');
    const userMaps = maps.filter(m => m.owner === currentUser.email);
    const filtered = selectedStyle ? userMaps.filter(m => m.style === selectedStyle) : userMaps;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        grid.innerHTML = filtered.map(m => `
            <div class="map-card" onclick="openMap('${m.id}')">
                <div class="map-thumb" style="background: ${getStyleBg(m.style)}">
                    <span>${getStyleIcon(m.style)}</span>
                    <span class="badge">${getStyleName(m.style)}</span>
                </div>
                <div class="map-info">
                    <h3>${m.name}</h3>
                    <p>${m.projection} · ${timeAgo(m.updatedAt)}</p>
                </div>
            </div>
        `).join('');
    }
}

function filterByStyle(style, btn) {
    selectedStyle = style;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderMaps();
}

function filterMaps(query) {
    const cards = document.querySelectorAll('.map-card');
    cards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = name.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function getStyleBg(id) { return (MAP_STYLES.find(s => s.id === id) || MAP_STYLES[0]).bg; }
function getStyleIcon(id) { return (MAP_STYLES.find(s => s.id === id) || MAP_STYLES[0]).icon; }
function getStyleName(id) { return (MAP_STYLES.find(s => s.id === id) || MAP_STYLES[0]).name; }

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return mins + ' min';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h';
    return Math.floor(hours / 24) + ' j';
}

// ========== NEW MAP ==========
function initStyleGrid() {
    const grid = document.getElementById('style-grid');
    grid.innerHTML = MAP_STYLES.map(s => `
        <div class="style-option ${s.id === 'political' ? 'selected' : ''}" data-style="${s.id}" onclick="selectStyle('${s.id}', this)">
            <span class="style-icon">${s.icon}</span>
            ${s.name}
        </div>
    `).join('');
}

function initProjectionList() {
    const list = document.getElementById('projection-list');
    list.innerHTML = PROJECTIONS.map(p => `
        <div class="projection-option ${p.id === 'mercator' ? 'selected' : ''}" data-projection="${p.id}" onclick="selectProjection('${p.id}', this)">
            <span>${p.icon}</span>
            <span>${p.name}</span>
            <span class="check">✓</span>
        </div>
    `).join('');
}

let newMapStyle = 'political';
let newMapProjection = 'mercator';

function selectStyle(id, el) {
    newMapStyle = id;
    document.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
}

function selectProjection(id, el) {
    newMapProjection = id;
    document.querySelectorAll('.projection-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
}

function showNewMap() {
    document.getElementById('new-map-modal').classList.remove('hidden');
    document.getElementById('new-map-name').value = '';
    document.getElementById('new-map-desc').value = '';
    document.getElementById('new-map-name').focus();
}

function createMap() {
    const name = document.getElementById('new-map-name').value.trim();
    if (!name) { showToast('Donnez un nom à la carte'); return; }

    const map = {
        id: Date.now().toString(),
        name,
        description: document.getElementById('new-map-desc').value.trim(),
        style: newMapStyle,
        projection: newMapProjection,
        owner: currentUser.email,
        layers: [{ id: '1', name: 'Calque 1', visible: true, locked: false, elements: [] }],
        texts: [],
        legend: { title: 'Légende', items: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    maps.push(map);
    saveData();
    closeModal('new-map-modal');
    renderMaps();
    showToast('Carte créée !');
}

function deleteMap(id) {
    if (!confirm('Supprimer cette carte ?')) return;
    maps = maps.filter(m => m.id !== id);
    saveData();
    renderMaps();
    showToast('Carte supprimée');
}

// ========== MODAL ==========
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ========== TOAST ==========
function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ========== DARK MODE ==========
function toggleDarkMode() {
    const dark = document.getElementById('dark-mode').checked;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('geocarte_theme', dark ? 'dark' : 'light');
}

// ========== STORAGE ==========
function saveData() {
    localStorage.setItem('geocarte_user', JSON.stringify(currentUser));
    localStorage.setItem('geocarte_maps', JSON.stringify(maps));
}

function loadData() {
    try {
        const u = localStorage.getItem('geocarte_user');
        if (u) currentUser = JSON.parse(u);
        const m = localStorage.getItem('geocarte_maps');
        if (m) maps = JSON.parse(m);
        const theme = localStorage.getItem('geocarte_theme');
        if (theme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); document.getElementById('dark-mode').checked = true; }
    } catch (e) {}
}

function exportData() {
    const data = JSON.stringify({ user: currentUser, maps }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geocarte-export.json';
    a.click();
    showToast('Données exportées');
}

function syncData() { showToast('Synchronisation... (bientôt disponible)'); }
