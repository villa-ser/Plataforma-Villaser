// ============================================================================
// MÓDULO CROQUIS ELÉCTRICO DE AMBIENTE (2.5D) - VILLASER GESTIÓN
// ============================================================================

let db = null;
let uidSeguro = null;
let clienteDesdeAgenda = false;
let borradorActualId = null;
let timerAutoguardado = null;
let ultimoComputoGlobal = null;

// ============================================================================
// 1. DICCIONARIO DE SÍMBOLOS VECTORIALES (LISTO PARA LIBREOFFICE DRAW)
// ============================================================================
// CÓMO INCORPORAR TUS DIBUJOS DE LIBREOFFICE DRAW:
// 1. Dibujá el símbolo centrado en la página (o con el punto de apoyo en el centro).
// 2. Exportá desde LibreOffice Draw como SVG (Archivo > Exportar > SVG).
// 3. Abrí el .svg con un editor de texto, copiá las etiquetas <path .../> o <g>...</g>
//    y pegalas dentro de la propiedad `svg` del símbolo correspondiente abajo.
//    (El sistema escala y rota automáticamente cada símbolo según la pared).
// ============================================================================
const SIMBOLOS_CROQUIS = {
    boca_techo: {
        nombre: 'Boca de Techo (Octogonal)',
        tipoMontaje: 'techo',
        zDefault: () => parseFloat(document.getElementById('ambAlto')?.value) || 2.60,
        circuitoDefault: 'C1',
        // Símbolo IRAM / AEA: Círculo con cruz y centro
        svg: `
            <circle cx="0" cy="0" r="10" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="-13" y1="-13" x2="13" y2="13" stroke="#0f172a" stroke-width="1.6"/>
            <line x1="13" y1="-13" x2="-13" y2="13" stroke="#0f172a" stroke-width="1.6"/>
            <circle cx="0" cy="0" r="2.5" fill="#0f172a"/>
        `
    },
    aplique_pared: {
        nombre: 'Aplique de Pared',
        tipoMontaje: 'pared',
        zDefault: () => 2.10,
        circuitoDefault: 'C1',
        // Orientado hacia abajo (+Y = interior del ambiente cuando está en pared Norte)
        svg: `
            <line x1="0" y1="0" x2="0" y2="9" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="16" r="7.5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <line x1="-5" y1="11" x2="5" y2="21" stroke="#0f172a" stroke-width="1.5"/>
            <line x1="5" y1="11" x2="-5" y2="21" stroke="#0f172a" stroke-width="1.5"/>
        `
    },
    llave_1p: {
        nombre: 'Llave 1 Punto (10A)',
        tipoMontaje: 'pared',
        zDefault: () => 1.10,
        circuitoDefault: 'C1',
        svg: `
            <line x1="0" y1="0" x2="0" y2="7" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="12" r="5.5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <polyline points="3.5,16 11,23 15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    llave_2p: {
        nombre: 'Llave 2 Puntos (10A)',
        tipoMontaje: 'pared',
        zDefault: () => 1.10,
        circuitoDefault: 'C1',
        svg: `
            <line x1="0" y1="0" x2="0" y2="7" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="12" r="5.5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <polyline points="3.5,16 11,23 15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
            <polyline points="-3.5,16 -11,23 -15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    llave_3p: {
        nombre: 'Llave 3 Puntos (10A)',
        tipoMontaje: 'pared',
        zDefault: () => 1.10,
        circuitoDefault: 'C1',
        svg: `
            <line x1="0" y1="0" x2="0" y2="7" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="12" r="5.5" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
            <polyline points="3.5,16 11,23 15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
            <polyline points="-3.5,16 -11,23 -15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="0" y1="17.5" x2="0" y2="25" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    llave_comb: {
        nombre: 'Llave Combinación (10A)',
        tipoMontaje: 'pared',
        zDefault: () => 1.10,
        circuitoDefault: 'C1',
        svg: `
            <line x1="0" y1="0" x2="0" y2="7" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="12" r="5.5" fill="#0f172a" stroke="#0f172a" stroke-width="2"/>
            <polyline points="3.5,16 11,23 15,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
            <polyline points="-3.5,8 -11,1 -15,4" fill="none" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    toma_llave: {
        nombre: 'Combinado 1P + 1 Toma 10A',
        tipoMontaje: 'pared',
        zDefault: () => 1.10,
        circuitoDefault: 'C2',
        svg: `
            <line x1="0" y1="0" x2="0" y2="8" stroke="#0f172a" stroke-width="2"/>
            <path d="M -8 16 A 8 8 0 0 1 8 16" fill="none" stroke="#0f172a" stroke-width="2"/>
            <circle cx="0" cy="14" r="4.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
            <polyline points="3,17 10,23 14,20" fill="none" stroke="#0f172a" stroke-width="1.8"/>
        `
    },
    toma_simple: {
        nombre: 'Toma Simple 10A (2P+T)',
        tipoMontaje: 'pared',
        zDefault: () => (document.getElementById('ambNombre')?.value === 'Cocina' ? 1.10 : 0.30),
        circuitoDefault: 'C2',
        svg: `
            <line x1="0" y1="0" x2="0" y2="8" stroke="#0f172a" stroke-width="2"/>
            <path d="M -8 16 A 8 8 0 0 1 8 16" fill="none" stroke="#0f172a" stroke-width="2.2"/>
            <line x1="-10" y1="16" x2="10" y2="16" stroke="#0f172a" stroke-width="1.5"/>
        `
    },
    toma_doble: {
        nombre: 'Toma Doble 10A (2P+T)',
        tipoMontaje: 'pared',
        zDefault: () => (document.getElementById('ambNombre')?.value === 'Cocina' ? 1.10 : 0.30),
        circuitoDefault: 'C2',
        svg: `
            <line x1="0" y1="0" x2="0" y2="8" stroke="#0f172a" stroke-width="2"/>
            <path d="M -8 16 A 8 8 0 0 1 8 16" fill="none" stroke="#0f172a" stroke-width="2.2"/>
            <path d="M -11 21 A 11 11 0 0 1 11 21" fill="none" stroke="#0f172a" stroke-width="1.8"/>
            <text x="0" y="29" font-size="8" font-weight="bold" text-anchor="middle" fill="#0f172a">x2</text>
        `
    },
    toma_20a: {
        nombre: 'Toma Especial 20A (AA / Carga)',
        tipoMontaje: 'pared',
        zDefault: () => 2.20,
        circuitoDefault: 'C3',
        svg: `
            <line x1="0" y1="0" x2="0" y2="8" stroke="#0f172a" stroke-width="2"/>
            <path d="M -9 17 A 9 9 0 0 1 9 17 Z" fill="#0f172a" stroke="#0f172a" stroke-width="2"/>
            <text x="0" y="27" font-size="7.5" font-weight="bold" text-anchor="middle" fill="#0f172a">20A</text>
        `
    },
    tablero: {
        nombre: 'Tablero Seccional / Entrada',
        tipoMontaje: 'pared',
        zDefault: () => 1.50,
        circuitoDefault: 'C1',
        svg: `
            <rect x="-13" y="1" width="26" height="12" fill="#0f172a" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="-13" y1="13" x2="13" y2="1" stroke="#ffffff" stroke-width="1.5"/>
        `
    }
};

// ============================================================================
// 2. ESTADO CENTRAL DEL CROQUIS
// ============================================================================
let estadoCroquis = {
    ambiente: {
        nombre: 'Dormitorio',
        ancho: 3.50,
        largo: 4.00,
        alto: 2.60,
        desperdicio: 10
    },
    aberturas: [
        { id: 'ab_init', tipo: 'puerta', pared: 'sur', ancho: 0.80, offset: 0.30 }
    ],
    nodos: [],   // { id, tipo, x, y, z, pared, rotacion, circuito, label }
    tramos: []   // { id, desde, hasta, rol, trazado, diametro, circuito }
};

let historialUndo = [];
let herramientaActiva = 'select';
let nodoSeleccionadoId = null;
let nodoOrigenConexionId = null;
let tramoPendiente = null; // { desde, hasta, editId }
let zoomPreviewActual = 1;

// ============================================================================
// 3. INICIALIZACIÓN, SESIÓN Y MEMORIA GLOBAL
// ============================================================================
function arrancarModuloCroquis() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (user) {
                        uidSeguro = user.uid;
                        window.currentUserUid = user.uid;
                        actualizarBadgeNube('ready', 'Nube Lista');
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Aviso Firebase:", e);
        actualizarBadgeNube('local', 'Modo Local');
    }

    cargarClienteDesdeMemoriaGlobal();
    restaurarEstadoLocal();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarModuloCroquis);
} else {
    arrancarModuloCroquis();
}

function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof window.currentUserUid !== 'undefined' && window.currentUserUid) return window.currentUserUid;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function') {
        const u = firebase.auth().currentUser;
        if (u) return u.uid;
    }
    return null;
}

function actualizarBadgeNube(estado, texto) {
    const el = document.getElementById('ui-cloud-badge');
    if (!el) return;
    el.className = `pres-cloud-pill ${estado}`;
    const icon = estado === 'saving' ? 'fa-spinner fa-spin' : (estado === 'saved' ? 'fa-cloud-check' : 'fa-cloud');
    el.innerHTML = `<i class="fa-solid ${icon}"></i> ${texto}`;
}

