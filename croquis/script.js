// ==========================================================================
// MÓDULO CROQUIS ELÉCTRICO DE AMBIENTE - VILLASER GESTIÓN
// ==========================================================================

// --- SINCRONIZACIÓN DE TEMA AUTOMÁTICO ---
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
    if (temaGuardado === 'system') {
        const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (prefiereClaro) document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
    }
});

// ==========================================================================
// 1. LIBRERÍA VECTORIAL 100 % OFFLINE DE SÍMBOLOS NORMALIZADOS
// ==========================================================================
const CATALOGO_TIPOS = {
    boca_centro: {
        nombre: 'Boca de Techo',
        corto: 'Boca Techo',
        zDefault: 2.60,
        circuitoDefault: 'C1',
        enPared: false,
        svg: `
            <circle cx="0" cy="0" r="11" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="-7.5" y1="-7.5" x2="7.5" y2="7.5" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="7.5" y1="-7.5" x2="-7.5" y2="7.5" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    aplique_pared: {
        nombre: 'Aplique de Pared',
        corto: 'Aplique',
        zDefault: 2.10,
        circuitoDefault: 'C1',
        enPared: true,
        svg: `
            <line x1="-10" y1="-12" x2="10" y2="-12" stroke="#0f172a" stroke-width="2.5"/>
            <line x1="0" y1="-12" x2="0" y2="-4" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="4" r="8" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="-5" y1="-1" x2="5" y2="9" stroke="#0f172a" stroke-width="1.5"/>
            <line x1="5" y1="-1" x2="-5" y2="9" stroke="#0f172a" stroke-width="1.5"/>
        `
    },
    toma_simple: {
        nombre: 'Tomacorriente 10A',
        corto: 'Toma 10A',
        zDefault: 0.30,
        circuitoDefault: 'C2',
        enPared: true,
        svg: `
            <line x1="0" y1="-13" x2="0" y2="-5" stroke="#0f172a" stroke-width="2"/>
            <path d="M -9 4 A 9 9 0 0 1 9 4" fill="#ffffff" stroke="#0f172a" stroke-width="2.2"/>
            <line x1="-10" y1="4" x2="10" y2="4" stroke="#0f172a" stroke-width="2"/>
        `
    },
    toma_doble: {
        nombre: 'Tomacorriente Doble',
        corto: 'Toma Doble',
        zDefault: 0.30,
        circuitoDefault: 'C2',
        enPared: true,
        svg: `
            <line x1="0" y1="-14" x2="0" y2="-6" stroke="#0f172a" stroke-width="2"/>
            <path d="M -9 1 A 9 9 0 0 1 9 1" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <path d="M -9 7 A 9 9 0 0 1 9 7" fill="none" stroke="#0f172a" stroke-width="2"/>
            <line x1="-10" y1="7" x2="10" y2="7" stroke="#0f172a" stroke-width="2"/>
        `
    },
    toma_especial: {
        nombre: 'Tomacorriente 20A (TUE)',
        corto: 'Toma 20A',
        zDefault: 0.30,
        circuitoDefault: 'C3',
        enPared: true,
        svg: `
            <line x1="0" y1="-13" x2="0" y2="-5" stroke="#0f172a" stroke-width="2"/>
            <path d="M -9 4 A 9 9 0 0 1 9 4 Z" fill="#0f172a" stroke="#0f172a" stroke-width="2"/>
        `
    },
    llave_1p: {
        nombre: 'Llave de 1 Punto',
        corto: 'Llave 1P',
        zDefault: 1.10,
        circuitoDefault: 'C1',
        enPared: true,
        svg: `
            <circle cx="0" cy="0" r="5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="3.5" y1="-3.5" x2="12" y2="-12" stroke="#0f172a" stroke-width="2"/>
            <line x1="9" y1="-12" x2="12" y2="-12" stroke="#0f172a" stroke-width="2"/>
        `
    },
    llave_2p: {
        nombre: 'Llave de 2 Puntos',
        corto: 'Llave 2P',
        zDefault: 1.10,
        circuitoDefault: 'C1',
        enPared: true,
        svg: `
            <circle cx="0" cy="0" r="5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="3" y1="-4" x2="11" y2="-13" stroke="#0f172a" stroke-width="2"/>
            <line x1="-3" y1="-4" x2="-11" y2="-13" stroke="#0f172a" stroke-width="2"/>
        `
    },
    llave_3p: {
        nombre: 'Llave de 3 Puntos',
        corto: 'Llave 3P',
        zDefault: 1.10,
        circuitoDefault: 'C1',
        enPared: true,
        svg: `
            <circle cx="0" cy="0" r="5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="0" y1="-5" x2="0" y2="-15" stroke="#0f172a" stroke-width="2"/>
            <line x1="3.5" y1="-3.5" x2="12" y2="-12" stroke="#0f172a" stroke-width="2"/>
            <line x1="-3.5" y1="-3.5" x2="-12" y2="-12" stroke="#0f172a" stroke-width="2"/>
        `
    },
    llave_comb: {
        nombre: 'Llave Combinada',
        corto: 'Combinada',
        zDefault: 1.10,
        circuitoDefault: 'C1',
        enPared: true,
        svg: `
            <circle cx="0" cy="0" r="5" fill="#0f172a" stroke="#0f172a" stroke-width="2"/>
            <line x1="3.5" y1="-3.5" x2="12" y2="-12" stroke="#0f172a" stroke-width="2"/>
            <line x1="-3.5" y1="3.5" x2="-12" y2="12" stroke="#0f172a" stroke-width="2"/>
        `
    },
    tablero: {
        nombre: 'Tablero Seccional',
        corto: 'Tablero',
        zDefault: 1.60,
        circuitoDefault: 'CS',
        enPared: true,
        svg: `
            <rect x="-14" y="-7" width="28" height="14" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <polygon points="-14,-7 14,-7 -14,7" fill="#0f172a"/>
        `
    },
    caja_paso: {
        nombre: 'Caja de Paso / Derivación',
        corto: 'Caja Paso',
        zDefault: 2.30,
        circuitoDefault: 'C1',
        enPared: false,
        svg: `
            <rect x="-8" y="-8" width="16" height="16" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="-8" y1="-8" x2="8" y2="8" stroke="#0f172a" stroke-width="1.6"/>
        `
    }
};

// ==========================================================================
// 2. ESTADO GLOBAL DEL MÓDULO
// ==========================================================================
const STORAGE_KEY = 'croquis_estado_actual';

let estadoCroquis = {
    cliNombre: '',
    cliDireccion: '',
    ambNombre: 'Dormitorio Principal',
    ambAncho: 4.00,
    ambLargo: 3.50,
    ambAlto: 2.60,
    nodos: [],
    tramos: [],
    desperdicio: 0.10,
    obsGenerales: ''
};

let herramientaActual = 'seleccionar';
let nodoOrigenConectar = null;
let elementoSeleccionado = null; // { tipo: 'nodo' | 'tramo', id: string }
let pasoFinoMetros = 0.10;
let mostrarCotas = true;
let historialUndo = [];
let ultimoComputo = [];

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let telefonoClienteActual = '';
let timerAutoGuardado = null;
let escalaActualPreview = 1;

// ==========================================================================
// 3. INICIALIZACIÓN Y GESTIÓN DE MEMORIA GLOBAL
// ==========================================================================
function obtenerUid() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.uid;
    }
    return null;
}

document.addEventListener('DOMContentLoaded', () => {
    asegurarItemCroquisEnFooter();
    cargarEstadoInicial();
    actualizarPDFHeaders();
});

function asegurarItemCroquisEnFooter() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;
    setTimeout(() => {
        if (!footer.querySelector('[data-mod="croquis"]')) {
            const btn = document.createElement('button');
            btn.className = 'corp-nav-item active';
            btn.setAttribute('data-mod', 'croquis');
            btn.innerHTML = '<i class="fa-solid fa-compass-drafting"></i><span>Croquis</span>';
            footer.appendChild(btn);
            footer.scrollLeft = footer.scrollWidth;
        }
    }, 80);
}

function cargarEstadoInicial() {
    try {
        const guardadoRaw = localStorage.getItem(STORAGE_KEY);
        if (guardadoRaw) {
            const data = JSON.parse(guardadoRaw);
            if (data && (data.cliNombre || (data.nodos && data.nodos.length > 0))) {
                aplicarDatosCargados(data);
                if (data.cliNombre) {
                    avanzarPasoTrabajo();
                    return;
                }
            }
        }

        // Si no hay borrador activo, revisar cliente global de la PWA
        const globalRaw = localStorage.getItem('villaser_cliente_global');
        if (globalRaw) {
            const g = JSON.parse(globalRaw);
            if (g && g.nombre) {
                document.getElementById('cliNombre').value = g.nombre || '';
                document.getElementById('cliDireccion').value = g.direccion || g.dir || '';
                telefonoClienteActual = g.telefono || g.tel || '';
                clienteDesdeAgenda = true;
                permiteGuardarNube = true;
            }
        }
    } catch (e) {
        console.warn('No se pudo restaurar estado previo de Croquis:', e);
    }
}

function aplicarDatosCargados(data) {
    estadoCroquis = {
        cliNombre: data.cliNombre || '',
        cliDireccion: data.cliDireccion || '',
        ambNombre: data.ambNombre || 'Ambiente',
        ambAncho: parseFloat(data.ambAncho) || 4.00,
        ambLargo: parseFloat(data.ambLargo) || 3.50,
        ambAlto: parseFloat(data.ambAlto) || 2.60,
        nodos: Array.isArray(data.nodos) ? data.nodos : [],
        tramos: Array.isArray(data.tramos) ? data.tramos : [],
        desperdicio: data.desperdicio !== undefined ? parseFloat(data.desperdicio) : 0.10,
        obsGenerales: data.obsGenerales || ''
    };

    document.getElementById('cliNombre').value = estadoCroquis.cliNombre;
    document.getElementById('cliDireccion').value = estadoCroquis.cliDireccion;
    document.getElementById('ambNombre').value = estadoCroquis.ambNombre;
    document.getElementById('ambAncho').value = estadoCroquis.ambAncho.toFixed(2);
    document.getElementById('ambLargo').value = estadoCroquis.ambLargo.toFixed(2);
    document.getElementById('ambAlto').value = estadoCroquis.ambAlto.toFixed(2);
    document.getElementById('selDesperdicio').value = estadoCroquis.desperdicio.toFixed(2);
    document.getElementById('obsGenerales').value = estadoCroquis.obsGenerales;

    if (data.clienteDesdeAgenda !== undefined) clienteDesdeAgenda = Boolean(data.clienteDesdeAgenda);
    if (data.permiteGuardarNube !== undefined) permiteGuardarNube = Boolean(data.permiteGuardarNube);
    if (data.nombreBorrador) nombreBorradorActual = data.nombreBorrador;
    if (data.telefonoClienteActual) telefonoClienteActual = data.telefonoClienteActual;
}

function guardarEstadoLocal() {
    try {
        const payload = {
            ...estadoCroquis,
            clienteDesdeAgenda,
            permiteGuardarNube,
            nombreBorrador: nombreBorradorActual,
            telefonoClienteActual
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Error guardando en localStorage:', e);
    }
}

function guardarClienteGlobal() {
    try {
        localStorage.setItem('villaser_cliente_global', JSON.stringify({
            nombre: estadoCroquis.cliNombre,
            direccion: estadoCroquis.cliDireccion,
            proyecto: estadoCroquis.ambNombre,
            telefono: telefonoClienteActual
        }));
    } catch (e) {}
}

// ==========================================================================
// 4. FLUJO DE CLIENTE Y AGENDA
// ==========================================================================
function seleccionarContacto(nombre, dir, tel = '') {
    document.getElementById('cliNombre').value = nombre;
    document.getElementById('cliDireccion').value = dir;
    telefonoClienteActual = tel;
    clienteDesdeAgenda = true;
    permiteGuardarNube = true;
    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    mostrarToast('Cliente Seleccionado', 'Vinculado con tu agenda.');
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
}

function iniciarCroquis() {
    const nombre = document.getElementById('cliNombre').value.trim();
    const ambNombre = document.getElementById('ambNombre').value.trim();
    const ancho = parseFloat(document.getElementById('ambAncho').value);
    const largo = parseFloat(document.getElementById('ambLargo').value);
    const alto = parseFloat(document.getElementById('ambAlto').value) || 2.60;

    if (!nombre) {
        mostrarAlertaCorp('Datos Incompletos', 'Ingresá el Nombre del Cliente para continuar.');
        return;
    }
    if (!ambNombre || isNaN(ancho) || ancho <= 0 || isNaN(largo) || largo <= 0) {
        mostrarAlertaCorp('Medidas Inválidas', 'Completá el nombre del ambiente, el ancho y el largo en metros.');
        return;
    }

    estadoCroquis.cliNombre = nombre;
    estadoCroquis.cliDireccion = document.getElementById('cliDireccion').value.trim();
    estadoCroquis.ambNombre = ambNombre;
    estadoCroquis.ambAncho = Math.min(30, Math.max(0.8, ancho));
    estadoCroquis.ambLargo = Math.min(30, Math.max(0.8, largo));
    estadoCroquis.ambAlto = Math.min(6, Math.max(2.0, alto));

    // Mantener todos los nodos dentro de los límites actuales del ambiente
    estadoCroquis.nodos.forEach(n => {
        n.x = Math.min(estadoCroquis.ambAncho, Math.max(0, n.x));
        n.y = Math.min(estadoCroquis.ambLargo, Math.max(0, n.y));
        if (n.tipo === 'boca_centro') n.z = estadoCroquis.ambAlto;
    });

    if (!clienteDesdeAgenda) {
        document.getElementById('modalAgendarCliente').classList.remove('oculto');
        return;
    }

    avanzarPasoTrabajo();
}

function avanzarPasoTrabajo() {
    document.getElementById('step-cliente').classList.add('oculto');
    const stepTrabajo = document.getElementById('step-trabajo');
    stepTrabajo.classList.remove('oculto');
    stepTrabajo.classList.add('flex-column', 'gap-15');

    document.getElementById('lblResumenAmbiente').innerText =
        `${estadoCroquis.ambNombre} (${estadoCroquis.ambAncho.toFixed(2)}m × ${estadoCroquis.ambLargo.toFixed(2)}m)`;
    document.getElementById('lblResumenCliente').innerText =
        `Cliente: ${estadoCroquis.cliNombre}${estadoCroquis.cliDireccion ? ' • ' + estadoCroquis.cliDireccion : ''}`;

    actualizarBadgeNube(permiteGuardarNube ? 'sincronizado' : 'local');
    guardarEstadoLocal();
    guardarClienteGlobal();
    recalcularYRenderizar();
}

function volverEditarDatos() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
}

function accionAgendarCliente() {
    const nombre = encodeURIComponent(document.getElementById('cliNombre').value.trim());
    const dir = encodeURIComponent(document.getElementById('cliDireccion').value.trim());
    window.location.href = `../agenda/index.html?nombre=${nombre}&dir=${dir}`;
}

function opcionBuscarAgenda() {
    document.getElementById('modalAgendarCliente').classList.add('oculto');
    if (typeof abrirModalAgendaGlobal === 'function') abrirModalAgendaGlobal();
}

function opcionContinuarSinAgenda() {
    document.getElementById('modalAgendarCliente').classList.add('oculto');
    document.getElementById('modalConfirmarSinAgenda').classList.remove('oculto');
}

function cerrarModalConfirmarSinAgenda() {
    document.getElementById('modalConfirmarSinAgenda').classList.add('oculto');
}

function ejecutarContinuarSinAgenda() {
    cerrarModalConfirmarSinAgenda();
    permiteGuardarNube = false;
    avanzarPasoTrabajo();
}

function ejecutarNuevoCroquis() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    estadoCroquis = {
        cliNombre: '',
        cliDireccion: '',
        ambNombre: 'Dormitorio Principal',
        ambAncho: 4.00,
        ambLargo: 3.50,
        ambAlto: 2.60,
        nodos: [],
        tramos: [],
        desperdicio: 0.10,
        obsGenerales: ''
    };

    historialUndo = [];
    elementoSeleccionado = null;
    nodoOrigenConectar = null;
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = '';

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('ambNombre').value = 'Dormitorio Principal';
    document.getElementById('ambAncho').value = '4.00';
    document.getElementById('ambLargo').value = '3.50';
    document.getElementById('ambAlto').value = '2.60';
    document.getElementById('obsGenerales').value = '';

    deseleccionarTodo();
    guardarEstadoLocal();
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
}

// ==========================================================================
// 5. MOTOR GEOMÉTRICO Y RENDERIZADO DEL PLANO SVG
// ==========================================================================
function obtenerGeometriaPlano() {
    const viewW = 700;
    const viewH = 520;
    const padLeft = 75;
    const padRight = 55;
    const padTop = 65;
    const padBottom = 55;

    const areaW = viewW - padLeft - padRight;
    const areaH = viewH - padTop - padBottom;

    const escala = Math.min(areaW / estadoCroquis.ambAncho, areaH / estadoCroquis.ambLargo);
    const roomW = estadoCroquis.ambAncho * escala;
    const roomH = estadoCroquis.ambLargo * escala;

    const offsetX = padLeft + (areaW - roomW) / 2;
    const offsetY = padTop + (areaH - roomH) / 2;

    return { viewW, viewH, escala, roomW, roomH, offsetX, offsetY };
}

function metrosAPx(mx, my, geo) {
    return {
        px: geo.offsetX + mx * geo.escala,
        py: geo.offsetY + my * geo.escala
    };
}

function pxAMetros(px, py, geo) {
    const rawX = (px - geo.offsetX) / geo.escala;
    const rawY = (py - geo.offsetY) / geo.escala;
    return {
        x: Math.round(Math.min(estadoCroquis.ambAncho, Math.max(0, rawX)) * 10) / 10,
        y: Math.round(Math.min(estadoCroquis.ambLargo, Math.max(0, rawY)) * 10) / 10
    };
}

function calcularRotacionPared(nodo) {
    if (typeof nodo.rotacionManual === 'number') return nodo.rotacionManual;
    const info = CATALOGO_TIPOS[nodo.tipo];
    if (!info || !info.enPared) return 0;

    const dNorte = nodo.y;
    const dSur = estadoCroquis.ambLargo - nodo.y;
    const dOeste = nodo.x;
    const dEste = estadoCroquis.ambAncho - nodo.x;

    const min = Math.min(dNorte, dSur, dOeste, dEste);
    if (min === dNorte) return 0;
    if (min === dEste) return 90;
    if (min === dSur) return 180;
    return 270;
}

function ajustarAParedCercana(mx, my, tipo) {
    const info = CATALOGO_TIPOS[tipo];
    if (!info || !info.enPared) return { x: mx, y: my };

    const umbral = 0.35; // 35 cm de imán a pared
    let nx = mx;
    let ny = my;

    if (ny < umbral) ny = 0;
    else if (estadoCroquis.ambLargo - ny < umbral) ny = estadoCroquis.ambLargo;

    if (nx < umbral) nx = 0;
    else if (estadoCroquis.ambAncho - nx < umbral) nx = estadoCroquis.ambAncho;

    return {
        x: Math.round(nx * 100) / 100,
        y: Math.round(ny * 100) / 100
    };
}

function renderizarPlanoSVG(targetSvgId = 'svgCroquis', modoExportacion = false) {
    const svg = document.getElementById(targetSvgId);
    if (!svg) return;

    const geo = obtenerGeometriaPlano();
    let html = '';

    // Fondo blanco limpio
    html += `<rect x="0" y="0" width="${geo.viewW}" height="${geo.viewH}" fill="#ffffff"/>`;

    // Grilla cada 0.50 m (solo en editor interactivo)
    if (!modoExportacion) {
        for (let gx = 0.5; gx < estadoCroquis.ambAncho; gx += 0.5) {
            const p = metrosAPx(gx, 0, geo);
            html += `<line x1="${p.px.toFixed(1)}" y1="${geo.offsetY}" x2="${p.px.toFixed(1)}" y2="${geo.offsetY + geo.roomH}" stroke="#e2e8f0" stroke-width="1"/>`;
        }
        for (let gy = 0.5; gy < estadoCroquis.ambLargo; gy += 0.5) {
            const p = metrosAPx(0, gy, geo);
            html += `<line x1="${geo.offsetX}" y1="${p.py.toFixed(1)}" x2="${geo.offsetX + geo.roomW}" y2="${p.py.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`;
        }
    }

    // Muros perimetrales del ambiente
    html += `<rect x="${geo.offsetX}" y="${geo.offsetY}" width="${geo.roomW}" height="${geo.roomH}" fill="#fafafa" stroke="#0f172a" stroke-width="4"/>`;

    // Cotas exteriores generales (Ancho y Largo)
    const cotaTopY = geo.offsetY - 24;
    html += `
        <line x1="${geo.offsetX}" y1="${cotaTopY}" x2="${geo.offsetX + geo.roomW}" y2="${cotaTopY}" stroke="#475569" stroke-width="1.2"/>
        <line x1="${geo.offsetX}" y1="${cotaTopY - 5}" x2="${geo.offsetX}" y2="${cotaTopY + 5}" stroke="#475569" stroke-width="1.2"/>
        <line x1="${geo.offsetX + geo.roomW}" y1="${cotaTopY - 5}" x2="${geo.offsetX + geo.roomW}" y2="${cotaTopY + 5}" stroke="#475569" stroke-width="1.2"/>
        <rect x="${geo.offsetX + geo.roomW / 2 - 34}" y="${cotaTopY - 9}" width="68" height="17" fill="#ffffff"/>
        <text x="${geo.offsetX + geo.roomW / 2}" y="${cotaTopY + 3}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${estadoCroquis.ambAncho.toFixed(2)} m</text>
    `;

    const cotaLeftX = geo.offsetX - 26;
    const midY = geo.offsetY + geo.roomH / 2;
    html += `
        <line x1="${cotaLeftX}" y1="${geo.offsetY}" x2="${cotaLeftX}" y2="${geo.offsetY + geo.roomH}" stroke="#475569" stroke-width="1.2"/>
        <line x1="${cotaLeftX - 5}" y1="${geo.offsetY}" x2="${cotaLeftX + 5}" y2="${geo.offsetY}" stroke="#475569" stroke-width="1.2"/>
        <line x1="${cotaLeftX - 5}" y1="${geo.offsetY + geo.roomH}" x2="${cotaLeftX + 5}" y2="${geo.offsetY + geo.roomH}" stroke="#475569" stroke-width="1.2"/>
        <text x="${cotaLeftX - 6}" y="${midY}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a" transform="rotate(-90, ${cotaLeftX - 6}, ${midY})">${estadoCroquis.ambLargo.toFixed(2)} m</text>
    `;

    // Título interno de superficie
    const sup = (estadoCroquis.ambAncho * estadoCroquis.ambLargo).toFixed(2);
    html += `<text x="${geo.offsetX + geo.roomW - 8}" y="${geo.offsetY + geo.roomH - 8}" text-anchor="end" font-size="10" fill="#64748b" font-weight="600">Sup: ${sup} m² • H: ${estadoCroquis.ambAlto.toFixed(2)} m</text>`;

    // Tramos de cañería
    estadoCroquis.tramos.forEach(tramo => {
        const nA = estadoCroquis.nodos.find(n => n.id === tramo.desde);
        const nB = estadoCroquis.nodos.find(n => n.id === tramo.hasta);
        if (!nA || !nB) return;

        const pA = metrosAPx(nA.x, nA.y, geo);
        const pB = metrosAPx(nB.x, nB.y, geo);
        const esSel = !modoExportacion && elementoSeleccionado && elementoSeleccionado.tipo === 'tramo' && elementoSeleccionado.id === tramo.id;

        const strokeCol = esSel ? '#e11d48' : '#0284c7';
        const strokeW = esSel ? '3.5' : '2.2';

        // Curva suave o tramo recto
        const midX = (pA.px + pB.px) / 2;
        const midYTramo = (pA.py + pB.py) / 2;
        const dx = pB.px - pA.px;
        const dy = pB.py - pA.py;
        const ctrlX = midX - dy * 0.10;
        const ctrlY = midYTramo + dx * 0.10;

        html += `<path d="M ${pA.px.toFixed(1)} ${pA.py.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${pB.px.toFixed(1)} ${pB.py.toFixed(1)}" fill="none" stroke="${strokeCol}" stroke-width="${strokeW}" stroke-dasharray="${tramo.tipo.startsWith('RETORNO') || tramo.tipo === 'COMBINACION' ? '6 3' : 'none'}" data-tramo-id="${tramo.id}" style="cursor:pointer;"/>`;

        // Hitbox invisible más ancho para tocar fácil en móvil
        if (!modoExportacion) {
            html += `<path d="M ${pA.px.toFixed(1)} ${pA.py.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${pB.px.toFixed(1)} ${pB.py.toFixed(1)}" fill="none" stroke="transparent" stroke-width="18" data-tramo-id="${tramo.id}" style="cursor:pointer;"/>`;
        }

        const long25D = calcularLongitudTramo25D(nA, nB);
        if (mostrarCotas || modoExportacion) {
            html += `
                <rect x="${(ctrlX - 22).toFixed(1)}" y="${(ctrlY - 8).toFixed(1)}" width="44" height="14" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
                <text x="${ctrlX.toFixed(1)}" y="${(ctrlY + 2.5).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0369a1">${long25D.toFixed(2)}m</text>
            `;
        }
    });

    // Cotas dinámicas en vivo del nodo seleccionado hacia las paredes
    if (!modoExportacion && elementoSeleccionado && elementoSeleccionado.tipo === 'nodo') {
        const nodoSel = estadoCroquis.nodos.find(n => n.id === elementoSeleccionado.id);
        if (nodoSel) {
            const pN = metrosAPx(nodoSel.x, nodoSel.y, geo);
            // Línea horizontal hacia pared izquierda
            if (nodoSel.x > 0.05) {
                html += `<line x1="${geo.offsetX}" y1="${pN.py}" x2="${pN.px}" y2="${pN.py}" stroke="#16a34a" stroke-width="1.2" stroke-dasharray="3 3"/>`;
                html += `<text x="${(geo.offsetX + pN.px) / 2}" y="${pN.py - 4}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#15803d">${nodoSel.x.toFixed(2)}m</text>`;
            }
            // Línea vertical hacia pared superior
            if (nodoSel.y > 0.05) {
                html += `<line x1="${pN.px}" y1="${geo.offsetY}" x2="${pN.px}" y2="${pN.py}" stroke="#16a34a" stroke-width="1.2" stroke-dasharray="3 3"/>`;
                html += `<text x="${pN.px + 6}" y="${(geo.offsetY + pN.py) / 2}" text-anchor="start" font-size="9.5" font-weight="800" fill="#15803d">${nodoSel.y.toFixed(2)}m</text>`;
            }
        }
    }

    // Nodos / Símbolos Eléctricos
    estadoCroquis.nodos.forEach(nodo => {
        const info = CATALOGO_TIPOS[nodo.tipo] || CATALOGO_TIPOS.boca_centro;
        const pos = metrosAPx(nodo.x, nodo.y, geo);
        const rot = calcularRotacionPared(nodo);
        const esSel = !modoExportacion && elementoSeleccionado && elementoSeleccionado.tipo === 'nodo' && elementoSeleccionado.id === nodo.id;
        const esOrigen = !modoExportacion && nodoOrigenConectar === nodo.id;

        if (esSel || esOrigen) {
            const ringColor = esOrigen ? '#f59e0b' : '#2563eb';
            html += `<circle cx="${pos.px.toFixed(1)}" cy="${pos.py.toFixed(1)}" r="19" fill="rgba(37,99,235,0.12)" stroke="${ringColor}" stroke-width="2" stroke-dasharray="4 2"/>`;
        }

        html += `<g transform="translate(${pos.px.toFixed(1)}, ${pos.py.toFixed(1)}) rotate(${rot})" data-nodo-id="${nodo.id}" style="cursor:pointer;">${info.svg}</g>`;

        // Etiqueta de circuito
        if (nodo.circuito) {
            html += `<text x="${(pos.px + 13).toFixed(1)}" y="${(pos.py - 11).toFixed(1)}" font-size="9.5" font-weight="800" fill="#0f172a" data-nodo-id="${nodo.id}">${nodo.circuito}</text>`;
        }

        // Hitbox táctil invisible para seleccionar fácil en celular
        if (!modoExportacion) {
            html += `<circle cx="${pos.px.toFixed(1)}" cy="${pos.py.toFixed(1)}" r="22" fill="transparent" data-nodo-id="${nodo.id}" style="cursor:pointer;"/>`;
        }
    });

    svg.innerHTML = html;

    if (!modoExportacion) {
        svg.onclick = manejarClickEnLienzo;
    }
}

