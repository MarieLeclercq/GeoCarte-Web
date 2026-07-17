// ========== EDITOR STATE ==========
let canvas, ctx;
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
let zoom = 1;
let panX = 0, panY = 0;
let layers = [{ id: '1', name: 'Calque 1', visible: true, locked: false }];
let activeLayerId = '1';

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

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDoubleClick);

    setTimeout(() => {
        resizeCanvas();
        renderLayers();
        renderCanvas();
    }, 50);
}

function closeEditor() {
    saveMap();
    document.getElementById('editor').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    renderMaps();
}

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    let w = container.clientWidth - 40;
    let h = container.clientHeight - 40;
    if (w < 100) w = container.clientWidth || window.innerWidth - 40;
    if (h < 100) h = container.clientHeight || window.innerHeight - 120;
    w = Math.max(w, 300);
    h = Math.max(h, 200);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
}

// ========== TOOLS ==========
function selectTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    canvas.style.cursor = tool === 'select' ? 'default' : tool === 'pan' ? 'grab' : 'crosshair';
}

// ========== CANVAS EVENTS ==========

function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    startX = (e.clientX - rect.left) / zoom - panX;
    startY = (e.clientY - rect.top) / zoom - panY;
    isDrawing = true;

    if (currentTool === 'select') {
        selectedElement = findElementAt(startX, startY);
        renderCanvas();
    } else if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
        currentPath = [{ x: startX, y: startY }];
    }
}

function onPointerMove(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - panX;
    const y = (e.clientY - rect.top) / zoom - panY;

    if (currentTool === 'pan') {
        panX += e.movementX / zoom;
        panY += e.movementY / zoom;
        renderCanvas();
    } else if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        currentPath.push({ x, y });
        renderCanvas();
        drawFreePath();
    } else if (currentTool === 'eraser') {
        eraseAt(x, y);
        renderCanvas();
    } else if (currentTool === 'select' && selectedElement) {
        selectedElement.x = x - selectedElement._offsetX;
        selectedElement.y = y - selectedElement._offsetY;
        renderCanvas();
    } else {
        renderCanvas();
        drawPreview(x, y);
    }
}

function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / zoom - panX;
    const endY = (e.clientY - rect.top) / zoom - panY;

    if (currentTool === 'freehand' || currentTool === 'pen' || currentTool === 'highlighter') {
        if (currentPath.length > 1) {
            const el = {
                id: Date.now().toString(),
                type: 'freehand',
                path: [...currentPath],
                strokeColor, fillColor: currentTool === 'highlighter' ? fillColor + '44' : 'transparent',
                strokeWidth: currentTool === 'highlighter' ? strokeWidth * 4 : strokeWidth,
                opacity: currentTool === 'highlighter' ? 0.4 : opacity,
                layerId: activeLayerId
            };
            addElement(el);
        }
        currentPath = [];
    } else if (currentTool !== 'select' && currentTool !== 'pan' && currentTool !== 'pipette' && currentTool !== 'eraser') {
        const w = endX - startX;
        const h = endY - startY;
        if (Math.abs(w) > 5 || Math.abs(h) > 5) {
            const el = createShapeElement(currentTool, startX, startY, w, h);
            addElement(el);
        }
    }
    renderCanvas();
}

function onDoubleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - panX;
    const y = (e.clientY - rect.top) / zoom - panY;

    if (currentTool === 'text') {
        const text = prompt('Texte :');
        if (text) {
            addElement({
                id: Date.now().toString(), type: 'text', x, y, text,
                fontSize: 16, fontWeight: 'bold', color: strokeColor,
                layerId: activeLayerId
            });
            renderCanvas();
        }
    }
}

// ========== CREATE SHAPES ==========
function createShapeElement(tool, x, y, w, h) {
    return {
        id: Date.now().toString(), type: tool,
        x: Math.min(x, x + w), y: Math.min(y, y + h),
        width: Math.abs(w), height: Math.abs(h),
        strokeColor, fillColor, strokeWidth, opacity, fillPattern,
        rotation: 0, layerId: activeLayerId
    };
}

// ========== DRAWING ==========
function renderCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(panX, panY);

    // Background based on map style
    drawMapBackground();

    // Grid
    drawGrid();

    // Elements
    elements.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(el => {
        const layer = layers.find(l => l.id === el.layerId);
        if (layer && !layer.visible) return;
        drawElement(el);
    });

    ctx.restore();

    // Selection indicator
    if (selectedElement) {
        ctx.save();
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            selectedElement.x * zoom + panX * zoom - 4,
            selectedElement.y * zoom + panY * zoom - 4,
            (selectedElement.width || 100) * zoom + 8,
            (selectedElement.height || 100) * zoom + 8
        );
        ctx.restore();
    }
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    const step = 40;
    for (let x = 0; x < canvas.width / zoom; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / zoom); ctx.stroke(); }
    for (let y = 0; y < canvas.height / zoom; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / zoom, y); ctx.stroke(); }
}

