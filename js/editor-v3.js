// ========== EDITOR STATE ==========
let canvas, ctx, leafletMap;
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
let leafletEventsSetup = false;
let trashVisible = false;
let longPressTimer = null;
let longPressTriggered = false;

const DRAW_TOOLS = ['freehand','pen','highlighter','eraser','rectangle','circle','triangle','star','arrow','line','text'];

function isDrawingTool(tool) {
    return DRAW_TOOLS.includes(tool);
}

// ========== GEO HELPERS ==========
function pixelToLatLng(x, y) {
    if (!leafletMap) return null;
    return leafletMap.containerPointToLatLng(L.point(x, y));
}

function latLngToPixel(latlng) {
    if (!leafletMap) return { x: 0, y: 0 };
    const p = leafletMap.latLngToContainerPoint(latlng);
    return { x: p.x, y: p.y };
}

function pixelToMeters(px) {
    if (!leafletMap) return px;
    const z = leafletMap.getZoom();
    const mpp = 40075016.686 * Math.cos(leafletMap.getCenter().lat * Math.PI / 180) / (256 * Math.pow(2, z));
    return px * mpp;
}

function metersToPixel(meters) {
    if (!leafletMap) return meters;
    const z = leafletMap.getZoom();
    const mpp = 40075016.686 * Math.cos(leafletMap.getCenter().lat * Math.PI / 180) / (256 * Math.pow(2, z));
    return meters / mpp;
}

// ========== OPEN/CLOSE EDITOR ==========
function openMap(id) {
    currentMap = maps.find(m => m.id === id);
    if (!currentMap) return;

    document.getElementById('app').classList.add('hidden');
    document.getElementById('editor').classList.remove('hidden');
    document.getElementById('editor-title').textContent = currentMap.name;

    layers = currentMap.layers || [{ id: '1', name: 'Calque 1', visible: true, locked: false }];
    elements = [];
    layers.forEach(l => (l.elements || []).forEach(e => elements.push(e)));

    canvas = document.getElementById('map-canvas');
    ctx = canvas.getContext('2d');
    selectedElement = null;

    setTimeout(() => {
        initLeafletMap();
        resizeCanvas();
        renderLayers();
        renderCanvas();
        selectTool('select', document.querySelector('.tool'));
    }, 150);
}

function closeEditor() {
    saveMap();
    if (leafletMap) { leafletMap.remove(); leafletMap = null; leafletEventsSetup = false; }
    document.getElementById('editor').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay) searchOverlay.classList.add('hidden');
    renderMaps();
}

// ========== LEAFLET MAP ==========
function initLeafletMap() {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }

    const savedView = currentMap.mapView || { center: [20, 0], zoom: 2 };

    leafletMap = L.map('leaflet-map', {
        center: savedView.center,
        zoom: savedView.zoom,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true,
        touchZoom: true,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        bounceAtZoomLimits: true
    });

    const tileInfo = getTileLayer(currentMap ? currentMap.style : 'political');
    tileInfo.layer.addTo(leafletMap);
    leafletMap.setMaxZoom(tileInfo.maxZoom);

    leafletMap.on('moveend', () => {
        if (currentMap) {
            currentMap.mapView = {
                center: [leafletMap.getCenter().lat, leafletMap.getCenter().lng],
                zoom: leafletMap.getZoom()
            };
        }
        renderCanvas();
    });

    if (!leafletEventsSetup) {
        setupLeafletDrawEvents();
        leafletEventsSetup = true;
    }
}

function getTileLayer(style) {
    const layerDefs = {
        political:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        physical:     { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true },
        satellite:    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, esri: true },
        blank:        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        relief:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, esri: true },
        shadedRelief: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true },
        topographic:  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 18, esri: true },
        simplified:   { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        countries:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        continents:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        oceans:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true },
        rivers:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Rivers_Lakes/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true },
        climate:      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Climate/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true },
        density:      { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, esri: false },
        biomes:       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrestrial_Ecosystems/MapServer/tile/{z}/{y}/{x}', maxZoom: 13, esri: true }
    };
    const info = layerDefs[style] || layerDefs.political;
    const layer = info.esri
        ? L.tileLayer(info.url, { attribution: 'Tiles &copy; Esri', maxZoom: info.maxZoom })
        : L.tileLayer(info.url, { attribution: '&copy; OpenStreetMap', maxZoom: info.maxZoom });
    return { layer, maxZoom: info.maxZoom };
}

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
}