function mostrarToast(titulo, mensaje, esError = false) {
    const toast = document.getElementById('toastNotificacion');
    if (!toast) return;
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMessage').innerText = mensaje;
    const icon = document.getElementById('toastIcon');
    if (esError) {
        toast.style.borderLeftColor = 'var(--error-red)';
        icon.className = 'fa-solid fa-triangle-exclamation';
        icon.style.color = 'var(--error-red)';
    } else {
        toast.style.borderLeftColor = 'var(--success-green)';
        icon.className = 'fa-solid fa-check-circle';
        icon.style.color = 'var(--success-green)';
    }
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 350);
    }, 3200);
}

// Puente con Agenda Global (global.js)
function seleccionarContacto(nombre, dir, tel) {
    document.getElementById('cliNombre').value = nombre || '';
    document.getElementById('cliDireccion').value = dir || '';
    document.getElementById('cliTel').value = tel || '';
    clienteDesdeAgenda = true;
    guardarClienteGlobal();
    cerrarModalAgendaGlobal();
    mostrarToast("Cliente Cargado", `${nombre} seleccionado desde Agenda.`);
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
}

function guardarClienteGlobal() {
    const data = {
        nombre: document.getElementById('cliNombre').value.trim(),
        direccion: document.getElementById('cliDireccion').value.trim(),
        telefono: document.getElementById('cliTel').value.trim(),
        proyecto: document.getElementById('cliProyecto').value.trim()
    };
    localStorage.setItem('villaser_cliente_global', JSON.stringify(data));
}

function cargarClienteDesdeMemoriaGlobal() {
    try {
        const raw = localStorage.getItem('villaser_cliente_global');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.nombre) document.getElementById('cliNombre').value = data.nombre;
        if (data.direccion) document.getElementById('cliDireccion').value = data.direccion;
        if (data.telefono) document.getElementById('cliTel').value = data.telefono;
        if (data.proyecto) document.getElementById('cliProyecto').value = data.proyecto;
    } catch (e) {}
}

function avanzarPasoTrabajo(desdeRestauracion = false) {
    const nombre = document.getElementById('cliNombre').value.trim() || 'Cliente sin nombre';
    const dir = document.getElementById('cliDireccion').value.trim() || 'Sin dirección';
    document.getElementById('lblClienteActivo').innerText = nombre;
    document.getElementById('lblDireccionActiva').innerText = dir;

    document.getElementById('step-cliente').classList.add('oculto');
    const secTrabajo = document.getElementById('step-trabajo');
    secTrabajo.classList.remove('oculto');
    secTrabajo.classList.add('flex-column', 'gap-15');

    if (!desdeRestauracion) {
        programarAutoguardado();
    }
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
}

function volverAEditarCliente() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
}

function reiniciarCroquis() {
    if (!confirm("¿Iniciar un croquis nuevo? Se limpiarán las bocas y cañerías actuales.")) return;
    guardarSnapshotUndo();
    estadoCroquis.nodos = [];
    estadoCroquis.tramos = [];
    estadoCroquis.aberturas = [{ id: 'ab_' + Date.now(), tipo: 'puerta', pared: 'sur', ancho: 0.80, offset: 0.30 }];
    nodoSeleccionadoId = null;
    nodoOrigenConexionId = null;
    borradorActualId = null;
    document.getElementById('obsGenerales').value = '';
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
    mostrarToast("Croquis Reiniciado", "Lienzo listo para nuevo ambiente.");
}

