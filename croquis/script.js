// ==========================================================================
// MÓDULO CROQUIS ELÉCTRICO DE AMBIENTE 3D Y CÓMPUTO 2.5D - VILLASER
// ==========================================================================
let db = null;
let uidSeguro = null;
let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let borradorPendienteEliminar = null;
let telefonoClienteActual = '';

const STORAGE_KEY_CROQUIS = 'croquis_estado_actual';

let herramientaActiva = 'SELECT';
let elementoSeleccionadoId = null;
let origenConexionId = null;
let modoVista3D = true;

// Variables de Zoom y Pan Táctil en el Lienzo
let zoomPlano = 1;
let panPlanoX = 0;
let panPlanoY = 0;
let zoomTactilInicializado = false;

// Catálogo de cotas y metadatos normativos AEA 90364 por tipo de boca
const PRESETS_ELEMENTOS = {
    BOCA_TECHO: { nombre: 'Boca de Centro',      zDefault: 2.60, pared: false, prefijo: 'B',  circ: 'C1' },
    APLIQUE:    { nombre: 'Aplique de Pared',    zDefault: 2.10, pared: true,  prefijo: 'AP', circ: 'C1' },
    LLAVE_1P:   { nombre: 'Llave 1 Punto',       zDefault: 1.10, pared: true,  prefijo: 'LL', circ: 'C1' },
    LLAVE_2P:   { nombre: 'Llave 2 Puntos',      zDefault: 1.10, pared: true,  prefijo: 'LL', circ: 'C1' },
    LLAVE_3P:   { nombre: 'Llave 3 Puntos',      zDefault: 1.10, pared: true,  prefijo: 'LL', circ: 'C1' },
    LLAVE_COMB: { nombre: 'Llave Combinación',   zDefault: 1.10, pared: true,  prefijo: 'LC', circ: 'C1' },
    TOMA_10A:   { nombre: 'Toma Simple 10A',     zDefault: 0.30, pared: true,  prefijo: 'T',  circ: 'C2' },
    TOMA_DOBLE: { nombre: 'Toma Doble 2×10A',    zDefault: 0.30, pared: true,  prefijo: 'T',  circ: 'C2' },
    TOMA_20A:   { nombre: 'Toma Especial 20A',   zDefault: 1.10, pared: true,  prefijo: 'TE', circ: 'C3' },
    TABLERO:    { nombre: 'Tablero Seccional',   zDefault: 1.60, pared: true,  prefijo: 'TS', circ: 'TS' },
    CAJA_PASO:  { nombre: 'Caja de Paso',        zDefault: 2.40, pared: true,  prefijo: 'CP', circ: 'C1' }
};

function crearPlantillaDormitorio() {
    return {
        nombre: 'Dormitorio Principal',
        ancho: 3.50,
        largo: 3.20,
        alto: 2.60,
        desperdicio: 10,
        canoDiam: '3/4" (Ø 20mm)',
        aberturas: [
            { id: 'ab1', tipo: 'PUERTA',  pared: 'SUR',   offset: 0.25, ancho: 0.80 },
            { id: 'ab2', tipo: 'VENTANA', pared: 'NORTE', offset: 1.15, ancho: 1.20 }
        ],
        elementos: [
            { id: 'el1', tag: 'B1',  tipo: 'BOCA_TECHO', x: 1.75, y: 1.60, z: 2.60, muro: 'TECHO', rot: 0,   circ: 'C1', nota: '' },
            { id: 'el2', tag: 'LL1', tipo: 'LLAVE_1P',   x: 1.20, y: 3.20, z: 1.10, muro: 'SUR',   rot: 180, circ: 'C1', nota: 'Junto a puerta' },
            { id: 'el3', tag: 'T1',  tipo: 'TOMA_DOBLE', x: 0.00, y: 1.60, z: 0.30, muro: 'OESTE', rot: 270, circ: 'C2', nota: 'Mesita luz' },
            { id: 'el4', tag: 'T2',  tipo: 'TOMA_DOBLE', x: 3.50, y: 1.60, z: 0.30, muro: 'ESTE',  rot: 90,  circ: 'C2', nota: 'Mesita luz' },
            { id: 'el5', tag: 'T3',  tipo: 'TOMA_10A',   x: 2.60, y: 0.00, z: 0.30, muro: 'NORTE', rot: 0,   circ: 'C2', nota: '' }
        ],
        tramos: [
            { id: 'tr1', desde: 'el1', hasta: 'el2', via: 'TECHO',      rol: 'BAJADA_1P' },
            { id: 'tr2', desde: 'el3', hasta: 'el4', via: 'CONTRAPISO', rol: 'ALIM_TUG' },
            { id: 'tr3', desde: 'el4', hasta: 'el5', via: 'PARED',      rol: 'ALIM_TUG' }
        ]
    };
}

let estadoCroquis = crearPlantillaDormitorio();

// ==========================================================================
// INICIALIZACIÓN INMEDIATA DE FIREBASE Y AGENDA GLOBAL
// ==========================================================================
function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        uidSeguro = firebase.auth().currentUser.uid;
        return uidSeguro;
    }
    return null;
}
function obtenerUidSeguro() {
    return obtenerUid();
}

function arrancarModuloCroquis() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (user) {
                        uidSeguro = user.uid;
                        actualizarBadgeNube();
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Aviso Firebase Croquis:', e);
    }

    generarMenuInferiorLocal();
    inicializarZoomTactilPlano();
    cargarEstadoInicial();
    actualizarPDFHeaders();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarModuloCroquis);
} else {
    arrancarModuloCroquis();
}

function generarMenuInferiorLocal() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer || footer.children.length > 0) return;

    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-cube', url: '#', active: true },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catálogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
    ];

    modulos.forEach(mod => {
        const btn = document.createElement('button');
        btn.className = `corp-nav-item ${mod.active ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid ${mod.icon}"></i><span>${mod.nombre}</span>`;
        btn.onclick = () => { if (!mod.active) window.location.replace(mod.url); };
        footer.appendChild(btn);
    });

    requestAnimationFrame(() => {
        const btnActivo = footer.querySelector('.corp-nav-item.active');
        if (btnActivo) {
            const fRect = footer.getBoundingClientRect();
            const bRect = btnActivo.getBoundingClientRect();
            footer.scrollLeft += (bRect.left - fRect.left) - (fRect.width / 2) + (bRect.width / 2);
        }
    });
}

// ==========================================================================
// FLUJO DE CLIENTE, AGENDA Y PERSISTENCIA LOCAL
// ==========================================================================
function cargarEstadoInicial() {
    if (verificarRetornoDesdeMateriales()) return;

    const raw = localStorage.getItem(STORAGE_KEY_CROQUIS);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data && data.estadoCroquis) {
                document.getElementById('cliNombre').value = data.cliNombre || '';
                document.getElementById('cliDireccion').value = data.cliDireccion || '';
                document.getElementById('cliProyecto').value = data.cliProyecto || '';
                document.getElementById('obsGenerales').value = data.obsGenerales || '';
                estadoCroquis = normalizarEstadoCroquis(data.estadoCroquis);
                clienteDesdeAgenda = !!data.clienteDesdeAgenda;
                permiteGuardarNube = data.permiteGuardarNube !== false;
                nombreBorradorActual = data.nombreBorrador || null;
                telefonoClienteActual = data.telefonoClienteActual || '';

                if (data.enTrabajo && data.cliNombre) {
                    avanzarPasoTrabajo(false);
                    return;
                }
            }
        } catch (e) {
            console.warn('Error leyendo estado croquis:', e);
        }
    }

    const rawGlobal = localStorage.getItem('villaser_cliente_global');
    if (rawGlobal) {
        try {
            const cli = JSON.parse(rawGlobal);
            if (cli && cli.nombre && !document.getElementById('cliNombre').value) {
                document.getElementById('cliNombre').value = cli.nombre || '';
                document.getElementById('cliDireccion').value = cli.direccion || '';
                document.getElementById('cliProyecto').value = cli.proyecto || '';
                telefonoClienteActual = cli.telefono || '';
                clienteDesdeAgenda = true;
                permiteGuardarNube = true;
                mostrarToast('Cliente Recuperado', `Datos de ${cli.nombre} listos.`);
            }
        } catch (e) {}
    }
}


function guardarEstadoLocal(enTrabajo = true) {
    const payload = {
        cliNombre: document.getElementById('cliNombre').value.trim(),
        cliDireccion: document.getElementById('cliDireccion').value.trim(),
        cliProyecto: document.getElementById('cliProyecto').value.trim(),
        obsGenerales: document.getElementById('obsGenerales').value,
        estadoCroquis,
        clienteDesdeAgenda,
        permiteGuardarNube,
        nombreBorrador: nombreBorradorActual,
        telefonoClienteActual,
        enTrabajo
    };
    localStorage.setItem(STORAGE_KEY_CROQUIS, JSON.stringify(payload));
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
}

// Callback invocado por global.js cuando el usuario toca "Usar" en #modalAgenda
function seleccionarContacto(nombre, dir, tel = '') {
    document.getElementById('cliNombre').value = nombre || '';
    document.getElementById('cliDireccion').value = dir || '';
    telefonoClienteActual = tel || '';
    clienteDesdeAgenda = true;
    permiteGuardarNube = true;
    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    guardarClienteGlobal();
    actualizarCabeceraProyecto();
    actualizarBadgeNube();
    mostrarToast('Cliente Seleccionado', `${nombre} vinculado desde Agenda.`);
}

function iniciarCroquis() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp('Datos Incompletos', 'Ingresá al menos el Nombre del Cliente para iniciar.');
        return;
    }
    if (!clienteDesdeAgenda) {
        document.getElementById('modalAgendarCliente').classList.remove('oculto');
        return;
    }
    avanzarPasoTrabajo(true);
}

function accionAgendarCliente() {
    const nombre = encodeURIComponent(document.getElementById('cliNombre').value.trim());
    const dir = encodeURIComponent(document.getElementById('cliDireccion').value.trim());
    window.location.href = `../agenda/index.html?nombre=${nombre}&dir=${dir}`;
}

function opcionBuscarAgenda() {
    document.getElementById('modalAgendarCliente').classList.add('oculto');
    if (typeof abrirModalAgendaGlobal === 'function') {
        abrirModalAgendaGlobal();
    } else {
        mostrarAlertaCorp('Agenda', 'No se encontró la función global de Agenda.');
    }
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
    avanzarPasoTrabajo(true);
}

function avanzarPasoTrabajo(guardar = true) {
    document.getElementById('step-cliente').classList.add('oculto');
    const stepT = document.getElementById('step-trabajo');
    stepT.classList.remove('oculto');
    stepT.classList.add('flex-column', 'gap-15');

    actualizarCabeceraProyecto();
    actualizarBadgeNube();
    if (guardar) {
        guardarClienteGlobal();
        guardarEstadoLocal(true);
    }
    try {
        renderizarTodoCroquis();
    } catch (e) {
        console.error('Error renderizando croquis:', e);
    }
}

function volverAEditarCliente() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    guardarEstadoLocal(false);
}

function actualizarCabeceraProyecto() {
    const nom = document.getElementById('cliNombre').value.trim() || 'Cliente';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();
    document.getElementById('ui-proyecto-cliente').innerText = nom;
    document.getElementById('ui-proyecto-detalle').innerText = [dir, proy].filter(Boolean).join(' • ') || 'Replanteo eléctrico 3D';
}

function actualizarBadgeNube() {
    const badge = document.getElementById('ui-cloud-badge');
    if (!badge) return;
    if (!permiteGuardarNube) {
        badge.className = 'pres-cloud-pill local';
        badge.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Modo Local';
    } else if (nombreBorradorActual) {
        badge.className = 'pres-cloud-pill saved';
        badge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
    } else {
        badge.className = 'pres-cloud-pill ready';
        badge.innerHTML = '<i class="fa-solid fa-cloud"></i> Nube Lista';
    }
}

// ==========================================================================
// ALTERNAR VISTA 3D CUBO / PLANTA 2D Y ZOOM TÁCTIL DEL PLANO
// ==========================================================================
let modoVista3D = true;

function alternarModoVista3D() {
    modoVista3D = !modoVista3D;
    const btn = document.getElementById('btnToggleVista3D');
    if (btn) {
        btn.classList.toggle('primary-action', modoVista3D);
        btn.innerHTML = modoVista3D
            ? '<i class="fa-solid fa-cube"></i> 3D Cubo'
            : '<i class="fa-solid fa-vector-square"></i> Planta 2D';
    }
    renderizarTodoCroquis();
}