// ==========================================================================
// 6. INTERACCIÓN TÁCTIL Y EDICIÓN DE PRECISIÓN
// ==========================================================================
function seleccionarHerramienta(herramienta) {
    herramientaActual = herramienta;
    nodoOrigenConectar = null;

    document.querySelectorAll('.tool-simbolo-btn').forEach(btn => btn.classList.remove('activo'));
    const btnActivo = document.getElementById(`tool-${herramienta}`);
    if (btnActivo) btnActivo.classList.add('activo');

    const ayuda = document.getElementById('ayudaHerramienta');
    if (herramienta === 'seleccionar') {
        ayuda.innerText = 'Tocá un símbolo o caño en el plano para moverlo con precisión o editarlo.';
    } else if (herramienta === 'conectar') {
        deseleccionarTodo();
        ayuda.innerText = 'Paso 1: Tocá el primer símbolo (origen del caño).';
    } else {
        deseleccionarTodo();
        const info = CATALOGO_TIPOS[herramienta];
        ayuda.innerText = `Tocá dentro del ambiente para ubicar: ${info ? info.nombre : herramienta}.`;
    }
    renderizarPlanoSVG();
}

function manejarClickEnLienzo(event) {
    const svg = document.getElementById('svgCroquis');
    const targetNodoId = event.target.getAttribute('data-nodo-id');
    const targetTramoId = event.target.getAttribute('data-tramo-id');

    // MODO CONECTAR CAÑO
    if (herramientaActual === 'conectar') {
        if (!targetNodoId) {
            mostrarToast('Seleccioná un Símbolo', 'Tocá sobre un símbolo existente para unir con caño.');
            return;
        }
        if (!nodoOrigenConectar) {
            nodoOrigenConectar = targetNodoId;
            document.getElementById('ayudaHerramienta').innerText = 'Paso 2: Ahora tocá el segundo símbolo (destino del caño).';
            renderizarPlanoSVG();
            return;
        }
        if (nodoOrigenConectar === targetNodoId) {
            nodoOrigenConectar = null;
            document.getElementById('ayudaHerramienta').innerText = 'Conexión cancelada. Tocá el símbolo de origen.';
            renderizarPlanoSVG();
            return;
        }

        // Evitar duplicar exactamente el mismo tramo
        const yaExiste = estadoCroquis.tramos.some(t =>
            (t.desde === nodoOrigenConectar && t.hasta === targetNodoId) ||
            (t.desde === targetNodoId && t.hasta === nodoOrigenConectar)
        );
        if (!yaExiste) {
            guardarSnapshotUndo();
            const nA = estadoCroquis.nodos.find(n => n.id === nodoOrigenConectar);
            const nB = estadoCroquis.nodos.find(n => n.id === targetNodoId);
            const tipoSugerido = inferirTipoTramo(nA, nB);
            estadoCroquis.tramos.push({
                id: 'T_' + Date.now(),
                desde: nodoOrigenConectar,
                hasta: targetNodoId,
                tipo: tipoSugerido
            });
            mostrarToast('Caño Conectado', `Tramo agregado (${tipoSugerido}).`);
        }
        nodoOrigenConectar = null;
        document.getElementById('ayudaHerramienta').innerText = 'Tocá otro símbolo de origen para seguir cableando.';
        recalcularYRenderizar();
        programarAutoGuardado();
        return;
    }

    // MODO SELECCIONAR / MOVER
    if (herramientaActual === 'seleccionar') {
        if (targetNodoId) {
            seleccionarNodo(targetNodoId);
            return;
        }
        if (targetTramoId) {
            seleccionarTramo(targetTramoId);
            return;
        }
        deseleccionarTodo();
        return;
    }

    // MODO INSERTAR NUEVO SÍMBOLO
    const info = CATALOGO_TIPOS[herramientaActual];
    if (!info) return;

    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

    const geo = obtenerGeometriaPlano();
    const coords = pxAMetros(svgPt.x, svgPt.y, geo);
    const ajustadas = ajustarAParedCercana(coords.x, coords.y, herramientaActual);

    guardarSnapshotUndo();
    const nuevoNodo = {
        id: 'N_' + Date.now(),
        tipo: herramientaActual,
        x: ajustadas.x,
        y: ajustadas.y,
        z: herramientaActual === 'boca_centro' ? estadoCroquis.ambAlto : info.zDefault,
        circuito: info.circuitoDefault
    };

    estadoCroquis.nodos.push(nuevoNodo);
    seleccionarHerramienta('seleccionar');
    seleccionarNodo(nuevoNodo.id);
    recalcularYRenderizar();
    programarAutoGuardado();
}

