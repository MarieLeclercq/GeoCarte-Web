let currentUser = null;
let maps = [];
let currentMap = null;
let selectedStyle = null;
let classes = [];
let editingMapId = null;

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
    { id: 'polar', name: 'Polaire', icon: '❄️' }
];

const LIBRARY_MAPS = [
    { id: 'lib1', name: 'Carte du Monde Politique', style: 'political', projection: 'mercator', region: 'monde', desc: 'Carte interactive du monde avec les frontières politiques' },
    { id: 'lib2', name: 'Europe Physique', style: 'physical', projection: 'mercator', region: 'europe', desc: 'Relief et topographie de l\'Europe' },
    { id: 'lib3', name: 'France Topographique', style: 'topographic', projection: 'mercator', region: 'france', desc: 'Carte topographique de la France' },
    { id: 'lib4', name: 'Afrique Satellite', style: 'satellite', projection: 'mercator', region: 'afrique', desc: 'Vue satellite de l\'Afrique' },
    { id: 'lib5', name: 'Asie Politique', style: 'political', projection: 'mercator', region: 'asie', desc: 'Frontières et pays d\u2019Asie' },
    { id: 'lib6', name: 'Amériques Physique', style: 'physical', projection: 'mercator', region: 'amerique', desc: 'Relief des Amériques du Nord et Sud' },
    { id: 'lib7', name: 'France Muette', style: 'blank', projection: 'mercator', region: 'france', desc: 'Carte vierge de la France pour exercices' },
    { id: 'lib8', name: 'Monde Climatique', style: 'climate', projection: 'mercator', region: 'monde', desc: 'Zones climatiques du globe' },
    { id: 'lib9', name: 'Europe Muette', style: 'blank', projection: 'mercator', region: 'europe', desc: 'Carte vierge de l\'Europe' },
    { id: 'lib10', name: 'Monde Océans', style: 'oceans', projection: 'mercator', region: 'monde', desc: 'Carte des océans et mers du monde' },
    { id: 'lib11', name: 'Afrique Muette', style: 'blank', projection: 'mercator', region: 'afrique', desc: 'Carte vierge de l\'Afrique' },
    { id: 'lib12', name: 'Asie Muette', style: 'blank', projection: 'mercator', region: 'asie', desc: 'Carte vierge de l\'Asie' }
];

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => { document.getElementById('splash').style.display = 'none'; initApp(); }, 300);
    }, 1500);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
});

function initApp() {
    loadData();
    if (currentUser) showApp();
    else document.getElementById('auth-screen').classList.remove('hidden');
    initStyleGrid();
    initProjectionList();
    renderLibrary();
}

let isSignUp = false;
let authRole = 'student';