function factorEscalaPerspectiva3D(z) {
    const alto = Math.max(2, estadoCroquis.alto || 2.60);
    const ratio = Math.max(0, Math.min(1, (z ?? 0) / alto));
    // Piso (z = 0) -> 0.70 del tamaño exterior; Techo (z = alto) -> 1.00
    return 0.70 + 0.30 * ratio;
}

function proyectarPunto3D(x, y, z, geom) {
    const basePx = geom.ox + x * geom.scale;
    const basePy = geom.oy + y * geom.scale;
    if (!modoVista3D) {
        return { px: basePx, py: basePy };
    }
    const cx = geom.ox + geom.roomW / 2;
    const cy = geom.oy + geom.roomH / 2;
    const f = factorEscalaPerspectiva3D(z);
    return {
        px: cx + (basePx - cx) * f,
        py: cy + (basePy - cy) * f
    };
}


function aplicarTransformacionZoomPlano() {
    const layer = document.getElementById('zoomLayerSvgCroquis');
    const txt = document.getElementById('txtZoomPlano');
    const btnReset = document.getElementById('btnResetZoomPlano');
    const viewport = document.getElementById('viewportSvgCroquis');

    if (layer) {
        layer.style.transform = `translate(${panPlanoX}px, ${panPlanoY}px) scale(${zoomPlano})`;
    }
    if (txt) {
        txt.innerText = `${Math.round(zoomPlano * 100)}%`;
    }
    if (btnReset) {
        btnReset.classList.toggle('oculto', zoomPlano <= 1.02 && Math.abs(panPlanoX) < 2 && Math.abs(panPlanoY) < 2);
    }
    if (viewport) {
        viewport.style.touchAction = zoomPlano > 1.02 ? 'none' : 'pan-y';
    }
}

function ajustarZoomPlano(delta) {
    const nuevoZoom = Math.min(3.2, Math.max(1, Math.round((zoomPlano + delta) * 100) / 100));
    if (nuevoZoom === 1) {
        panPlanoX = 0;
        panPlanoY = 0;
    }
    zoomPlano = nuevoZoom;
    aplicarTransformacionZoomPlano();
}

function resetearZoomPlano() {
    zoomPlano = 1;
    panPlanoX = 0;
    panPlanoY = 0;
    aplicarTransformacionZoomPlano();
}

function inicializarZoomTactilPlano() {
    if (zoomTactilInicializado) return;
    const viewport = document.getElementById('viewportSvgCroquis');
    if (!viewport) return;
    zoomTactilInicializado = true;

    let distInicial = 0;
    let zoomInicial = 1;
    let arrastrandoPan = false;
    let startPanX = 0;
    let startPanY = 0;

    viewport.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            e.preventDefault();
            distInicial = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            zoomInicial = zoomPlano;
        } else if (e.touches.length === 1 && zoomPlano > 1.02) {
            arrastrandoPan = true;
            startPanX = e.touches[0].clientX - panPlanoX;
            startPanY = e.touches[0].clientY - panPlanoY;
        }
    }, { passive: false });

    viewport.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && distInicial > 0) {
            e.preventDefault();
            const distActual = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            zoomPlano = Math.min(3.2, Math.max(1, zoomInicial * (distActual / distInicial)));
            if (zoomPlano <= 1.02) {
                zoomPlano = 1;
                panPlanoX = 0;
                panPlanoY = 0;
            }
            aplicarTransformacionZoomPlano();
        } else if (e.touches.length === 1 && arrastrandoPan && zoomPlano > 1.02) {
            e.preventDefault();
            const maxPanX = viewport.clientWidth * (zoomPlano - 1);
            const maxPanY = viewport.clientHeight * (zoomPlano - 1);
            panPlanoX = Math.min(0, Math.max(-maxPanX, e.touches[0].clientX - startPanX));
            panPlanoY = Math.min(0, Math.max(-maxPanY, e.touches[0].clientY - startPanY));
            aplicarTransformacionZoomPlano();
        }
    }, { passive: false });

    viewport.addEventListener('touchend', () => {
        distInicial = 0;
        arrastrandoPan = false;
    });
}

// ==========================================================================
// PLANTILLAS RÁPIDAS E IMPORTACIÓN DESDE MÓDULO POTENCIA
// ==========================================================================
function aplicarPlantillaCroquis(tipo) {
    elementoSeleccionadoId = null;
    origenConexionId = null;

    if (tipo === 'dormitorio') {
        estadoCroquis = crearPlantillaDormitorio();
    } else if (tipo === 'cocina') {
        estadoCroquis = {
            nombre: 'Cocina / Comedor',
            ancho: 4.20,
            largo: 3.00,
            alto: 2.60,
            desperdicio: 10,
            canoDiam: '3/4" (Ø 20mm)',
            aberturas: [
                { id: 'ab1', tipo: 'PUERTA',  pared: 'OESTE', offset: 0.25, ancho: 0.80 },
                { id: 'ab2', tipo: 'VENTANA', pared: 'NORTE', offset: 1.50, ancho: 1.40 }
            ],
            elementos: [
                { id: 'el1', tag: 'B1',  tipo: 'BOCA_TECHO', x: 1.40, y: 1.50, z: 2.60, muro: 'TECHO', rot: 0,   circ: 'C1', nota: 'Centro cocina' },
                { id: 'el2', tag: 'B2',  tipo: 'BOCA_TECHO', x: 3.10, y: 1.50, z: 2.60, muro: 'TECHO', rot: 0,   circ: 'C1', nota: 'Centro comedor' },
                { id: 'el3', tag: 'LL1', tipo: 'LLAVE_2P',   x: 0.00, y: 1.25, z: 1.10, muro: 'OESTE', rot: 270, circ: 'C1', nota: '2 efectos' },
                { id: 'el4', tag: 'TE1', tipo: 'TOMA_20A',   x: 1.80, y: 0.00, z: 1.10, muro: 'NORTE', rot: 0,   circ: 'C3', nota: 'Mesada 20A' },
                { id: 'el5', tag: 'T1',  tipo: 'TOMA_DOBLE', x: 2.70, y: 0.00, z: 1.10, muro: 'NORTE', rot: 0,   circ: 'C2', nota: 'Mesada TUG' },
                { id: 'el6', tag: 'T2',  tipo: 'TOMA_10A',   x: 0.60, y: 0.00, z: 0.30, muro: 'NORTE', rot: 0,   circ: 'C2', nota: 'Heladera' }
            ],
            tramos: [
                { id: 'tr1', desde: 'el1', hasta: 'el2', via: 'TECHO', rol: 'ALIM_IUG' },
                { id: 'tr2', desde: 'el1', hasta: 'el3', via: 'TECHO', rol: 'BAJADA_2P' },
                { id: 'tr3', desde: 'el6', hasta: 'el5', via: 'PARED', rol: 'ALIM_TUG' }
            ]
        };
    } else if (tipo === 'bano') {
        estadoCroquis = {
            nombre: 'Baño Completo',
            ancho: 2.40,
            largo: 1.80,
            alto: 2.60,
            desperdicio: 10,
            canoDiam: '3/4" (Ø 20mm)',
            aberturas: [
                { id: 'ab1', tipo: 'PUERTA',    pared: 'SUR',   offset: 0.20, ancho: 0.70 },
                { id: 'ab2', tipo: 'VENTANUCO', pared: 'NORTE', offset: 0.90, ancho: 0.60 }
            ],
            elementos: [
                { id: 'el1', tag: 'B1',  tipo: 'BOCA_TECHO', x: 1.20, y: 0.90, z: 2.60, muro: 'TECHO', rot: 0,   circ: 'C1', nota: '' },
                { id: 'el2', tag: 'AP1', tipo: 'APLIQUE',    x: 0.00, y: 0.90, z: 1.90, muro: 'OESTE', rot: 270, circ: 'C1', nota: 'Sobre espejo' },
                { id: 'el3', tag: 'LL1', tipo: 'LLAVE_2P',   x: 1.10, y: 1.80, z: 1.10, muro: 'SUR',   rot: 180, circ: 'C1', nota: 'Centro + espejo' },
                { id: 'el4', tag: 'T1',  tipo: 'TOMA_10A',   x: 0.00, y: 1.30, z: 1.10, muro: 'OESTE', rot: 270, circ: 'C2', nota: 'Con tapa IP' }
            ],
            tramos: [
                { id: 'tr1', desde: 'el1', hasta: 'el2', via: 'TECHO', rol: 'ALIM_IUG' },
                { id: 'tr2', desde: 'el1', hasta: 'el3', via: 'TECHO', rol: 'BAJADA_2P' }
            ]
        };
    } else {
        estadoCroquis = {
            nombre: 'Ambiente Nuevo',
            ancho: 4.00,
            largo: 3.50,
            alto: 2.60,
            desperdicio: 10,
            canoDiam: '3/4" (Ø 20mm)',
            aberturas: [
                { id: 'ab1', tipo: 'PUERTA', pared: 'SUR', offset: 0.30, ancho: 0.80 }
            ],
            elementos: [],
            tramos: []
        };
    }

    guardarEstadoLocal(true);
    renderizarTodoCroquis();
    mostrarToast('Plantilla Aplicada', `Ambiente "${estadoCroquis.nombre}" cargado.`);
}