function seleccionarNodo(nodoId) {
    const nodo = estadoCroquis.nodos.find(n => n.id === nodoId);
    if (!nodo) return;

    elementoSeleccionado = { tipo: 'nodo', id: nodoId };
    document.getElementById('panelEdicionTramo').classList.add('oculto');
    document.getElementById('panelEdicionNodo').classList.remove('oculto');

    const info = CATALOGO_TIPOS[nodo.tipo] || { nombre: nodo.tipo };
    document.getElementById('lblNodoSeleccionado').innerText = info.nombre;
    document.getElementById('inpNodoCircuito').value = nodo.circuito || '';
    document.getElementById('inpNodoZ').value = (nodo.z !== undefined ? nodo.z : 1.10).toFixed(2);
    actualizarTextoCotasNodo(nodo);
    renderizarPlanoSVG();
}

function seleccionarTramo(tramoId) {
    const tramo = estadoCroquis.tramos.find(t => t.id === tramoId);
    if (!tramo) return;

    elementoSeleccionado = { tipo: 'tramo', id: tramoId };
    document.getElementById('panelEdicionNodo').classList.add('oculto');
    document.getElementById('panelEdicionTramo').classList.remove('oculto');

    const nA = estadoCroquis.nodos.find(n => n.id === tramo.desde);
    const nB = estadoCroquis.nodos.find(n => n.id === tramo.hasta);
    const long = (nA && nB) ? calcularLongitudTramo25D(nA, nB).toFixed(2) : '0.00';

    document.getElementById('lblTramoSeleccionado').innerText = `Tramo de Caño (${long} m en 2.5D)`;
    document.getElementById('selTramoTipo').value = tramo.tipo || 'IUG';
    renderizarPlanoSVG();
}