function setAuthRole(role) {
    authRole = role;
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.seg-btn[data-role="${role}"]`).classList.add('active');
    document.getElementById('auth-student-fields').classList.toggle('hidden', role !== 'student');
    document.getElementById('auth-teacher-fields').classList.toggle('hidden', role !== 'teacher');
}

function toggleAuth() {
    isSignUp = !isSignUp;
    document.getElementById('signup-fields').classList.toggle('hidden', !isSignUp);
    document.querySelector('#auth-teacher-fields .btn-primary').textContent = isSignUp ? 'Créer un compte' : 'Se connecter';
    document.getElementById('toggle-auth').textContent = isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un compte';
}

function authenticate() {
    if (authRole === 'student') {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const classCode = document.getElementById('classCode').value.trim().toUpperCase();
        if (!firstName || !lastName || !classCode) { showToast('Remplissez tous les champs'); return; }
        const email = firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@eleve.local';
        currentUser = { email, firstName, lastName, role: 'student', classCode, createdAt: new Date().toISOString() };
    } else {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!email || !password) { showToast('Remplissez tous les champs'); return; }
        if (isSignUp) {
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            if (!firstName || !lastName) { showToast('Remplissez votre nom et prénom'); return; }
            currentUser = { email, firstName, lastName, role: 'teacher', createdAt: new Date().toISOString() };
        } else {
            const allUsers = JSON.parse(localStorage.getItem('geocarte_users') || '[]');
            const u = allUsers.find(u => u.email === email);
            if (u) { currentUser = u; }
            else { showToast('Aucun compte trouvé'); return; }
        }
    }
    const allUsers = JSON.parse(localStorage.getItem('geocarte_users') || '[]');
    if (!allUsers.find(u => u.email === currentUser.email)) { allUsers.push(currentUser); localStorage.setItem('geocarte_users', JSON.stringify(allUsers)); }
    saveData();
    showApp();
}

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-avatar').textContent = currentUser.firstName[0];
    document.getElementById('user-name').textContent = currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('user-email').textContent = currentUser.classCode || currentUser.email;
    document.getElementById('user-role').textContent = currentUser.role === 'teacher' ? 'Enseignant' : 'Élève';
    document.querySelectorAll('.teacher-only').forEach(el => el.style.display = currentUser.role === 'teacher' ? '' : 'none');
    document.querySelectorAll('.student-only').forEach(el => el.style.display = currentUser.role === 'student' ? '' : 'none');
    renderMaps();
    renderClasses();
    renderQuizzes();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('geocarte_user');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
}

function switchTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + tab).classList.add('active');
    const titles = { maps: 'Mes Cartes', library: 'Bibliothèque', classes: 'Mes Classes', quizzes: 'Mes Quiz', work: 'Mes Travaux', settings: 'Réglages' };
    document.getElementById('page-title').textContent = titles[tab] || 'GeoCarte';
}

function renderMaps() {
    const grid = document.getElementById('maps-grid');
    const empty = document.getElementById('empty-maps');
    const userMaps = maps.filter(m => m.owner === currentUser.email);
    const filtered = selectedStyle ? userMaps.filter(m => m.style === selectedStyle) : userMaps;
    if (filtered.length === 0) { grid.innerHTML = ''; empty.classList.remove('hidden'); }
    else {
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
                <div class="map-actions" onclick="event.stopPropagation()">
                    <button class="map-action-btn" onclick="showEditMap('${m.id}')">✏️</button>
                    <button class="map-action-btn" onclick="deleteMap('${m.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }
}

function filterByStyle(style, btn) {
    selectedStyle = style;
    document.querySelectorAll('#page-maps .filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderMaps();
}

function filterMaps(query) {
    document.querySelectorAll('#maps-grid .map-card').forEach(card => {
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
    const h = Math.floor(mins / 60);
    if (h < 24) return h + 'h';
    return Math.floor(h / 24) + ' j';
}

function initStyleGrid() {
    document.getElementById('style-grid').innerHTML = MAP_STYLES.map(s => `
        <div class="style-option ${s.id === 'political' ? 'selected' : ''}" data-style="${s.id}" onclick="selectStyle('${s.id}', this)">
            <span class="style-icon">${s.icon}</span>${s.name}
        </div>
    `).join('');
}

function initProjectionList() {
    document.getElementById('projection-list').innerHTML = PROJECTIONS.map(p => `
        <div class="projection-option ${p.id === 'mercator' ? 'selected' : ''}" data-projection="${p.id}" onclick="selectProjection('${p.id}', this)">
            <span>${p.icon}</span><span>${p.name}</span><span class="check">✓</span>
        </div>
    `).join('');
}

let newMapStyle = 'political';
let newMapProjection = 'mercator';
function selectStyle(id, el) { newMapStyle = id; document.querySelectorAll('.style-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); }
function selectProjection(id, el) { newMapProjection = id; document.querySelectorAll('.projection-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); }

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
        id: Date.now().toString(), name,
        description: document.getElementById('new-map-desc').value.trim(),
        style: newMapStyle, projection: newMapProjection,
        owner: currentUser.email,
        layers: [{ id: '1', name: 'Calque 1', visible: true, locked: false, elements: [] }],
        legend: { title: 'Légende', items: [] },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
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

function showEditMap(id) {
    const map = maps.find(m => m.id === id);
    if (!map) return;
    editingMapId = id;
    document.getElementById('edit-map-name').value = map.name;
    document.getElementById('edit-map-desc').value = map.description || '';
    document.getElementById('edit-style-grid').innerHTML = MAP_STYLES.map(s => `
        <div class="style-option ${s.id === map.style ? 'selected' : ''}" onclick="editSelectStyle('${s.id}', this)">
            <span class="style-icon">${s.icon}</span>${s.name}
        </div>
    `).join('');
    editingMapStyle = map.style;
    document.getElementById('edit-map-modal').classList.remove('hidden');
}

let editingMapStyle = 'political';
function editSelectStyle(id, el) {
    editingMapStyle = id;
    document.querySelectorAll('#edit-style-grid .style-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
}

function saveEditMap() {
    const map = maps.find(m => m.id === editingMapId);
    if (!map) return;
    const name = document.getElementById('edit-map-name').value.trim();
    if (!name) { showToast('Le nom ne peut pas être vide'); return; }
    map.name = name;
    map.description = document.getElementById('edit-map-desc').value.trim();
    map.style = editingMapStyle;
    map.updatedAt = new Date().toISOString();
    saveData();
    closeModal('edit-map-modal');
    renderMaps();
    showToast('Carte modifiée');
}

function deleteEditingMap() {
    if (!confirm('Supprimer cette carte ?')) return;
    maps = maps.filter(m => m.id !== editingMapId);
    saveData();
    closeModal('edit-map-modal');
    renderMaps();
    showToast('Carte supprimée');
}

// ========== LIBRARY ==========
let libraryFilter = null;
function renderLibrary() {
    const grid = document.getElementById('library-grid');
    const filtered = libraryFilter ? LIBRARY_MAPS.filter(m => m.region === libraryFilter) : LIBRARY_MAPS;
    grid.innerHTML = filtered.map(m => `
        <div class="map-card" onclick="useLibraryMap('${m.id}')">
            <div class="map-thumb" style="background: ${getStyleBg(m.style)}">
                <span>${getStyleIcon(m.style)}</span>
                <span class="badge">${getStyleName(m.style)}</span>
            </div>
            <div class="map-info">
                <h3>${m.name}</h3>
                <p>${m.desc}</p>
            </div>
        </div>
    `).join('');
}

function filterLibraryRegion(region, btn) {
    libraryFilter = region;
    document.querySelectorAll('#page-library .filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderLibrary();
}

function filterLibrary(query) {
    document.querySelectorAll('#library-grid .map-card').forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = name.includes(query.toLowerCase()) ? '' : 'none';
    });
}

function useLibraryMap(libId) {
    const lib = LIBRARY_MAPS.find(m => m.id === libId);
    if (!lib) return;
    const map = {
        id: Date.now().toString(), name: lib.name,
        description: lib.desc,
        style: lib.style, projection: lib.projection,
        owner: currentUser.email,
        layers: [{ id: '1', name: 'Calque 1', visible: true, locked: false, elements: [] }],
        legend: { title: 'Légende', items: [] },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    maps.push(map);
    saveData();
    switchTab('maps', document.querySelector('[data-tab="maps"]'));
    renderMaps();
    showToast('Carte ajoutée à vos cartes');
    setTimeout(() => openMap(map.id), 300);
}

// ========== CLASSES ==========
function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showNewClass() {
    document.getElementById('new-class-modal').classList.remove('hidden');
    document.getElementById('class-name').value = '';
    document.getElementById('class-subject').value = '';
}

function createClass() {
    const name = document.getElementById('class-name').value.trim();
    const subject = document.getElementById('class-subject').value.trim();
    if (!name) { showToast('Donnez un nom à la classe'); return; }
    const cls = {
        id: Date.now().toString(), name, subject,
        code: generateCode(),
        teacher: currentUser.email,
        students: [],
        assignments: [],
        createdAt: new Date().toISOString()
    };
    classes.push(cls);
    saveData();
    closeModal('new-class-modal');
    renderClasses();
    showToast('Classe créée ! Code: ' + cls.code);
}

function renderClasses() {
    const list = document.getElementById('classes-list');
    const empty = document.getElementById('empty-classes');
    const myClasses = classes.filter(c => c.teacher === currentUser.email);
    const studentClasses = classes.filter(c => c.students.some(s => s.email === currentUser.email));

    if (currentUser.role === 'teacher') {
        if (myClasses.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); }
        else {
            empty.classList.add('hidden');
            list.innerHTML = myClasses.map(c => `
                <div class="class-card" onclick="showClassDetail('${c.id}')">
                    <div class="class-info">
                        <h3>${c.name}</h3>
                        <p>${c.subject || 'Géographie'} · ${c.students.length} élève(s)</p>
                    </div>
                    <div class="class-code">
                        <span class="code-label">Code</span>
                        <span class="code-value">${c.code}</span>
                    </div>
                </div>
            `).join('');
        }
    } else {
        const workList = document.getElementById('work-list');
        const emptyWork = document.getElementById('empty-work');
        if (studentClasses.length === 0) { workList.innerHTML = ''; emptyWork.classList.remove('hidden'); }
        else {
            emptyWork.classList.add('hidden');
            workList.innerHTML = studentClasses.map(c => `
                <div class="class-card" onclick="showStudentClassDetail('${c.id}')">
                    <div class="class-info">
                        <h3>${c.name}</h3>
                        <p>${c.subject || 'Géographie'} · ${c.teacher}</p>
                    </div>
                </div>
            `).join('');
        }
    }
}

function showJoinClass() {
    document.getElementById('join-class-modal').classList.remove('hidden');
    document.getElementById('join-code').value = '';
    document.getElementById('join-code').focus();
}

function joinClass() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!code) { showToast('Entrez un code'); return; }
    const cls = classes.find(c => c.code === code);
    if (!cls) { showToast('Code invalide'); return; }
    if (!cls.students.find(s => s.email === currentUser.email)) {
        cls.students.push({ email: currentUser.email, firstName: currentUser.firstName, lastName: currentUser.lastName, joinedAt: new Date().toISOString() });
        saveData();
    }
    closeModal('join-class-modal');
    showToast('Classe rejointe : ' + cls.name);
    renderClasses();
}

function showClassDetail(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    document.getElementById('class-detail-title').textContent = cls.name;
    const body = document.getElementById('class-detail-body');
    body.innerHTML = `
        <div class="class-detail-header">
            <p><strong>Matière :</strong> ${cls.subject || 'Géographie'}</p>
            <div class="class-code-box">
                <p>Code pour les élèves :</p>
                <span class="big-code">${cls.code}</span>
                <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${cls.code}');showToast('Code copié!')" style="margin-top:8px;">📋 Copier le code</button>
            </div>
        </div>
        <h4>Élèves (${cls.students.length})</h4>
        <div class="students-list">
            ${cls.students.length === 0 ? '<p style="color:var(--text2)">Aucun élève pour l\'instant</p>' :
            cls.students.map(s => `<div class="student-item"><span class="avatar-sm">${s.firstName[0]}</span><span>${s.firstName} ${s.lastName}</span></div>`).join('')}
        </div>
    `;
    document.getElementById('class-detail-modal').classList.remove('hidden');
}

function showStudentClassDetail(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    document.getElementById('class-detail-title').textContent = cls.name;
    const body = document.getElementById('class-detail-body');
    body.innerHTML = `<p><strong>Matière :</strong> ${cls.subject || 'Géographie'}</p><p style="color:var(--text2);margin-top:12px;">Pas encore de travaux assignés.</p>`;
    document.getElementById('class-detail-modal').classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function toggleDarkMode() {
    const dark = document.getElementById('dark-mode').checked;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('geocarte_theme', dark ? 'dark' : 'light');
}

function saveData() {
    localStorage.setItem('geocarte_user', JSON.stringify(currentUser));
    localStorage.setItem('geocarte_maps', JSON.stringify(maps));
    localStorage.setItem('geocarte_classes', JSON.stringify(classes));
    localStorage.setItem('geocarte_quizzes', JSON.stringify(quizzes));
}

function loadData() {
    try {
        const u = localStorage.getItem('geocarte_user');
        if (u) currentUser = JSON.parse(u);
        const m = localStorage.getItem('geocarte_maps');
        if (m) maps = JSON.parse(m);
        const c = localStorage.getItem('geocarte_classes');
        if (c) classes = JSON.parse(c);
        const q = localStorage.getItem('geocarte_quizzes');
        if (q) quizzes = JSON.parse(q);
        const theme = localStorage.getItem('geocarte_theme');
        if (theme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); document.getElementById('dark-mode').checked = true; }
    } catch (e) {}
}

function exportData() {
    const data = JSON.stringify({ user: currentUser, maps, classes, quizzes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geocarte-export.json';
    a.click();
    showToast('Données exportées');
}

// ========== QUIZ SYSTEM ==========
let quizzes = [];
let editingQuizQuestions = [];

function showNewQuiz() {
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-desc').value = '';
    editingQuizQuestions = [];
    const sel = document.getElementById('quiz-class');
    const myClasses = classes.filter(c => c.teacher === currentUser.email);
    sel.innerHTML = myClasses.length === 0
        ? '<option value="">Aucune classe — créez une classe d\'abord</option>'
        : myClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    addQuizQuestion();
    document.getElementById('new-quiz-modal').classList.remove('hidden');
}

function addQuizQuestion() {
    editingQuizQuestions.push({ text: '', answers: ['', '', '', ''], correct: 0 });
    renderQuizQuestions();
}

function removeQuizQuestion(idx) {
    editingQuizQuestions.splice(idx, 1);
    renderQuizQuestions();
}

function renderQuizQuestions() {
    const list = document.getElementById('quiz-questions-list');
    list.innerHTML = editingQuizQuestions.map((q, i) => `
        <div class="quiz-question-editor">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <strong style="font-size:14px;">Question ${i + 1}</strong>
                ${editingQuizQuestions.length > 1 ? `<button class="icon-btn" onclick="removeQuizQuestion(${i})" style="width:28px;height:28px;font-size:12px;">✕</button>` : ''}
            </div>
            <input type="text" class="input" placeholder="Question..." value="${q.text}" onchange="editingQuizQuestions[${i}].text=this.value">
            ${q.answers.map((a, j) => `
                <div class="quiz-answer-row">
                    <input type="radio" name="qcorrect${i}" ${j === q.correct ? 'checked' : ''} onchange="editingQuizQuestions[${i}].correct=${j}">
                    <input type="text" class="input" placeholder="Réponse ${j + 1}" value="${a}" onchange="editingQuizQuestions[${i}].answers[${j}]=this.value">
                </div>
            `).join('')}
        </div>
    `).join('');
}

function saveQuiz() {
    const title = document.getElementById('quiz-title').value.trim();
    if (!title) { showToast('Donnez un titre au quiz'); return; }
    const classId = document.getElementById('quiz-class').value;
    const questions = editingQuizQuestions.filter(q => q.text.trim());
    if (questions.length === 0) { showToast('Ajoutez au moins une question'); return; }

    const quiz = {
        id: Date.now().toString(),
        title,
        description: document.getElementById('quiz-desc').value.trim(),
        classId,
        questions,
        createdAt: new Date().toISOString()
    };
    quizzes.push(quiz);
    saveData();
    closeModal('new-quiz-modal');
    renderQuizzes();
    showToast('Quiz créé !');
}

function renderQuizzes() {
    const list = document.getElementById('quizzes-list');
    const empty = document.getElementById('empty-quizzes');
    if (currentUser.role === 'teacher') {
        const myQuizzes = quizzes.filter(q => {
            const cls = classes.find(c => c.id === q.classId);
            return cls && cls.teacher === currentUser.email;
        });
        if (myQuizzes.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); }
        else {
            empty.classList.add('hidden');
            list.innerHTML = myQuizzes.map(q => {
                const cls = classes.find(c => c.id === q.classId);
                return `
                    <div class="quiz-card">
                        <h3>❓ ${q.title}</h3>
                        <p>${q.questions.length} question(s) · ${cls ? cls.name : 'Toutes classes'}</p>
                        <p style="font-size:12px;color:var(--text2);">${q.description || ''}</p>
                        <div class="quiz-card-actions">
                            <button class="btn btn-secondary" onclick="deleteQuiz('${q.id}')" style="flex:0;padding:8px 16px;font-size:13px;">🗑️ Supprimer</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } else {
        const myClassIds = classes.filter(c => c.students.some(s => s.email === currentUser.email)).map(c => c.id);
        const myQuizzes = quizzes.filter(q => myClassIds.includes(q.classId));
        if (myQuizzes.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); }
        else {
            empty.classList.add('hidden');
            list.innerHTML = myQuizzes.map(q => {
                const cls = classes.find(c => c.id === q.classId);
                return `
                    <div class="quiz-card">
                        <h3>❓ ${q.title}</h3>
                        <p>${q.questions.length} question(s) · ${cls ? cls.name : ''}</p>
                        <p style="font-size:12px;color:var(--text2);">${q.description || ''}</p>
                        <div class="quiz-card-actions">
                            <button class="btn btn-primary" onclick="playQuiz('${q.id}')" style="flex:1;padding:10px;font-size:14px;">Commencer</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function deleteQuiz(id) {
    if (!confirm('Supprimer ce quiz ?')) return;
    quizzes = quizzes.filter(q => q.id !== id);
    saveData();
    renderQuizzes();
    showToast('Quiz supprimé');
}

function playQuiz(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    document.getElementById('play-quiz-title').textContent = quiz.title;
    const body = document.getElementById('play-quiz-body');
    let score = 0;
    let answered = 0;

    function renderQuestion(idx) {
        if (idx >= quiz.questions.length) {
            body.innerHTML = `
                <div class="quiz-score">
                    <h2>${score}/${quiz.questions.length}</h2>
                    <p>${score === quiz.questions.length ? 'Excellent !' : score >= quiz.questions.length / 2 ? 'Bien joué !' : 'Courage, réessayez !'}</p>
                    <button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal('play-quiz-modal')">Fermer</button>
                </div>
            `;
            return;
        }
        const q = quiz.questions[idx];
        body.innerHTML = `
            <p style="color:var(--text2);margin-bottom:8px;">Question ${idx + 1}/${quiz.questions.length}</p>
            <div class="quiz-play-question">
                <h4>${q.text}</h4>
                ${q.answers.map((a, i) => `
                    <button class="quiz-play-option" id="qopt-${idx}-${i}" onclick="answerQuiz(${idx}, ${i}, ${q.correct})">${a}</button>
                `).join('')}
            </div>
        `;
    }

    window.answerQuiz = function(qIdx, chosen, correct) {
        const q = quiz.questions[qIdx];
        q.answers.forEach((_, i) => {
            const btn = document.getElementById(`qopt-${qIdx}-${i}`);
            if (btn) {
                btn.disabled = true;
                if (i === correct) btn.classList.add('correct');
                if (i === chosen && chosen !== correct) btn.classList.add('wrong');
            }
        });
        if (chosen === correct) score++;
        answered++;
        setTimeout(() => renderQuestion(qIdx + 1), 1000);
    };

    renderQuestion(0);
    document.getElementById('play-quiz-modal').classList.remove('hidden');
}