// ========== LEAFLET DRAW EVENTS ==========
function setupLeafletDrawEvents() {
    leafletMap.on('mousedown', onMapMouseDown);
    leafletMap.on('mousemove', onMapMouseMove);
    leafletMap.on('mouseup', onMapMouseUp);
    leafletMap.on('dblclick', onMapDblClick);
}

function onMapMouseDown(e) {
    if (!isDrawingTool(currentTool) && currentTool !== 'select') return;

    const px = e.containerPoint.x;
    const py = e.containerPoint.y;
    startX = px;
    startY = py;
    isDrawing = true;
    longPressTriggered = false;

    if (currentTool === 'select') {
        const el = findElementAt(px, py);
        if (el) {
            selectedElement = el;
            leafletMap.dragging.disable();
        } else {
            selectedElement = null;
        }
        renderCanvas();
    } else if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
        leafletMap.dragging.disable();
        currentPath = [{ x: px, y: py }];
    } else {
        leafletMap.dragging.disable();
    }
}

function onMapMouseMove(e) {
    if (!isDrawing) return;

    const px = e.containerPoint.x;
    const py = e.containerPoint.y;

    if (currentTool === 'select' && selectedElement) {
        if (longPressTriggered && trashVisible) {
            updateTrashHighlight(e.originalEvent.clientY);
        } else {
            const newPixelX = px - selectedElement._offsetX;
            const newPixelY = py - selectedElement._offsetY;
            const oldLatLng = pixelToLatLng(selectedElement._pixelCenterX, selectedElement._pixelCenterY);
            const newLatLng = pixelToLatLng(newPixelX + (selectedElement._pixelWidth || 0) / 2, newPixelY + (selectedElement._pixelHeight || 0) / 2);
            if (oldLatLng && newLatLng) {
                moveElementGeo(selectedElement, newLatLng.lat - oldLatLng.lat, newLatLng.lng - oldLatLng.lng);
            }
            selectedElement._pixelX = newPixelX;
            selectedElement._pixelY = newPixelY;
            selectedElement._pixelCenterX = newPixelX + (selectedElement._pixelWidth || 0) / 2;
            selectedElement._pixelCenterY = newPixelY + (selectedElement._pixelHeight || 0) / 2;
        }
        renderCanvas();
    } else if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        currentPath.push({ x: px, y: py });
        renderCanvas();
        drawFreePath();
    } else if (currentTool === 'eraser') {
        eraseAt(px, py);
        renderCanvas();
    } else if (currentTool !== 'select' && currentTool !== 'eraser') {
        renderCanvas();
        drawPreview(px, py);
    }
}

function onMapMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

    const px = e.containerPoint.x;
    const py = e.containerPoint.y;

    if (longPressTriggered && trashVisible) {
        if (isOverTrash(e.originalEvent.clientY)) { deleteSelectedElement(); }
        hideTrash();
        longPressTriggered = false;
        leafletMap.dragging.enable();
        renderCanvas();
        return;
    }
    longPressTriggered = false;
    leafletMap.dragging.enable();

    if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        if (currentPath.length > 1) {
            const centerIdx = Math.floor(currentPath.length / 2);
            const centerPixel = currentPath[centerIdx];
            const centerLatLng = pixelToLatLng(centerPixel.x, centerPixel.y);
            if (centerLatLng) {
                const geoPath = currentPath.map(p => {
                    const ll = pixelToLatLng(p.x, p.y);
                    return { dlat: ll.lat - centerLatLng.lat, dlng: ll.lng - centerLatLng.lng };
                });
                addElement({
                    id: Date.now().toString(), type: 'freehand',
                    geoPath, geoCenter: { lat: centerLatLng.lat, lng: centerLatLng.lng },
                    strokeColor,
                    fillColor: currentTool === 'highlighter' ? fillColor + '44' : 'transparent',
                    strokeWidth: currentTool === 'highlighter' ? strokeWidth * 4 : strokeWidth,
                    opacity: currentTool === 'highlighter' ? 0.4 : opacity,
                    layerId: activeLayerId
                });
            }
        }
        currentPath = [];
    } else if (currentTool !== 'select' && currentTool !== 'eraser') {
        const w = px - startX;
        const h = py - startY;
        if (Math.abs(w) > 5 || Math.abs(h) > 5) {
            const topLeft = { x: Math.min(startX, startX + w), y: Math.min(startY, startY + h) };
            const centerPx = { x: topLeft.x + Math.abs(w) / 2, y: topLeft.y + Math.abs(h) / 2 };
            const geoCenter = pixelToLatLng(centerPx.x, centerPx.y);
            if (geoCenter) {
                addElement(createShapeElement(currentTool, topLeft, Math.abs(w), Math.abs(h), geoCenter));
            }
        }
    }
    renderCanvas();
}