function deseleccionarTodo() {
    elementoSeleccionado = null;
    document.getElementById('panelEdicionNodo').classList.add('oculto');
    document.getElementById('panelEdicionTramo').classList.add('oculto');
    renderizarPlanoSVG();
}

function setPasoFino(paso) {
    pasoFinoMetros = paso;
    const b10 = document.getElementById('btnPaso10');
    const b25 = document.getElementById('btnPaso25');
    b10.style.borderColor = paso === 0.10 ? 'var(--ngc-neon)' : '';
    b10.style.color = paso === 0.10 ? 'var(--ngc-neon)' : '';
    b25.style.borderColor = paso === 0.25 ? 'var(--ngc-neon)' : '';
    b25.style.color = paso === 0.25 ? 'var(--ngc-neon)' : '';
}

function moverNodoPaso(dirX, dirY) {
    if (!elementoSeleccionado || elementoSeleccionado.tipo !== 'nodo') return;
    const nodo = estadoCroquis.nodos.find(n => n.id === elementoSeleccionado.id);
    if (!nodo) return;

    guardarSnapshotUndo();
    nodo.x = Math.round(Math.min(estadoCroquis.ambAncho, Math.max(0, nodo.x + dirX * pasoFinoMetros)) * 100) / 100;
    nodo.y = Math.round(Math.min(estadoCroquis.ambLargo, Math.max(0, nodo.y + dirY * pasoFinoMetros)) * 100) / 100;
    delete nodo.rotacionManual;

    actualizarTextoCotasNodo(nodo);
    recalcularYRenderizar();
    programarAutoGuardado();
}

function rotarNodoSeleccionado() {
    if (!elementoSeleccionado || elementoSeleccionado.tipo !== 'nodo') return;
    const nodo = estadoCroquis.nodos.find(n => n.id === elementoSeleccionado.id);
    if (!nodo) return;

    guardarSnapshotUndo();
    const actual = calcularRotacionPared(nodo);
    nodo.rotacionManual = (actual + 90) % 360;
    recalcularYRenderizar();
    programarAutoGuardado();
}