async function abrirModalImportarPotencia() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp('Sin Sesión', 'Iniciá sesión en la nube para importar desde Potencia.');
        return;
    }

    const modal = document.getElementById('modalImportarPotencia');
    const lista = document.getElementById('listaBorradoresPotencia');
    lista.innerHTML = '<div style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando cálculos en Potencia...</div>';
    modal.classList.remove('oculto');

    try {
        const snap = await db.collection('perfiles').doc(uid).collection('borradores_potencia').get();
        if (snap.empty) {
            lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No hay borradores guardados en Potencia.</p>';
            return;
        }
        lista.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const ambs = Array.isArray(d.listaAmbientes) ? d.listaAmbientes : [];
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'stretch';
            div.style.gap = '6px';

            let btnsAmbs = '';
            if (ambs.length > 0) {
                btnsAmbs = ambs.map((a, i) => `
                    <button type="button" class="corp-btn-small success-btn" style="margin: 2px;" onclick="importarAmbientePotencia('${escapeJs(doc.id)}', ${i})">
                        <i class="fa-solid fa-vector-square"></i> ${escapeHtml(a.nombre || a.tipo || `Ambiente ${i + 1}`)} (${a.ancho || 3}×${a.largo || 3}m)
                    </button>
                `).join('');
            } else {
                btnsAmbs = `<small style="color:var(--ngc-text-faded);">Sin ambientes detallados</small>`;
            }

            div.innerHTML = `
                <div>
                    <h4>${escapeHtml(d.nombreBorrador || doc.id)}</h4>
                    <small>${escapeHtml(d.cliNombre || 'Cliente')} • ${ambs.length} ambientes</small>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">${btnsAmbs}</div>
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

async function importarAmbientePotencia(docId, ambIndex) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    try {
        const doc = await db.collection('perfiles').doc(uid).collection('borradores_potencia').doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();
        const amb = (data.listaAmbientes || [])[ambIndex];
        if (!amb) return;

        const ancho = Math.max(1.5, parseFloat(amb.ancho) || 3.50);
        const largo = Math.max(1.5, parseFloat(amb.largo) || 3.20);
        const elementos = [];
        const tramos = [];

        const cantIUG = parseInt(amb.bIUG, 10) || 1;
        for (let i = 0; i < Math.min(4, cantIUG); i++) {
            const fracX = (i + 1) / (Math.min(4, cantIUG) + 1);
            elementos.push({
                id: `el_b${i + 1}`,
                tag: `B${i + 1}`,
                tipo: 'BOCA_TECHO',
                x: redondear05(ancho * fracX),
                y: redondear05(largo / 2),
                z: 2.60,
                muro: 'TECHO',
                rot: 0,
                circ: amb.circIUG || 'C1',
                nota: ''
            });
        }

        elementos.push({
            id: 'el_ll1',
            tag: 'LL1',
            tipo: cantIUG > 1 ? 'LLAVE_2P' : 'LLAVE_1P',
            x: redondear05(Math.min(ancho - 0.25, 1.15)),
            y: largo,
            z: 1.10,
            muro: 'SUR',
            rot: 180,
            circ: amb.circIUG || 'C1',
            nota: ''
        });

        if (elementos.length >= 2) {
            tramos.push({
                id: 'tr_bajada',
                desde: 'el_b1',
                hasta: 'el_ll1',
                via: 'TECHO',
                rol: cantIUG > 1 ? 'BAJADA_2P' : 'BAJADA_1P'
            });
        }

        const cantTUG = Math.min(6, parseInt(amb.bTUG, 10) || 2);
        const murosCiclo = [
            { muro: 'OESTE', x: 0,     y: largo * 0.5, rot: 270 },
            { muro: 'NORTE', x: ancho * 0.5, y: 0,     rot: 0   },
            { muro: 'ESTE',  x: ancho, y: largo * 0.5, rot: 90  },
            { muro: 'SUR',   x: ancho * 0.75, y: largo, rot: 180 }
        ];
        for (let t = 0; t < cantTUG; t++) {
            const m = murosCiclo[t % murosCiclo.length];
            const idT = `el_t${t + 1}`;
            elementos.push({
                id: idT,
                tag: `T${t + 1}`,
                tipo: 'TOMA_10A',
                x: redondear05(m.x),
                y: redondear05(m.y),
                z: 0.30,
                muro: m.muro,
                rot: m.rot,
                circ: amb.circTUG || 'C2',
                nota: ''
            });
            if (t > 0) {
                tramos.push({ id: `tr_t${t}`, desde: `el_t${t}`, hasta: idT, via: 'CONTRAPISO', rol: 'ALIM_TUG' });
            }
        }

        estadoCroquis = {
            nombre: amb.nombre || amb.tipo || 'Ambiente Importado',
            ancho,
            largo,
            alto: 2.60,
            desperdicio: 10,
            canoDiam: '3/4" (Ø 20mm)',
            aberturas: [{ id: 'ab1', tipo: 'PUERTA', pared: 'SUR', offset: 0.25, ancho: 0.80 }],
            elementos,
            tramos
        };

        elementoSeleccionadoId = null;
        origenConexionId = null;
        cerrarModalImportarPotencia();
        guardarEstadoLocal(true);
        renderizarTodoCroquis();
        mostrarToast('Importado de Potencia', `${estadoCroquis.nombre} (${ancho}×${largo} m) replanteado.`);
    } catch (e) {
        mostrarAlertaCorp('Error', 'No se pudo importar el ambiente.');
    }
}

// ==========================================================================
// CONFIGURACIÓN DE AMBIENTE, ABERTURAS Y ELEMENTOS
// ==========================================================================
function abrirModalAmbiente() {
    document.getElementById('ambNombre').value = estadoCroquis.nombre || 'Ambiente';
    document.getElementById('ambAncho').value = estadoCroquis.ancho || 3.50;
    document.getElementById('ambLargo').value = estadoCroquis.largo || 3.20;
    document.getElementById('ambAlto').value = estadoCroquis.alto || 2.60;
    document.getElementById('ambDesperdicio').value = String(estadoCroquis.desperdicio || 10);
    document.getElementById('ambCanoDiam').value = estadoCroquis.canoDiam || '3/4" (Ø 20mm)';
    document.getElementById('modalAmbiente').classList.remove('oculto');
}

function cerrarModalAmbiente() {
    document.getElementById('modalAmbiente').classList.add('oculto');
}

function guardarConfigAmbiente() {
    const nuevoAncho = Math.max(1, Math.min(25, parseFloat(document.getElementById('ambAncho').value) || 3.50));
    const nuevoLargo = Math.max(1, Math.min(25, parseFloat(document.getElementById('ambLargo').value) || 3.20));
    const nuevoAlto  = Math.max(2, Math.min(6,  parseFloat(document.getElementById('ambAlto').value)  || 2.60));

    estadoCroquis.nombre = document.getElementById('ambNombre').value.trim() || 'Ambiente';
    estadoCroquis.ancho = nuevoAncho;
    estadoCroquis.largo = nuevoLargo;
    estadoCroquis.alto = nuevoAlto;
    estadoCroquis.desperdicio = parseInt(document.getElementById('ambDesperdicio').value, 10) || 10;
    estadoCroquis.canoDiam = document.getElementById('ambCanoDiam').value;

    estadoCroquis.elementos.forEach(el => {
        if (el.muro === 'ESTE') el.x = nuevoAncho;
        else if (el.muro === 'OESTE') el.x = 0;
        else el.x = Math.min(nuevoAncho, Math.max(0, el.x));

        if (el.muro === 'SUR') el.y = nuevoLargo;
        else if (el.muro === 'NORTE') el.y = 0;
        else el.y = Math.min(nuevoLargo, Math.max(0, el.y));

        if (el.tipo === 'BOCA_TECHO') el.z = nuevoAlto;
        else el.z = Math.min(nuevoAlto, Math.max(0, el.z ?? 1.10));
    });

    cerrarModalAmbiente();
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
    mostrarToast('Medidas Actualizadas', `${estadoCroquis.nombre}: ${nuevoAncho.toFixed(2)} × ${nuevoLargo.toFixed(2)} m`);
}

function abrirModalAbertura() {
    renderizarListaAberturasModal();
    document.getElementById('modalAbertura').classList.remove('oculto');
}

function cerrarModalAbertura() {
    document.getElementById('modalAbertura').classList.add('oculto');
}

function renderizarListaAberturasModal() {
    const cont = document.getElementById('listaAberturasModal');
    if (!estadoCroquis.aberturas || estadoCroquis.aberturas.length === 0) {
        cont.innerHTML = '<small style="color:var(--ngc-text-faded); text-align:center;">Sin aberturas cargadas.</small>';
        return;
    }
    cont.innerHTML = estadoCroquis.aberturas.map((ab, idx) => `
        <div class="modal-list-item">
            <div>
                <h4 style="font-size:0.85rem;">${escapeHtml(ab.tipo)} • Pared ${escapeHtml(ab.pared)}</h4>
                <small>A ${ab.offset.toFixed(2)} m de esquina • Ancho ${ab.ancho.toFixed(2)} m</small>
            </div>
            <button type="button" class="corp-btn-small danger" onclick="eliminarAbertura(${idx})"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
        }

