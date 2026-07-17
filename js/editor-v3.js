// ========== EDITOR STATE ==========
let canvas, ctx, leafletMap;
let editorMode = 'navigate'; // 'navigate' | 'draw'
let currentTool = 'select';
let isDrawing = false;
let startX = 0, startY = 0;
let elements = [];
let selectedElement = null;
let undoStack = [];
let redoStack = [];
let strokeColor = '#007AFF';
let fillColor = '#007AFF';
let strokeWidth = 2;
let opacity = 1;
let fillPattern = 'solid';
let currentPath = [];
let layers = [{ id: '1', name: 'Calque 1', visible: true, locked: false }];
let activeLayerId = '1';

const DRAW_TOOLS = ['freehand','pen','highlighter','eraser','rectangle','circle','triangle','star','arrow','line','text'];
function isDrawingTool(tool) { return DRAW_TOOLS.includes(tool); }

// ========== LEGEND STATE ==========
let legendItems = [];
let legendVisible = false;

// ========== GEO HELPERS ==========
function toLatLng(x, y) {
    if (!leafletMap) return null;
    return leafletMap.containerPointToLatLng(L.point(x, y));
}
function toPixel(latlng) {
    if (!leafletMap) return { x: 0, y: 0 };
    const p = leafletMap.latLngToContainerPoint(latlng);
    return { x: p.x, y: p.y };
}

// ========== OPEN/CLOSE ==========
function openMap(id) {
    currentMap = maps.find(m => m.id === id);
    if (!currentMap) return;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('editor').classList.remove('hidden');
    document.getElementById('editor-title').textContent = currentMap.name;
    layers = currentMap.layers || [{ id: '1', name: 'Calque 1', visible: true, locked: false }];
    elements = [];
    layers.forEach(l => (l.elements || []).forEach(e => elements.push(e)));
    legendItems = currentMap.legendItems || [];
    canvas = document.getElementById('map-canvas');
    ctx = canvas.getContext('2d');
    selectedElement = null;
    editorMode = 'navigate';
    setTimeout(() => {
        initLeafletMap();
        resizeCanvas();
        renderLayers();
        renderCanvas();
        updateModeUI();
        renderLegend();
    }, 150);
}

function closeEditor() {
    saveMap();
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    document.getElementById('editor').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('search-overlay')?.classList.add('hidden');
    document.getElementById('legend-panel')?.classList.add('hidden');
    legendVisible = false;
    renderMaps();
}

// ========== LEAFLET MAP ==========
function initLeafletMap() {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    const sv = currentMap.mapView || { center: [20, 0], zoom: 2 };
    leafletMap = L.map('leaflet-map', {
        center: sv.center, zoom: sv.zoom,
        minZoom: 1, maxZoom: 18,
        zoomControl: true, attributionControl: true,
        touchZoom: true, dragging: true, scrollWheelZoom: true,
        doubleClickZoom: true, bounceAtZoomLimits: true
    });
    const ti = getTileLayer(currentMap ? currentMap.style : 'political');
    ti.layer.addTo(leafletMap);
    leafletMap.setMaxZoom(ti.maxZoom);
    leafletMap.on('moveend', () => {
        if (currentMap) currentMap.mapView = { center: [leafletMap.getCenter().lat, leafletMap.getCenter().lng], zoom: leafletMap.getZoom() };
        renderCanvas();
    });
    setupLeafletEvents();
}

function getTileLayer(style) {
    const d = {
        political:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
        physical:     { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 },
        satellite:    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 18 },
        blank:        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
        relief:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18 },
        shadedRelief: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 },
        topographic:  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18 },
        simplified:   { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', maxZoom: 19 },
        countries:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
        continents:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
        oceans:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 },
        rivers:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Rivers_Lakes/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 },
        climate:      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Climate/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 },
        density:      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
        biomes:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrestrial_Ecosystems/MapServer/tile/{z}/{y}/{x}', maxZoom: 13 }
    };
    const info = d[style] || d.political;
    const layer = info.maxZoom > 15
        ? L.tileLayer(info.url, { attribution: '&copy; OpenStreetMap', maxZoom: info.maxZoom })
        : L.tileLayer(info.url, { attribution: 'Tiles &copy; Esri', maxZoom: info.maxZoom });
    return { layer, maxZoom: info.maxZoom };
}