function actualizarPropiedadesNodo() {
    if (!elementoSeleccionado || elementoSeleccionado.tipo !== 'nodo') return;
    const nodo = estadoCroquis.nodos.find(n => n.id === elementoSeleccionado.id);
    if (!nodo) return;

    nodo.circuito = document.getElementById('inpNodoCircuito').value.trim().toUpperCase();
    const zVal = parseFloat(document.getElementById('inpNodoZ').value);
    if (!isNaN(zVal) && zVal >= 0) nodo.z = zVal;

    recalcularYRenderizar();
    programarAutoGuardado();
}

function actualizarTipoTramo() {
    if (!elementoSeleccionado || elementoSeleccionado.tipo !== 'tramo') return;
    const tramo = estadoCroquis.tramos.find(t => t.id === elementoSeleccionado.id);
    if (!tramo) return;

    guardarSnapshotUndo();
    tramo.tipo = document.getElementById('selTramoTipo').value;
    recalcularYRenderizar();
    programarAutoGuardado();
}

function actualizarTextoCotasNodo(nodo) {
    const distIzq = nodo.x.toFixed(2);
    const distDer = (estadoCroquis.ambAncho - nodo.x).toFixed(2);
    const distSup = nodo.y.toFixed(2);
    const distInf = (estadoCroquis.ambLargo - nodo.y).toFixed(2);
    document.getElementById('lblCotasParedes').innerText =
        `Izq: ${distIzq}m | Der: ${distDer}m | Sup: ${distSup}m | Inf: ${distInf}m`;
}

function eliminarElementoSeleccionado() {
    if (!elementoSeleccionado) return;
    guardarSnapshotUndo();

    if (elementoSeleccionado.tipo === 'nodo') {
        const id = elementoSeleccionado.id;
        estadoCroquis.nodos = estadoCroquis.nodos.filter(n => n.id !== id);
        estadoCroquis.tramos = estadoCroquis.tramos.filter(t => t.desde !== id && t.hasta !== id);
    } else if (elementoSeleccionado.tipo === 'tramo') {
        const id = elementoSeleccionado.id;
        estadoCroquis.tramos = estadoCroquis.tramos.filter(t => t.id !== id);
    }

    deseleccionarTodo();
    recalcularYRenderizar();
    programarAutoGuardado();
}

function alternarCotas() {
    mostrarCotas = !mostrarCotas;
    renderizarPlanoSVG();
}

function guardarSnapshotUndo() {
    historialUndo.push(JSON.stringify({
        nodos: estadoCroquis.nodos,
        tramos: estadoCroquis.tramos
    }));
    if (historialUndo.length > 25) historialUndo.shift();
}

function deshacerUltimaAccion() {
    if (historialUndo.length === 0) {
        mostrarToast('Sin Cambios', 'No hay acciones recientes para deshacer.');
        return;
    }
    const previo = JSON.parse(historialUndo.pop());
    estadoCroquis.nodos = previo.nodos || [];
    estadoCroquis.tramos = previo.tramos || [];
    deseleccionarTodo();
    recalcularYRenderizar();
    programarAutoGuardado();
}

function confirmarLimpiarPlano() {
    if (estadoCroquis.nodos.length === 0) return;
    guardarSnapshotUndo();
    estadoCroquis.nodos = [];
    estadoCroquis.tramos = [];
    deseleccionarTodo();
    recalcularYRenderizar();
    programarAutoGuardado();
    mostrarToast('Plano Vaciado', 'Podés recuperar con Deshacer si fue accidental.');
            }

// ==========================================================================
// 7. MOTOR DE CÁLCULO 2.5D Y DEDUCCIÓN DE CONDUCTORES / MATERIALES
// ==========================================================================
function calcularLongitudTramo25D(nodoA, nodoB) {
    // Recorrido ortogonal en planta (por cielorraso o muros) + diferencia real de alturas Z
    const dx = Math.abs(nodoA.x - nodoB.x);
    const dy = Math.abs(nodoA.y - nodoB.y);
    const zA = nodoA.z !== undefined ? nodoA.z : 1.10;
    const zB = nodoB.z !== undefined ? nodoB.z : 1.10;
    const dz = Math.abs(zA - zB);

    // Si ambos están en pared a baja altura (ej. dos tomas a 0.30m), el caño sube/baja al menos 0.30m hacia losa/contrapiso
    const saltoMinimo = (zA < 1.5 && zB < 1.5 && (dx + dy) > 0.2) ? 0.60 : 0;
    return Math.round((dx + dy + dz + saltoMinimo) * 100) / 100;
}

function inferirTipoTramo(nA, nB) {
    if (!nA || !nB) return 'IUG';
    const tipos = [nA.tipo, nB.tipo];

    if (tipos.includes('toma_especial')) return 'TUE';
    if (tipos.includes('toma_simple') || tipos.includes('toma_doble')) return 'TUG';
    if (tipos.includes('llave_comb')) return 'COMBINACION';
    if (tipos.includes('llave_3p')) return 'RETORNO_3';
    if (tipos.includes('llave_2p')) return 'RETORNO_2';
    if (tipos.includes('llave_1p')) return 'RETORNO_1';
    return 'IUG';
}

function calcularComputoMateriales() {
    estadoCroquis.desperdicio = parseFloat(document.getElementById('selDesperdicio').value) || 0.10;
    const factor = 1 + estadoCroquis.desperdicio;

    let metrosCanoTotal = 0;
    const cables = {
        fase_15: 0,
        neutro_15: 0,
        pe_15: 0,
        retorno_15: 0,
        fase_25: 0,
        neutro_25: 0,
        pe_25: 0,
        fase_40: 0,
        neutro_40: 0,
        pe_40: 0
    };

    estadoCroquis.tramos.forEach(tramo => {
        const nA = estadoCroquis.nodos.find(n => n.id === tramo.desde);
        const nB = estadoCroquis.nodos.find(n => n.id === tramo.hasta);
        if (!nA || !nB) return;

        const m = calcularLongitudTramo25D(nA, nB);
        metrosCanoTotal += m;

        switch (tramo.tipo) {
            case 'TUG':
                cables.fase_25 += m;
                cables.neutro_25 += m;
                cables.pe_25 += m;
                break;
            case 'TUE':
                cables.fase_40 += m;
                cables.neutro_40 += m;
                cables.pe_40 += m;
                break;
            case 'RETORNO_1':
                cables.fase_15 += m;
                cables.retorno_15 += m;
                break;
            case 'RETORNO_2':
                cables.fase_15 += m;
                cables.retorno_15 += m * 2;
                break;
            case 'RETORNO_3':
                cables.fase_15 += m;
                cables.retorno_15 += m * 3;
                break;
            case 'COMBINACION':
                cables.fase_15 += m;
                cables.retorno_15 += m * 2;
                break;
            case 'IUG':
            default:
                cables.fase_15 += m;
                cables.neutro_15 += m;
                cables.pe_15 += m;
                break;
        }
    });

    // Conteo de cajas y mecanismos por símbolo
    let cajasRect = 0;
    let cajasOcto = 0;
    let cajasPaso = 0;
    let gabinetes = 0;
    let modToma10 = 0;
    let modToma20 = 0;
    let modPunto = 0;
    let modComb = 0;
    let bastidores = 0;

    estadoCroquis.nodos.forEach(n => {
        switch (n.tipo) {
            case 'boca_centro':
            case 'aplique_pared':
                cajasOcto++;
                break;
            case 'toma_simple':
                cajasRect++;
                bastidores++;
                modToma10 += 1;
                break;
            case 'toma_doble':
                cajasRect++;
                bastidores++;
                modToma10 += 2;
                break;
            case 'toma_especial':
                cajasRect++;
                bastidores++;
                modToma20 += 1;
                break;
            case 'llave_1p':
                cajasRect++;
                bastidores++;
                modPunto += 1;
                break;
            case 'llave_2p':
                cajasRect++;
                bastidores++;
                modPunto += 2;
                break;
            case 'llave_3p':
                cajasRect++;
                bastidores++;
                modPunto += 3;
                break;
            case 'llave_comb':
                cajasRect++;
                bastidores++;
                modComb += 1;
                break;
            case 'caja_paso':
                cajasPaso++;
                break;
            case 'tablero':
                gabinetes++;
                break;
        }
    });

    const items = [];

    if (metrosCanoTotal > 0) {
        const canoConDesp = metrosCanoTotal * factor;
        const rollosCano = Math.ceil(canoConDesp / 25);
        items.push({
            rubro: 'Canalización',
            descripcion: 'Caño corrugado Ø 3/4" (20 mm) ignífugo',
            neto: `${canoConDesp.toFixed(1)} m`,
            comercial: `${rollosCano} rollo${rollosCano > 1 ? 's' : ''} × 25m`,
            cantMateriales: Math.ceil(canoConDesp),
            unidadMateriales: 'm'
        });
    }

    const agregarCable = (metrosBase, desc) => {
        if (metrosBase <= 0) return;
        const mFinal = Math.ceil(metrosBase * factor);
        const rollos = Math.ceil(mFinal / 100);
        items.push({
            rubro: 'Conductores',
            descripcion: desc,
            neto: `${mFinal} m`,
            comercial: mFinal >= 65 ? `${rollos} rollo × 100m` : `${mFinal} m fracc.`,
            cantMateriales: mFinal,
            unidadMateriales: 'm'
        });
    };

    agregarCable(cables.fase_15, 'Cable unipolar 1,5 mm² Marrón (Fase IUG)');
    agregarCable(cables.neutro_15, 'Cable unipolar 1,5 mm² Celeste (Neutro IUG)');
    agregarCable(cables.pe_15, 'Cable unipolar 1,5 mm² Verde/Amarillo (PE)');
    agregarCable(cables.retorno_15, 'Cable unipolar 1,5 mm² Blanco/Negro (Retornos)');
    agregarCable(cables.fase_25, 'Cable unipolar 2,5 mm² Marrón (Fase TUG)');
    agregarCable(cables.neutro_25, 'Cable unipolar 2,5 mm² Celeste (Neutro TUG)');
    agregarCable(cables.pe_25, 'Cable unipolar 2,5 mm² Verde/Amarillo (PE TUG)');
    agregarCable(cables.fase_40, 'Cable unipolar 4 mm² Marrón (Fase TUE)');
    agregarCable(cables.neutro_40, 'Cable unipolar 4 mm² Celeste (Neutro TUE)');
    agregarCable(cables.pe_40, 'Cable unipolar 4 mm² Verde/Amarillo (PE TUE)');

    if (cajasOcto > 0) items.push({ rubro: 'Cajas', descripcion: 'Caja octogonal chica / grande', neto: `${cajasOcto} u`, comercial: `${cajasOcto} unid.`, cantMateriales: cajasOcto, unidadMateriales: 'unid.' });
    if (cajasRect > 0) items.push({ rubro: 'Cajas', descripcion: 'Caja rectangular 10×5 cm', neto: `${cajasRect} u`, comercial: `${cajasRect} unid.`, cantMateriales: cajasRect, unidadMateriales: 'unid.' });
    if (cajasPaso > 0) items.push({ rubro: 'Cajas', descripcion: 'Caja de paso / derivación 10×10 cm', neto: `${cajasPaso} u`, comercial: `${cajasPaso} unid.`, cantMateriales: cajasPaso, unidadMateriales: 'unid.' });
    if (gabinetes > 0) items.push({ rubro: 'Tableros', descripcion: 'Gabinete DIN para tablero seccional', neto: `${gabinetes} u`, comercial: `${gabinetes} unid.`, cantMateriales: gabinetes, unidadMateriales: 'unid.' });

    if (bastidores > 0) items.push({ rubro: 'Mecanismos', descripcion: 'Bastidor + tapa exterior 10×5', neto: `${bastidores} jgo`, comercial: `${bastidores} juegos`, cantMateriales: bastidores, unidadMateriales: 'jgo' });
    if (modToma10 > 0) items.push({ rubro: 'Mecanismos', descripcion: 'Módulo tomacorriente 2P+T 10A', neto: `${modToma10} u`, comercial: `${modToma10} unid.`, cantMateriales: modToma10, unidadMateriales: 'unid.' });
    if (modToma20 > 0) items.push({ rubro: 'Mecanismos', descripcion: 'Módulo tomacorriente 2P+T 20A', neto: `${modToma20} u`, comercial: `${modToma20} unid.`, cantMateriales: modToma20, unidadMateriales: 'unid.' });
    if (modPunto > 0) items.push({ rubro: 'Mecanismos', descripcion: 'Módulo interruptor 1 punto', neto: `${modPunto} u`, comercial: `${modPunto} unid.`, cantMateriales: modPunto, unidadMateriales: 'unid.' });
    if (modComb > 0) items.push({ rubro: 'Mecanismos', descripcion: 'Módulo interruptor combinación', neto: `${modComb} u`, comercial: `${modComb} unid.`, cantMateriales: modComb, unidadMateriales: 'unid.' });

    ultimoComputo = items;
    return items;
}