function onMapDblClick(e) {
    if (currentTool !== 'text') return;
    const text = prompt('Texte :');
    if (text) {
        const ll = e.latlng;
        addElement({
            id: Date.now().toString(), type: 'text', text,
            geoCenter: { lat: ll.lat, lng: ll.lng },
            fontSize: 16, fontWeight: 'bold', color: strokeColor,
            layerId: activeLayerId
        });
        renderCanvas();
    }
}

// ========== TOOL SELECTION ==========
function selectTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    if (tool !== 'select') selectedElement = null;
    renderCanvas();
}

// ========== SEARCH ==========
let searchTimeout = null;
function toggleSearch() {
    const input = document.getElementById('search-input');
    input.focus();
    input.select();
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

// ========== CREATE SHAPES ==========
function createShapeElement(tool, pixelPos, w, h, geoCenter) {
    return {
        id: Date.now().toString(), type: tool,
        geoCenter: { lat: geoCenter.lat, lng: geoCenter.lng },
        widthMeters: pixelToMeters(w), heightMeters: pixelToMeters(h),
        _pixelX: pixelPos.x, _pixelY: pixelPos.y,
        _pixelWidth: w, _pixelHeight: h,
        _pixelCenterX: pixelPos.x + w / 2, _pixelCenterY: pixelPos.y + h / 2,
        strokeColor, fillColor, strokeWidth, opacity, fillPattern,
        rotation: 0, layerId: activeLayerId
    };
}

function moveElementGeo(el, dlat, dlng) {
    if (el.geoCenter) { el.geoCenter.lat += dlat; el.geoCenter.lng += dlng; }
    if (el.geoPath) { el.geoPath.forEach(p => { p.dlat += dlat; p.dlng += dlng; }); }
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

    if (selectedElement && selectedElement._pixelX != null) {
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            selectedElement._pixelX - 4, selectedElement._pixelY - 4,
            (selectedElement._pixelWidth || 100) + 8, (selectedElement._pixelHeight || 100) + 8
        );
        ctx.restore();
    }
}

function projectAndDraw(el) {
    if (!el.geoCenter) return;

    const centerPx = latLngToPixel(el.geoCenter);

    if (el.widthMeters != null) {
        el._pixelWidth = metersToPixel(el.widthMeters);
        el._pixelHeight = metersToPixel(el.heightMeters);
    }

    if (el.type === 'text') {
        el._pixelX = centerPx.x;
        el._pixelY = centerPx.y;
    } else if (el.type === 'freehand' && el.geoPath) {
        el._pixelPath = el.geoPath.map(p => {
            const ll = L.latLng(el.geoCenter.lat + p.dlat, el.geoCenter.lng + p.dlng);
            return latLngToPixel(ll);
        });
    } else {
        el._pixelX = centerPx.x - (el._pixelWidth || 0) / 2;
        el._pixelY = centerPx.y - (el._pixelHeight || 0) / 2;
    }

    el._pixelCenterX = centerPx.x;
    el._pixelCenterY = centerPx.y;

    drawElement(el);
}