function resizeCanvas() {
    const c = document.getElementById('canvas-container');
    if (!canvas || !c) return;
    canvas.width = c.clientWidth;
    canvas.height = c.clientHeight;
    canvas.style.width = c.clientWidth + 'px';
    canvas.style.height = c.clientHeight + 'px';
}

// ========== MODE TOGGLE ==========
function setMode(mode) {
    editorMode = mode;
    if (mode === 'navigate') {
        leafletMap.dragging.enable();
        leafletMap.touchZoom.enable();
        leafletMap.scrollWheelZoom.enable();
        leafletMap.doubleClickZoom.enable();
        currentTool = 'select';
        selectedElement = null;
        canvas.style.cursor = 'default';
        hideDrawTools();
    } else {
        leafletMap.dragging.disable();
        leafletMap.touchZoom.disable();
        leafletMap.scrollWheelZoom.disable();
        leafletMap.doubleClickZoom.disable();
        if (!currentTool || currentTool === 'select') {
            selectTool('rectangle', document.querySelector('.draw-tool[data-tool="rectangle"]'));
        }
        showDrawTools();
    }
    updateModeUI();
    renderCanvas();
}

function updateModeUI() {
    document.getElementById('mode-navigate').classList.toggle('active', editorMode === 'navigate');
    document.getElementById('mode-draw').classList.toggle('active', editorMode === 'draw');
    document.getElementById('draw-palette').classList.toggle('hidden', editorMode !== 'draw');
}

function showDrawTools() {
    document.getElementById('draw-palette').classList.remove('hidden');
}
function hideDrawTools() {
    document.getElementById('draw-palette').classList.add('hidden');
}

// ========== DRAW EVENTS (DOM touch support for iPad) ==========
let _eventsSetup = false;