function recalcularYRenderizar() {
    renderizarPlanoSVG('svgCroquis', false);
    const items = calcularComputoMateriales();

    const tbodyUI = document.getElementById('tbodyComputoUI');
    if (tbodyUI) {
        if (items.length === 0) {
            tbodyUI.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--ngc-text-faded); padding: 14px;">Ubicá símbolos y conectá caños para calcular materiales.</td></tr>';
        } else {
            tbodyUI.innerHTML = items.map(it => `
                <tr>
                    <td><strong style="color:var(--ngc-text-main);">${it.descripcion}</strong><br><small style="color:var(--ngc-text-faded);">${it.rubro}</small></td>
                    <td style="text-align:right; white-space:nowrap;">${it.neto}</td>
                    <td style="text-align:right; white-space:nowrap; color:var(--ngc-neon); font-weight:700;">${it.comercial}</td>
                </tr>
            `).join('');
        }
    }

    guardarEstadoLocal();
    sincronizarVistaPreviaPDF();
}

// ==========================================================================
// 8. VISTA PREVIA A4 Y EXPORTACIÓN PDF SIN HOJAS EN BLANCO
// ==========================================================================
function actualizarPDFHeaders() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL INDEPENDIENTE';
    const profTel = localStorage.getItem('villaser_conf_telefono') || '';
    const profSlogan = localStorage.getItem('villaser_conf_slogan') || '';
    const profLogo = localStorage.getItem('villaser_conf_logo') || '';
    const profCuit = localStorage.getItem('villaser_conf_cuit') || '';
    const profMatricula = localStorage.getItem('villaser_conf_matricula') || '';

    let profEmail = localStorage.getItem('villaser_conf_email') || '';
    if (!profEmail && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        profEmail = firebase.auth().currentUser.email || '';
    }

    const imgPdf = document.getElementById('pdf-img-logo');
    const txtPdf = document.getElementById('pdf-text-logo');
    if (imgPdf && txtPdf) {
        if (profLogo && profLogo.startsWith('data:image')) {
            imgPdf.src = profLogo;
            imgPdf.style.display = 'block';
            txtPdf.style.display = 'none';
        } else {
            imgPdf.removeAttribute('src');
            imgPdf.style.display = 'none';
            txtPdf.innerText = profNombre.toUpperCase();
            txtPdf.style.display = 'block';
        }
    }

    const elProfNombre = document.getElementById('pdf-prof-nombre');
    if (elProfNombre) elProfNombre.innerText = profLogo && profLogo.startsWith('data:image') ? profNombre : '';

    const elSlogan = document.getElementById('pdf-slogan');
    if (elSlogan) elSlogan.innerText = profSlogan || '¡Electricidad Segura, Hogar Tranquilo!';

    const lineaRegistro = [
        profMatricula ? `Mat.: ${profMatricula}` : '',
        profCuit ? `CUIT: ${profCuit}` : ''
    ].filter(Boolean).join(' | ');

    const lineaContacto = [
        profTel ? `Tel: ${profTel}` : '',
        profEmail ? `Email: ${profEmail}` : ''
    ].filter(Boolean).join(' • ');

    const elContacto = document.getElementById('pdf-header-contacto');
    if (elContacto) elContacto.innerHTML = [lineaRegistro, lineaContacto].filter(Boolean).join('<br>');

    const elBrand = document.getElementById('pdf-footer-brand');
    if (elBrand) elBrand.innerText = profNombre;
}

function sincronizarVistaPreviaPDF() {
    actualizarPDFHeaders();

    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');
    document.getElementById('pdf-cliente').innerText = estadoCroquis.cliNombre || 'Sin nombre';

    const rowDir = document.getElementById('pdf-row-direccion');
    if (estadoCroquis.cliDireccion) {
        rowDir.style.display = 'block';
        document.getElementById('pdf-direccion').innerText = estadoCroquis.cliDireccion;
    } else {
        rowDir.style.display = 'none';
    }

    const sup = (estadoCroquis.ambAncho * estadoCroquis.ambLargo).toFixed(2);
    document.getElementById('pdf-ambiente').innerText =
        `${estadoCroquis.ambNombre} (${estadoCroquis.ambAncho.toFixed(2)} m × ${estadoCroquis.ambLargo.toFixed(2)} m = ${sup} m²)`;

    // Renderizar SVG limpio dentro del contenedor PDF
    const contSvgPdf = document.getElementById('pdf-svg-container');
    contSvgPdf.innerHTML = '<svg id="svgPdfExport" viewBox="0 0 700 520" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-height: 365px; height: auto; display: block; margin: 0 auto;"></svg>';
    renderizarPlanoSVG('svgPdfExport', true);

    // Leyenda simbólica dinámica (solo los símbolos presentes en el croquis)
    const leyendaEl = document.getElementById('pdf-leyenda-simbolos');
    const tiposPresentes = [...new Set(estadoCroquis.nodos.map(n => n.tipo))];
    if (tiposPresentes.length === 0) {
        leyendaEl.innerHTML = '<span><b>Referencias:</b> Plano sin símbolos ubicados aún.</span>';
    } else {
        leyendaEl.innerHTML = tiposPresentes.map(tipo => {
            const info = CATALOGO_TIPOS[tipo];
            if (!info) return '';
            const cant = estadoCroquis.nodos.filter(n => n.tipo === tipo).length;
            return `
                <span style="display: inline-flex; align-items: center; gap: 5px;">
                    <svg width="18" height="18" viewBox="-16 -16 32 32" xmlns="http://www.w3.org/2000/svg">${info.svg}</svg>
                    <span><b>${info.corto}</b> (${cant})</span>
                </span>
            `;
        }).join('');
    }

    // Tabla de materiales en PDF (máximo 14 filas para garantizar 1 sola hoja A4)
    const tbodyPdf = document.getElementById('pdf-tbody-materiales');
    const items = ultimoComputo.slice(0, 14);
    if (items.length === 0) {
        tbodyPdf.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">Sin tramos ni materiales calculados.</td></tr>';
    } else {
        tbodyPdf.innerHTML = items.map(it => `
            <tr>
                <td><b>${it.rubro}</b></td>
                <td>${it.descripcion}</td>
                <td style="text-align: right;">${it.neto}</td>
                <td style="text-align: right; font-weight: 700;">${it.comercial}</td>
            </tr>
        `).join('');
    }

    const obs = document.getElementById('obsGenerales').value.trim();
    estadoCroquis.obsGenerales = obs;
    const boxNotas = document.getElementById('pdf-notas-box');
    if (obs) {
        boxNotas.style.display = 'block';
        document.getElementById('pdf-notas').innerText = obs;
    } else {
        boxNotas.style.display = 'none';
    }
}