function agregarAbertura() {
    const tipo = document.getElementById('abTipo').value;
    const pared = document.getElementById('abPared').value;
    const offset = Math.max(0, parseFloat(document.getElementById('abOffset').value) || 0.20);
    const ancho = Math.max(0.40, parseFloat(document.getElementById('abAncho').value) || 0.80);

    estadoCroquis.aberturas.push({
        id: 'ab_' + Date.now(),
        tipo,
        pared,
        offset,
        ancho
    });
    renderizarListaAberturasModal();
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function eliminarAbertura(idx) {
    estadoCroquis.aberturas.splice(idx, 1);
    renderizarListaAberturasModal();
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

// ==========================================================================
// HERRAMIENTAS TÁCTILES, COLOCACIÓN CON IMÁN A MUROS Y D-PAD 3D
// ==========================================================================
function seleccionarHerramienta(tool) {
    herramientaActiva = tool;
    origenConexionId = null;

    document.querySelectorAll('#paletaHerramientas button').forEach(btn => {
        const esActiva = btn.getAttribute('data-tool') === tool;
        btn.classList.toggle('primary-action', esActiva);
    });

    const hints = {
        SELECT: 'Tocá cualquier caja en el plano para moverla (X/Y/Z) o editar sus datos.',
        BOCA_TECHO: 'Tocá cualquier punto del techo para ubicar una Boca de Centro.',
        APLIQUE: 'Tocá cerca de una pared para fijar un Aplique (se orienta solo).',
        LLAVE_1P: 'Tocá cerca de una pared (ej. junto a puerta) para colocar Llave de Luz.',
        TOMA_10A: 'Tocá cerca de una pared para ubicar un Tomacorriente.',
        TABLERO: 'Tocá una pared para ubicar el Tablero Seccional (TS).',
        CAJA_PASO: 'Tocá una pared o esquina para colocar Caja de Paso.',
        CONECTAR: 'Paso 1: Tocá la caja de ORIGEN del caño.'
    };
    document.getElementById('ui-hint-herramienta').innerText = hints[tool] || '';
}

function centrarBocaTecho() {
    const cx = redondear05(estadoCroquis.ancho / 2);
    const cy = redondear05(estadoCroquis.largo / 2);
    const existente = estadoCroquis.elementos.find(e => e.tipo === 'BOCA_TECHO');

    if (existente) {
        existente.x = cx;
        existente.y = cy;
        existente.z = estadoCroquis.alto;
        elementoSeleccionadoId = existente.id;
    } else {
        const nuevo = {
            id: 'el_' + Date.now(),
            tag: generarSiguienteTag('B'),
            tipo: 'BOCA_TECHO',
            x: cx,
            y: cy,
            z: estadoCroquis.alto,
            muro: 'TECHO',
            rot: 0,
            circ: 'C1',
            nota: 'Centro geométrico'
        };
        estadoCroquis.elementos.push(nuevo);
        elementoSeleccionadoId = nuevo.id;
    }

    seleccionarHerramienta('SELECT');
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
    mostrarToast('Boca Centrada', `Ubicada en X=${cx.toFixed(2)}m, Y=${cy.toFixed(2)}m`);
}

function manejarToqueLienzo(evt) {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const vb = svg.viewBox.baseVal;
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

    const svgX = ((clientX - rect.left) / rect.width) * vb.width;
    const svgY = ((clientY - rect.top) / rect.height) * vb.height;

    const geom = calcularGeometriaPlano(vb.width, vb.height);

    // Detectar toque directo sobre símbolo proyectado (funciona tanto en 3D Cubo como en 2D)
    let tocado = null;
    let minDistPx = 28;
    estadoCroquis.elementos.forEach(el => {
        const pt = proyectarPunto3D(el.x, el.y, el.z ?? 0, geom);
        const dPx = Math.hypot(pt.px - svgX, pt.py - svgY);
        if (dPx < minDistPx) {
            minDistPx = dPx;
            tocado = el;
        }
    });

    // Convertir toque a coordenadas reales (X, Y) del ambiente
    const preset = PRESETS_ELEMENTOS[herramientaActiva] || PRESETS_ELEMENTOS.TOMA_10A;
    const zRef = (modoVista3D && preset.pared) ? preset.zDefault : (estadoCroquis.alto || 2.60);
    const escalaZ = modoVista3D ? factorEscalaPerspectiva3D(zRef) : 1;
    const cx = geom.ox + geom.roomW / 2;
    const cy = geom.oy + geom.roomH / 2;

    const planoX = cx + (svgX - cx) / escalaZ;
    const planoY = cy + (svgY - cy) / escalaZ;

    const realX = Math.max(0, Math.min(estadoCroquis.ancho, (planoX - geom.ox) / geom.scale));
    const realY = Math.max(0, Math.min(estadoCroquis.largo, (planoY - geom.oy) / geom.scale));

    if (herramientaActiva === 'CONECTAR') {
        if (!tocado) {
            mostrarToast('Seleccioná una Caja', 'Tocá directamente sobre un símbolo para unirlo.');
            return;
        }
        if (!origenConexionId) {
            origenConexionId = tocado.id;
            elementoSeleccionadoId = tocado.id;
            document.getElementById('ui-hint-herramienta').innerText = `Origen: [${tocado.tag}]. Ahora tocá la caja de DESTINO.`;
            renderizarTodoCroquis();
        } else if (origenConexionId !== tocado.id) {
            conectarDosCajas(origenConexionId, tocado.id);
            origenConexionId = null;
            seleccionarHerramienta('SELECT');
        }
        return;
    }

    if (herramientaActiva === 'SELECT') {
        elementoSeleccionadoId = tocado ? tocado.id : null;
        renderizarTodoCroquis();
        return;
    }

    let posX = redondear05(realX);
    let posY = redondear05(realY);
    let muro = 'TECHO';
    let rot = 0;

    if (preset.pared) {
        const snap = ajustarAParedCercana(posX, posY);
        posX = snap.x;
        posY = snap.y;
        muro = snap.muro;
        rot = snap.rot;
    }

    const nuevo = {
        id: 'el_' + Date.now(),
        tag: generarSiguienteTag(preset.prefijo),
        tipo: herramientaActiva,
        x: posX,
        y: posY,
        z: herramientaActiva === 'BOCA_TECHO' ? estadoCroquis.alto : preset.zDefault,
        muro,
        rot,
        circ: preset.circ,
        nota: ''
    };

    estadoCroquis.elementos.push(nuevo);
    elementoSeleccionadoId = nuevo.id;
    seleccionarHerramienta('SELECT');
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function ajustarAParedCercana(x, y) {
    const W = estadoCroquis.ancho;
    const L = estadoCroquis.largo;
    const dists = [
        { muro: 'NORTE', d: y,     x: redondear05(x), y: 0, rot: 0   },
        { muro: 'SUR',   d: L - y, x: redondear05(x), y: L, rot: 180 },
        { muro: 'OESTE', d: x,     x: 0,              y: redondear05(y), rot: 270 },
        { muro: 'ESTE',  d: W - x, x: W,              y: redondear05(y), rot: 90  }
    ];
    dists.sort((a, b) => a.d - b.d);
    return dists[0];
}

function moverElementoSeleccionado(dx, dy) {
    const el = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    if (!el) return;

    const paso = parseFloat(document.getElementById('selPasoFino').value) || 0.10;
    let nx = redondear05(el.x + dx * paso);
    let ny = redondear05(el.y + dy * paso);

    nx = Math.max(0, Math.min(estadoCroquis.ancho, nx));
    ny = Math.max(0, Math.min(estadoCroquis.largo, ny));

    el.x = nx;
    el.y = ny;

    if (el.muro !== 'TECHO') {
        const snap = ajustarAParedCercana(nx, ny);
        el.x = snap.x;
        el.y = snap.y;
        el.muro = snap.muro;
        el.rot = snap.rot;
    }

    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function moverAlturaSeleccionado(dirZ) {
    const el = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    if (!el) return;

    const paso = parseFloat(document.getElementById('selPasoFino').value) || 0.10;
    const altoMax = estadoCroquis.alto || 2.60;
    const actualZ = el.z ?? 1.10;
    const nuevoZ = Math.max(0, Math.min(altoMax, redondear05(actualZ + dirZ * paso)));

    el.z = nuevoZ;
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function iniciarConexionDesdeSeleccionado() {
    if (!elementoSeleccionadoId) return;
    const el = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    seleccionarHerramienta('CONECTAR');
    origenConexionId = elementoSeleccionadoId;
    if (el) {
        document.getElementById('ui-hint-herramienta').innerText = `Origen: [${el.tag}]. Tocá ahora la caja de DESTINO en el plano.`;
    }
    renderizarTodoCroquis();
}

function eliminarElementoSeleccionado() {
    if (!elementoSeleccionadoId) return;
    const idBorrar = elementoSeleccionadoId;
    estadoCroquis.elementos = estadoCroquis.elementos.filter(e => e.id !== idBorrar);
    estadoCroquis.tramos = estadoCroquis.tramos.filter(t => t.desde !== idBorrar && t.hasta !== idBorrar);
    elementoSeleccionadoId = null;
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function abrirModalEditarElemento() {
    const el = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    if (!el) return;

    document.getElementById('elTag').value = el.tag || '';
    document.getElementById('elTipo').value = el.tipo || 'TOMA_10A';
    document.getElementById('elCircuito').value = el.circ || 'C2';
    document.getElementById('elZ').value = el.z ?? 0.30;
    document.getElementById('elX').value = el.x ?? 0;
    document.getElementById('elY').value = el.y ?? 0;
    document.getElementById('elNota').value = el.nota || '';
    document.getElementById('modalElemento').classList.remove('oculto');
}

function cerrarModalElemento() {
    document.getElementById('modalElemento').classList.add('oculto');
}

function actualizarAlturaPorTipo() {
    const tipo = document.getElementById('elTipo').value;
    const p = PRESETS_ELEMENTOS[tipo];
    if (p) {
        document.getElementById('elZ').value = tipo === 'BOCA_TECHO' ? estadoCroquis.alto : p.zDefault;
        document.getElementById('elCircuito').value = p.circ;
    }
}

function guardarEdicionElemento() {
    const el = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    if (!el) return;

    const nuevoTipo = document.getElementById('elTipo').value;
    const preset = PRESETS_ELEMENTOS[nuevoTipo] || PRESETS_ELEMENTOS.TOMA_10A;

    el.tag = document.getElementById('elTag').value.trim() || el.tag;
    el.tipo = nuevoTipo;
    el.circ = document.getElementById('elCircuito').value;
    el.z = Math.max(0, Math.min(estadoCroquis.alto || 2.60, parseFloat(document.getElementById('elZ').value) || 0));
    el.x = Math.max(0, Math.min(estadoCroquis.ancho, parseFloat(document.getElementById('elX').value) || 0));
    el.y = Math.max(0, Math.min(estadoCroquis.largo, parseFloat(document.getElementById('elY').value) || 0));
    el.nota = document.getElementById('elNota').value.trim();

    if (preset.pared) {
        const snap = ajustarAParedCercana(el.x, el.y);
        el.x = snap.x;
        el.y = snap.y;
        el.muro = snap.muro;
        el.rot = snap.rot;
    } else {
        el.muro = 'TECHO';
        el.rot = 0;
    }

    cerrarModalElemento();
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
        }

// ==========================================================================
// CONEXIÓN DE TRAMOS Y CÁLCULO 2.5D REAL (TECHO / PARED / CONTRAPISO)
// ==========================================================================
function inferirViaTramo(a, b) {
    if (!a || !b) return 'TECHO';
    if (a.muro === 'TECHO' || b.muro === 'TECHO') return 'TECHO';
    if ((a.z ?? 0) <= 0.60 && (b.z ?? 0) <= 0.60 && a.muro !== b.muro) return 'CONTRAPISO';
    if (a.muro === b.muro) return 'PARED';
    return 'TECHO';
}

function conectarDosCajas(idA, idB) {
    const a = estadoCroquis.elementos.find(e => e.id === idA);
    const b = estadoCroquis.elementos.find(e => e.id === idB);
    if (!a || !b) return;

    let rol = 'ALIM_TUG';
    const tipos = [a.tipo, b.tipo];
    if (tipos.includes('LLAVE_1P')) rol = 'BAJADA_1P';
    else if (tipos.includes('LLAVE_2P')) rol = 'BAJADA_2P';
    else if (tipos.includes('LLAVE_3P')) rol = 'BAJADA_3P';
    else if (tipos.includes('LLAVE_COMB')) rol = 'COMBINACION';
    else if (tipos.includes('TOMA_20A') || a.circ === 'C3' || b.circ === 'C3') rol = 'ALIM_TUE';
    else if (a.circ === 'C1' && b.circ === 'C1') rol = 'ALIM_IUG';

    const via = inferirViaTramo(a, b);

    estadoCroquis.tramos.push({
        id: 'tr_' + Date.now(),
        desde: idA,
        hasta: idB,
        via,
        rol
    });
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
    mostrarToast('Tramo Conectado', `${a.tag} → ${b.tag} (${via})`);
}

function abrirModalTramoManual() {
    if (estadoCroquis.elementos.length < 2) {
        mostrarAlertaCorp('Faltan Cajas', 'Necesitás al menos 2 cajas ubicadas en el plano para conectar un caño.');
        return;
    }
    const opts = estadoCroquis.elementos.map(e => `<option value="${e.id}">[${escapeHtml(e.tag)}] ${escapeHtml(PRESETS_ELEMENTOS[e.tipo]?.nombre || e.tipo)}</option>`).join('');
    document.getElementById('tramoDesde').innerHTML = opts;
    document.getElementById('tramoHasta').innerHTML = opts;
    if (estadoCroquis.elementos.length >= 2) {
        document.getElementById('tramoHasta').selectedIndex = 1;
    }
    document.getElementById('modalTramo').classList.remove('oculto');
}

function cerrarModalTramo() {
    document.getElementById('modalTramo').classList.add('oculto');
}

function guardarTramoManual() {
    const desde = document.getElementById('tramoDesde').value;
    const hasta = document.getElementById('tramoHasta').value;
    const viaEl = document.getElementById('tramoVia');
    const via = viaEl ? viaEl.value : 'TECHO';
    const rol = document.getElementById('tramoRol').value;

    if (desde === hasta) {
        mostrarAlertaCorp('Misma Caja', 'Seleccioná dos cajas diferentes.');
        return;
    }
    estadoCroquis.tramos.push({ id: 'tr_' + Date.now(), desde, hasta, via, rol });
    cerrarModalTramo();
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function cambiarViaTramo(idx, nuevaVia) {
    if (!estadoCroquis.tramos[idx]) return;
    estadoCroquis.tramos[idx].via = nuevaVia;
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function eliminarTramo(idx) {
    estadoCroquis.tramos.splice(idx, 1);
    guardarEstadoLocal(true);
    renderizarTodoCroquis();
}

function calcularLongitudTramo25D(tramo) {
    const a = estadoCroquis.elementos.find(e => e.id === tramo.desde);
    const b = estadoCroquis.elementos.find(e => e.id === tramo.hasta);
    if (!a || !b) return 0;

    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const zA = a.z ?? 0;
    const zB = b.z ?? 0;
    const dz = Math.abs(zB - zA);
    const techo = estadoCroquis.alto || 2.60;
    const via = tramo.via || inferirViaTramo(a, b);

    if (via === 'CONTRAPISO') {
        // Baja desde caja A a piso (Z=0), cruza ortogonalmente y sube a caja B
        return zA + dx + dy + zB;
    }
    if (via === 'PARED') {
        // Recorre horizontalmente por los muros y absorbe la diferencia vertical
        return dx + dy + dz;
    }
    // TECHO: si alguno ya está en techo, trazado ortogonal + bajada; si ambos en pared, sube a losa, cruza y baja
    if (a.muro === 'TECHO' || b.muro === 'TECHO') {
        return dx + dy + dz;
    }
    return Math.abs(techo - zA) + dx + dy + Math.abs(techo - zB);
}

function calcularComputo25D() {
    // Si existen materiales editados/reemplazados desde el módulo Materiales, priorizarlos
    if (
        typeof materialesEditadosDesdeCatalogo !== 'undefined' &&
        Array.isArray(materialesEditadosDesdeCatalogo) &&
        materialesEditadosDesdeCatalogo.length > 0
    ) {
        const itemsAdaptados = materialesEditadosDesdeCatalogo.map(it => ({
            rubro: (it.nota || 'Catálogo').split('•')[0].trim() || 'Catálogo',
            desc: it.material || '',
            cant: Number(it.cantidad || 1),
            unid: it.unidad || 'UNID'
        }));
        const canoItem = itemsAdaptados.find(i => i.desc.toLowerCase().includes('caño'));
        const canoTotal = canoItem ? canoItem.cant : 0;
        return { canoNeto: canoTotal, canoTotal, items: itemsAdaptados };
    }

    const factorDesp = 1 + ((estadoCroquis.desperdicio || 10) / 100);
    let canoNeto = 0;

    // Acumuladores de conductores (en metros netos)
    const cables = {
        f15: 0, n15: 0, pe15: 0, ret15: 0,
        f25: 0, n25: 0, pe25: 0,
        f40: 0, n40: 0, pe40: 0
    };

    estadoCroquis.tramos.forEach(tr => {
        const L = calcularLongitudTramo25D(tr);
        if (L <= 0) return;
        canoNeto += L;
        const Lhilo = L + 0.40; // 20 cm chicote por cada caja

        if (tr.rol === 'ALIM_IUG') {
            cables.f15 += Lhilo; cables.n15 += Lhilo; cables.pe15 += Lhilo;
        } else if (tr.rol === 'ALIM_TUG') {
            cables.f25 += Lhilo; cables.n25 += Lhilo; cables.pe25 += Lhilo;
        } else if (tr.rol === 'ALIM_TUE') {
            cables.f40 += Lhilo; cables.n40 += Lhilo; cables.pe40 += Lhilo;
        } else if (tr.rol === 'BAJADA_1P') {
            cables.f15 += Lhilo; cables.ret15 += Lhilo;
        } else if (tr.rol === 'BAJADA_2P') {
            cables.f15 += Lhilo; cables.ret15 += Lhilo * 2;
        } else if (tr.rol === 'BAJADA_3P') {
            cables.f15 += Lhilo; cables.ret15 += Lhilo * 3;
        } else if (tr.rol === 'COMBINACION') {
            cables.ret15 += Lhilo * 3;
        }
    });

    // Conteo de cajas y mecanismos
    let octoGrandes = 0, octoChicas = 0, rect10x5 = 0, cajasPaso = 0, gabinetes = 0;
    let modPunto = 0, modComb = 0, modToma10 = 0, modToma20 = 0;

    estadoCroquis.elementos.forEach(el => {
        if (el.tipo === 'BOCA_TECHO') octoGrandes++;
        else if (el.tipo === 'APLIQUE') octoChicas++;
        else if (el.tipo === 'CAJA_PASO') cajasPaso++;
        else if (el.tipo === 'TABLERO') gabinetes++;
        else {
            rect10x5++;
            if (el.tipo === 'LLAVE_1P') modPunto += 1;
            else if (el.tipo === 'LLAVE_2P') modPunto += 2;
            else if (el.tipo === 'LLAVE_3P') modPunto += 3;
            else if (el.tipo === 'LLAVE_COMB') modComb += 1;
            else if (el.tipo === 'TOMA_10A') modToma10 += 1;
            else if (el.tipo === 'TOMA_DOBLE') modToma10 += 2;
            else if (el.tipo === 'TOMA_20A') modToma20 += 1;
        }
    });

    const items = [];
    const canoTotal = Math.ceil(canoNeto * factorDesp);
    if (canoTotal > 0) {
        const rollos = Math.ceil(canoTotal / 25);
        items.push({
            rubro: 'Canalización',
            desc: `Caño Corrugado Ignífugo ${estadoCroquis.canoDiam} (~${rollos} rollo/s × 25m)`,
            cant: canoTotal,
            unid: 'MTS'
        });
    }
    if (octoGrandes > 0) items.push({ rubro: 'Cajas', desc: 'Caja Octogonal Grande (Losa / Centro)', cant: octoGrandes, unid: 'UNID' });
    if (octoChicas > 0) items.push({ rubro: 'Cajas', desc: 'Caja Octogonal Chica / Mignon (Aplique)', cant: octoChicas, unid: 'UNID' });
    if (rect10x5 > 0) {
        items.push({ rubro: 'Cajas', desc: 'Caja Rectangular Embutir 10×5 cm', cant: rect10x5, unid: 'UNID' });
        items.push({ rubro: 'Mecanismos', desc: 'Conjunto Bastidor + Tapa 10×5 cm', cant: rect10x5, unid: 'UNID' });
    }
    if (cajasPaso > 0) items.push({ rubro: 'Cajas', desc: 'Caja de Paso / Derivación con Tapa', cant: cajasPaso, unid: 'UNID' });
    if (gabinetes > 0) items.push({ rubro: 'Tableros', desc: 'Gabinete Seccional DIN Embutir/Sup.', cant: gabinetes, unid: 'UNID' });

    if (modPunto > 0) items.push({ rubro: 'Mecanismos', desc: 'Módulo Interruptor Unipolar 1 Punto 10A', cant: modPunto, unid: 'UNID' });
    if (modComb > 0) items.push({ rubro: 'Mecanismos', desc: 'Módulo Interruptor Combinación 10A', cant: modComb, unid: 'UNID' });
    if (modToma10 > 0) items.push({ rubro: 'Mecanismos', desc: 'Módulo Tomacorriente 2P+T 10A IRAM 2071', cant: modToma10, unid: 'UNID' });
    if (modToma20 > 0) items.push({ rubro: 'Mecanismos', desc: 'Módulo Tomacorriente 2P+T 20A Reforzado', cant: modToma20, unid: 'UNID' });

    // Conductores discriminados por sección y color IRAM
    const addCable = (metros, desc) => {
        if (metros > 0) {
            items.push({ rubro: 'Conductores', desc, cant: Math.ceil(metros * factorDesp), unid: 'MTS' });
        }
    };
    addCable(cables.f15,   'Cable Unipolar 1,5 mm² IRAM 247-3 (Marrón - Fase)');
    addCable(cables.n15,   'Cable Unipolar 1,5 mm² IRAM 247-3 (Celeste - Neutro)');
    addCable(cables.ret15, 'Cable Unipolar 1,5 mm² IRAM 247-3 (Negro/Blanco - Retorno)');
    addCable(cables.pe15,  'Cable Unipolar 1,5 mm² IRAM 247-3 (Verde/Amarillo - PE)');

    addCable(cables.f25,   'Cable Unipolar 2,5 mm² IRAM 247-3 (Marrón - Fase)');
    addCable(cables.n25,   'Cable Unipolar 2,5 mm² IRAM 247-3 (Celeste - Neutro)');
    addCable(cables.pe25,  'Cable Unipolar 2,5 mm² IRAM 247-3 (Verde/Amarillo - PE)');

    addCable(cables.f40,   'Cable Unipolar 4,0 mm² IRAM 247-3 (Marrón - Fase)');
    addCable(cables.n40,   'Cable Unipolar 4,0 mm² IRAM 247-3 (Celeste - Neutro)');
    addCable(cables.pe40,  'Cable Unipolar 4,0 mm² IRAM 247-3 (Verde/Amarillo - PE)');

    return { canoNeto, canoTotal, items };
                   }
            

// ==========================================================================
// RENDERIZADO GENERAL DE INTERFAZ Y LISTADO DE MATERIALES
// ==========================================================================
function toggleListaComputo() {
    const lista = document.getElementById('ui-lista-computo');
    const btn = document.getElementById('btnToggleComputo');
    if (!lista) return;

    const estabaOculta = lista.classList.contains('oculto');
    lista.classList.toggle('oculto', !estabaOculta);

    if (btn) {
        btn.innerHTML = estabaOculta
            ? '<i class="fa-solid fa-eye-slash"></i> Ocultar'
            : '<i class="fa-solid fa-eye"></i> Ver Listado';
    }
}

function renderizarTodoCroquis() {
    const sup = (estadoCroquis.ancho * estadoCroquis.largo).toFixed(2).replace('.', ',');
    const comp = calcularComputo25D();

    document.getElementById('ui-titulo-ambiente').innerText = `${estadoCroquis.nombre} (${estadoCroquis.ancho.toFixed(2)} × ${estadoCroquis.largo.toFixed(2)} m)`;
    document.getElementById('ui-stat-superficie').innerText = `${sup} m² • Z ${estadoCroquis.alto.toFixed(2)}m`;
    document.getElementById('ui-stat-bocas').innerText = `${estadoCroquis.elementos.length} cajas`;
    document.getElementById('ui-stat-caneria').innerText = `${comp.canoTotal} m (+${estadoCroquis.desperdicio}%)`;

    // Banner normativo AEA
    const banner = document.getElementById('ui-aea-croquis-status');
    const cantTomas = estadoCroquis.elementos.filter(e => e.tipo.startsWith('TOMA_')).length;
    const cantLuces = estadoCroquis.elementos.filter(e => e.tipo === 'BOCA_TECHO' || e.tipo === 'APLIQUE').length;
    if (estadoCroquis.elementos.length === 0) {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = '<i class="fa-solid fa-info-circle"></i> <strong>Ambiente Vacío:</strong> Usá las herramientas táctiles para ubicar bocas, llaves y tomas.';
    } else if (cantLuces === 0 || cantTomas === 0) {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Verificar AEA 770:</strong> ${cantLuces} boca(s) de iluminación y ${cantTomas} boca(s) de tomacorriente en ${sup} m².`;
    } else {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Replanteo Completo:</strong> ${cantLuces} bocas ilum. + ${cantTomas} tomas • ${comp.canoTotal} m de cañería calculados.`;
    }

    // Panel de selección 3D (X, Y, Z)
    const panelSel = document.getElementById('panelControlSeleccion');
    const selEl = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
    if (selEl) {
        panelSel.classList.remove('oculto');
        const pNom = PRESETS_ELEMENTOS[selEl.tipo]?.nombre || selEl.tipo;
        document.getElementById('selElemTitulo').innerText = `[${selEl.tag}] ${pNom} (${selEl.circ})`;
        document.getElementById('selElemCoords').innerText = `X: ${selEl.x.toFixed(2)} m • Y: ${selEl.y.toFixed(2)} m • Z: ${(selEl.z ?? 0).toFixed(2)} m (${selEl.muro})`;
    } else {
        panelSel.classList.add('oculto');
    }

    // Lista de tramos con selector rápido de vía (Techo / Pared / Contrapiso)
    document.getElementById('ui-cant-tramos').innerText = estadoCroquis.tramos.length;
    const contTramos = document.getElementById('ui-lista-tramos');
    if (estadoCroquis.tramos.length === 0) {
        contTramos.innerHTML = '<div style="text-align:center; padding:10px; font-size:0.78rem; color:var(--ngc-text-faded);">Sin tramos conectados. Usá la herramienta <b>Caño</b> para unir dos cajas.</div>';
    } else {
        contTramos.innerHTML = estadoCroquis.tramos.map((tr, idx) => {
            const a = estadoCroquis.elementos.find(e => e.id === tr.desde);
            const b = estadoCroquis.elementos.find(e => e.id === tr.hasta);
            const dist = calcularLongitudTramo25D(tr);
            const viaActual = tr.via || inferirViaTramo(a, b);
            return `
                <div class="uni-circ-item">
                    <div class="uni-circ-top">
                        <span class="uni-circ-tag"><i class="fa-solid fa-route"></i> ${escapeHtml(a?.tag || '?')} → ${escapeHtml(b?.tag || '?')}</span>
                        <span class="uni-circ-pill">${dist.toFixed(2)} m netos</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:4px;">
                        <select class="corp-input" style="width:auto; padding:4px 8px; font-size:0.75rem;" onchange="cambiarViaTramo(${idx}, this.value)">
                            <option value="TECHO" ${viaActual === 'TECHO' ? 'selected' : ''}>Por Techo</option>
                            <option value="PARED" ${viaActual === 'PARED' ? 'selected' : ''}>Por Pared</option>
                            <option value="CONTRAPISO" ${viaActual === 'CONTRAPISO' ? 'selected' : ''}>Por Contrapiso</option>
                        </select>
                        <span class="uni-circ-details" style="flex:1; text-align:center;">${escapeHtml(tr.rol)}</span>
                        <button type="button" class="corp-btn-small danger" onclick="eliminarTramo(${idx})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Actualizar resumen y listado completo de materiales debajo del croquis
    const pillResumen = document.getElementById('ui-resumen-computo-pill');
    if (pillResumen) {
        pillResumen.innerText = `${comp.items.length} ítems • ${comp.canoTotal} m caño`;
    }

    const contComp = document.getElementById('ui-lista-computo');
    const btnToggleComp = document.getElementById('btnToggleComputo');
    if (contComp) {
        if (comp.items.length === 0) {
            contComp.innerHTML = '<div style="text-align:center; padding:10px; font-size:0.78rem; color:var(--ngc-text-faded);">Agregá elementos y tramos para ver el cómputo de materiales.</div>';
        } else {
            contComp.classList.remove('oculto');
            if (btnToggleComp) {
                btnToggleComp.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Ocultar';
            }
            contComp.innerHTML = comp.items.map(it => `
                <div class="uni-circ-item" style="padding: 8px 10px;">
                    <div class="uni-circ-top">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--ngc-text-main);">${escapeHtml(it.desc)}</span>
                        <span class="uni-circ-pill">${it.cant} ${it.unid}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Dibujar SVG en el contenedor de zoom táctil y en la lámina A4
    const svgHTML = generarSVGCroquis(true);
    const zoomLayer = document.getElementById('zoomLayerSvgCroquis');
    const stage = zoomLayer || document.getElementById('contenedorSvgPantalla');
    if (stage) {
        stage.innerHTML = svgHTML;
        const svgNode = stage.querySelector('svg');
        if (svgNode) {
            svgNode.style.width = '100%';
            svgNode.style.height = 'auto';
            svgNode.style.display = 'block';
            svgNode.style.cursor = 'pointer';
            svgNode.onclick = manejarToqueLienzo;
        }
    }

    actualizarVistaPreviaPDF();
        }

// ==========================================================================
// MOTOR VECTORIAL SVG: CUBO 3D (PERSPECTIVA CENITAL) + PLANTA 2D
// ==========================================================================
function calcularGeometriaPlano(vbW, vbH) {
    const padL = 56, padR = 46, padT = 48, padB = 48;
    const dispW = vbW - padL - padR;
    const dispH = vbH - padT - padB;
    const scale = Math.min(dispW / estadoCroquis.ancho, dispH / estadoCroquis.largo);
    const roomW = estadoCroquis.ancho * scale;
    const roomH = estadoCroquis.largo * scale;
    const ox = padL + (dispW - roomW) / 2;
    const oy = padT + (dispH - roomH) / 2;
    return { ox, oy, roomW, roomH, scale };
}

function factorEscalaPerspectiva3D(z) {
    const alto = Math.max(2, estadoCroquis.alto || 2.60);
    const ratio = Math.max(0, Math.min(1, (z ?? 0) / alto));
    // Piso (z=0) -> 0.70 del tamaño exterior; Techo (z=alto) -> 1.00
    return 0.70 + 0.30 * ratio;
}

function proyectarPunto3D(x, y, z, geom) {
    const basePx = geom.ox + x * geom.scale;
    const basePy = geom.oy + y * geom.scale;
    if (!modoVista3D) {
        return { px: basePx, py: basePy };
    }
    const cx = geom.ox + geom.roomW / 2;
    const cy = geom.oy + geom.roomH / 2;
    const f = factorEscalaPerspectiva3D(z);
    return {
        px: cx + (basePx - cx) * f,
        py: cy + (basePy - cy) * f
    };
}

function generarSVGCroquis(mostrarSeleccion = true) {
    const vbW = 500;
    const vbH = 490;
    const { ox, oy, roomW, roomH, scale } = calcularGeometriaPlano(vbW, vbH);
    const W = estadoCroquis.ancho;
    const L = estadoCroquis.largo;

    let s = `<svg viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">`;
    s += `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#ffffff"/>`;

    // Grilla auxiliar cada 0.50 m
    for (let gx = 0.5; gx < W; gx += 0.5) {
        const px = ox + gx * scale;
        s += `<line x1="${px}" y1="${oy}" x2="${px}" y2="${oy + roomH}" stroke="#f1f5f9" stroke-width="1"/>`;
    }
    for (let gy = 0.5; gy < L; gy += 0.5) {
        const py = oy + gy * scale;
        s += `<line x1="${ox}" y1="${py}" x2="${ox + roomW}" y2="${py}" stroke="#f1f5f9" stroke-width="1"/>`;
    }

    // Muros perimetrales del ambiente
    s += `<rect x="${ox}" y="${oy}" width="${roomW}" height="${roomH}" fill="#fafafa" stroke="#0f172a" stroke-width="5"/>`;

    // Cotas exteriores (Ancho arriba, Largo izquierda)
    s += `<line x1="${ox}" y1="${oy - 22}" x2="${ox + roomW}" y2="${oy - 22}" stroke="#475569" stroke-width="1"/>`;
    s += `<line x1="${ox}" y1="${oy - 27}" x2="${ox}" y2="${oy - 17}" stroke="#475569" stroke-width="1.2"/>`;
    s += `<line x1="${ox + roomW}" y1="${oy - 27}" x2="${ox + roomW}" y2="${oy - 17}" stroke="#475569" stroke-width="1.2"/>`;
    s += `<rect x="${ox + roomW / 2 - 28}" y="${oy - 30}" width="56" height="15" fill="#ffffff"/>`;
    s += `<text x="${ox + roomW / 2}" y="${oy - 19}" fill="#0f172a" font-size="10.5" font-weight="bold" text-anchor="middle">${W.toFixed(2)} m</text>`;

    s += `<line x1="${ox - 22}" y1="${oy}" x2="${ox - 22}" y2="${oy + roomH}" stroke="#475569" stroke-width="1"/>`;
    s += `<line x1="${ox - 27}" y1="${oy}" x2="${ox - 17}" y2="${oy}" stroke="#475569" stroke-width="1.2"/>`;
    s += `<line x1="${ox - 27}" y1="${oy + roomH}" x2="${ox - 17}" y2="${oy + roomH}" stroke="#475569" stroke-width="1.2"/>`;
    s += `<text x="${ox - 28}" y="${oy + roomH / 2}" fill="#0f172a" font-size="10.5" font-weight="bold" text-anchor="middle" transform="rotate(-90 ${ox - 28} ${oy + roomH / 2})">${L.toFixed(2)} m</text>`;

    // Aberturas (Puertas y Ventanas)
    (estadoCroquis.aberturas || []).forEach(ab => {
        const abW = Math.min(ab.ancho, (ab.pared === 'NORTE' || ab.pared === 'SUR') ? W : L) * scale;
        const off = ab.offset * scale;
        let ax = ox, ay = oy, aw = abW, ah = 7;

        if (ab.pared === 'NORTE') { ax = ox + off; ay = oy - 3.5; }
        else if (ab.pared === 'SUR') { ax = ox + off; ay = oy + roomH - 3.5; }
        else if (ab.pared === 'OESTE') { ax = ox - 3.5; ay = oy + off; aw = 7; ah = abW; }
        else if (ab.pared === 'ESTE') { ax = ox + roomW - 3.5; ay = oy + off; aw = 7; ah = abW; }

        s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#ffffff" stroke="#0f172a" stroke-width="1"/>`;
        if (ab.tipo.startsWith('VENTAN')) {
            if (ab.pared === 'NORTE' || ab.pared === 'SUR') {
                s += `<line x1="${ax}" y1="${ay + ah / 2}" x2="${ax + aw}" y2="${ay + ah / 2}" stroke="#0284c7" stroke-width="1.5"/>`;
            } else {
                s += `<line x1="${ax + aw / 2}" y1="${ay}" x2="${ax + aw / 2}" y2="${ay + ah}" stroke="#0284c7" stroke-width="1.5"/>`;
            }
        } else {
            // Arco de barrido de puerta
            if (ab.pared === 'SUR') {
                s += `<line x1="${ax}" y1="${ay + 3.5}" x2="${ax}" y2="${ay + 3.5 - abW}" stroke="#0f172a" stroke-width="1.5"/>`;
                s += `<path d="M ${ax} ${ay + 3.5 - abW} A ${abW} ${abW} 0 0 1 ${ax + abW} ${ay + 3.5}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>`;
            } else if (ab.pared === 'NORTE') {
                s += `<line x1="${ax}" y1="${ay + 3.5}" x2="${ax}" y2="${ay + 3.5 + abW}" stroke="#0f172a" stroke-width="1.5"/>`;
                s += `<path d="M ${ax} ${ay + 3.5 + abW} A ${abW} ${abW} 0 0 0 ${ax + abW} ${ay + 3.5}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>`;
            } else if (ab.pared === 'OESTE') {
                s += `<line x1="${ax + 3.5}" y1="${ay}" x2="${ax + 3.5 + abW}" y2="${ay}" stroke="#0f172a" stroke-width="1.5"/>`;
                s += `<path d="M ${ax + 3.5 + abW} ${ay} A ${abW} ${abW} 0 0 1 ${ax + 3.5} ${ay + abW}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>`;
            } else if (ab.pared === 'ESTE') {
                s += `<line x1="${ax + 3.5}" y1="${ay}" x2="${ax + 3.5 - abW}" y2="${ay}" stroke="#0f172a" stroke-width="1.5"/>`;
                s += `<path d="M ${ax + 3.5 - abW} ${ay} A ${abW} ${abW} 0 0 0 ${ax + 3.5} ${ay + abW}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>`;
            }
        }
    });

    // Tramos de cañería (curva suave o trazo técnico)
    (estadoCroquis.tramos || []).forEach(tr => {
        const a = estadoCroquis.elementos.find(e => e.id === tr.desde);
        const b = estadoCroquis.elementos.find(e => e.id === tr.hasta);
        if (!a || !b) return;

        const x1 = ox + a.x * scale;
        const y1 = oy + a.y * scale;
        const x2 = ox + b.x * scale;
        const y2 = oy + b.y * scale;
        const esBajada = tr.rol.startsWith('BAJADA') || tr.rol === 'COMBINACION';
        const colorLinea = esBajada ? '#ea580c' : '#2563eb';
        const dash = esBajada ? 'stroke-dasharray="4,2"' : '';

        // Curva leve hacia el centro del ambiente para visibilidad limpia
        const cx = (x1 + x2) / 2 + (ox + roomW / 2 - (x1 + x2) / 2) * 0.18;
        const cy = (y1 + y2) / 2 + (oy + roomH / 2 - (y1 + y2) / 2) * 0.18;
        s += `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${colorLinea}" stroke-width="1.8" ${dash}/>`;
    });

    // Cotas dinámicas del elemento seleccionado
    if (mostrarSeleccion && elementoSeleccionadoId) {
        const sel = estadoCroquis.elementos.find(e => e.id === elementoSeleccionadoId);
        if (sel) {
            const sx = ox + sel.x * scale;
            const sy = oy + sel.y * scale;
            s += `<circle cx="${sx}" cy="${sy}" r="18" fill="rgba(35,116,225,0.16)" stroke="#2374E1" stroke-width="1.5" stroke-dasharray="3,2"/>`;
            if (sel.x > 0.05) {
                s += `<line x1="${ox}" y1="${sy}" x2="${sx}" y2="${sy}" stroke="#2374E1" stroke-width="1" stroke-dasharray="2,2"/>`;
                s += `<text x="${(ox + sx) / 2}" y="${sy - 4}" fill="#1d4ed8" font-size="8.5" font-weight="bold" text-anchor="middle">${sel.x.toFixed(2)}m</text>`;
            }
            if (sel.y > 0.05) {
                s += `<line x1="${sx}" y1="${oy}" x2="${sx}" y2="${sy}" stroke="#2374E1" stroke-width="1" stroke-dasharray="2,2"/>`;
                s += `<text x="${sx + 5}" y="${(oy + sy) / 2}" fill="#1d4ed8" font-size="8.5" font-weight="bold">${sel.y.toFixed(2)}m</text>`;
            }
        }
    }

    // Dibujo de símbolos normalizados
    estadoCroquis.elementos.forEach(el => {
        const px = ox + el.x * scale;
        const py = oy + el.y * scale;
        s += dibujarSimboloCroquis(el, px, py);
    });

    // Leyenda inferior en dos renglones centrados (sin superposición en ambientes angostos)
    const centroPlanoX = ox + (roomW / 2);
    const yLinea1 = oy + roomH + 22;
    const yLinea2 = oy + roomH + 38;
    const supM2 = (W * L).toFixed(2);
    const desperdicioPct = estadoCroquis.desperdicio ?? 10;

    s += `<text x="${centroPlanoX.toFixed(1)}" y="${yLinea1.toFixed(1)}" fill="#0f172a" font-size="10" font-weight="bold" text-anchor="middle">${escapeXml(estadoCroquis.nombre.toUpperCase())} • ${W.toFixed(2)} m × ${L.toFixed(2)} m (${supM2} m²)</text>`;
    s += `<text x="${centroPlanoX.toFixed(1)}" y="${yLinea2.toFixed(1)}" fill="#64748b" font-size="8.8" font-weight="bold" text-anchor="middle">Altura: ${estadoCroquis.alto.toFixed(2)} m • Desperdicio: +${desperdicioPct}% • Escala Gráfica AEA 90364</text>`;

    s += `</svg>`;
    return s;
        }
                                         


function dibujarSimboloCroquis(el, x, y) {
    const rot = el.rot || 0;
    let g = `<g transform="translate(${x}, ${y})">`;
    g += `<g transform="rotate(${rot})">`;

    switch (el.tipo) {
        case 'BOCA_TECHO':
            g += `<circle cx="0" cy="0" r="10" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>`;
            g += `<line x1="-7" y1="-7" x2="7" y2="7" stroke="#0f172a" stroke-width="1.4"/>`;
            g += `<line x1="7" y1="-7" x2="-7" y2="7" stroke="#0f172a" stroke-width="1.4"/>`;
            break;
        case 'APLIQUE':
            g += `<line x1="0" y1="0" x2="0" y2="8" stroke="#0f172a" stroke-width="1.8"/>`;
            g += `<circle cx="0" cy="14" r="6.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>`;
            g += `<line x1="-4.5" y1="9.5" x2="4.5" y2="18.5" stroke="#0f172a" stroke-width="1.2"/>`;
            g += `<line x1="4.5" y1="9.5" x2="-4.5" y2="18.5" stroke="#0f172a" stroke-width="1.2"/>`;
            break;
        case 'LLAVE_1P':
        case 'LLAVE_2P':
        case 'LLAVE_3P':
        case 'LLAVE_COMB': {
            const cant = el.tipo === 'LLAVE_3P' ? 3 : (el.tipo === 'LLAVE_2P' ? 2 : 1);
            g += `<circle cx="0" cy="8" r="5" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>`;
            g += `<line x1="0" y1="3" x2="8" y2="-4" stroke="#0f172a" stroke-width="1.6"/>`;
            if (el.tipo === 'LLAVE_COMB') {
                g += `<line x1="0" y1="13" x2="-8" y2="20" stroke="#0f172a" stroke-width="1.6"/>`;
            } else if (cant > 1) {
                g += `<text x="10" y="11" fill="#0f172a" font-size="8" font-weight="bold">×${cant}</text>`;
            }
            break;
        }
        case 'TOMA_10A':
        case 'TOMA_DOBLE':
        case 'TOMA_20A': {
            g += `<line x1="0" y1="0" x2="0" y2="7" stroke="#0f172a" stroke-width="1.8"/>`;
            g += `<path d="M -7 14 A 7 7 0 0 1 7 14" fill="none" stroke="#0f172a" stroke-width="1.8"/>`;
            g += `<line x1="-8" y1="14" x2="8" y2="14" stroke="#0f172a" stroke-width="1.6"/>`;
            if (el.tipo === 'TOMA_DOBLE') {
                g += `<text x="10" y="16" fill="#0f172a" font-size="8" font-weight="bold">×2</text>`;
            } else if (el.tipo === 'TOMA_20A') {
                g += `<text x="10" y="16" fill="#dc2626" font-size="7.5" font-weight="bold">20A</text>`;
            }
            break;
        }
        case 'TABLERO':
            g += `<rect x="-12" y="2" width="24" height="10" fill="#0f172a" stroke="#0f172a" stroke-width="1.4"/>`;
            g += `<line x1="-12" y1="2" x2="12" y2="12" stroke="#ffffff" stroke-width="1.2"/>`;
            break;
        default:
            g += `<rect x="-6" y="3" width="12" height="12" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>`;
            break;
    }

    g += `</g>`;

    let lx = 0, ly = -13;
    if (rot === 0) ly = 26;
    else if (rot === 180) ly = -16;
    else if (rot === 270) { lx = 22; ly = 4; }
    else if (rot === 90) { lx = -22; ly = 4; }

    g += `<rect x="${lx - 13}" y="${ly - 8}" width="26" height="11" rx="2" fill="rgba(255,255,255,0.92)"/>`;
    g += `<text x="${lx}" y="${ly}" fill="#0f172a" font-size="8.5" font-weight="bold" text-anchor="middle">${escapeXml(el.tag)}</text>`;
    g += `</g>`;
    return g;
}

// ==========================================================================
// SINCRONIZACIÓN A4, EXPORTACIÓN PDF Y ENVÍO A MATERIALES
// ==========================================================================
function actualizarVistaPreviaPDF() {
    const hoy = new Date().toLocaleDateString('es-AR');
    const comp = calcularComputo25D();

    document.getElementById('pdf-fecha').innerText = hoy;
    document.getElementById('pdf-cliente').innerText = document.getElementById('cliNombre').value.trim() || '-';
    document.getElementById('pdf-dir').innerText = document.getElementById('cliDireccion').value.trim() || '-';
    document.getElementById('pdf-proyecto').innerText = `${estadoCroquis.nombre} (${estadoCroquis.ancho.toFixed(2)}×${estadoCroquis.largo.toFixed(2)}m)`;
    document.getElementById('pdf-sub-ambiente').innerText = `${estadoCroquis.nombre} • Desperdicio +${estadoCroquis.desperdicio}%`;

    const svgCont = document.getElementById('pdf-svg-container');
    if (svgCont) svgCont.innerHTML = generarSVGCroquis(false);

    const tbody = document.getElementById('pdf-tbody-computo');
    if (comp.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:8px; text-align:center; border:1px solid #cbd5e1; color:#64748b;">Sin elementos o canalizaciones cargadas en el croquis.</td></tr>';
    } else {
        tbody.innerHTML = comp.items.slice(0, 14).map((it, idx) => `
            <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 3.5px 6px; border: 1px solid #cbd5e1; font-weight: 700;">${escapeHtml(it.rubro)}</td>
                <td style="padding: 3.5px 6px; border: 1px solid #cbd5e1;">${escapeHtml(it.desc)}</td>
                <td style="padding: 3.5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800;">${it.cant}</td>
                <td style="padding: 3.5px 6px; border: 1px solid #cbd5e1; text-align: center;">${it.unid}</td>
            </tr>
        `).join('');
    }

    const notas = document.getElementById('obsGenerales').value.trim();
    document.getElementById('pdf-notas-texto').innerText = notas || 'Cotas expresadas en metros desde ejes interiores. Alturas estándar: llaves 1,10 m, tomas 0,30 m, apliques 2,10 m NPT.';

    actualizarPDFHeaders();
}

function actualizarPDFHeaders() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL INDEPENDIENTE';
    const profTel = localStorage.getItem('villaser_conf_telefono') || '';
    const profSlogan = localStorage.getItem('villaser_conf_slogan') || '';
    const profLogo = localStorage.getItem('villaser_conf_logo') || '';
    const profCuit = localStorage.getItem('villaser_conf_cuit') || '';
    const profMatricula = localStorage.getItem('villaser_conf_matricula') || '';

    let profEmail = localStorage.getItem('villaser_conf_email') || '';
    if (!profEmail && typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        profEmail = firebase.auth().currentUser.email || '';
    }

    const lineaContacto = [
        profTel ? `Tel.: ${profTel}` : '',
        profEmail ? `Email: ${profEmail}` : ''
    ].filter(Boolean).join('<br>');

    const elHeaderContacto = document.getElementById('pdf-header-contacto');
    if (elHeaderContacto) elHeaderContacto.innerHTML = lineaContacto;

    const elFirmaSub = document.getElementById('pdf-firma-sub');
    if (elFirmaSub) {
        elFirmaSub.innerText = profMatricula ? `${profNombre} • Mat. ${profMatricula}` : profNombre;
    }

    const elSlogan = document.getElementById('pdf-slogan');
    if (elSlogan) elSlogan.innerText = profSlogan || '¡Electricidad Segura, Hogar Tranquilo!';

    const elTelFooter = document.getElementById('pdf-tel-footer');
    if (elTelFooter) elTelFooter.innerText = profCuit ? `CUIT: ${profCuit}` : '';

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
}

async function convertirSvgCroquisAImagen() {
    const contenedor = document.getElementById('pdf-svg-container');
    if (!contenedor) return () => {};

    const svgOriginalHTML = contenedor.innerHTML;
    const svgEl = contenedor.querySelector('svg');
    if (!svgEl) return () => {};

    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    const ancho = (vb && vb.width) ? vb.width : (parseFloat(svgEl.getAttribute('width')) || 500);
    const alto = (vb && vb.height) ? vb.height : (parseFloat(svgEl.getAttribute('height')) || 500);

    const svgClon = svgEl.cloneNode(true);
    svgClon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClon.setAttribute('width', ancho);
    svgClon.setAttribute('height', alto);

    const xml = new XMLSerializer().serializeToString(svgClon);
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`);

    try {
        const pngDataUrl = await new Promise((resolve, reject) => {
            const imgLoader = new Image();
            imgLoader.onload = () => {
                const escala = 3;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(ancho * escala);
                canvas.height = Math.round(alto * escala);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(escala, escala);
                ctx.drawImage(imgLoader, 0, 0, ancho, alto);
                resolve(canvas.toDataURL('image/png'));
            };
            imgLoader.onerror = reject;
            imgLoader.src = dataUri;
        });

        contenedor.innerHTML = `<img src="${pngDataUrl}" alt="Croquis Eléctrico" style="width: auto; max-width: 100%; height: 340px; object-fit: contain; display: block; margin: 0 auto;">`;
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    } catch (e) {
        console.warn('Respaldo vectorial SVG en PDF:', e);
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    }
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
    }

    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    const modalVista = document.getElementById('modalVistaPrevia');
    const modalAbierto = modalVista && !modalVista.classList.contains('oculto');
    const teniaClaseOculto = element ? element.classList.contains('oculto') : false;
    const padreOriginal = element ? element.parentNode : null;
    let movidoAlBody = false;

    if (!modalAbierto && element) {
        element.classList.remove('oculto');
        element.style.display = 'block';
        if (window.innerWidth < 992) {
            document.body.appendChild(element);
            movidoAlBody = true;
        }
        window.scrollTo(0, 0);
    } else if (pdfContainer) {
        pdfContainer.style.transform = 'none';
    }

    if (element) {
        element.style.width = '794px';
        element.style.height = '1115px';
        element.style.overflow = 'hidden';
    }

    const marcaAgua = document.getElementById('marcaAguaPDF');
    if (marcaAgua) marcaAgua.style.display = 'none';

    let restaurarSvg = () => {};
    try {
        restaurarSvg = await convertirSvgCroquisAImagen();
        const inputNombre = document.getElementById('nombreArchivoPDF');
        const nombreFinal = (inputNombre && inputNombre.value.trim()) || 'Croquis_Electrico';

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
                ignoreElements: el => el.id === 'marcaAguaPDF' || (el.tagName === 'IMG' && !(el.getAttribute('src') || '').startsWith('data:image'))
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
        mostrarToast('Éxito', 'Croquis Eléctrico PDF generado.');

        if (permiteGuardarNube && typeof guardarBorradorFirebase === 'function') {
            try {
                guardarBorradorFirebase(false, true);
            } catch (errNube) {
                console.warn('Aviso respaldo automático:', errNube);
            }
        }
    } catch (error) {
        console.error('Error generando PDF Croquis:', error);
        mostrarAlertaCorp('Error al Exportar', `No se pudo generar el PDF (${error.message || 'error interno'}).`);
    } finally {
        restaurarSvg();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Descargar';
        }
        if (element) {
            element.style.width = '';
            element.style.height = '';
            element.style.overflow = '';
            if (teniaClaseOculto) element.classList.add('oculto');
        }
        if (marcaAgua) marcaAgua.style.display = 'flex';
        if (movidoAlBody && padreOriginal && element) {
            element.style.display = '';
            padreOriginal.appendChild(element);
        } else if (modalAbierto && typeof aplicarEscalaVistaPrevia === 'function') {
            aplicarEscalaVistaPrevia(escalaActualPreview);
        } else if (element && window.innerWidth < 992) {
            element.style.display = 'none';
        }
    }
    }

function generarPDF() {
    actualizarVistaPreviaPDF();
    const cli = document.getElementById('cliNombre').value.trim().replace(/\s+/g, '_') || 'Cliente';
    const amb = (estadoCroquis.nombre || 'Ambiente').replace(/\s+/g, '_');
    const sufijo = Math.floor(Math.random() * 9000) + 1000;
    document.getElementById('nombreArchivoPDF').value = `Croquis_${amb}_${cli}_${sufijo}`;
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

// ==========================================================================
// PUENTE BIDIRECCIONAL: CROQUIS <-> MATERIALES
// ==========================================================================
let materialesEditadosDesdeCatalogo = null;

function exportarComputoAMateriales() {
    const calculo25D = calcularComputo25D();
    const itemsBase = (Array.isArray(materialesEditadosDesdeCatalogo) && materialesEditadosDesdeCatalogo.length > 0)
        ? materialesEditadosDesdeCatalogo
        : calculo25D.items.map((it, idx) => ({
            id: Date.now() + idx,
            material: it.desc,
            cantidad: it.cant,
            unidad: it.unid,
            nota: `${it.rubro} • ${estadoCroquis.nombre || 'Ambiente'}`
        }));

    if (!itemsBase || itemsBase.length === 0) {
        mostrarAlertaCorp('Sin Cómputo', 'Cargá al menos un elemento y tramo en el croquis antes de enviar a Materiales.');
        return;
    }

    const cliNombre = (document.getElementById('cliNombre')?.value || '').trim();
    const cliDireccion = (document.getElementById('cliDireccion')?.value || '').trim();
    const cliProyecto = (document.getElementById('cliProyecto')?.value || '').trim();
    const ambienteNombre = (estadoCroquis.nombre || document.getElementById('ambNombre')?.value || 'Ambiente').trim();
    const desperdicio = parseFloat(document.getElementById('ambDesperdicio')?.value || estadoCroquis.desperdicio || 10);

    localStorage.setItem('villaser_cliente_global', JSON.stringify({
        nombre: cliNombre,
        direccion: cliDireccion,
        proyecto: cliProyecto || `Instalación ${ambienteNombre}`,
        telefono: telefonoClienteActual || ''
    }));

    guardarEstadoLocal(true);

    const paqueteExportacion = {
        origen: 'croquis',
        timestamp: Date.now(),
        cliNombre,
        cliDireccion,
        cliProyecto: cliProyecto || `Instalación ${ambienteNombre}`,
        telefonoClienteActual: telefonoClienteActual || '',
        clienteDesdeAgenda: Boolean(clienteDesdeAgenda),
        permiteGuardarNube: Boolean(permiteGuardarNube),
        ambienteNombre,
        desperdicio,
        items: itemsBase.map((it, idx) => ({
            id: it.id || (Date.now() + idx),
            material: it.material || '',
            cantidad: Number(it.cantidad || 1),
            unidad: it.unidad || 'UNID',
            nota: it.nota || `Croquis: ${ambienteNombre}`
        }))
    };

    localStorage.setItem('villaser_computo_croquis', JSON.stringify(paqueteExportacion));
    window.location.href = '../materiales/index.html?from=croquis';
}

function verificarRetornoDesdeMateriales() {
    const params = new URLSearchParams(window.location.search);
    const retornoRaw = localStorage.getItem('villaser_computo_croquis_return');

    if (!retornoRaw && params.get('from') !== 'materiales') return false;

    try {
        if (retornoRaw) {
            const datosRetorno = JSON.parse(retornoRaw);

            if (Array.isArray(datosRetorno.items)) {
                materialesEditadosDesdeCatalogo = datosRetorno.items;
            }
            if (datosRetorno.cliNombre && document.getElementById('cliNombre')) {
                document.getElementById('cliNombre').value = datosRetorno.cliNombre;
            }
            if (datosRetorno.cliDireccion && document.getElementById('cliDireccion')) {
                document.getElementById('cliDireccion').value = datosRetorno.cliDireccion;
            }
            if (datosRetorno.cliProyecto && document.getElementById('cliProyecto')) {
                document.getElementById('cliProyecto').value = datosRetorno.cliProyecto;
            }
            if (datosRetorno.ambienteNombre) {
                estadoCroquis.nombre = datosRetorno.ambienteNombre;
                if (document.getElementById('ambNombre')) {
                    document.getElementById('ambNombre').value = datosRetorno.ambienteNombre;
                }
            }
            if (datosRetorno.desperdicio !== undefined) {
                estadoCroquis.desperdicio = parseFloat(datosRetorno.desperdicio) || 10;
                if (document.getElementById('ambDesperdicio')) {
                    document.getElementById('ambDesperdicio').value = String(estadoCroquis.desperdicio);
                }
            }
            if (datosRetorno.clienteDesdeAgenda !== undefined) {
                clienteDesdeAgenda = Boolean(datosRetorno.clienteDesdeAgenda);
            }
            if (datosRetorno.permiteGuardarNube !== undefined) {
                permiteGuardarNube = Boolean(datosRetorno.permiteGuardarNube);
            }

            localStorage.removeItem('villaser_computo_croquis_return');
            avanzarPasoTrabajo(true);
            mostrarToast('Cómputo Actualizado', 'Se aplicaron los materiales editados desde el catálogo.');
        }
    } catch (err) {
        console.error('Error al procesar retorno desde Materiales:', err);
        localStorage.removeItem('villaser_computo_croquis_return');
    } finally {
        if (params.has('from')) {
            params.delete('from');
            const nuevaUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
            window.history.replaceState({}, '', nuevaUrl);
        }
    }
    return true;
                          }
                                   

// ==========================================================================
// VISTA PREVIA FULLSCREEN CON ZOOM Y WHATSAPP
// ==========================================================================
let escalaActualPreview = 1;

function abrirVistaPrevia() {
    actualizarVistaPreviaPDF();
    const modal = document.getElementById('modalVistaPrevia');
    const cont = document.getElementById('contenedorVistaPreviaMobile');
    const plantilla = document.getElementById('plantilla-pdf');

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    plantilla.style.display = 'inline-block';
    cont.appendChild(plantilla);

    const anchoDisp = Math.max(280, document.getElementById('areaScrollVistaPrevia').clientWidth - 28);
    escalaActualPreview = Math.min(1, anchoDisp / 794);
    aplicarEscalaVistaPrevia(escalaActualPreview);
}

function aplicarEscalaVistaPrevia(escala) {
    escalaActualPreview = Math.min(1.6, Math.max(0.35, escala));
    const cont = document.getElementById('contenedorVistaPreviaMobile');
    if (cont) {
        cont.style.transform = `scale(${escalaActualPreview})`;
        cont.style.width = `${794 * escalaActualPreview}px`;
        cont.style.height = `${1115 * escalaActualPreview}px`;
    }
    const txt = document.getElementById('txtZoomPreview');
    if (txt) txt.innerText = `${Math.round(escalaActualPreview * 100)}%`;
}

function cambiarZoomPreview(delta) {
    aplicarEscalaVistaPrevia(escalaActualPreview + delta);
}

function cerrarVistaPrevia() {
    const modal = document.getElementById('modalVistaPrevia');
    const plantilla = document.getElementById('plantilla-pdf');
    const aside = document.querySelector('.preview-panel');

    modal.classList.add('oculto');
    document.body.style.overflow = '';

    if (aside && plantilla) {
        plantilla.style.display = '';
        aside.appendChild(plantilla);
    }
}

function toggleAccionesMenu() {
    document.getElementById('accionesMenu').classList.toggle('oculto');
}

function prepararEnvioWhatsApp() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'VILLASER GESTIÓN';
    const cli = document.getElementById('cliNombre').value.trim() || 'Cliente';
    const comp = calcularComputo25D();

    let msg = `*${profNombre.toUpperCase()} - CROQUIS 3D Y CÓMPUTO 2.5D*\n`;
    msg += `*Cliente:* ${cli}\n`;
    msg += `*Ambiente:* ${estadoCroquis.nombre} (${estadoCroquis.ancho.toFixed(2)}×${estadoCroquis.largo.toFixed(2)} m)\n\n`;

    if (comp.items.length > 0) {
        msg += `*Materiales Calculados (+${estadoCroquis.desperdicio}% desp.):*\n`;
        comp.items.forEach(it => {
            msg += `• ${it.cant} ${it.unid} — ${it.desc}\n`;
        });
    }

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, msg);
    }
}

// ==========================================================================
// BORRADORES EN FIREBASE (perfiles/{uid}/borradores_croquis)
// ==========================================================================
function guardarBorradorFirebase(pedirNombre = true, silencioso = false) {
    const uid = obtenerUid();
    if (!uid || !db) {
        if (!silencioso) mostrarAlertaCorp('Sin Sesión', 'No se detectó sesión activa para guardar en la nube.');
        return;
    }
    if (!permiteGuardarNube) {
        if (!silencioso) mostrarAlertaCorp('Cliente no Agendado', 'Vinculá el cliente desde Agenda para respaldar en la nube.');
        return;
    }

    if (pedirNombre) {
        const cli = document.getElementById('cliNombre').value.trim().replace(/\s+/g, '_') || 'Cliente';
        const amb = (estadoCroquis.nombre || 'Ambiente').replace(/\s+/g, '_');
        const fecha = new Date().toISOString().slice(0, 10);
        document.getElementById('inputNombreBorrador').value = nombreBorradorActual || `Croquis_${amb}_${cli}_${fecha}`;
        document.getElementById('modalGuardarBorrador').classList.remove('oculto');
        return;
    }

    const nombreFinal = nombreBorradorActual || `Croquis_${Date.now()}`;
    ejecutarGuardadoEnNube(nombreFinal, silencioso);
}

function cerrarModalGuardarBorrador() {
    document.getElementById('modalGuardarBorrador').classList.add('oculto');
}

function ejecutarGuardarBorrador() {
    const nombre = document.getElementById('inputNombreBorrador').value.trim();
    if (!nombre) {
        mostrarAlertaCorp('Faltan Datos', 'Ingresá un nombre para identificar el borrador.');
        return;
    }
    nombreBorradorActual = nombre;
    cerrarModalGuardarBorrador();
    ejecutarGuardadoEnNube(nombre, false);
}

function normalizarEstadoCroquis(raw) {
    const base = Object.assign(crearPlantillaDormitorio(), raw || {});
    if (!Array.isArray(base.aberturas)) base.aberturas = [];
    if (!Array.isArray(base.elementos)) base.elementos = [];
    if (!Array.isArray(base.tramos)) base.tramos = [];
    return base;
}

function ejecutarGuardadoEnNube(nombreDoc, silencioso) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    const badge = document.getElementById('ui-cloud-badge');
    if (badge) {
        badge.className = 'pres-cloud-pill saving';
        badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    }

    const docId = nombreDoc.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const payload = JSON.parse(JSON.stringify({
        cliNombre: document.getElementById('cliNombre').value.trim(),
        cliDireccion: document.getElementById('cliDireccion').value.trim(),
        cliProyecto: document.getElementById('cliProyecto').value.trim(),
        obsGenerales: document.getElementById('obsGenerales').value,
        estadoCroquis: normalizarEstadoCroquis(estadoCroquis),
        nombreBorrador: nombreDoc,
        telefonoClienteActual: telefonoClienteActual || '',
        fechaGuardado: Date.now()
    }));

    const escritura = db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).set(payload);
    const timeoutNube = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo agotado')), 8000));

    Promise.race([escritura, timeoutNube])
        .then(() => {
            if (badge) {
                badge.className = 'pres-cloud-pill saved';
                badge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
            }
            if (!silencioso) mostrarToast('Guardado en Nube', `Borrador "${nombreDoc}" sincronizado.`);
        })
        .catch(err => {
            console.error('Error guardando croquis:', err);
            if (badge) actualizarBadgeNube();
            if (!silencioso) mostrarAlertaCorp('Error de Nube', 'No se pudo sincronizar con Firebase.');
        });
}

function abrirModalBorradores() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp('Sin Sesión', 'Iniciá sesión para acceder a tus borradores en la nube.');
        return;
    }

    const modal = document.getElementById('modalBorradores');
    const lista = document.getElementById('listaBorradores');
    lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</p>';
    modal.classList.remove('oculto');

    db.collection('perfiles').doc(uid).collection('borradores_croquis').orderBy('fechaGuardado', 'desc').get()
        .then(snap => {
            if (snap.empty) {
                lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No tenés croquis guardados aún.</p>';
                return;
            }
            lista.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const div = document.createElement('div');
                div.className = 'modal-list-item';
                div.innerHTML = `
                    <div style="flex:1; min-width:0;">
                        <h4 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(d.nombreBorrador || doc.id)}</h4>
                        <small>${escapeHtml(d.cliNombre || 'Sin cliente')} • ${escapeHtml(d.estadoCroquis?.nombre || 'Ambiente')}</small>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="corp-btn-small primary-action" onclick="cargarBorradorCroquis('${escapeJs(doc.id)}')">Abrir</button>
                        <button type="button" class="corp-btn-small danger" onclick="confirmarEliminarBorrador('${escapeJs(doc.id)}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                lista.appendChild(div);
            });
        })
        .catch(() => {
            lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al cargar borradores.</p>';
        });
}

function cerrarModalBorradores() {
    document.getElementById('modalBorradores').classList.add('oculto');
}

function cargarBorradorCroquis(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const d = doc.data();
        document.getElementById('cliNombre').value = d.cliNombre || '';
        document.getElementById('cliDireccion').value = d.cliDireccion || '';
        document.getElementById('cliProyecto').value = d.cliProyecto || '';
        document.getElementById('obsGenerales').value = d.obsGenerales || '';
        if (d.estadoCroquis) {
            estadoCroquis = normalizarEstadoCroquis(d.estadoCroquis);
        }

        clienteDesdeAgenda = true;
        permiteGuardarNube = true;
        nombreBorradorActual = d.nombreBorrador || docId;
        telefonoClienteActual = d.telefonoClienteActual || '';

        cerrarModalBorradores();
        avanzarPasoTrabajo(true);
        mostrarToast('Borrador Cargado', `Croquis "${nombreBorradorActual}" listo.`);
    });
}

function confirmarEliminarBorrador(docId) {
    borradorPendienteEliminar = docId;
    document.getElementById('modalConfirmarEliminar').classList.remove('oculto');
}

function cerrarModalEliminarBorrador() {
    borradorPendienteEliminar = null;
    document.getElementById('modalConfirmarEliminar').classList.add('oculto');
}

function ejecutarEliminarBorrador() {
    const uid = obtenerUid();
    if (!uid || !db || !borradorPendienteEliminar) return;
    const idBorrar = borradorPendienteEliminar;
    cerrarModalEliminarBorrador();

    db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(idBorrar).delete()
        .then(() => {
            mostrarToast('Eliminado', 'Borrador borrado de la nube.');
            abrirModalBorradores();
        });
}

// ==========================================================================
// REINICIO DE MÓDULO Y UTILIDADES
// ==========================================================================
function ejecutarNuevoCroquis() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';
    document.getElementById('obsGenerales').value = '';

    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = '';
    elementoSeleccionadoId = null;
    origenConexionId = null;
    resetearZoomPlano();

    estadoCroquis = crearPlantillaDormitorio();
    localStorage.removeItem(STORAGE_KEY_CROQUIS);

    const acc = document.getElementById('accionesMenu');
    if (acc) acc.classList.add('oculto');

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
}

function generarSiguienteTag(prefijo) {
    let n = 1;
    while (estadoCroquis.elementos.some(e => e.tag.toUpperCase() === `${prefijo}${n}`)) {
        n++;
    }
    return `${prefijo}${n}`;
}

function redondear05(val) {
    return Math.round(val * 20) / 20;
}

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
    setTimeout(() => toast.classList.add('mostrar'), 80);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 350);
    }, 3500);
}

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function escapeXml(str) {
    return String(str || '').replace(/[<>&'"]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[m]));
}

function escapeJs(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