function drawMapBackground() {
    const w = canvas.width / zoom;
    const h = canvas.height / zoom;
    const style = currentMap ? currentMap.style : 'blank';

    switch (style) {
        case 'political': {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#87CEEB'); grad.addColorStop(0.3, '#B0E0E6');
            grad.addColorStop(0.4, '#87CEEB'); grad.addColorStop(1, '#4682B4');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#90EE90';
            ctx.beginPath(); ctx.ellipse(w * 0.25, h * 0.35, w * 0.18, h * 0.22, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7CCD7C';
            ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.5, w * 0.15, h * 0.28, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3CB371';
            ctx.beginPath(); ctx.ellipse(w * 0.75, h * 0.3, w * 0.12, h * 0.18, -0.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8FBC8F';
            ctx.beginPath(); ctx.ellipse(w * 0.4, h * 0.75, w * 0.2, h * 0.15, 0.15, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'physical': {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#87CEEB'); grad.addColorStop(0.35, '#B0E0E6');
            grad.addColorStop(0.4, '#8FBC8F'); grad.addColorStop(0.6, '#DEB887');
            grad.addColorStop(0.8, '#D2691E'); grad.addColorStop(1, '#A0522D');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath(); ctx.ellipse(w * 0.6, h * 0.15, w * 0.35, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(w * 0.2, h * 0.25, w * 0.25, h * 0.08, -0.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#228B22';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.55, w * 0.15, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8B4513';
            ctx.beginPath(); ctx.ellipse(w * 0.7, h * 0.6, w * 0.18, h * 0.15, 0.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'satellite': {
            const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
            grad.addColorStop(0, '#1a3a1a'); grad.addColorStop(0.5, '#0d1f0d');
            grad.addColorStop(0.8, '#0a1a2e'); grad.addColorStop(1, '#060d1a');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(30,70,30,0.6)';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.4, w * 0.2, h * 0.25, -0.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(20,60,20,0.5)';
            ctx.beginPath(); ctx.ellipse(w * 0.7, h * 0.5, w * 0.15, h * 0.2, 0.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'blank': {
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'relief': {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#DEB887'); grad.addColorStop(0.3, '#D2B48C');
            grad.addColorStop(0.5, '#8FBC8F'); grad.addColorStop(0.7, '#228B22');
            grad.addColorStop(1, '#8B4513');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#D2691E';
            ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.3, w * 0.25, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#A0522D';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.6, w * 0.2, h * 0.18, 0.1, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'shadedRelief': {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#8B4513'); grad.addColorStop(0.4, '#6B8E23');
            grad.addColorStop(0.7, '#228B22'); grad.addColorStop(1, '#556B2F');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(139,69,19,0.4)';
            ctx.beginPath(); ctx.ellipse(w * 0.4, h * 0.35, w * 0.2, h * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(34,139,34,0.3)';
            ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.6, w * 0.18, h * 0.2, 0.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'topographic': {
            ctx.fillStyle = '#F5F5DC'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#C0B283'; ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const r = (w * 0.08) * (i + 1);
                ctx.beginPath(); ctx.ellipse(w * 0.45, h * 0.4, r, r * 0.6, 0.1, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.fillStyle = '#98FB98';
            ctx.beginPath(); ctx.ellipse(w * 0.45, h * 0.4, w * 0.08, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'simplified': {
            ctx.fillStyle = '#F5F5F5'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#E8E8E8';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.4, w * 0.15, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(w * 0.6, h * 0.5, w * 0.12, h * 0.18, 0.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'countries': {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#FFB6C1'); grad.addColorStop(0.25, '#ADD8E6');
            grad.addColorStop(0.5, '#90EE90'); grad.addColorStop(0.75, '#FFD700');
            grad.addColorStop(1, '#DDA0DD');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(w * 0.25, h * 0.3, w * 0.15, h * 0.2, -0.2, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.45, w * 0.18, h * 0.22, 0.1, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(w * 0.75, h * 0.35, w * 0.1, h * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
            break;
        }
        case 'continents': {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#87CEEB'); grad.addColorStop(0.3, '#ADD8E6');
            grad.addColorStop(1, '#4682B4');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#90EE90';
            ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.35, w * 0.2, h * 0.25, -0.15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7CCD7C';
            ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.5, w * 0.15, h * 0.2, 0.1, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'oceans': {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#001a33'); grad.addColorStop(0.3, '#003366');
            grad.addColorStop(0.6, '#006994'); grad.addColorStop(1, '#87CEEB');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'rivers': {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#E0F0FF'); grad.addColorStop(1, '#87CEEB');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#4169E1'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(w * 0.1, 0);
            ctx.quadraticCurveTo(w * 0.3, h * 0.3, w * 0.25, h * 0.5);
            ctx.quadraticCurveTo(w * 0.2, h * 0.7, w * 0.15, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(w * 0.6, 0);
            ctx.quadraticCurveTo(w * 0.65, h * 0.25, w * 0.7, h * 0.4);
            ctx.quadraticCurveTo(w * 0.75, h * 0.6, w * 0.68, h); ctx.stroke();
            ctx.strokeStyle = '#1E90FF'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(w * 0.4, 0);
            ctx.quadraticCurveTo(w * 0.42, h * 0.35, w * 0.45, h * 0.6);
            ctx.lineTo(w * 0.48, h); ctx.stroke();
            break;
        }
        case 'climate': {
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, '#FF6347'); grad.addColorStop(0.2, '#FF8C00');
            grad.addColorStop(0.4, '#FFD700'); grad.addColorStop(0.6, '#90EE90');
            grad.addColorStop(0.8, '#87CEEB'); grad.addColorStop(1, '#4169E1');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            break;
        }
        case 'density': {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#E6E6FA'); grad.addColorStop(0.5, '#DDA0DD');
            grad.addColorStop(1, '#87CEEB');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(148,0,211,0.15)';
            for (let i = 0; i < 30; i++) {
                ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 15 + 5, 0, Math.PI * 2); ctx.fill();
            }
            break;
        }
        case 'biomes': {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#228B22'); grad.addColorStop(0.3, '#32CD32');
            grad.addColorStop(0.5, '#DEB887'); grad.addColorStop(0.7, '#D2691E');
            grad.addColorStop(1, '#8FBC8F');
            ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
            break;
        }
        default: {
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
        }
    }
}

function drawElement(el) {
    ctx.save();
    ctx.globalAlpha = el.opacity || 1;
    ctx.strokeStyle = el.strokeColor || '#007AFF';
    ctx.fillStyle = el.fillColor || 'transparent';
    ctx.lineWidth = el.strokeWidth || 2;

    const x = el.x || 0, y = el.y || 0, w = el.width || 100, h = el.height || 100;

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
        case 'diamond':
            ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
            ctx.fill(); ctx.stroke(); break;
        case 'star': drawStar(x + w / 2, y + h / 2, Math.min(w, h) / 2, 5); break;
        case 'arrow':
            ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w - 15, y); ctx.moveTo(x + w, y + h / 2); ctx.lineTo(x + w - 15, y + h);
            ctx.stroke(); break;
        case 'line':
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke(); break;
        case 'freehand':
            if (el.path && el.path.length > 1) {
                ctx.beginPath(); ctx.moveTo(el.path[0].x, el.path[0].y);
                el.path.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
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
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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
    const w = x - startX, h = y - startY;
    const el = createShapeElement(currentTool, startX, startY, w, h);
    drawElement(el);
    ctx.restore();
}

// ========== HELPERS ==========
function findElementAt(x, y) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.x != null && el.y != null && el.width != null && el.height != null) {
            if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
                el._offsetX = x - el.x;
                el._offsetY = y - el.y;
                return el;
            }
        }
    }
    return null;
}

function eraseAt(x, y) {
    elements = elements.filter(el => {
        if (el.x != null && el.width != null) {
            return !(x >= el.x - 10 && x <= el.x + el.width + 10 && y >= el.y - 10 && y <= el.y + el.height + 10);
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
    renderCanvas();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    elements = redoStack.pop();
    renderCanvas();
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

// ========== SAVE ==========
function saveMap() {
    if (!currentMap) return;
    currentMap.layers = layers;
    currentMap.updatedAt = new Date().toISOString();
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

// ========== ZOOM ==========
document.getElementById('canvas-container')?.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom = Math.max(0.2, Math.min(5, zoom + delta));
    renderCanvas();
}, { passive: false });

let lastTouchDist = 0;
document.getElementById('canvas-container')?.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
});
document.getElementById('canvas-container')?.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        zoom = Math.max(0.2, Math.min(5, zoom + (dist - lastTouchDist) * 0.005));
        lastTouchDist = dist;
        renderCanvas();
    }
});

window.addEventListener('resize', () => { if (canvas) { resizeCanvas(); renderCanvas(); } });