async function convertirSvgCroquisAImagen() {
    const contenedor = document.getElementById('pdf-svg-container');
    if (!contenedor) return () => {};

    const svgOriginalHTML = contenedor.innerHTML;
    const svgEl = contenedor.querySelector('svg');
    if (!svgEl) return () => {};

    const ancho = 700;
    const alto = 520;
    const svgClon = svgEl.cloneNode(true);
    svgClon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClon.setAttribute('width', ancho);
    svgClon.setAttribute('height', alto);

    const xml = new XMLSerializer().serializeToString(svgClon);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
        type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);

    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const escala = 3;
                const canvas = document.createElement('canvas');
                canvas.width = ancho * escala;
                canvas.height = alto * escala;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(escala, escala);
                ctx.drawImage(img, 0, 0, ancho, alto);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = err => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });

        contenedor.innerHTML = `<img src="${dataUrl}" alt="Croquis Eléctrico" style="width: 100%; max-height: 365px; height: auto; object-fit: contain; display: block; margin: 0 auto;">`;
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    } catch (e) {
        console.warn('Error rasterizando SVG para PDF:', e);
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    }
}

function toggleAccionesMenu() {
    document.getElementById('contenedorAcciones').classList.toggle('oculto');
}

function abrirVistaPreviaMobile() {
    sincronizarVistaPreviaPDF();
    const modal = document.getElementById('modalVistaPrevia');
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla.querySelector('.pdf-container');

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    plantilla.style.display = 'inline-block';
    plantilla.style.textAlign = 'left';
    contenedor.appendChild(plantilla);

    const anchoDisponible = Math.max(280, contenedor.clientWidth - 24);
    escalaActualPreview = Math.min(1, anchoDisponible / 794);
    if (pdfContainer) {
        pdfContainer.style.transformOrigin = 'top left';
        pdfContainer.style.transform = `scale(${escalaActualPreview})`;
    }
    plantilla.style.width = `${794 * escalaActualPreview}px`;
    plantilla.style.height = `${1115 * escalaActualPreview}px`;
}

function cerrarVistaPreviaMobile() {
    const modal = document.getElementById('modalVistaPrevia');
    const previewAside = document.querySelector('.preview-panel');
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla.querySelector('.pdf-container');

    modal.classList.add('oculto');
    document.body.style.overflow = '';

    if (pdfContainer) pdfContainer.style.transform = '';
    plantilla.style.width = '';
    plantilla.style.height = '';
    if (window.innerWidth < 992) plantilla.style.display = 'none';
    if (previewAside) previewAside.appendChild(plantilla);
}

function generarPDF() {
    if (estadoCroquis.nodos.length === 0) {
        mostrarAlertaCorp('Plano Vacío', 'Ubicá al menos un símbolo eléctrico antes de exportar el PDF.');
        return;
    }
    sincronizarVistaPreviaPDF();

    const ambSlug = estadoCroquis.ambNombre.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Ambiente';
    const cliSlug = estadoCroquis.cliNombre.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Cliente';
    document.getElementById('nombreArchivoPDF').value = `Croquis_${ambSlug}_${cliSlug}`;
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Descargar';
    }
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    const modalVista = document.getElementById('modalVistaPrevia');
    const modalAbierto = modalVista && !modalVista.classList.contains('oculto');

    if (!modalAbierto && element) {
        element.style.display = 'block';
        window.scrollTo(0, 0);
    } else if (pdfContainer) {
        pdfContainer.style.transform = 'none';
    }

    element.style.width = '794px';
    element.style.height = '1115px';
    element.style.overflow = 'hidden';

    const marcaAgua = document.getElementById('marcaAguaPDF');
    if (marcaAgua) marcaAgua.style.display = 'none';

    let restaurarSvg = () => {};
    try {
        restaurarSvg = await convertirSvgCroquisAImagen();
        const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Croquis_Electrico';

        const opt = {
            margin: 0,
            filename: `${nombreFinal}.pdf`,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: {
                scale: 2,
                useCORS: false,
                allowTaint: false,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                width: 794,
                height: 1115,
                ignoreElements: el =>
                    el.id === 'marcaAguaPDF' ||
                    (el.tagName === 'IMG' && !(el.getAttribute('src') || '').startsWith('data:image'))
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
        };

        await html2pdf()
            .set(opt)
            .from(element)
            .toPdf()
            .get('pdf')
            .then(pdf => {
                const totalPages = pdf.internal.getNumberOfPages();
                for (let i = totalPages; i > 1; i--) {
                    pdf.deletePage(i);
                }
            })
            .save();

        cerrarModalPDF();
        mostrarToast('PDF Descargado', 'Croquis generado en 1 hoja A4.');

        if (permiteGuardarNube) {
            guardarBorradorFirebase(false, true);
        }
    } catch (error) {
        console.error('Error exportando PDF de Croquis:', error);
        mostrarAlertaCorp('Error al Exportar', `No se pudo generar el PDF (${error.message || 'error interno'}).`);
    } finally {
        restaurarSvg();
        btn.disabled = false;
        btn.innerHTML = 'Descargar';

        element.style.width = '';
        element.style.height = '';
        element.style.overflow = '';

        if (marcaAgua) marcaAgua.style.display = 'flex';

        if (modalAbierto) {
            if (pdfContainer) pdfContainer.style.transform = `scale(${escalaActualPreview})`;
            element.style.width = `${794 * escalaActualPreview}px`;
            element.style.height = `${1115 * escalaActualPreview}px`;
        } else if (window.innerWidth < 992) {
            element.style.display = 'none';
        }
    }
}