// ============================================================================
// 4. CONFIGURACIÓN GEOMÉTRICA Y ABERTURAS
// ============================================================================
function actualizarAmbiente() {
    const nombre = document.getElementById('ambNombre').value;
    const ancho = Math.max(1.0, Math.min(25.0, parseFloat(document.getElementById('ambAncho').value) || 3.50));
    const largo = Math.max(1.0, Math.min(25.0, parseFloat(document.getElementById('ambLargo').value) || 4.00));
    const alto = Math.max(2.0, Math.min(8.0, parseFloat(document.getElementById('ambAlto').value) || 2.60));
    const desperdicio = parseInt(document.getElementById('ambDesperdicio').value) || 10;

    estadoCroquis.ambiente = { nombre, ancho, largo, alto, desperdicio };

    // Ajustar nodos que excedan el nuevo perímetro y actualizar Z de bocas de techo
    estadoCroquis.nodos.forEach(n => {
        if (n.tipo === 'boca_techo') n.z = alto;
        if (n.pared === 'este') n.x = ancho;
        if (n.pared === 'sur') n.y = largo;
        n.x = Math.min(ancho, Math.max(0, n.x));
        n.y = Math.min(largo, Math.max(0, n.y));
    });

    const sup = (ancho * largo).toFixed(2);
    document.getElementById('lblSupAmbiente').innerText = `${sup} m²`;
    document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;

    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function abrirModalAbertura() {
    renderListaAberturasModal();
    document.getElementById('modalAbertura').classList.remove('oculto');
}

function cerrarModalAbertura() {
    document.getElementById('modalAbertura').classList.add('oculto');
}

function agregarAbertura() {
    const tipo = document.getElementById('abTipo').value;
    const pared = document.getElementById('abPared').value;
    const ancho = Math.max(0.4, parseFloat(document.getElementById('abAncho').value) || 0.80);
    const offset = Math.max(0, parseFloat(document.getElementById('abOffset').value) || 0.20);

    guardarSnapshotUndo();
    estadoCroquis.aberturas.push({
        id: 'ab_' + Date.now(),
        tipo,
        pared,
        ancho,
        offset
    });

    document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;
    renderListaAberturasModal();
    dibujarCroquisSVG();
    programarAutoguardado();
}

function eliminarAbertura(id) {
    guardarSnapshotUndo();
    estadoCroquis.aberturas = estadoCroquis.aberturas.filter(a => a.id !== id);
    document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;
    renderListaAberturasModal();
    dibujarCroquisSVG();
    programarAutoguardado();
}

function renderListaAberturasModal() {
    const cont = document.getElementById('listaAberturasModal');
    if (!cont) return;
    if (estadoCroquis.aberturas.length === 0) {
        cont.innerHTML = `<p style="font-size:0.78rem; color:var(--ngc-text-faded); text-align:center;">Sin aberturas cargadas.</p>`;
        return;
    }
    cont.innerHTML = estadoCroquis.aberturas.map(ab => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--ngc-bg-input); border:1px solid var(--ngc-privacy-border); border-radius:6px; margin-bottom:5px; font-size:0.78rem;">
            <span><b>${ab.tipo === 'puerta' ? 'Puerta' : 'Ventana'}</b> (${ab.pared.toUpperCase()}) - ${ab.ancho.toFixed(2)}m a ${ab.offset.toFixed(2)}m</span>
            <button type="button" onclick="eliminarAbertura('${ab.id}')" style="background:transparent; border:none; color:var(--error-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

// ============================================================================
// 5. HERRAMIENTAS, SNAP A MURO Y GESTIÓN DE NODOS / TRAMOS
// ============================================================================
function seleccionarHerramienta(tool) {
    herramientaActiva = tool;
    nodoOrigenConexionId = null;

    document.querySelectorAll('.tool-pill').forEach(btn => btn.classList.remove('active'));
    const btnActivo = document.getElementById(`tool-${tool}`);
    if (btnActivo) btnActivo.classList.add('active');

    const banner = document.getElementById('bannerModoActivo');
    if (tool === 'select') {
        banner.style.borderLeftColor = 'var(--ngc-neon)';
        banner.innerHTML = '<b>Modo Selección:</b> Tocá una boca para moverla con precisión o editar sus módulos y circuito.';
    } else if (tool === 'conectar') {
        banner.style.borderLeftColor = 'var(--ngc-warning)';
        banner.innerHTML = '<b>Modo Unir Caño:</b> Tocá la <u>boca de origen</u> y luego la <u>boca de destino</u>.';
    } else {
        const info = SIMBOLOS_CROQUIS[tool];
        banner.style.borderLeftColor = 'var(--success-green)';
        const lugar = info?.tipoMontaje === 'techo' ? 'el interior del techo' : 'cerca de una pared (se adosa solo)';
        banner.innerHTML = `<b>Insertar ${info?.nombre || tool}:</b> Tocá ${lugar} en el plano.`;
    }
    dibujarCroquisSVG();
}

function guardarSnapshotUndo() {
    historialUndo.push(JSON.stringify({
        aberturas: estadoCroquis.aberturas,
        nodos: estadoCroquis.nodos,
        tramos: estadoCroquis.tramos
    }));
    if (historialUndo.length > 25) historialUndo.shift();
}

function deshacerUltimaAccion() {
    if (historialUndo.length === 0) {
        mostrarToast("Sin cambios", "No hay acciones previas para deshacer.", true);
        return;
    }
    const prev = JSON.parse(historialUndo.pop());
    estadoCroquis.aberturas = prev.aberturas;
    estadoCroquis.nodos = prev.nodos;
    estadoCroquis.tramos = prev.tramos;
    nodoSeleccionadoId = null;
    nodoOrigenConexionId = null;
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function limpiarSoloPlano() {
    if (estadoCroquis.nodos.length === 0) return;
    if (!confirm("¿Vaciar todas las bocas y cañerías de este ambiente?")) return;
    guardarSnapshotUndo();
    estadoCroquis.nodos = [];
    estadoCroquis.tramos = [];
    nodoSeleccionadoId = null;
    nodoOrigenConexionId = null;
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function centrarBocaTecho() {
    guardarSnapshotUndo();
    const { ancho, largo, alto } = estadoCroquis.ambiente;
    const cx = Math.round((ancho / 2) * 20) / 20;
    const cy = Math.round((largo / 2) * 20) / 20;
    const nuevo = {
        id: 'n_' + Date.now(),
        tipo: 'boca_techo',
        x: cx,
        y: cy,
        z: alto,
        pared: 'techo',
        rotacion: 0,
        circuito: 'C1',
        label: ''
    };
    estadoCroquis.nodos.push(nuevo);
    nodoSeleccionadoId = nuevo.id;
    seleccionarHerramienta('select');
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
    mostrarToast("Boca Centrada", `Ubicada en (${cx.toFixed(2)}m, ${cy.toFixed(2)}m).`);
}

function ajustarPuntoAMuro(x, y, tipoMontaje) {
    const { ancho, largo } = estadoCroquis.ambiente;
    // Grilla de precisión de 0.05m (5 cm)
    let sx = Math.round(Math.min(ancho, Math.max(0, x)) * 20) / 20;
    let sy = Math.round(Math.min(largo, Math.max(0, y)) * 20) / 20;

    if (tipoMontaje === 'techo') {
        sx = Math.min(ancho - 0.15, Math.max(0.15, sx));
        sy = Math.min(largo - 0.15, Math.max(0.15, sy));
        return { x: sx, y: sy, pared: 'techo', rotacion: 0 };
    }

    // Snap automático a la pared más cercana
    const dNorte = sy;
    const dSur = largo - sy;
    const dOeste = sx;
    const dEste = ancho - sx;
    const minD = Math.min(dNorte, dSur, dOeste, dEste);

    if (minD === dNorte) return { x: sx, y: 0, pared: 'norte', rotacion: 0 };
    if (minD === dSur) return { x: sx, y: largo, pared: 'sur', rotacion: 180 };
    if (minD === dOeste) return { x: 0, y: sy, pared: 'oeste', rotacion: 270 };
    return { x: ancho, y: sy, pared: 'este', rotacion: 90 };
}

function onClickLienzo(evt) {
    const svg = document.getElementById('lienzoCroquisSVG');
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const geom = obtenerGeometriaRender();
    const xMetros = (svgPt.x - geom.offsetX) / geom.escala;
    const yMetros = (svgPt.y - geom.offsetY) / geom.escala;

    const { ancho, largo } = estadoCroquis.ambiente;
    // Tolerancia de borde de 0.45m para facilitar toque en paredes
    if (xMetros < -0.45 || xMetros > ancho + 0.45 || yMetros < -0.45 || yMetros > largo + 0.45) {
        return;
    }

    // Buscar si tocó cerca de algún nodo existente (radio 0.35m)
    let nodoTocado = null;
    let minDist = 0.38;
    estadoCroquis.nodos.forEach(n => {
        const d = Math.hypot(n.x - xMetros, n.y - yMetros);
        if (d < minDist) {
            minDist = d;
            nodoTocado = n;
        }
    });

    if (herramientaActiva === 'select') {
        nodoSeleccionadoId = nodoTocado ? nodoTocado.id : null;
        actualizarBarraPrecision();
        dibujarCroquisSVG();
        return;
    }

    if (herramientaActiva === 'conectar') {
        if (!nodoTocado) {
            mostrarToast("Tocá una boca", "Seleccioná una boca existente para iniciar o cerrar el caño.", true);
            return;
        }
        if (!nodoOrigenConexionId) {
            nodoOrigenConexionId = nodoTocado.id;
            nodoSeleccionadoId = nodoTocado.id;
            dibujarCroquisSVG();
            return;
        }
        if (nodoOrigenConexionId === nodoTocado.id) {
            nodoOrigenConexionId = null;
            dibujarCroquisSVG();
            return;
        }
        // Abrir modal de configuración de tramo entre nodoOrigenConexionId y nodoTocado.id
        abrirModalNuevoTramo(nodoOrigenConexionId, nodoTocado.id);
        nodoOrigenConexionId = null;
        dibujarCroquisSVG();
        return;
    }

    // Insertar nuevo artefacto
    const def = SIMBOLOS_CROQUIS[herramientaActiva];
    if (!def) return;

    guardarSnapshotUndo();
    const pos = ajustarPuntoAMuro(xMetros, yMetros, def.tipoMontaje);
    const nuevoNodo = {
        id: 'n_' + Date.now(),
        tipo: herramientaActiva,
        x: pos.x,
        y: pos.y,
        z: def.zDefault(),
        pared: pos.pared,
        rotacion: pos.rotacion,
        circuito: def.circuitoDefault,
        label: ''
    };
    estadoCroquis.nodos.push(nuevoNodo);
    nodoSeleccionadoId = nuevoNodo.id;
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function moverElementoSeleccionado(dx, dy) {
    if (!nodoSeleccionadoId) return;
    const n = estadoCroquis.nodos.find(item => item.id === nodoSeleccionadoId);
    if (!n) return;

    guardarSnapshotUndo();
    const { ancho, largo } = estadoCroquis.ambiente;

    if (n.pared === 'techo') {
        n.x = Math.round(Math.min(ancho - 0.1, Math.max(0.1, n.x + dx)) * 20) / 20;
        n.y = Math.round(Math.min(largo - 0.1, Math.max(0.1, n.y + dy)) * 20) / 20;
    } else if (n.pared === 'norte' || n.pared === 'sur') {
        n.x = Math.round(Math.min(ancho, Math.max(0, n.x + dx)) * 20) / 20;
    } else {
        n.y = Math.round(Math.min(largo, Math.max(0, n.y + dy)) * 20) / 20;
    }

    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function actualizarBarraPrecision() {
    const barra = document.getElementById('barraPrecisionElemento');
    if (!barra) return;
    const n = estadoCroquis.nodos.find(item => item.id === nodoSeleccionadoId);
    if (!n) {
        barra.classList.add('oculto');
        return;
    }
    const def = SIMBOLOS_CROQUIS[n.tipo];
    document.getElementById('lblSelNombre').innerText = `${def?.nombre || n.tipo} [${n.circuito}]`;
    document.getElementById('lblSelCoords').innerText = `X: ${n.x.toFixed(2)}m | Y: ${n.y.toFixed(2)}m | Z: ${n.z.toFixed(2)}m`;
    barra.classList.remove('oculto');
}

// Modal Edición de Elemento
function abrirModalElementoSeleccionado() {
    const n = estadoCroquis.nodos.find(item => item.id === nodoSeleccionadoId);
    if (!n) return;
    document.getElementById('editElemId').value = n.id;
    document.getElementById('editElemTipo').value = n.tipo;
    document.getElementById('editElemCircuito').value = n.circuito;
    document.getElementById('editElemZ').value = n.z;
    document.getElementById('editElemX').value = n.x;
    document.getElementById('editElemY').value = n.y;
    document.getElementById('editElemLabel').value = n.label || '';
    document.getElementById('modalEditarElemento').classList.remove('oculto');
}

function cerrarModalElemento() {
    document.getElementById('modalEditarElemento').classList.add('oculto');
}

function onCambioTipoElementoModal() {
    const tipo = document.getElementById('editElemTipo').value;
    const def = SIMBOLOS_CROQUIS[tipo];
    if (def) {
        document.getElementById('editElemZ').value = def.zDefault();
        document.getElementById('editElemCircuito').value = def.circuitoDefault;
    }
}

function guardarEdicionElemento() {
    const id = document.getElementById('editElemId').value;
    const n = estadoCroquis.nodos.find(item => item.id === id);
    if (!n) return;

    guardarSnapshotUndo();
    const nuevoTipo = document.getElementById('editElemTipo').value;
    const def = SIMBOLOS_CROQUIS[nuevoTipo];
    const nx = parseFloat(document.getElementById('editElemX').value) || 0;
    const ny = parseFloat(document.getElementById('editElemY').value) || 0;
    const nz = parseFloat(document.getElementById('editElemZ').value) || 0;

    n.tipo = nuevoTipo;
    n.circuito = document.getElementById('editElemCircuito').value;
    n.z = Math.max(0, nz);
    n.label = document.getElementById('editElemLabel').value.trim();

    const pos = ajustarPuntoAMuro(nx, ny, def?.tipoMontaje || 'pared');
    n.x = pos.x;
    n.y = pos.y;
    n.pared = pos.pared;
    n.rotacion = pos.rotacion;

    cerrarModalElemento();
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function eliminarElementoModal() {
    const id = document.getElementById('editElemId').value;
    guardarSnapshotUndo();
    estadoCroquis.nodos = estadoCroquis.nodos.filter(n => n.id !== id);
    estadoCroquis.tramos = estadoCroquis.tramos.filter(t => t.desde !== id && t.hasta !== id);
    nodoSeleccionadoId = null;
    cerrarModalElemento();
    actualizarBarraPrecision();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

// ============================================================================
// 6. CONFIGURACIÓN DE TRAMOS DE CAÑERÍA
// ============================================================================
function abrirModalNuevoTramo(desdeId, hastaId) {
    const nA = estadoCroquis.nodos.find(n => n.id === desdeId);
    const nB = estadoCroquis.nodos.find(n => n.id === hastaId);
    if (!nA || !nB) return;

    tramoPendiente = { desde: desdeId, hasta: hastaId, editId: null };
    document.getElementById('tramoResumenEndpoints').innerText =
        `Desde: ${SIMBOLOS_CROQUIS[nA.tipo]?.nombre || nA.tipo} → Hasta: ${SIMBOLOS_CROQUIS[nB.tipo]?.nombre || nB.tipo}`;
    document.getElementById('tramoRol').value = 'auto';
    document.getElementById('tramoTrazado').value = (nA.pared === 'techo' || nB.pared === 'techo') ? 'losa' : 'ortogonal';
    document.getElementById('tramoDiametro').value = '3/4';
    document.getElementById('tramoCircuito').value = nB.circuito || nA.circuito || 'C1';
    document.getElementById('btnEliminarTramoModal').classList.add('oculto');
    document.getElementById('modalConfigTramo').classList.remove('oculto');
}

function editarTramo(tramoId) {
    const t = estadoCroquis.tramos.find(item => item.id === tramoId);
    if (!t) return;
    const nA = estadoCroquis.nodos.find(n => n.id === t.desde);
    const nB = estadoCroquis.nodos.find(n => n.id === t.hasta);
    tramoPendiente = { desde: t.desde, hasta: t.hasta, editId: t.id };
    document.getElementById('tramoResumenEndpoints').innerText =
        `Editando tramo: ${SIMBOLOS_CROQUIS[nA?.tipo]?.nombre || 'Boca'} ↔ ${SIMBOLOS_CROQUIS[nB?.tipo]?.nombre || 'Boca'}`;
    document.getElementById('tramoRol').value = t.rol;
    document.getElementById('tramoTrazado').value = t.trazado;
    document.getElementById('tramoDiametro').value = t.diametro;
    document.getElementById('tramoCircuito').value = t.circuito;
    document.getElementById('btnEliminarTramoModal').classList.remove('oculto');
    document.getElementById('modalConfigTramo').classList.remove('oculto');
}

function cerrarModalTramo() {
    tramoPendiente = null;
    document.getElementById('modalConfigTramo').classList.add('oculto');
}

function confirmarTramo() {
    if (!tramoPendiente) return;
    guardarSnapshotUndo();

    const datos = {
        rol: document.getElementById('tramoRol').value,
        trazado: document.getElementById('tramoTrazado').value,
        diametro: document.getElementById('tramoDiametro').value,
        circuito: document.getElementById('tramoCircuito').value
    };

    if (tramoPendiente.editId) {
        const idx = estadoCroquis.tramos.findIndex(t => t.id === tramoPendiente.editId);
        if (idx !== -1) {
            estadoCroquis.tramos[idx] = { ...estadoCroquis.tramos[idx], ...datos };
        }
    } else {
        estadoCroquis.tramos.push({
            id: 't_' + Date.now(),
            desde: tramoPendiente.desde,
            hasta: tramoPendiente.hasta,
            ...datos
        });
    }

    cerrarModalTramo();
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function eliminarTramo(tramoId) {
    guardarSnapshotUndo();
    estadoCroquis.tramos = estadoCroquis.tramos.filter(t => t.id !== tramoId);
    dibujarCroquisSVG();
    recalcularYRenderizarMateriales();
    programarAutoguardado();
}

function eliminarTramoActual() {
    if (tramoPendiente?.editId) {
        eliminarTramo(tramoPendiente.editId);
    }
    cerrarModalTramo();
}

// ============================================================================
// 7. MOTOR DE RENDERIZADO VECTORIAL SVG (PLANTA ACOTADA + SIMBOLOGÍA)
// ============================================================================
function obtenerGeometriaRender() {
    const svgW = 500;
    const svgH = 520;
    const margen = 62;
    const { ancho, largo } = estadoCroquis.ambiente;
    const escalaX = (svgW - margen * 2) / ancho;
    const escalaY = (svgH - margen * 2 - 20) / largo;
    const escala = Math.min(escalaX, escalaY);
    const dibujoW = ancho * escala;
    const dibujoH = largo * escala;
    const offsetX = (svgW - dibujoW) / 2;
    const offsetY = (svgH - dibujoH) / 2 + 8;
    return { svgW, svgH, escala, dibujoW, dibujoH, offsetX, offsetY };
}

function generarMarkupSVG(esParaPDF = false) {
    const { ancho, largo, alto, nombre } = estadoCroquis.ambiente;
    const { escala, dibujoW, dibujoH, offsetX, offsetY } = obtenerGeometriaRender();

    let out = '';

    // 1. Fondo y Cuadrícula cada 0.50m
    out += `<rect x="0" y="0" width="500" height="520" fill="#ffffff"/>`;
    out += `<text x="250" y="22" font-size="12.5" font-weight="800" text-anchor="middle" fill="#0f172a" font-family="Arial, sans-serif">PLANTA: ${nombre.toUpperCase()} (${ancho.toFixed(2)}m × ${largo.toFixed(2)}m | H=${alto.toFixed(2)}m)</text>`;

    // Grilla 0.50m
    for (let gx = 0.5; gx < ancho; gx += 0.5) {
        const px = offsetX + gx * escala;
        out += `<line x1="${px}" y1="${offsetY}" x2="${px}" y2="${offsetY + dibujoH}" stroke="#e2e8f0" stroke-width="0.8"/>`;
    }
    for (let gy = 0.5; gy < largo; gy += 0.5) {
        const py = offsetY + gy * escala;
        out += `<line x1="${offsetX}" y1="${py}" x2="${offsetX + dibujoW}" y2="${py}" stroke="#e2e8f0" stroke-width="0.8"/>`;
    }

    // 2. Muros Perimetrales
    out += `<rect x="${offsetX}" y="${offsetY}" width="${dibujoW}" height="${dibujoH}" fill="none" stroke="#1e293b" stroke-width="5"/>`;

    // 3. Cotas Generales Exteriores (Ancho arriba, Largo a la izquierda)
    const yCotaSup = offsetY - 18;
    out += `<line x1="${offsetX}" y1="${yCotaSup}" x2="${offsetX + dibujoW}" y2="${yCotaSup}" stroke="#475569" stroke-width="1"/>`;
    out += `<line x1="${offsetX}" y1="${yCotaSup - 4}" x2="${offsetX}" y2="${yCotaSup + 4}" stroke="#475569" stroke-width="1.2"/>`;
    out += `<line x1="${offsetX + dibujoW}" y1="${yCotaSup - 4}" x2="${offsetX + dibujoW}" y2="${yCotaSup + 4}" stroke="#475569" stroke-width="1.2"/>`;
    out += `<text x="${offsetX + dibujoW / 2}" y="${yCotaSup - 4}" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#334155">${ancho.toFixed(2)} m</text>`;

    const xCotaIzq = offsetX - 18;
    out += `<line x1="${xCotaIzq}" y1="${offsetY}" x2="${xCotaIzq}" y2="${offsetY + dibujoH}" stroke="#475569" stroke-width="1"/>`;
    out += `<line x1="${xCotaIzq - 4}" y1="${offsetY}" x2="${xCotaIzq + 4}" y2="${offsetY}" stroke="#475569" stroke-width="1.2"/>`;
    out += `<line x1="${xCotaIzq - 4}" y1="${offsetY + dibujoH}" x2="${xCotaIzq + 4}" y2="${offsetY + dibujoH}" stroke="#475569" stroke-width="1.2"/>`;
    out += `<text x="${xCotaIzq - 6}" y="${offsetY + dibujoH / 2}" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#334155" transform="rotate(-90 ${xCotaIzq - 6} ${offsetY + dibujoH / 2})">${largo.toFixed(2)} m</text>`;

    // 4. Aberturas (Puertas con arco de barrido y Ventanas)
    estadoCroquis.aberturas.forEach(ab => {
        const wPx = Math.min(ab.ancho * escala, (ab.pared === 'norte' || ab.pared === 'sur') ? dibujoW : dibujoH);
        const offPx = ab.offset * escala;

        if (ab.pared === 'sur') {
            const x1 = offsetX + Math.min(dibujoW - wPx, offPx);
            const y1 = offsetY + dibujoH;
            out += `<line x1="${x1}" y1="${y1}" x2="${x1 + wPx}" y2="${y1}" stroke="#ffffff" stroke-width="6"/>`;
            if (ab.tipo === 'puerta') {
                out += `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 - wPx}" stroke="#64748b" stroke-width="1.8"/>`;
                out += `<path d="M ${x1} ${y1 - wPx} A ${wPx} ${wPx} 0 0 1 ${x1 + wPx} ${y1}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`;
            } else {
                out += `<rect x="${x1}" y="${y1 - 2.5}" width="${wPx}" height="5" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>`;
            }
        } else if (ab.pared === 'norte') {
            const x1 = offsetX + Math.min(dibujoW - wPx, offPx);
            const y1 = offsetY;
            out += `<line x1="${x1}" y1="${y1}" x2="${x1 + wPx}" y2="${y1}" stroke="#ffffff" stroke-width="6"/>`;
            if (ab.tipo === 'puerta') {
                out += `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 + wPx}" stroke="#64748b" stroke-width="1.8"/>`;
                out += `<path d="M ${x1} ${y1 + wPx} A ${wPx} ${wPx} 0 0 0 ${x1 + wPx} ${y1}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`;
            } else {
                out += `<rect x="${x1}" y="${y1 - 2.5}" width="${wPx}" height="5" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>`;
            }
        } else if (ab.pared === 'oeste') {
            const x1 = offsetX;
            const y1 = offsetY + Math.min(dibujoH - wPx, offPx);
            out += `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 + wPx}" stroke="#ffffff" stroke-width="6"/>`;
            if (ab.tipo === 'puerta') {
                out += `<line x1="${x1}" y1="${y1}" x2="${x1 + wPx}" y2="${y1}" stroke="#64748b" stroke-width="1.8"/>`;
                out += `<path d="M ${x1 + wPx} ${y1} A ${wPx} ${wPx} 0 0 1 ${x1} ${y1 + wPx}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`;
            } else {
                out += `<rect x="${x1 - 2.5}" y="${y1}" width="5" height="${wPx}" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>`;
            }
        } else if (ab.pared === 'este') {
            const x1 = offsetX + dibujoW;
            const y1 = offsetY + Math.min(dibujoH - wPx, offPx);
            out += `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 + wPx}" stroke="#ffffff" stroke-width="6"/>`;
            if (ab.tipo === 'puerta') {
                out += `<line x1="${x1}" y1="${y1}" x2="${x1 - wPx}" y2="${y1}" stroke="#64748b" stroke-width="1.8"/>`;
                out += `<path d="M ${x1 - wPx} ${y1} A ${wPx} ${wPx} 0 0 0 ${x1} ${y1 + wPx}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`;
            } else {
                out += `<rect x="${x1 - 2.5}" y="${y1}" width="5" height="${wPx}" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>`;
            }
        }
    });

    // 5. Cañerías / Tramos Conectados
    estadoCroquis.tramos.forEach(t => {
        const nA = estadoCroquis.nodos.find(n => n.id === t.desde);
        const nB = estadoCroquis.nodos.find(n => n.id === t.hasta);
        if (!nA || !nB) return;

        const x1 = offsetX + nA.x * escala;
        const y1 = offsetY + nA.y * escala;
        const x2 = offsetX + nB.x * escala;
        const y2 = offsetY + nB.y * escala;

        const colorTramo = t.circuito === 'C1' ? '#0284c7' : (t.circuito === 'C2' ? '#d97706' : '#dc2626');
        const dash = t.trazado === 'ortogonal' ? 'stroke-dasharray="5 3"' : '';

        if (t.trazado === 'ortogonal') {
            // Trazado en L por pared/piso
            const midX = x1;
            const midY = y2;
            out += `<polyline points="${x1},${y1} ${midX},${midY} ${x2},${y2}" fill="none" stroke="${colorTramo}" stroke-width="2" ${dash}/>`;
        } else {
            // Curva suave en losa
            const cx = (x1 + x2) / 2 - (y2 - y1) * 0.14;
            const cy = (y1 + y2) / 2 + (x2 - x1) * 0.14;
            out += `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${colorTramo}" stroke-width="2"/>`;
        }

        // Etiqueta de longitud 2.5D en el punto medio del tramo
        const largo25D = calcularLongitudTramo25D(nA, nB, t.trazado).neto;
        const lx = (x1 + x2) / 2;
        const ly = (y1 + y2) / 2 - 5;
        out += `<rect x="${lx - 18}" y="${ly - 8}" width="36" height="12" rx="3" fill="#ffffff" stroke="${colorTramo}" stroke-width="0.8"/>`;
        out += `<text x="${lx}" y="${ly + 1}" font-size="8" font-weight="bold" text-anchor="middle" fill="${colorTramo}">${largo25D.toFixed(1)}m</text>`;
    });

    // 6. Cotas parciales del nodo seleccionado (solo en pantalla interactiva)
    if (!esParaPDF && nodoSeleccionadoId) {
        const sel = estadoCroquis.nodos.find(n => n.id === nodoSeleccionadoId);
        if (sel) {
            const sx = offsetX + sel.x * escala;
            const sy = offsetY + sel.y * escala;
            if (sel.x > 0.05) {
                out += `<line x1="${offsetX}" y1="${sy}" x2="${sx}" y2="${sy}" stroke="#0088aa" stroke-width="1" stroke-dasharray="3 2"/>`;
                out += `<text x="${(offsetX + sx) / 2}" y="${sy - 4}" font-size="9" font-weight="bold" text-anchor="middle" fill="#0088aa">${sel.x.toFixed(2)}m</text>`;
            }
            if (sel.y > 0.05) {
                out += `<line x1="${sx}" y1="${offsetY}" x2="${sx}" y2="${sy}" stroke="#0088aa" stroke-width="1" stroke-dasharray="3 2"/>`;
                out += `<text x="${sx + 6}" y="${(offsetY + sy) / 2}" font-size="9" font-weight="bold" fill="#0088aa">${sel.y.toFixed(2)}m</text>`;
            }
        }
    }

    // 7. Bocas / Artefactos Vectoriales
    estadoCroquis.nodos.forEach(n => {
        const px = offsetX + n.x * escala;
        const py = offsetY + n.y * escala;
        const def = SIMBOLOS_CROQUIS[n.tipo];
        const esSel = !esParaPDF && (n.id === nodoSeleccionadoId || n.id === nodoOrigenConexionId);

        out += `<g transform="translate(${px}, ${py})">`;
        if (esSel) {
            out += `<circle cx="0" cy="0" r="18" fill="rgba(0, 212, 255, 0.22)" stroke="#0088aa" stroke-width="1.5" stroke-dasharray="3 2"/>`;
        }
        out += `<g transform="rotate(${n.rotacion || 0})">${def ? def.svg : '<circle r="6" fill="#000"/>'}</g>`;

        // Etiqueta de circuito / referencia
        const tag = n.label ? `${n.circuito} (${n.label})` : n.circuito;
        const tagY = n.pared === 'norte' ? 32 : (n.pared === 'sur' ? -24 : -16);
        out += `<text x="0" y="${tagY}" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#0f172a">${tag}</text>`;
        out += `</g>`;
    });

    // 8. Leyenda inferior de colores de circuito
    out += `
        <g transform="translate(24, 502)" font-size="9" font-family="Arial, sans-serif" fill="#334155">
            <line x1="0" y1="0" x2="18" y2="0" stroke="#0284c7" stroke-width="2.5"/><text x="23" y="3">C1 (IUG)</text>
            <line x1="85" y1="0" x2="103" y2="0" stroke="#d97706" stroke-width="2.5"/><text x="108" y="3">C2 (TUG)</text>
            <line x1="170" y1="0" x2="188" y2="0" stroke="#dc2626" stroke-width="2.5"/><text x="193" y="3">C3/C4 (ESP)</text>
            <line x1="275" y1="0" x2="293" y2="0" stroke="#475569" stroke-width="2" stroke-dasharray="4 2"/><text x="298" y="3">Pared/Piso</text>
            <line x1="375" y1="0" x2="393" y2="0" stroke="#475569" stroke-width="2"/><text x="398" y="3">En Losa</text>
        </g>
    `;

    return out;
}

function dibujarCroquisSVG() {
    const svg = document.getElementById('lienzoCroquisSVG');
    if (!svg) return;
    svg.innerHTML = generarMarkupSVG(false);
    svg.onclick = onClickLienzo;
}

// ============================================================================
// 8. MOTOR DE CÓMPUTO 2.5D (CAJAS, MÓDULOS, CAÑERÍAS Y CONDUCTORES)
// ============================================================================
function calcularLongitudTramo25D(nA, nB, trazado) {
    const dx = Math.abs(nB.x - nA.x);
    const dy = Math.abs(nB.y - nA.y);
    const dxy = (trazado === 'ortogonal') ? (dx + dy) : Math.hypot(dx, dy);
    const dz = Math.abs((nB.z || 0) - (nA.z || 0));
    // +0.30m por acometida en ambas cajas (0.15m c/u)
    const neto = dxy + dz + 0.30;
    const desp = (estadoCroquis.ambiente.desperdicio || 10) / 100;
    const conDesp = neto * (1 + desp);
    return { neto, conDesp };
}

function deducirConductoresTramo(tramo, nA, nB) {
    let rol = tramo.rol;
    if (rol === 'auto') {
        const tipos = [nA?.tipo, nB?.tipo];
        if (tipos.includes('llave_3p')) rol = 'bajada_3p';
        else if (tipos.includes('llave_2p')) rol = 'bajada_2p';
        else if (tipos.includes('llave_comb')) rol = 'combinacion';
        else if (tipos.includes('toma_llave')) rol = 'toma_llave';
        else if (tipos.includes('llave_1p') && (tipos.includes('boca_techo') || tipos.includes('aplique_pared'))) rol = 'bajada_1p';
        else if (tramo.circuito === 'C1') rol = 'troncal_iug';
        else if (tramo.circuito === 'C2') rol = 'troncal_tug';
        else rol = 'troncal_tue';
    }

    switch (rol) {
        case 'bajada_1p':
            return [
                { seccion: '1.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Blanco / Negro (Retorno)', hilos: 1 }
            ];
        case 'bajada_2p':
            return [
                { seccion: '1.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Blanco / Negro (Retornos)', hilos: 2 }
            ];
        case 'bajada_3p':
            return [
                { seccion: '1.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Blanco / Negro (Retornos)', hilos: 3 }
            ];
        case 'combinacion':
            return [
                { seccion: '1.5 mm²', color: 'Negro (Puentes Combinación)', hilos: 2 },
                { seccion: '1.5 mm²', color: 'Blanco (Retorno / Fase)', hilos: 1 }
            ];
        case 'toma_llave':
            return [
                { seccion: '2.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '2.5 mm²', color: 'Celeste (Neutro)', hilos: 1 },
                { seccion: '2.5 mm²', color: 'Verde-Amarillo (PE Tierra)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Blanco (Retorno Luz)', hilos: 1 }
            ];
        case 'troncal_iug':
            return [
                { seccion: '1.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Celeste (Neutro)', hilos: 1 },
                { seccion: '1.5 mm²', color: 'Verde-Amarillo (PE Tierra)', hilos: 1 }
            ];
        case 'troncal_tue':
            return [
                { seccion: '4.0 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '4.0 mm²', color: 'Celeste (Neutro)', hilos: 1 },
                { seccion: '4.0 mm²', color: 'Verde-Amarillo (PE Tierra)', hilos: 1 }
            ];
        case 'troncal_tug':
        default:
            return [
                { seccion: '2.5 mm²', color: 'Marrón (Fase)', hilos: 1 },
                { seccion: '2.5 mm²', color: 'Celeste (Neutro)', hilos: 1 },
                { seccion: '2.5 mm²', color: 'Verde-Amarillo (PE Tierra)', hilos: 1 }
            ];
    }
}

function recalcularYRenderizarMateriales() {
    const itemsMap = new Map();
    const sumarItem = (rubro, desc, neto, conDesp, unidad) => {
        const key = `${rubro}||${desc}`;
        if (!itemsMap.has(key)) {
            itemsMap.set(key, { rubro, desc, neto: 0, conDesp: 0, unidad });
        }
        const entry = itemsMap.get(key);
        entry.neto += neto;
        entry.conDesp += conDesp;
    };

    // 1. Conteo de Cajas, Bastidores, Tapas y Módulos por cada Boca
    estadoCroquis.nodos.forEach(n => {
        switch (n.tipo) {
            case 'boca_techo':
                sumarItem('Cajas y Accesorios', 'Caja Octogonal Grande (Techo)', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Gancho Centro / Tapa Octogonal', 1, 1, 'un');
                break;
            case 'aplique_pared':
                sumarItem('Cajas y Accesorios', 'Caja Octogonal Chica (Pared)', 1, 1, 'un');
                break;
            case 'llave_1p':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Interruptor 1 Punto 10A', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 2, 2, 'un');
                break;
            case 'llave_2p':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Interruptor 1 Punto 10A', 2, 2, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 1, 1, 'un');
                break;
            case 'llave_3p':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Interruptor 1 Punto 10A', 3, 3, 'un');
                break;
            case 'llave_comb':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Interruptor Combinación 10A', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 2, 2, 'un');
                break;
            case 'toma_llave':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Interruptor 1 Punto 10A', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Tomacorriente 10A (2P+T)', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 1, 1, 'un');
                break;
            case 'toma_simple':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Tomacorriente 10A (2P+T)', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 2, 2, 'un');
                break;
            case 'toma_doble':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Tomacorriente 10A (2P+T)', 2, 2, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 1, 1, 'un');
                break;
            case 'toma_20a':
                sumarItem('Cajas y Accesorios', 'Caja Rectangular 10x5 cm', 1, 1, 'un');
                sumarItem('Cajas y Accesorios', 'Bastidor + Tapa 10x5 cm', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Tomacorriente 20A (2P+T)', 1, 1, 'un');
                sumarItem('Módulos y Mecanismos', 'Módulo Ciego (Tapón)', 2, 2, 'un');
                break;
            case 'tablero':
                sumarItem('Cajas y Accesorios', 'Gabinete Tablero Seccional (s/ proyecto)', 1, 1, 'un');
                break;
        }
    });

    // 2. Conteo de Cañerías, Conectores y Conductores por Tramo
    let totalMetrosCano = 0;
    let totalMetrosCable = 0;
    const despFactor = 1 + ((estadoCroquis.ambiente.desperdicio || 10) / 100);

    estadoCroquis.tramos.forEach(t => {
        const nA = estadoCroquis.nodos.find(n => n.id === t.desde);
        const nB = estadoCroquis.nodos.find(n => n.id === t.hasta);
        if (!nA || !nB) return;

        const long = calcularLongitudTramo25D(nA, nB, t.trazado);
        totalMetrosCano += long.conDesp;

        const tipoCano = t.trazado === 'losa' ? 'Losa' : 'Pared/Piso';
        sumarItem('Canalizaciones', `Caño Ø ${t.diametro}" (${tipoCano})`, long.neto, long.conDesp, 'm');
        sumarItem('Cajas y Accesorios', `Conector / Boquilla Ø ${t.diametro}"`, 2, 2, 'un');

        // Chicote de conexión de +0.40m (0.20m por caja) por cada hilo
        const hilos = deducirConductoresTramo(t, nA, nB);
        hilos.forEach(h => {
            const netoHilo = (long.neto + 0.40) * h.hilos;
            const totalHilo = netoHilo * despFactor;
            totalMetrosCable += totalHilo;
            sumarItem('Conductores Unipolares', `Cable ${h.seccion} - ${h.color}`, netoHilo, totalHilo, 'm');
        });
    });

    const listaFinal = Array.from(itemsMap.values());
    ultimoComputoGlobal = {
        items: listaFinal,
        totalBocas: estadoCroquis.nodos.length,
        totalCanos: totalMetrosCano,
        totalCables: totalMetrosCable
    };

    // Actualizar KPIs
    document.getElementById('kpiCajas').innerText = `${estadoCroquis.nodos.length} un`;
    document.getElementById('kpiCanos').innerText = `${totalMetrosCano.toFixed(1)} m`;
    document.getElementById('kpiCables').innerText = `${totalMetrosCable.toFixed(1)} m`;
    document.getElementById('badgeResumenRapido').innerText = `${estadoCroquis.nodos.length} Bocas | ${totalMetrosCano.toFixed(1)} m Caño`;
    document.getElementById('countTramos').innerText = estadoCroquis.tramos.length;

    // Renderizar tabla agrupada en UI
    const contMat = document.getElementById('contenedorListaMateriales');
    if (listaFinal.length === 0) {
        contMat.innerHTML = `<p style="font-size: 0.8rem; color: var(--ngc-text-faded); text-align: center; padding: 12px 0;">Agregá bocas y unilas con caños para calcular automáticamente cajas, módulos, caños y cables.</p>`;
    } else {
        const rubros = ['Cajas y Accesorios', 'Módulos y Mecanismos', 'Canalizaciones', 'Conductores Unipolares'];
        let html = '';
        rubros.forEach(r => {
            const sub = listaFinal.filter(i => i.rubro === r);
            if (sub.length === 0) return;
            html += `<div class="mat-group-header">${r}</div>`;
            sub.forEach(item => {
                const cantTxt = item.unidad === 'un'
                    ? `${Math.ceil(item.conDesp)} un`
                    : `${Math.ceil(item.conDesp * 10) / 10} m`;
                html += `
                    <div class="mat-row-item">
                        <span style="color: var(--ngc-text-main);">${item.desc}</span>
                        <span class="mat-qty-badge">${cantTxt}</span>
                    </div>
                `;
            });
        });
        contMat.innerHTML = html;
    }

    // Renderizar lista de tramos editables
    const contTramos = document.getElementById('listaTramosUI');
    if (contTramos) {
        if (estadoCroquis.tramos.length === 0) {
            contTramos.innerHTML = `<p style="font-size:0.75rem; color:var(--ngc-text-faded);">Aún no conectaste tramos de cañería.</p>`;
        } else {
            contTramos.innerHTML = estadoCroquis.tramos.map((t, idx) => {
                const nA = estadoCroquis.nodos.find(n => n.id === t.desde);
                const nB = estadoCroquis.nodos.find(n => n.id === t.hasta);
                const l = (nA && nB) ? calcularLongitudTramo25D(nA, nB, t.trazado).conDesp.toFixed(1) : '0.0';
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; background:var(--ngc-bg-input); border:1px solid var(--ngc-privacy-border); border-radius:6px; margin-bottom:5px; font-size:0.76rem;">
                        <span><b>#${idx + 1} [${t.circuito}]</b> Ø${t.diametro}" (${t.trazado}) — <b>${l} m</b></span>
                        <div style="display:flex; gap:6px;">
                            <button type="button" onclick="editarTramo('${t.id}')" style="background:transparent; border:none; color:var(--ngc-neon); cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="eliminarTramo('${t.id}')" style="background:transparent; border:none; color:var(--error-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// ============================================================================
// 9. VISTA PREVIA A4, ZOOM TÁCTIL Y GENERACIÓN DE PDF
// ============================================================================
function poblarPlantillaPDF() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL ELECTRICISTA';
    const profTel = localStorage.getItem('villaser_conf_telefono') || '';
    const profSlogan = localStorage.getItem('villaser_conf_slogan') || 'Instalaciones Eléctricas y Proyectos';
    const profLogo = localStorage.getItem('villaser_conf_logo') || '';

    const imgLogo = document.getElementById('pdf-img-logo');
    const txtLogo = document.getElementById('pdf-text-logo');
    if (profLogo && profLogo.startsWith('data:image')) {
        imgLogo.src = profLogo;
        imgLogo.style.display = 'block';
        txtLogo.style.display = 'none';
    } else {
        imgLogo.style.display = 'none';
        txtLogo.innerText = profNombre.toUpperCase();
        txtLogo.style.display = 'block';
    }

    document.getElementById('pdf-slogan').innerText = profSlogan;
    document.getElementById('pdf-credenciales').innerText = profNombre;
    document.getElementById('pdf-tel-footer').innerText = profTel ? `Tel: ${profTel}` : '';
    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');

    document.getElementById('pdf-cliente').innerText = document.getElementById('cliNombre').value.trim() || 'Cliente';
    document.getElementById('pdf-direccion').innerText = document.getElementById('cliDireccion').value.trim() || '-';
    document.getElementById('pdf-proyecto').innerText = document.getElementById('cliProyecto').value.trim() || 'Relevamiento de Ambiente';

    const { nombre, ancho, largo, alto, desperdicio } = estadoCroquis.ambiente;
    document.getElementById('pdf-ambiente').innerText = `${nombre} (Desp. +${desperdicio}%)`;
    document.getElementById('pdf-dimensiones').innerText = `${ancho.toFixed(2)} m × ${largo.toFixed(2)} m`;
    document.getElementById('pdf-sup-alt').innerText = `${(ancho * largo).toFixed(2)} m² / H: ${alto.toFixed(2)} m`;

    // Renderizar SVG limpio en contenedor PDF
    const svgCont = document.getElementById('pdf-svg-container');
    svgCont.innerHTML = `<svg id="svgParaExportarPDF" viewBox="0 0 500 520" width="440" height="400" xmlns="http://www.w3.org/2000/svg">${generarMarkupSVG(true)}</svg>`;

    // Referencias simbólicas presentes en el plano
    const tiposPresentes = [...new Set(estadoCroquis.nodos.map(n => n.tipo))];
    const refGrid = document.getElementById('pdf-referencias-grid');
    if (tiposPresentes.length === 0) {
        refGrid.innerHTML = `<span>Sin artefactos insertados en el plano.</span>`;
    } else {
        refGrid.innerHTML = tiposPresentes.map(t => {
            const def = SIMBOLOS_CROQUIS[t];
            return `
                <div style="display:flex; align-items:center; gap:6px;">
                    <svg viewBox="-16 -16 32 46" width="18" height="22">${def?.svg || ''}</svg>
                    <span>${def?.nombre || t}</span>
                </div>
            `;
        }).join('');
    }

    // Tabla de materiales en PDF
    const tbody = document.getElementById('pdf-tbody-materiales');
    const items = ultimoComputoGlobal?.items || [];
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:8px; text-align:center; color:#64748b;">No se registraron materiales computados.</td></tr>`;
    } else {
        tbody.innerHTML = items.map((it, idx) => {
            const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
            const netoStr = it.unidad === 'un' ? `${Math.round(it.neto)} un` : `${it.neto.toFixed(1)} m`;
            const totStr = it.unidad === 'un' ? `${Math.ceil(it.conDesp)} un` : `${Math.ceil(it.conDesp)} m`;
            return `
                <tr style="background:${bg}; border-bottom:1px solid #e2e8f0;">
                    <td style="padding:4px 8px; color:#475569; font-weight:600;">${it.rubro}</td>
                    <td style="padding:4px 8px; color:#0f172a;">${it.desc}</td>
                    <td style="padding:4px 8px; text-align:center; color:#475569;">${netoStr}</td>
                    <td style="padding:4px 8px; text-align:right; font-weight:700; color:#0f172a;">${totStr}</td>
                </tr>
            `;
        }).join('');
    }

    const obs = document.getElementById('obsGenerales').value.trim();
    document.getElementById('pdf-obs-text').innerText = obs || 'Sin observaciones adicionales.';
}

function abrirVistaPrevia() {
    poblarPlantillaPDF();
    const plantilla = document.getElementById('plantilla-pdf');
    const mount = document.getElementById('previewMountPoint');
    const marca = document.getElementById('marcaAguaPDF');
    if (marca) marca.style.display = 'flex';

    plantilla.classList.remove('oculto');
    mount.innerHTML = '';
    mount.appendChild(plantilla);

    ajustarZoomPreview();
    document.getElementById('modalVistaPrevia').classList.remove('oculto');
}

function cerrarVistaPrevia() {
    const plantilla = document.getElementById('plantilla-pdf');
    plantilla.classList.add('oculto');
    document.body.appendChild(plantilla);
    document.getElementById('modalVistaPrevia').classList.add('oculto');
}

function ajustarZoomPreview() {
    const anchoDisp = window.innerWidth - 32;
    zoomPreviewActual = Math.min(1, Math.max(0.38, anchoDisp / 794));
    const mount = document.getElementById('previewMountPoint');
    if (mount) mount.style.transform = `scale(${zoomPreviewActual})`;
}

function cambiarZoomPreview(delta) {
    zoomPreviewActual = Math.min(1.8, Math.max(0.35, zoomPreviewActual + delta));
    const mount = document.getElementById('previewMountPoint');
    if (mount) mount.style.transform = `scale(${zoomPreviewActual})`;
}

// Soporte Pinch-to-Zoom táctil en Vista Previa
(function initPinchZoomPreview() {
    let distInicial = 0;
    let zoomInicial = 1;
    document.addEventListener('touchstart', e => {
        const modal = document.getElementById('modalVistaPrevia');
        if (!modal || modal.classList.contains('oculto')) return;
        if (e.touches.length === 2) {
            distInicial = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            zoomInicial = zoomPreviewActual;
        }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        const modal = document.getElementById('modalVistaPrevia');
        if (!modal || modal.classList.contains('oculto')) return;
        if (e.touches.length === 2 && distInicial > 0) {
            const distActual = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            zoomPreviewActual = Math.min(2.0, Math.max(0.35, zoomInicial * (distActual / distInicial)));
            const mount = document.getElementById('previewMountPoint');
            if (mount) mount.style.transform = `scale(${zoomPreviewActual})`;
        }
    }, { passive: true });
})();

function generarPDF() {
    const cli = (document.getElementById('cliNombre').value.trim() || 'Cliente').replace(/\s+/g, '_');
    const amb = (estadoCroquis.ambiente.nombre || 'Ambiente').replace(/[^a-zA-Z0-9]/g, '_');
    document.getElementById('nombreArchivoPDF').value = `Croquis_${amb}_${cli}`;
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
}

function convertirSvgAImagenParaPDF() {
    return new Promise((resolve) => {
        const svgEl = document.getElementById('svgParaExportarPDF');
        if (!svgEl) return resolve(null);

        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svgEl);
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 880;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            const pngImg = document.createElement('img');
            pngImg.src = canvas.toDataURL('image/png');
            pngImg.style.width = '440px';
            pngImg.style.height = '400px';
            pngImg.style.display = 'block';
            pngImg.style.margin = '0 auto';

            const cont = document.getElementById('pdf-svg-container');
            cont.innerHTML = '';
            cont.appendChild(pngImg);
            resolve(true);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function ejecutarDescargaPDF() {
    const nombreArchivo = (document.getElementById('nombreArchivoPDF').value.trim() || 'Croquis_Ambiente') + '.pdf';
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

    poblarPlantillaPDF();
    const plantilla = document.getElementById('plantilla-pdf');
    const marca = document.getElementById('marcaAguaPDF');
    if (marca) marca.style.display = 'none';

    plantilla.classList.remove('oculto');
    plantilla.style.position = 'fixed';
    plantilla.style.left = '-9999px';
    plantilla.style.top = '0';

    await convertirSvgAImagenParaPDF();

    const opt = {
        margin: 0,
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(plantilla).toPdf().get('pdf').then((pdf) => {
            while (pdf.internal.getNumberOfPages() > 1) {
                pdf.deletePage(pdf.internal.getNumberOfPages());
            }
        }).save();
        mostrarToast("PDF Generado", "Lámina A4 descargada correctamente.");
    } catch (err) {
        console.error("Error PDF:", err);
        mostrarToast("Error PDF", "No se pudo exportar el PDF.", true);
    } finally {
        plantilla.classList.add('oculto');
        plantilla.style.position = '';
        plantilla.style.left = '';
        plantilla.style.top = '';
        if (marca) marca.style.display = 'flex';
        btn.disabled = false;
        btn.innerHTML = 'Descargar';
        cerrarModalPDF();
    }
}

// ============================================================================
// 10. WHATSAPP, PORTAPAPELES, NUBE FIREBASE Y RESPALDO JSON
// ============================================================================
function generarTextoListaMateriales() {
    const cli = document.getElementById('cliNombre').value.trim() || 'Cliente';
    const amb = estadoCroquis.ambiente;
    const items = ultimoComputoGlobal?.items || [];

    let txt = `*CÓMPUTO DE MATERIALES - CROQUIS ELÉCTRICO*\n`;
    txt += `*Cliente:* ${cli}\n`;
    txt += `*Ambiente:* ${amb.nombre} (${amb.ancho.toFixed(2)}m × ${amb.largo.toFixed(2)}m | H=${amb.alto.toFixed(2)}m)\n`;
    txt += `────────────────────\n`;

    if (items.length === 0) {
        txt += `Sin materiales computados.\n`;
    } else {
        items.forEach(it => {
            const cant = it.unidad === 'un' ? `${Math.ceil(it.conDesp)} un` : `${Math.ceil(it.conDesp)} m`;
            txt += `• *${cant}* — ${it.desc}\n`;
        });
    }
    return txt;
}

function enviarMaterialesWhatsApp() {
    const texto = generarTextoListaMateriales();
    const telRaw = document.getElementById('cliTel').value.replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (telRaw.length >= 8) {
        const tel = telRaw.startsWith('54') ? telRaw : `549${telRaw}`;
        url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
    }
    window.open(url, '_blank');
}

async function copiarComputoPortapapeles() {
    const texto = generarTextoListaMateriales();
    // Guarda también puente en localStorage para futura integración directa con módulo Materiales
    localStorage.setItem('villaser_puente_croquis_materiales', JSON.stringify({
        fecha: new Date().toISOString(),
        cliente: document.getElementById('cliNombre').value.trim(),
        ambiente: estadoCroquis.ambiente,
        items: ultimoComputoGlobal?.items || []
    }));

    try {
        await navigator.clipboard.writeText(texto);
        mostrarToast("Lista Copiada", "Cómputo copiado al portapapeles.");
    } catch (e) {
        mostrarToast("Lista Preparada", "Datos guardados en memoria local.");
    }
}

function programarAutoguardado() {
    guardarEstadoLocal();
    clearTimeout(timerAutoguardado);
    timerAutoguardado = setTimeout(() => {
        guardarBorradorFirebase(false, true);
    }, 2500);
}

function guardarEstadoLocal() {
    try {
        const payload = {
            cliente: {
                nombre: document.getElementById('cliNombre').value.trim(),
                tel: document.getElementById('cliTel').value.trim(),
                dir: document.getElementById('cliDireccion').value.trim(),
                proyecto: document.getElementById('cliProyecto').value.trim()
            },
            observaciones: document.getElementById('obsGenerales').value,
            estadoCroquis
        };
        localStorage.setItem('villaser_croquis_autosave', JSON.stringify(payload));
    } catch (e) {}
}

function restaurarEstadoLocal() {
    try {
        const raw = localStorage.getItem('villaser_croquis_autosave');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.estadoCroquis && (data.estadoCroquis.nodos?.length > 0 || data.estadoCroquis.tramos?.length > 0)) {
            estadoCroquis = data.estadoCroquis;
            document.getElementById('ambNombre').value = estadoCroquis.ambiente.nombre || 'Dormitorio';
            document.getElementById('ambAncho').value = estadoCroquis.ambiente.ancho || 3.50;
            document.getElementById('ambLargo').value = estadoCroquis.ambiente.largo || 4.00;
            document.getElementById('ambAlto').value = estadoCroquis.ambiente.alto || 2.60;
            document.getElementById('ambDesperdicio').value = estadoCroquis.ambiente.desperdicio || 10;
            document.getElementById('lblSupAmbiente').innerText = `${(estadoCroquis.ambiente.ancho * estadoCroquis.ambiente.largo).toFixed(2)} m²`;
            document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;
            if (data.observaciones) document.getElementById('obsGenerales').value = data.observaciones;
        }
    } catch (e) {}
}

async function guardarBorradorFirebase(mostrarMensaje = true, esAuto = false) {
    guardarEstadoLocal();
    const uid = obtenerUid();
    if (!uid || !db) {
        if (mostrarMensaje) mostrarToast("Guardado Local", "Sin sesión nube activa; guardado en el dispositivo.");
        return;
    }

    actualizarBadgeNube('saving', 'Guardando...');
    const payload = {
        clienteNombre: document.getElementById('cliNombre').value.trim() || 'Cliente',
        clienteDireccion: document.getElementById('cliDireccion').value.trim() || '',
        clienteTel: document.getElementById('cliTel').value.trim() || '',
        proyecto: document.getElementById('cliProyecto').value.trim() || '',
        observaciones: document.getElementById('obsGenerales').value.trim(),
        estadoCroquis,
        fechaActualizacion: new Date().toISOString()
    };

    try {
        const colRef = db.collection('perfiles').doc(uid).collection('borradores_croquis');
        if (borradorActualId) {
            await colRef.doc(borradorActualId).set(payload, { merge: true });
        } else {
            const docRef = await colRef.add(payload);
            borradorActualId = docRef.id;
        }
        actualizarBadgeNube('saved', 'Guardado');
        if (mostrarMensaje) mostrarToast("Guardado en Nube", "Croquis sincronizado correctamente.");
    } catch (e) {
        console.warn("Error guardando croquis en Firebase:", e);
        actualizarBadgeNube('local', 'Guardado Local');
        if (mostrarMensaje && !esAuto) {
            mostrarToast("Guardado Local", "No se pudo sincronizar con la nube (verificá reglas Firestore).", true);
        }
    }
}

async function abrirModalBorradores() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarToast("Sin Sesión", "Iniciá sesión para ver tus croquis en la nube.", true);
        return;
    }

    document.getElementById('modalBorradores').classList.remove('oculto');
    const cont = document.getElementById('listaBorradores');
    cont.innerHTML = `<p style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando croquis...</p>`;

    try {
        const snap = await db.collection('perfiles').doc(uid).collection('borradores_croquis')
            .orderBy('fechaActualizacion', 'desc').limit(25).get();

        if (snap.empty) {
            cont.innerHTML = `<p style="text-align:center; color:var(--ngc-text-faded);">No hay croquis guardados en la nube.</p>`;
            return;
        }

        cont.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const amb = d.estadoCroquis?.ambiente?.nombre || 'Ambiente';
            const fecha = d.fechaActualizacion ? new Date(d.fechaActualizacion).toLocaleDateString('es-AR') : '';
            const item = document.createElement('div');
            item.className = 'modal-list-item';
            item.innerHTML = `
                <div>
                    <h4>${d.clienteNombre || 'Cliente'} — ${amb}</h4>
                    <small>${d.clienteDireccion || 'Sin dirección'} | ${fecha}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="corp-btn-small" onclick="cargarBorradorCroquis('${doc.id}')">Abrir</button>
                    <button type="button" class="corp-btn-small danger-btn" onclick="eliminarBorradorCroquis('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            cont.appendChild(item);
        });
    } catch (e) {
        cont.innerHTML = `<p style="text-align:center; color:var(--error-red);">Error al leer borradores de la nube.</p>`;
    }
}

async function cargarBorradorCroquis(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;
    try {
        const doc = await db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).get();
        if (!doc.exists) return;
        const d = doc.data();
        borradorActualId = doc.id;
        document.getElementById('cliNombre').value = d.clienteNombre || '';
        document.getElementById('cliDireccion').value = d.clienteDireccion || '';
        document.getElementById('cliTel').value = d.clienteTel || '';
        document.getElementById('cliProyecto').value = d.proyecto || '';
        document.getElementById('obsGenerales').value = d.observaciones || '';

        if (d.estadoCroquis) {
            estadoCroquis = d.estadoCroquis;
            document.getElementById('ambNombre').value = estadoCroquis.ambiente.nombre;
            document.getElementById('ambAncho').value = estadoCroquis.ambiente.ancho;
            document.getElementById('ambLargo').value = estadoCroquis.ambiente.largo;
            document.getElementById('ambAlto').value = estadoCroquis.ambiente.alto;
            document.getElementById('ambDesperdicio').value = estadoCroquis.ambiente.desperdicio;
            document.getElementById('lblSupAmbiente').innerText = `${(estadoCroquis.ambiente.ancho * estadoCroquis.ambiente.largo).toFixed(2)} m²`;
            document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;
        }

        cerrarModalBorradoresGlobal();
        avanzarPasoTrabajo(true);
        mostrarToast("Croquis Cargado", "Diseño restaurado desde la nube.");
    } catch (e) {
        mostrarToast("Error", "No se pudo abrir el borrador.", true);
    }
}

async function eliminarBorradorCroquis(docId) {
    if (!confirm("¿Eliminar este croquis de la nube?")) return;
    const uid = obtenerUid();
    if (!uid || !db) return;
    try {
        await db.collection('perfiles').doc(uid).collection('borradores_croquis').doc(docId).delete();
        if (borradorActualId === docId) borradorActualId = null;
        abrirModalBorradores();
    } catch (e) {
        mostrarToast("Error", "No se pudo eliminar.", true);
    }
}

function exportarJSON() {
    const payload = {
        modulo: 'villaser_croquis_v1',
        fecha: new Date().toISOString(),
        cliente: {
            nombre: document.getElementById('cliNombre').value.trim(),
            tel: document.getElementById('cliTel').value.trim(),
            dir: document.getElementById('cliDireccion').value.trim(),
            proyecto: document.getElementById('cliProyecto').value.trim()
        },
        observaciones: document.getElementById('obsGenerales').value,
        estadoCroquis
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const amb = (estadoCroquis.ambiente.nombre || 'Ambiente').replace(/[^a-zA-Z0-9]/g, '_');
    a.href = url;
    a.download = `Croquis_${amb}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.estadoCroquis) throw new Error("Formato inválido");
            if (data.cliente) {
                document.getElementById('cliNombre').value = data.cliente.nombre || '';
                document.getElementById('cliTel').value = data.cliente.tel || '';
                document.getElementById('cliDireccion').value = data.cliente.dir || '';
                document.getElementById('cliProyecto').value = data.cliente.proyecto || '';
            }
            document.getElementById('obsGenerales').value = data.observaciones || '';
            estadoCroquis = data.estadoCroquis;
            document.getElementById('ambNombre').value = estadoCroquis.ambiente.nombre;
            document.getElementById('ambAncho').value = estadoCroquis.ambiente.ancho;
            document.getElementById('ambLargo').value = estadoCroquis.ambiente.largo;
            document.getElementById('ambAlto').value = estadoCroquis.ambiente.alto;
            document.getElementById('ambDesperdicio').value = estadoCroquis.ambiente.desperdicio;
            document.getElementById('lblSupAmbiente').innerText = `${(estadoCroquis.ambiente.ancho * estadoCroquis.ambiente.largo).toFixed(2)} m²`;
            document.getElementById('lblCountAberturas').innerText = estadoCroquis.aberturas.length;

            avanzarPasoTrabajo(true);
            mostrarToast("Archivo Cargado", "Croquis restaurado desde respaldo .JSON.");
        } catch (err) {
            mostrarToast("Error de Archivo", "El archivo .JSON no corresponde a un croquis válido.", true);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}