function setupLeafletEvents() {
    if (_eventsSetup) return;
    _eventsSetup = true;
    const container = document.getElementById('canvas-container');

    container.addEventListener('mousedown', e => onPointerDown(e));
    container.addEventListener('mousemove', e => onPointerMove(e));
    container.addEventListener('mouseup', e => onPointerUp(e));
    container.addEventListener('mouseleave', e => { if (isDrawing) onPointerUp(e); });

    container.addEventListener('touchstart', e => {
        if (editorMode !== 'draw') return;
        e.preventDefault();
        const t = e.touches[0];
        onPointerDown({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });

    container.addEventListener('touchmove', e => {
        if (editorMode !== 'draw' || !isDrawing) return;
        e.preventDefault();
        const t = e.touches[0];
        onPointerMove({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });

    container.addEventListener('touchend', e => {
        if (editorMode !== 'draw') return;
        e.preventDefault();
        const t = e.changedTouches[0];
        onPointerUp({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
}

function containerXY(clientX, clientY) {
    const rect = document.getElementById('leaflet-map').getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function onPointerDown(e) {
    if (editorMode !== 'draw') return;
    if (!isDrawingTool(currentTool) && currentTool !== 'select') return;
    const { x: px, y: py } = containerXY(e.clientX, e.clientY);
    startX = px; startY = py;
    isDrawing = true;

    if (currentTool === 'select') {
        const el = findElementAt(px, py);
        if (el) {
            selectedElement = el;
        } else {
            selectedElement = null;
        }
        renderCanvas();
    } else {
        if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
            currentPath = [{ x: px, y: py }];
        }
    }
}

function onPointerMove(e) {
    if (editorMode !== 'draw' || !isDrawing) return;
    const { x: px, y: py } = containerXY(e.clientX, e.clientY);

    if (currentTool === 'select' && selectedElement) {
        const newAnchor = toLatLng(px - selectedElement._dragOffX, py - selectedElement._dragOffY);
        if (newAnchor) {
            selectedElement.anchorLat = newAnchor.lat;
            selectedElement.anchorLng = newAnchor.lng;
        }
        renderCanvas();
    } else if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        currentPath.push({ x: px, y: py });
        renderCanvas();
        drawFreePath();
    } else if (currentTool === 'eraser') {
        eraseAt(px, py);
        renderCanvas();
    } else if (currentTool !== 'select') {
        renderCanvas();
        drawPreview(px, py);
    }
}

function onPointerUp(e) {
    if (editorMode !== 'draw' || !isDrawing) return;
    isDrawing = false;
    const { x: px, y: py } = containerXY(e.clientX, e.clientY);

    if (currentTool === 'select') { renderCanvas(); return; }

    if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        if (currentPath.length > 1) {
            const ci = Math.floor(currentPath.length / 2);
            const ll = toLatLng(currentPath[ci].x, currentPath[ci].y);
            if (ll) {
                const pathOffsets = currentPath.map(p => {
                    const pll = toLatLng(p.x, p.y);
                    return { dx: pll.lng - ll.lng, dy: pll.lat - ll.lat };
                });
                addElement({
                    id: Date.now().toString(), type: 'freehand',
                    anchorLat: ll.lat, anchorLng: ll.lng, pathOffsets,
                    strokeColor,
                    fillColor: currentTool === 'highlighter' ? fillColor + '44' : 'transparent',
                    strokeWidth: currentTool === 'highlighter' ? strokeWidth * 4 : strokeWidth,
                    opacity: currentTool === 'highlighter' ? 0.4 : opacity,
                    layerId: activeLayerId
                });
            }
        }
        currentPath = [];
    } else if (currentTool !== 'eraser') {
        const w = Math.abs(px - startX), h = Math.abs(py - startY);
        if (w > 5 || h > 5) {
            const anchorLL = toLatLng(Math.min(startX, px), Math.min(startY, py));
            if (anchorLL) {
                addElement({
                    id: Date.now().toString(), type: currentTool,
                    anchorLat: anchorLL.lat, anchorLng: anchorLL.lng,
                    pixelW: w, pixelH: h,
                    strokeColor, fillColor, strokeWidth, opacity, fillPattern,
                    layerId: activeLayerId
                });
            }
        }
    }
    renderCanvas();
}

function onDblClick(e) {
    if (editorMode !== 'draw' || currentTool !== 'text') return;
    const { x: px, y: py } = containerXY(e.clientX, e.clientY);
    const ll = toLatLng(px, py);
    if (!ll) return;
    const text = prompt('Texte :');
    if (text) {
        addElement({
            id: Date.now().toString(), type: 'text',
            anchorLat: ll.lat, anchorLng: ll.lng, text,
            fontSize: 16, fontWeight: 'bold', color: strokeColor,
            layerId: activeLayerId
        });
        renderCanvas();
    }
}

// ========== TOOL SELECTION ==========
function selectTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.draw-tool').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    if (tool !== 'select') selectedElement = null;
    renderCanvas();
}

// ========== SEARCH ==========
let searchTimeout = null;
function toggleSearch() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.toggle('hidden');
    if (!overlay.classList.contains('hidden')) {
        document.getElementById('search-input').focus();
    }
}
function onSearchInput(val) {
    clearTimeout(searchTimeout);
    const results = document.getElementById('search-results');
    if (!val || val.length < 2) { results.innerHTML = ''; return; }
    searchTimeout = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=8&accept-language=fr`)
            .then(r => r.json())
            .then(data => {
                results.innerHTML = data.map(r => `
                    <div class="search-result" onclick="flyToResult(${r.lat}, ${r.lon}, '${r.display_name.replace(/'/g, "\\'")}')">
                        <span class="search-result-icon">📍</span>
                        <span class="search-result-text">${r.display_name}</span>
                    </div>
                `).join('');
            }).catch(() => { results.innerHTML = ''; });
    }, 400);
}
function flyToResult(lat, lon, name) {
    leafletMap.flyTo([lat, lon], 10, { duration: 1.5 });
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('search-input').value = '';
    showToast('📍 ' + name.substring(0, 40));
}

// ========== RENDERING ==========
function renderCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    elements.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(el => {
        const layer = layers.find(l => l.id === el.layerId);
        if (layer && !layer.visible) return;
        projectAndDraw(el);
    });

    if (selectedElement && selectedElement._pxX != null) {
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 2;
        const sx = selectedElement._pxX - 4;
        const sy = selectedElement._pxY - 4;
        const sw = (selectedElement._drawW || 100) + 8;
        const sh = (selectedElement._drawH || 100) + 8;
        if (selectedElement.type === 'freehand') {
            ctx.strokeRect(sx, sy, sw, sh);
        } else {
            ctx.strokeRect(sx, sy, sw, sh);
        }
        ctx.restore();
    }
}

function projectAndDraw(el) {
    if (el.anchorLat == null || el.anchorLng == null) return;

    if (el.type === 'freehand' && el.pathOffsets) {
        const center = toPixel(L.latLng(el.anchorLat, el.anchorLng));
        el._pxPath = el.pathOffsets.map(o => {
            const ll = L.latLng(el.anchorLat + o.dy, el.anchorLng + o.dx);
            return toPixel(ll);
        });
        el._pxX = center.x;
        el._pxY = center.y;
    } else if (el.type === 'text') {
        const p = toPixel(L.latLng(el.anchorLat, el.anchorLng));
        el._pxX = p.x;
        el._pxY = p.y;
    } else {
        const p = toPixel(L.latLng(el.anchorLat, el.anchorLng));
        el._pxX = p.x;
        el._pxY = p.y;
        el._drawW = el.pixelW || 100;
        el._drawH = el.pixelH || 100;
    }

    el.anchorPx = el._pxX;
    el.anchorPy = el._pxY;

    drawElement(el);
}

function drawElement(el) {
    ctx.save();
    ctx.globalAlpha = el.opacity || 1;
    ctx.strokeStyle = el.strokeColor || '#007AFF';
    ctx.fillStyle = el.fillColor || 'transparent';
    ctx.lineWidth = el.strokeWidth || 2;

    const x = el._pxX || 0, y = el._pxY || 0;
    const w = el._drawW || el.pixelW || 100, h = el._drawH || el.pixelH || 100;

    switch (el.type) {
        case 'rectangle':
            fillPatternRect(x, y, w, h, el.fillPattern);
            ctx.strokeRect(x, y, w, h);
            break;
        case 'circle': {
            const r = Math.min(w, h) / 2;
            ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke(); break;
        }
        case 'triangle':
            ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
            ctx.fill(); ctx.stroke(); break;
        case 'star': drawStar(x + w / 2, y + h / 2, Math.min(w, h) / 2, 5); break;
        case 'arrow':
            ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w - 15, y); ctx.moveTo(x + w, y + h / 2); ctx.lineTo(x + w - 15, y + h);
            ctx.stroke(); break;
        case 'line':
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke(); break;
        case 'freehand':
            if (el._pxPath && el._pxPath.length > 1) {
                ctx.beginPath(); ctx.moveTo(el._pxPath[0].x, el._pxPath[0].y);
                el._pxPath.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = el.strokeColor || '#007AFF';
                ctx.lineWidth = el.strokeWidth || 2;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.stroke();
            }
            break;
        case 'text':
            ctx.font = `${el.fontWeight || 'bold'} ${el.fontSize || 16}px -apple-system, sans-serif`;
            ctx.fillStyle = el.color || '#000';
            ctx.fillText(el.text || '', x, y);
            break;
    }
    ctx.restore();
}

function drawStar(cx, cy, r, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI / pts) - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.4;
        const px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
}

function fillPatternRect(x, y, w, h, pattern) {
    ctx.fillRect(x, y, w, h);
    if (!pattern || pattern === 'solid') return;
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5;
    switch (pattern) {
        case 'hatched': for (let i = -h; i < w + h; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); } break;
        case 'dots': for (let dx = 4; dx < w; dx += 8) for (let dy = 4; dy < h; dy += 8) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2); ctx.fill(); } break;
        case 'crosses': for (let dx = 8; dx < w; dx += 12) for (let dy = 8; dy < h; dy += 12) { ctx.beginPath(); ctx.moveTo(x + dx - 2, y + dy); ctx.lineTo(x + dx + 2, y + dy); ctx.moveTo(x + dx, y + dy - 2); ctx.lineTo(x + dx, y + dy + 2); ctx.stroke(); } break;
        case 'horizontal': for (let dy = 0; dy < h; dy += 6) { ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x + w, y + dy); ctx.stroke(); } break;
        case 'vertical': for (let dx = 0; dx < w; dx += 6) { ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx, y + h); ctx.stroke(); } break;
        case 'diagonal': for (let i = -h; i < w + h; i += 8) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke(); } break;
        case 'grid': for (let dx = 0; dx < w; dx += 10) { ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(x + dx, y + h); ctx.stroke(); } for (let dy = 0; dy < h; dy += 10) { ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x + w, y + dy); ctx.stroke(); } break;
    }
    ctx.restore();
}

function drawFreePath() {
    if (currentPath.length < 2) return;
    ctx.save();
    ctx.strokeStyle = currentTool === 'highlighter' ? fillColor + '44' : strokeColor;
    ctx.lineWidth = currentTool === 'highlighter' ? strokeWidth * 4 : strokeWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = currentTool === 'highlighter' ? 0.4 : opacity;
    ctx.beginPath(); ctx.moveTo(currentPath[0].x, currentPath[0].y);
    currentPath.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
}

function drawPreview(x, y) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = strokeWidth;
    const w = Math.abs(x - startX), h = Math.abs(y - startY);
    const px = Math.min(startX, x), py = Math.min(startY, y);
    if (currentTool === 'circle') {
        const r = Math.min(w, h) / 2;
        ctx.beginPath(); ctx.arc(px + r, py + r, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    } else if (currentTool === 'triangle') {
        ctx.beginPath(); ctx.moveTo(px + w / 2, py); ctx.lineTo(px + w, py + h); ctx.lineTo(px, py + h); ctx.closePath();
        ctx.fill(); ctx.stroke();
    } else if (currentTool === 'line' || currentTool === 'arrow') {
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
    } else {
        ctx.strokeRect(px, py, w, h);
    }
    ctx.restore();
}

// ========== HELPERS ==========
function findElementAt(x, y) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const layer = layers.find(l => l.id === el.layerId);
        if (layer && (layer.locked || !layer.visible)) continue;
        if (el.type === 'freehand' && el._pxPath) {
            for (const p of el._pxPath) {
                if (Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10) {
                    el._dragOffX = x - el._pxX;
                    el._dragOffY = y - el._pxY;
                    return el;
                }
            }
        } else if (el._pxX != null) {
            const w = el._drawW || el.pixelW || 100;
            const h = el._drawH || el.pixelH || 100;
            if (x >= el._pxX && x <= el._pxX + w && y >= el._pxY && y <= el._pxY + h) {
                el._dragOffX = x - el._pxX;
                el._dragOffY = y - el._pxY;
                return el;
            }
        }
    }
    return null;
}

function eraseAt(x, y) {
    elements = elements.filter(el => {
        if (el._pxX != null) {
            const w = el._drawW || el.pixelW || 100;
            const h = el._drawH || el.pixelH || 100;
            return !(x >= el._pxX - 10 && x <= el._pxX + w + 10 && y >= el._pxY - 10 && y <= el._pxY + h + 10);
        }
        return true;
    });
}

function addElement(el) {
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    redoStack = [];
    elements.push(el);
    const layer = layers.find(l => l.id === el.layerId);
    if (layer) { if (!layer.elements) layer.elements = []; layer.elements.push(el); }
    renderLayers();
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.parse(JSON.stringify(elements)));
    elements = undoStack.pop();
    layers.forEach(l => { l.elements = elements.filter(e => e.layerId === l.id); });
    selectedElement = null;
    renderCanvas(); renderLayers();
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    elements = redoStack.pop();
    layers.forEach(l => { l.elements = elements.filter(e => e.layerId === l.id); });
    selectedElement = null;
    renderCanvas(); renderLayers();
}

// ========== PROPERTIES ==========
function updateStrokeColor(v) { strokeColor = v; }
function updateFillColor(v) { fillColor = v; }
function updateStrokeWidth(v) { strokeWidth = parseInt(v); }
function updateOpacity(v) { opacity = v / 100; }
function updateFillPattern(v) { fillPattern = v; }

// ========== LAYERS ==========
function toggleLayers() { document.getElementById('layer-panel').classList.toggle('hidden'); }

function renderLayers() {
    document.getElementById('layers-list').innerHTML = layers.map(l => `
        <div class="layer-item ${l.id === activeLayerId ? 'active' : ''}" onclick="selectLayer('${l.id}')">
            <span class="layer-name">${l.name}</span>
            <div class="layer-actions">
                <button class="layer-btn ${l.visible ? 'active' : ''}" onclick="event.stopPropagation(); toggleLayerVisibility('${l.id}')">👁️</button>
                <button class="layer-btn ${l.locked ? 'active' : ''}" onclick="event.stopPropagation(); toggleLayerLock('${l.id}')">🔒</button>
            </div>
        </div>
    `).join('');
}

function selectLayer(id) { activeLayerId = id; renderLayers(); }
function addLayer() {
    const name = prompt('Nom du calque :', 'Calque ' + (layers.length + 1));
    if (!name) return;
    layers.push({ id: Date.now().toString(), name, visible: true, locked: false });
    renderLayers();
}
function toggleLayerVisibility(id) {
    const l = layers.find(l => l.id === id);
    if (l) { l.visible = !l.visible; renderLayers(); renderCanvas(); }
}
function toggleLayerLock(id) {
    const l = layers.find(l => l.id === id);
    if (l) { l.locked = !l.locked; renderLayers(); }
}

// ========== TRASH ==========
function showTrash() { document.getElementById('trash-zone').classList.remove('hidden'); document.getElementById('trash-zone').classList.add('visible'); }
function hideTrash() { document.getElementById('trash-zone').classList.remove('visible', 'highlight'); document.getElementById('trash-zone').classList.add('hidden'); }
function isOverTrash(cy) { return cy >= document.getElementById('trash-zone').getBoundingClientRect().top - 20; }
function updateTrashHighlight(cy) { document.getElementById('trash-zone').classList.toggle('highlight', isOverTrash(cy)); }
function deleteSelectedElement() {
    if (!selectedElement) return;
    elements = elements.filter(el => el.id !== selectedElement.id);
    layers.forEach(l => { if (l.elements) l.elements = l.elements.filter(el => el.id !== selectedElement.id); });
    selectedElement = null;
    renderLayers();
}

// ========== LEGEND ==========
function toggleLegend() {
    legendVisible = !legendVisible;
    document.getElementById('legend-panel').classList.toggle('hidden', !legendVisible);
    document.getElementById('legend-toggle').classList.toggle('active', legendVisible);
}

function renderLegend() {
    const list = document.getElementById('legend-list');
    if (!list) return;
    list.innerHTML = legendItems.map((item, i) => `
        <div class="legend-item" draggable="true" ondragstart="legendDragStart(event, ${i})" ondragover="legendDragOver(event)" ondrop="legendDrop(event, ${i})">
            <div class="legend-item-grip" title="Glisser pour réordonner">⠿</div>
            <div class="legend-swatch" style="background:${item.color}; border: 2px solid ${darken(item.color)};" data-shape="${item.shape}">${legendShapeIcon(item.shape)}</div>
            <input type="text" class="legend-label-input" value="${escapeHtml(item.label)}" oninput="updateLegendLabel(${i}, this.value)" placeholder="Libellé...">
            <div class="legend-item-actions">
                <button class="icon-btn-sm" onclick="editLegendItem(${i})" title="Modifier">✏️</button>
                <button class="icon-btn-sm" onclick="removeLegendItem(${i})" title="Supprimer">✕</button>
            </div>
        </div>
    `).join('');
}

function legendShapeIcon(shape) {
    switch(shape) {
        case 'circle': return '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="7" fill="white" stroke="none"/></svg>';
        case 'triangle': return '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="8,1 15,15 1,15" fill="white" stroke="none"/></svg>';
        case 'line': return '<svg viewBox="0 0 16 16" width="14" height="14"><line x1="2" y1="14" x2="14" y2="2" stroke="white" stroke-width="3"/></svg>';
        case 'star': return '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="8,1 10,6 15,6 11,9 13,15 8,11 3,15 5,9 1,6 6,6" fill="white" stroke="none"/></svg>';
        default: return '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="1" y="1" width="14" height="14" rx="2" fill="white" stroke="none"/></svg>';
    }
}

function darken(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const r = Math.max(0, parseInt(c.substring(0,2), 16) - 40);
    const g = Math.max(0, parseInt(c.substring(2,4), 16) - 40);
    const b = Math.max(0, parseInt(c.substring(4,6), 16) - 40);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function addLegendItem() {
    legendItems.push({ shape: 'rectangle', color: '#007AFF', label: '' });
    renderLegend();
    saveMap();
}

function removeLegendItem(i) {
    legendItems.splice(i, 1);
    renderLegend();
    saveMap();
}

function editLegendItem(i) {
    const item = legendItems[i];
    const shapes = ['rectangle', 'circle', 'triangle', 'line', 'star'];
    const currentIdx = shapes.indexOf(item.shape);
    item.shape = shapes[(currentIdx + 1) % shapes.length];
    renderLegend();
    saveMap();
}

function updateLegendLabel(i, val) {
    legendItems[i].label = val;
    saveMap();
}

function updateLegendColor(i, val) {
    legendItems[i].color = val;
    renderLegend();
    saveMap();
}

let _legendDragIdx = null;
function legendDragStart(e, i) { _legendDragIdx = i; e.dataTransfer.effectAllowed = 'move'; }
function legendDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function legendDrop(e, i) {
    e.preventDefault();
    if (_legendDragIdx === null || _legendDragIdx === i) return;
    const item = legendItems.splice(_legendDragIdx, 1)[0];
    legendItems.splice(i, 0, item);
    _legendDragIdx = null;
    renderLegend();
    saveMap();
}

function escapeHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========== KEYBOARD ==========
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('editor') || document.getElementById('editor').classList.contains('hidden')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && document.activeElement.tagName !== 'INPUT') {
        deleteSelectedElement(); renderCanvas();
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Escape' && editorMode === 'draw') { setMode('navigate'); }
});

// ========== SAVE ==========
function saveMap() {
    if (!currentMap) return;
    currentMap.layers = layers;
    currentMap.legendItems = legendItems;
    currentMap.updatedAt = new Date().toISOString();
    if (leafletMap) currentMap.mapView = { center: [leafletMap.getCenter().lat, leafletMap.getCenter().lng], zoom: leafletMap.getZoom() };
    const idx = maps.findIndex(m => m.id === currentMap.id);
    if (idx >= 0) maps[idx] = currentMap;
    saveData();
}

function exportMap() {
    const link = document.createElement('a');
    link.download = currentMap.name + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Image exportée');
}

window.addEventListener('resize', () => {
    if (canvas) { resizeCanvas(); renderCanvas(); }
    if (leafletMap) leafletMap.invalidateSize();
});