function drawElement(el) {
    ctx.save();
    ctx.globalAlpha = el.opacity || 1;
    ctx.strokeStyle = el.strokeColor || '#007AFF';
    ctx.fillStyle = el.fillColor || 'transparent';
    ctx.lineWidth = el.strokeWidth || 2;

    const x = el._pixelX || 0, y = el._pixelY || 0;
    const w = el._pixelWidth || 0, h = el._pixelHeight || 0;

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
            if (el._pixelPath && el._pixelPath.length > 1) {
                ctx.beginPath(); ctx.moveTo(el._pixelPath[0].x, el._pixelPath[0].y);
                el._pixelPath.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
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

function drawStar(cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI / points) - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.4;
        i === 0 ? ctx.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)) : ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
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
    } else if (currentTool === 'line') {
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
        if (el.type === 'freehand' && el._pixelPath) {
            for (const p of el._pixelPath) {
                if (Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10) {
                    el._offsetX = x - (el._pixelX || 0);
                    el._offsetY = y - (el._pixelY || 0);
                    return el;
                }
            }
        } else if (el._pixelX != null && el._pixelWidth != null) {
            if (x >= el._pixelX && x <= el._pixelX + el._pixelWidth && y >= el._pixelY && y <= el._pixelY + el._pixelHeight) {
                el._offsetX = x - el._pixelX;
                el._offsetY = y - el._pixelY;
                return el;
            }
        } else if (el._pixelX != null) {
            if (Math.abs(x - el._pixelX) < 20 && Math.abs(y - el._pixelY) < 20) {
                el._offsetX = 0; el._offsetY = 0;
                return el;
            }
        }
    }
    return null;
}

function eraseAt(x, y) {
    elements = elements.filter(el => {
        if (el._pixelX != null && el._pixelWidth != null) {
            return !(x >= el._pixelX - 10 && x <= el._pixelX + el._pixelWidth + 10 && y >= el._pixelY - 10 && y <= el._pixelY + el._pixelHeight + 10);
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
    if (undoStack.length === 0) return;
    redoStack.push(JSON.parse(JSON.stringify(elements)));
    elements = undoStack.pop();
    layers.forEach(l => { l.elements = elements.filter(e => e.layerId === l.id); });
    selectedElement = null;
    renderCanvas(); renderLayers();
}

function redo() {
    if (redoStack.length === 0) return;
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
    const list = document.getElementById('layers-list');
    list.innerHTML = layers.map(l => `
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

// ========== TRASH ZONE ==========
function showTrash() {
    const t = document.getElementById('trash-zone');
    t.classList.remove('hidden');
    t.classList.add('visible');
    trashVisible = true;
}

function hideTrash() {
    const t = document.getElementById('trash-zone');
    t.classList.remove('visible', 'highlight');
    t.classList.add('hidden');
    trashVisible = false;
}

function isOverTrash(clientY) {
    const trash = document.getElementById('trash-zone');
    return clientY >= trash.getBoundingClientRect().top - 20;
}

function updateTrashHighlight(clientY) {
    const trash = document.getElementById('trash-zone');
    if (isOverTrash(clientY)) trash.classList.add('highlight');
    else trash.classList.remove('highlight');
}

function deleteSelectedElement() {
    if (!selectedElement) return;
    elements = elements.filter(el => el.id !== selectedElement.id);
    layers.forEach(l => {
        if (l.elements) l.elements = l.elements.filter(el => el.id !== selectedElement.id);
    });
    selectedElement = null;
    renderLayers();
}

// ========== KEYBOARD ==========
document.addEventListener('keydown', (e) => {
    if (!document.getElementById('editor') || document.getElementById('editor').classList.contains('hidden')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && document.activeElement.tagName !== 'INPUT') {
        deleteSelectedElement();
        renderCanvas();
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

// ========== SAVE ==========
function saveMap() {
    if (!currentMap) return;
    currentMap.layers = layers;
    currentMap.updatedAt = new Date().toISOString();
    if (leafletMap) {
        currentMap.mapView = {
            center: [leafletMap.getCenter().lat, leafletMap.getCenter().lng],
            zoom: leafletMap.getZoom()
        };
    }
    const idx = maps.findIndex(m => m.id === currentMap.id);
    if (idx >= 0) maps[idx] = currentMap;
    saveData();
    showToast('Carte sauvegardée');
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