async function descargarPNG() {
    sincronizarVistaPreviaPDF();
    const element = document.getElementById('plantilla-pdf');
    const prevDisplay = element.style.display;
    element.style.display = 'block';
    const marcaAgua = document.getElementById('marcaAguaPDF');
    if (marcaAgua) marcaAgua.style.display = 'none';

    const restaurarSvg = await convertirSvgCroquisAImagen();
    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: false,
            backgroundColor: '#ffffff',
            width: 794,
            height: 1115
        });
        const a = document.createElement('a');
        a.download = `Croquis_${estadoCroquis.ambNombre.replace(/ /g, '_')}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        mostrarToast('Imagen Guardada', 'PNG descargado en tu dispositivo.');
    } finally {
        restaurarSvg();
        if (marcaAgua) marcaAgua.style.display = 'flex';
        element.style.display = prevDisplay;
    }
}

// ==========================================================================
// 9. CONEXIÓN CON OTROS MÓDULOS (POTENCIA, MATERIALES, WHATSAPP)
// ==========================================================================
function enviarComputoAMateriales() {
    if (ultimoComputo.length === 0) {
        mostrarAlertaCorp('Sin Materiales', 'Ubicá símbolos y conectá caños para generar el listado.');
        return;
    }

    const listaItems = ultimoComputo.map((it, idx) => ({
        id: Date.now() + idx,
        material: it.descripcion,
        nota: `${it.rubro} (${it.comercial})`,
        cantidad: it.cantMateriales,
        unidad: it.unidadMateriales
    }));

    const payloadMateriales = {
        cliNombre: estadoCroquis.cliNombre,
        cliDireccion: estadoCroquis.cliDireccion,
        cliProyecto: `Croquis ${estadoCroquis.ambNombre}`,
        obsGenerales: estadoCroquis.obsGenerales || `Cómputo importado desde Croquis (${estadoCroquis.ambAncho}m × ${estadoCroquis.ambLargo}m).`,
        listaItems,
        clienteDesdeAgenda,
        permiteGuardarNube,
        telefonoClienteActual
    };

    localStorage.setItem('materiales_estado_actual', JSON.stringify(payloadMateriales));
    window.location.href = '../materiales/index.html';
}

function prepararEnvioWhatsApp() {
    if (estadoCroquis.nodos.length === 0) {
        mostrarAlertaCorp('Sin Datos', 'Agregá al menos un elemento al plano.');
        return;
    }
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL';
    let msg = `*${profNombre.toUpperCase()} - CROQUIS Y CÓMPUTO*\n`;
    msg += `*Cliente:* ${estadoCroquis.cliNombre}\n`;
    msg += `*Ambiente:* ${estadoCroquis.ambNombre} (${estadoCroquis.ambAncho.toFixed(2)}m × ${estadoCroquis.ambLargo.toFixed(2)}m)\n\n`;
    msg += `*Materiales Estimados:*\n`;
    ultimoComputo.forEach(it => {
        msg += `• ${it.descripcion}: *${it.neto}* (${it.comercial})\n`;
    });
    if (estadoCroquis.obsGenerales) msg += `\n*Notas:* ${estadoCroquis.obsGenerales}`;

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, msg);
    }
}

async function abrirModalImportarPotencia() {
    const uid = obtenerUid();
    const lista = document.getElementById('listaProyectosPotencia');
    document.getElementById('modalImportarPotencia').classList.remove('oculto');
    lista.innerHTML = '<div style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando en Potencia...</div>';

    if (!uid || typeof db === 'undefined') {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Sin conexión a la nube.</p>';
        return;
    }

    try {
        const snap = await db.collection('perfiles').doc(uid).collection('borradores_potencia').get();
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, data: d.data() }));

        if (docs.length === 0) {
            lista.innerHTML = '<p style="color:var(--ngc-text-faded); text-align:center;">No tenés proyectos guardados en Potencia.</p>';
            return;
        }

        lista.innerHTML = '';
        docs.forEach(item => {
            const p = item.data;
            const ambs = Array.isArray(p.listaAmbientes) ? p.listaAmbientes : [];
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'stretch';
            div.style.gap = '6px';

            let btnsAmb = ambs.map((a, idx) => `
                <button type="button" class="corp-btn-small" style="justify-content: space-between; width: 100%;" onclick="importarAmbientePotencia('${item.id}', ${idx})">
                    <span>${a.tipo} (${a.ancho || 3}m × ${a.largo || 3}m)</span>
                    <i class="fa-solid fa-file-import"></i>
                </button>
            `).join('');

            if (!btnsAmb) btnsAmb = '<small style="color:var(--ngc-text-faded);">Sin ambientes cargados</small>';

            div.innerHTML = `
                <div><strong>${p.cliNombre || item.id}</strong> <small style="color:var(--ngc-text-faded);">${p.cliDireccion || ''}</small></div>
                <div style="display:flex; flex-direction:column; gap:4px;">${btnsAmb}</div>
            `;
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al consultar Potencia.</p>';
    }
}

function cerrarModalImportarPotencia() {
    document.getElementById('modalImportarPotencia').classList.add('oculto');
}

async function importarAmbientePotencia(docId, indexAmb) {
    const uid = obtenerUid();
    if (!uid || typeof db === 'undefined') return;

    try {
        const doc = await db.collection('perfiles').doc(uid).collection('borradores_potencia').doc(docId).get();
        if (!doc.exists) return;
        const p = doc.data();
        const amb = (p.listaAmbientes || [])[indexAmb];
        if (!amb) return;

        document.getElementById('cliNombre').value = p.cliNombre || '';
        document.getElementById('cliDireccion').value = p.cliDireccion || '';
        document.getElementById('ambNombre').value = amb.tipo || 'Ambiente';
        document.getElementById('ambAncho').value = (parseFloat(amb.ancho) || 4.0).toFixed(2);
        document.getElementById('ambLargo').value = (parseFloat(amb.largo) || 3.5).toFixed(2);

        clienteDesdeAgenda = true;
        permiteGuardarNube = true;
        cerrarModalImportarPotencia();
        mostrarToast('Ambiente Importado', `${amb.tipo} cargado desde Potencia.`);
    } catch (e) {
        mostrarAlertaCorp('Error', 'No se pudo importar el ambiente.');
    }
            }

// ==========================================================================
// 10. PERSISTENCIA EN LA NUBE (FIREBASE) Y RESPALDO LOCAL JSON
// ==========================================================================
function actualizarBadgeNube(estado) {
    const badge = document.getElementById('ui-cloud-badge');
    if (!badge) return;
    badge.classList.remove('guardando', 'error', 'local');

    if (estado === 'guardando') {
        badge.classList.add('guardando');
        badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    } else if (estado === 'error') {
        badge.classList.add('error');
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Sin red';
    } else if (estado === 'local') {
        badge.classList.add('local');
        badge.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Solo Local';
    } else {
        badge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
    }
}

function programarAutoGuardado() {
    guardarEstadoLocal();
    if (!permiteGuardarNube) return;
    clearTimeout(timerAutoGuardado);
    timerAutoGuardado = setTimeout(() => {
        guardarBorradorFirebase(false, true);
    }, 2000);
}

async function guardarBorradorFirebase(mostrarAlerta = false, silencioso = false) {
    const uid = obtenerUid();
    if (!uid || typeof db === 'undefined') {
        if (mostrarAlerta) mostrarAlertaCorp('Sin Sesión', 'No se detectó sesión activa.');
        return;
    }
    if (!permiteGuardarNube) {
        if (mostrarAlerta) mostrarAlertaCorp('Modo Local', 'Agendá el cliente para habilitar el respaldo en la nube.');
        return;
    }
    if (!estadoCroquis.cliNombre) return;

    actualizarBadgeNube('guardando');

    const baseId = nombreBorradorActual || `${estadoCroquis.cliNombre}_${estadoCroquis.ambNombre}`;
    const docId = baseId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    nombreBorradorActual = docId;

    const payload = {
        ...estadoCroquis,
        nombreBorrador: `${estadoCroquis.cliNombre} - ${estadoCroquis.ambNombre}`,
        telefonoClienteActual,
        fechaGuardado: Date.now()
    };

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
        );
        await Promise.race([
            db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).set(payload),
            timeoutPromise
        ]);

        actualizarBadgeNube('sincronizado');
        if (mostrarAlerta) mostrarToast('Guardado en Nube', 'Croquis sincronizado correctamente.');
    } catch (err) {
        console.warn('Error guardando croquis en Firestore:', err);
        actualizarBadgeNube('error');
        if (!silencioso || mostrarAlerta) {
            mostrarAlertaCorp('Error de Nube', `No se pudo guardar en Firebase (${err.code || err.message}). Tu copia local está a salvo.`);
        }
    }
}

async function abrirModalBorradores() {
    const uid = obtenerUid();
    const lista = document.getElementById('listaBorradores');
    document.getElementById('modalBorradores').classList.remove('oculto');
    lista.innerHTML = '<div style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando croquis...</div>';

    if (!uid || typeof db === 'undefined') {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Sin conexión a la nube.</p>';
        return;
    }

    try {
        const snap = await db.collection('perfiles').doc(uid).collection('borradores_croquis').get();
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
        docs.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        if (docs.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No hay croquis guardados en la nube.</p>';
            return;
        }

        lista.innerHTML = '';
        docs.forEach(item => {
            const p = item.data;
            const fecha = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : '';
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.style.borderLeft = '3px solid var(--ngc-neon)';
            div.innerHTML = `
                <div style="flex:1; min-width:0; padding-right:8px;">
                    <h4 style="margin-bottom:4px; word-break:break-word;">${p.nombreBorrador || item.id}</h4>
                    <small style="color:var(--ngc-text-faded);">${p.ambAncho || 0}m × ${p.ambLargo || 0}m • ${fecha}</small>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="corp-btn-small" onclick="cargarBorradorNube('${item.id}')">Abrir</button>
                    <button type="button" class="corp-btn-small danger" onclick="eliminarBorradorNube('${item.id}', this)"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al cargar borradores.</p>';
    }
}

async function cargarBorradorNube(docId) {
    const uid = obtenerUid();
    if (!uid || typeof db === 'undefined') return;

    try {
        const doc = await db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();
        data.clienteDesdeAgenda = true;
        data.permiteGuardarNube = true;
        data.nombreBorrador = docId;

        aplicarDatosCargados(data);
        if (typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();
        avanzarPasoTrabajo();
        mostrarToast('Croquis Cargado', 'Listo para editar.');
    } catch (e) {
        mostrarAlertaCorp('Error', 'No se pudo abrir el croquis.');
    }
}

async function eliminarBorradorNube(docId, btnEl) {
    const uid = obtenerUid();
    if (!uid || typeof db === 'undefined') return;
    try {
        await db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).delete();
        if (btnEl && btnEl.closest('.modal-list-item')) btnEl.closest('.modal-list-item').remove();
        mostrarToast('Eliminado', 'Croquis borrado de la nube.');
    } catch (e) {
        mostrarAlertaCorp('Error', 'No se pudo eliminar el borrador.');
    }
}

function guardarComoJSON() {
    const payload = {
        ...estadoCroquis,
        telefonoClienteActual,
        exportadoEn: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Villaser_Croquis_${(estadoCroquis.cliNombre || 'Proyecto').replace(/ /g, '_')}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function cargarDesdeJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || !Array.isArray(data.nodos)) throw new Error('Archivo inválido');
            aplicarDatosCargados(data);
            avanzarPasoTrabajo();
            mostrarToast('Respaldo Cargado', 'Croquis importado desde JSON.');
        } catch (err) {
            mostrarAlertaCorp('Archivo Inválido', 'El archivo JSON no corresponde a un croquis válido de Villaser.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ==========================================================================
// 11. HELPERS DE UI COMPARTIDOS
// ==========================================================================
function mostrarAlertaCorp(titulo, mensaje) {
    document.getElementById('modalAlertaTitulo').innerText = titulo;
    document.getElementById('modalAlertaMensaje').innerText = mensaje;
    document.getElementById('modalAlertaCorp').classList.remove('oculto');
}

function cerrarModalAlertaCorp() {
    document.getElementById('modalAlertaCorp').classList.add('oculto');
}

function mostrarToast(titulo, mensaje) {
    const toast = document.getElementById('toastCliente');
    if (!toast) return;
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMessage').innerText = mensaje;
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 20);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 350);
    }, 3500);
}
