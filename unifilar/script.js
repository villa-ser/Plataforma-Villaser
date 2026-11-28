// ==========================================================================
// MÓDULO ESQUEMA UNIFILAR PROFESIONAL (IEC 60617 / AEA 90364) - VILLASER
// ==========================================================================
let db = null;
let uidSeguro = null;

const STORAGE_KEY_UNIFILAR = 'unifilar_estado_actual';
const STORAGE_KEY_CLIENTE_GLOBAL = 'villaser_cliente_global';

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let telefonoClienteActual = "";
let borradorPendienteEliminar = null;
let timerAutoSyncNube = null;

let editandoCircuitoIndex = null;
let editandoTSIndex = null;
let filtroTSCircuitos = 'TODOS';

// ==========================================
// PRECARGA DE SÍMBOLOS SVG EXTERNOS
// ==========================================
let cacheSimboloPIA = null;
let cacheSimboloID = null;

async function cargarArchivoSVG(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const txt = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(txt, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;

    let w = 60, h = 100;
    const vb = svg.getAttribute('viewBox');
    if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            w = parts[2];
            h = parts[3];
        }
    } else {
        w = parseFloat(svg.getAttribute('width')) || 60;
        h = parseFloat(svg.getAttribute('height')) || 100;
    }

    return { w, h, inner: svg.innerHTML };
}

async function precargarSimbolosExternos() {
    try {
        const [pia, id] = await Promise.all([
            cargarArchivoSVG('simbolos/Termomagnetica.svg').catch(() => null),
            cargarArchivoSVG('simbolos/Diferencial.svg').catch(() => null)
        ]);
        if (pia) cacheSimboloPIA = pia;
        if (id) cacheSimboloID = id;

        const stepTrabajo = document.getElementById('step-trabajo');
        if (stepTrabajo && !stepTrabajo.classList.contains('oculto')) {
            renderizarTodo();
        }
    } catch (err) {
        console.warn('No se pudieron cargar los símbolos SVG externos, se usa respaldo:', err);
    }
}

// ==========================================
// UTILIDADES DE SEGURIDAD Y FORMATO
// ==========================================
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function escapeXml(str) {
    return String(str || '').replace(/[<>&'"]/g, m => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;'
    }[m]));
}

function escapeJs(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        return firebase.auth().currentUser.uid;
    }
    return null;
}

function mostrarToast(titulo, mensaje, esError = false) {
    const toast = document.getElementById('toastCliente');
    if (!toast) return;
    const tTitle = document.getElementById('toastTitle');
    const tMsg = document.getElementById('toastMessage');
    const iconBox = toast.querySelector('.toast-icon');

    if (tTitle) tTitle.innerText = titulo;
    if (tMsg) tMsg.innerText = mensaje;
    if (iconBox) {
        iconBox.innerHTML = esError
            ? '<i class="fa-solid fa-circle-exclamation" style="color:var(--error-red);"></i>'
            : '<i class="fa-solid fa-check-circle"></i>';
    }

    toast.classList.remove('oculto');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.add('oculto');
    }, 3200);
}

function mostrarAlertaCorp(titulo, mensaje) {
    document.getElementById('modalAlertaTitulo').innerText = titulo;
    document.getElementById('modalAlertaMensaje').innerText = mensaje;
    document.getElementById('modalAlertaCorp').classList.remove('oculto');
}

function cerrarModalAlertaCorp() {
    document.getElementById('modalAlertaCorp').classList.add('oculto');
}

// ==========================================
// ESTADO INICIAL Y NORMALIZACIÓN JERÁRQUICA
// ==========================================
function crearEstadoInicialUnifilar() {
    return {
        nivel0: {
            suministro: 'Monofásico 220V',
            rdd: 'RDD',
            dpla: 'DPLA',
            medidor: 'M - Monofásico 220V',
            lineaAlim: 'LA: 2x6 mm² + PE 1x6 mm²'
        },
        nivel1: {
            nombre: 'TP',
            ip: 'IP54',
            dobleAislacion: true,
            tipoDisp: 'PIA',
            curvaPolos: 'C 2x',
            in: '32',
            pcc: '4500',
            tension: '220',
            dps: 'NO',
            lineaSec: 'LS: 2x6 mm² + PE 1x6 mm²'
        },
        tablerosSeccionales: [
            {
                id: 'TS_1',
                nombre: 'TS1',
                ubicacion: 'Tablero Seccional General',
                ip: 'IP41',
                dobleAislacion: true,
                origen: 'TP',
                lineaAlim: 'LS: 2x6 mm² + PE 1x6 mm²',
                tipoCab: 'ID Clase A',
                in: '2x40A',
                sens: '30mA',
                pcc: '3000',
                tension: '220',
                pat: 'PAT ≤ 40 Ω'
            }
        ],
        circuitos: [
            { id: 'C1', tableroId: 'TS_1', fase: 'L1', tipo: 'IUG', desc: 'Iluminación General', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 9, dpms: 540 },
            { id: 'C2', tableroId: 'TS_1', fase: 'L1', tipo: 'TUG', desc: 'Tomas Uso General 1', piaCod: 'PIA2', curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 11, dpms: 2200 },
            { id: 'C3', tableroId: 'TS_1', fase: 'L1', tipo: 'TUG', desc: 'Tomas Uso General 2', piaCod: 'PIA3', curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 7, dpms: 2200 },
            { id: 'C4', tableroId: 'TS_1', fase: 'L1', tipo: 'ACU', desc: 'Aire Acondicionado', piaCod: 'PIA4', curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1, dpms: 1500 }
        ]
    };
}

let esquema = crearEstadoInicialUnifilar();

function normalizarEsquema(raw) {
    const base = crearEstadoInicialUnifilar();
    if (!raw || typeof raw !== 'object') return base;

    const est = {
        nivel0: Object.assign(base.nivel0, raw.nivel0 || {}),
        nivel1: Object.assign(base.nivel1, raw.nivel1 || {}),
        tablerosSeccionales: [],
        circuitos: []
    };

    if (typeof est.nivel1.dobleAislacion !== 'boolean') {
        est.nivel1.dobleAislacion = true;
    }

    if (Array.isArray(raw.tablerosSeccionales) && raw.tablerosSeccionales.length > 0) {
        est.tablerosSeccionales = raw.tablerosSeccionales.map((ts, idx) => ({
            id: ts.id || `TS_${idx + 1}`,
            nombre: ts.nombre || `TS${idx + 1}`,
            ubicacion: ts.ubicacion || '',
            ip: ts.ip || 'IP41',
            dobleAislacion: typeof ts.dobleAislacion === 'boolean' ? ts.dobleAislacion : true,
            origen: ts.origen || 'TP',
            lineaAlim: ts.lineaAlim || (idx === 0 ? est.nivel1.lineaSec : `LS${idx + 1}: 2x4 mm² + PE 1x4 mm²`),
            tipoCab: ts.tipoCab || 'ID Clase A',
            in: ts.in || '2x40A',
            sens: ts.sens || '30mA',
            pcc: ts.pcc || '3000',
            tension: ts.tension || '220',
            pat: ts.pat || 'PAT ≤ 40 Ω'
        }));
    } else {
        est.tablerosSeccionales = base.tablerosSeccionales;
    }

    const primerTsId = est.tablerosSeccionales[0].id;
    const idsValidos = new Set(est.tablerosSeccionales.map(t => t.id));

    if (Array.isArray(raw.circuitos) && raw.circuitos.length > 0) {
        est.circuitos = raw.circuitos.map((c, idx) => {
            const es4P = String(c.curvaPolos || '').includes('4x') || String(c.tension) === '380';
            return {
                id: c.id || `C${idx + 1}`,
                tableroId: idsValidos.has(c.tableroId) ? c.tableroId : primerTsId,
                fase: c.fase || (es4P ? 'L1-L2-L3' : 'L1'),
                tipo: c.tipo || 'TUG',
                desc: c.desc || 'Circuito Terminal',
                piaCod: c.piaCod || `PIA${idx + 1}`,
                curvaPolos: c.curvaPolos || 'C 2x',
                in: String(c.in || '16'),
                pcc: String(c.pcc || '3000'),
                tension: String(c.tension || '220'),
                secLN: String(c.secLN || '2.5'),
                secPE: String(c.secPE || '2.5'),
                bocas: parseInt(c.bocas, 10) || 0,
                dpms: parseFloat(c.dpms) || 0
            };
        });
    } else {
        est.circuitos = [];
    }

    return est;
}

function esSuministroTrifasico() {
    return String(esquema.nivel0.suministro || '').toLowerCase().includes('trif');
}

// ==========================================
// PERSISTENCIA LOCAL Y MEMORIA ENTRE MÓDULOS
// ==========================================
function guardarEstadoLocal(dispararNube = false) {
    try {
        const payload = {
            cliNombre: document.getElementById('cliNombre')?.value || '',
            cliDireccion: document.getElementById('cliDireccion')?.value || '',
            cliProyecto: document.getElementById('cliProyecto')?.value || '',
            clienteDesdeAgenda,
            permiteGuardarNube,
            nombreBorrador: nombreBorradorActual,
            telefonoClienteActual,
            esquema,
            actualizadoEn: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_UNIFILAR, JSON.stringify(payload));
        guardarClienteGlobal();
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
    }

    if (dispararNube && clienteDesdeAgenda && permiteGuardarNube) {
        clearTimeout(timerAutoSyncNube);
        timerAutoSyncNube = setTimeout(() => {
            guardarBorradorFirebase(false, true);
        }, 2500);
    }
}

function guardarClienteGlobal() {
    try {
        const nombre = document.getElementById('cliNombre')?.value.trim() || '';
        const direccion = document.getElementById('cliDireccion')?.value.trim() || '';
        const proyecto = document.getElementById('cliProyecto')?.value.trim() || '';
        if (!nombre) return;
        localStorage.setItem(STORAGE_KEY_CLIENTE_GLOBAL, JSON.stringify({
            nombre,
            direccion,
            proyecto,
            telefono: telefonoClienteActual || ''
        }));
    } catch (e) {}
}

function restaurarEstadoInicial() {
    try {
        const rawLocal = localStorage.getItem(STORAGE_KEY_UNIFILAR);
        if (rawLocal) {
            const data = JSON.parse(rawLocal);
            if (data && (data.cliNombre || data.esquema)) {
                document.getElementById('cliNombre').value = data.cliNombre || '';
                document.getElementById('cliDireccion').value = data.cliDireccion || '';
                document.getElementById('cliProyecto').value = data.cliProyecto || '';
                if (data.esquema) esquema = normalizarEsquema(data.esquema);
                clienteDesdeAgenda = !!data.clienteDesdeAgenda;
                permiteGuardarNube = data.permiteGuardarNube !== false;
                nombreBorradorActual = data.nombreBorrador || null;
                telefonoClienteActual = data.telefonoClienteActual || '';

                if (data.cliNombre && data.cliNombre.trim() !== '') {
                    avanzarPasoTrabajo(true);
                    return;
                }
            }
        }

        const rawGlobal = localStorage.getItem(STORAGE_KEY_CLIENTE_GLOBAL);
        if (rawGlobal) {
            const cg = JSON.parse(rawGlobal);
            if (cg && cg.nombre) {
                document.getElementById('cliNombre').value = cg.nombre || '';
                document.getElementById('cliDireccion').value = cg.direccion || '';
                document.getElementById('cliProyecto').value = cg.proyecto || '';
                telefonoClienteActual = cg.telefono || '';
                clienteDesdeAgenda = true;
                permiteGuardarNube = true;
                mostrarToast("Cliente Recuperado", `Datos activos de ${cg.nombre}.`);
            }
        }
    } catch (e) {
        console.warn('Error restaurando estado local:', e);
    }
}

// ==========================================
// ARRANQUE DEL MÓDULO
// ==========================================
function arrancarModulo() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (user) uidSeguro = user.uid;
                });
            }
        }
    } catch (e) {
        console.warn("Aviso: Firebase no pudo iniciar.", e);
    }

    precargarSimbolosExternos();
    restaurarEstadoInicial();
    actualizarPDFHeaders();
    renderizarTodo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarModulo);
} else {
    arrancarModulo();
}

// ==========================================
// FLUJO DE CLIENTE, AGENDA Y PASO A TRABAJO
// ==========================================
function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
    telefonoClienteActual = "";
    guardarEstadoLocal(false);
}

function seleccionarContacto(nombre, dir, tel = '') {
    document.getElementById('cliNombre').value = nombre || '';
    document.getElementById('cliDireccion').value = dir || '';
    telefonoClienteActual = tel || '';
    clienteDesdeAgenda = true;
    permiteGuardarNube = true;
    guardarEstadoLocal(false);

    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    mostrarToast("Cliente Vinculado", `${nombre} seleccionado desde Agenda.`);
}

function accionAgendarCliente() {
    const nombre = encodeURIComponent(document.getElementById('cliNombre').value.trim());
    const dir = encodeURIComponent(document.getElementById('cliDireccion').value.trim());
    window.location.href = `../agenda/index.html?nuevo=1&nombre=${nombre}&dir=${dir}`;
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

function iniciarUnifilar() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Datos Incompletos", "Por favor, ingresá al menos el Nombre del Cliente.");
        return;
    }

    if (!clienteDesdeAgenda && permiteGuardarNube) {
        document.getElementById('modalAgendarCliente').classList.remove('oculto');
        return;
    }

    avanzarPasoTrabajo();
}

function avanzarPasoTrabajo(silencioso = false) {
    document.getElementById('step-cliente').classList.add('oculto');
    const st = document.getElementById('step-trabajo');
    st.classList.remove('oculto');
    st.classList.add('flex-column', 'gap-15');

    const dock = document.getElementById('dockUnifilarFlotante');
    if (dock) dock.classList.remove('oculto');

    actualizarResumenProyectoUI();
    renderizarTodo();
    if (!silencioso) guardarEstadoLocal(true);
}

function volverAEditarCliente() {
    const dock = document.getElementById('dockUnifilarFlotante');
    if (dock) dock.classList.add('oculto');

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
}

function actualizarResumenProyectoUI(estadoSync = null) {
    const elNombre = document.getElementById('ui-proyecto-cliente');
    const elDetalle = document.getElementById('ui-proyecto-detalle');
    const elBadge = document.getElementById('ui-cloud-badge');
    if (!elNombre || !elDetalle) return;

    const cli = document.getElementById('cliNombre').value.trim() || 'Proyecto Sin Nombre';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();

    elNombre.innerText = cli;
    const partes = [dir, proy].filter(Boolean);
    elDetalle.innerText = partes.length > 0 ? partes.join(' • ') : 'Esquema Unifilar AEA 90364';

    if (!elBadge) return;
    if (!permiteGuardarNube || !clienteDesdeAgenda) {
        elBadge.className = 'pres-cloud-pill local';
        elBadge.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Solo Local';
    } else if (estadoSync === 'syncing') {
        elBadge.className = 'pres-cloud-pill syncing';
        elBadge.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Guardando...';
    } else if (estadoSync === 'synced') {
        elBadge.className = 'pres-cloud-pill synced';
        elBadge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
    } else {
        elBadge.className = 'pres-cloud-pill ready';
        elBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> Nube Lista';
    }
}

function ejecutarNuevoUnifilar() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();
    cerrarDrawerUnifilar();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';

    esquema = crearEstadoInicialUnifilar();
    filtroTSCircuitos = 'TODOS';
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = "";

    localStorage.removeItem(STORAGE_KEY_UNIFILAR);

    const dock = document.getElementById('dockUnifilarFlotante');
    if (dock) dock.classList.add('oculto');

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    renderizarTodo();
}

// ==========================================
// CAJÓN FULLSCREEN (PATRÓN CARRITO / RESUMEN)
// ==========================================
function abrirDrawerUnifilar() {
    renderizarTodo();
    const modal = document.getElementById('modalListaUnifilar');
    if (modal) modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';
}

function cerrarDrawerUnifilar() {
    const modal = document.getElementById('modalListaUnifilar');
    if (modal) modal.classList.add('oculto');
    const vp = document.getElementById('modalVistaPrevia');
    if (!vp || vp.classList.contains('oculto')) {
        document.body.style.overflow = '';
    }
}

function pulsarDockUnifilar() {
    const dock = document.getElementById('dockUnifilarFlotante');
    if (!dock) return;
    dock.classList.remove('uni-dock-pulse');
    void dock.offsetWidth;
    dock.classList.add('uni-dock-pulse');
}

// ==========================================
// PLANTILLAS RÁPIDAS E IMPORTACIÓN DE POTENCIA
// ==========================================
function aplicarPlantillaUnifilar(tipo) {
    if (tipo === 'mono_770') {
        esquema = crearEstadoInicialUnifilar();
        mostrarToast("Plantilla Aplicada", "Vivienda Monofásica AEA 770 cargada.");
    } else if (tipo === 'trifa_770') {
        esquema = {
            nivel0: {
                suministro: 'Trifásico 380V',
                rdd: 'RDD',
                dpla: 'DPLA',
                medidor: 'M - Trifásico 380V',
                lineaAlim: 'LA: 4x10 mm² + PE 1x10 mm²'
            },
            nivel1: {
                nombre: 'TP',
                ip: 'IP54',
                dobleAislacion: true,
                tipoDisp: 'PIA',
                curvaPolos: 'C 4x',
                in: '40',
                pcc: '6000',
                tension: '380',
                dps: 'Tipo 2 (4P)',
                lineaSec: 'LS: 4x10 mm² + PE 1x10 mm²'
            },
            tablerosSeccionales: [
                {
                    id: 'TS_1',
                    nombre: 'TS1',
                    ubicacion: 'Tablero Seccional General',
                    ip: 'IP41',
                    dobleAislacion: true,
                    origen: 'TP',
                    lineaAlim: 'LS: 4x10 mm² + PE 1x10 mm²',
                    tipoCab: 'ID Clase A',
                    in: '4x40A',
                    sens: '30mA',
                    pcc: '4500',
                    tension: '380',
                    pat: 'PAT ≤ 40 Ω'
                }
            ],
            circuitos: [
                { id: 'C1', tableroId: 'TS_1', fase: 'L1', tipo: 'IUG', desc: 'Iluminación Planta Baja', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '4500', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 10, dpms: 600 },
                { id: 'C2', tableroId: 'TS_1', fase: 'L2', tipo: 'TUG', desc: 'Tomas Uso General 1', piaCod: 'PIA2', curvaPolos: 'C 2x', in: '16', pcc: '4500', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 12, dpms: 2200 },
                { id: 'C3', tableroId: 'TS_1', fase: 'L3', tipo: 'TUG', desc: 'Tomas Uso General 2', piaCod: 'PIA3', curvaPolos: 'C 2x', in: '16', pcc: '4500', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 8, dpms: 2200 },
                { id: 'C4', tableroId: 'TS_1', fase: 'L1-L2-L3', tipo: 'MOTOR', desc: 'Bomba / Equipo Trifásico', piaCod: 'PIA4', curvaPolos: 'C 4x', in: '16', pcc: '4500', tension: '380', secLN: '2.5', secPE: '2.5', bocas: 1, dpms: 3500 }
            ]
        };
        mostrarToast("Plantilla Aplicada", "Suministro Trifásico 380V configurado.");
    } else {
        esquema = {
            nivel0: {
                suministro: 'Monofásico 220V',
                rdd: 'RDD',
                dpla: 'DPLA',
                medidor: 'M - Monofásico 220V',
                lineaAlim: 'LA: 2x6 mm² + PE 1x6 mm²'
            },
            nivel1: {
                nombre: 'TP',
                ip: 'IP54',
                dobleAislacion: true,
                tipoDisp: 'PIA',
                curvaPolos: 'C 2x',
                in: '32',
                pcc: '4500',
                tension: '220',
                dps: 'NO',
                lineaSec: 'LS: 2x6 mm² + PE 1x6 mm²'
            },
            tablerosSeccionales: [
                {
                    id: 'TS_1',
                    nombre: 'TS1',
                    ubicacion: 'Tablero Seccional',
                    ip: 'IP41',
                    dobleAislacion: true,
                    origen: 'TP',
                    lineaAlim: 'LS: 2x6 mm² + PE 1x6 mm²',
                    tipoCab: 'ID Clase A',
                    in: '2x40A',
                    sens: '30mA',
                    pcc: '3000',
                    tension: '220',
                    pat: 'PAT ≤ 40 Ω'
                }
            ],
            circuitos: []
        };
        mostrarToast("Estructura Base", "Tableros listos para cargar circuitos.");
    }

    filtroTSCircuitos = 'TODOS';
    renderizarTodo();
    guardarEstadoLocal(true);
}

async function abrirModalImportarPotencia() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp("Sin Sesión", "Iniciá sesión en la nube para importar cálculos de Potencia.");
        return;
    }

    const modal = document.getElementById('modalImportarPotencia');
    const lista = document.getElementById('listaBorradoresPotencia');
    lista.innerHTML = '<p style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando borradores en Potencia...</p>';
    modal.classList.remove('oculto');

    try {
        const snap = await db.collection('perfiles').doc(uid).collection('borradores_potencia').get();
        if (snap.empty) {
            lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No tenés borradores guardados en el módulo Potencia.</p>';
            return;
        }

        lista.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const circs = Array.isArray(d.circuitos) ? d.circuitos : [];
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.innerHTML = `
                <div>
                    <h4>${escapeHtml(d.nombreBorrador || doc.id)}</h4>
                    <small>${escapeHtml(d.cliNombre || 'Cliente')} • ${circs.length} circuitos • ${escapeHtml(d.suministro || 'Monofásico')}</small>
                </div>
                <button type="button" class="corp-btn-small primary-action">Importar</button>
            `;
            div.querySelector('button').onclick = () => {
                importarBorradorPotencia(d);
                cerrarModalImportarPotencia();
            };
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al consultar borradores de Potencia.</p>';
    }
}

function cerrarModalImportarPotencia() {
    document.getElementById('modalImportarPotencia').classList.add('oculto');
}

function importarBorradorPotencia(dataPot) {
    const esTrifa = String(dataPot.suministro || '').toLowerCase().includes('trif');
    const secCS = dataPot.csSeccionLN || (esTrifa ? '10' : '6');
    const secCSPE = dataPot.csSeccionPE || secCS;
    const inCS = String(dataPot.csIn || (esTrifa ? '40' : '32'));

    esquema.nivel0.suministro = esTrifa ? 'Trifásico 380V' : 'Monofásico 220V';
    esquema.nivel0.medidor = esTrifa ? 'M - Trifásico 380V' : 'M - Monofásico 220V';
    esquema.nivel0.lineaAlim = esTrifa
        ? `LA: 4x${secCS} mm² + PE 1x${secCSPE} mm²`
        : `LA: 2x${secCS} mm² + PE 1x${secCSPE} mm²`;

    esquema.nivel1.curvaPolos = esTrifa ? 'C 4x' : 'C 2x';
    esquema.nivel1.in = inCS;
    esquema.nivel1.tension = esTrifa ? '380' : '220';
    esquema.nivel1.lineaSec = esTrifa
        ? `LS: 4x${secCS} mm² + PE 1x${secCSPE} mm²`
        : `LS: 2x${secCS} mm² + PE 1x${secCSPE} mm²`;

    const idCalibre = Math.max(40, parseInt(inCS, 10) || 40);
    esquema.tablerosSeccionales = [
        {
            id: 'TS_1',
            nombre: 'TS1',
            ubicacion: 'Tablero Seccional General',
            ip: 'IP41',
            dobleAislacion: true,
            origen: 'TP',
            lineaAlim: esquema.nivel1.lineaSec,
            tipoCab: 'ID Clase A',
            in: esTrifa ? `4x${idCalibre}A` : `2x${idCalibre}A`,
            sens: '30mA',
            pcc: '3000',
            tension: esTrifa ? '380' : '220',
            pat: 'PAT ≤ 40 Ω'
        }
    ];

    const fasesCycle = ['L1', 'L2', 'L3'];
    const circsPot = Array.isArray(dataPot.circuitos) ? dataPot.circuitos : [];
    esquema.circuitos = circsPot.map((c, idx) => {
        const tipo = c.tipo || 'TUG';
        const es4P = String(c.tension) === '380';
        const faseAsignada = !esTrifa ? 'L1' : (es4P ? 'L1-L2-L3' : fasesCycle[idx % 3]);
        return {
            id: c.id || `C${idx + 1}`,
            tableroId: 'TS_1',
            fase: faseAsignada,
            tipo: tipo,
            desc: c.destino || c.desc || `Circuito ${tipo}`,
            piaCod: `PIA${idx + 1}`,
            curvaPolos: es4P ? 'C 4x' : (tipo === 'IUG' ? 'B 2x' : 'C 2x'),
            in: String(c.in || (tipo === 'IUG' ? '10' : '16')),
            pcc: '3000',
            tension: es4P ? '380' : '220',
            secLN: String(c.seccionLN || (tipo === 'IUG' ? '1.5' : '2.5')),
            secPE: String(c.seccionPE || '2.5'),
            bocas: parseInt(c.bocas, 10) || 1,
            dpms: Math.round(parseFloat(c.dpms) || 0)
        };
    });

    filtroTSCircuitos = 'TODOS';
    renderizarTodo();
    guardarEstadoLocal(true);
    pulsarDockUnifilar();
    mostrarToast("Importado de Potencia", `${esquema.circuitos.length} circuitos generados automáticamente.`);
}

// ==========================================
// CONTROLADORES DE MODALES POR NIVEL (0, 1, 2)
// ==========================================
function cerrarModalNivel(idModal) {
    document.getElementById(idModal).classList.add('oculto');
    if (idModal === 'modalNivel2') editandoTSIndex = null;
}

function abrirModalEditarNivel(nivel) {
    if (nivel === 0) {
        document.getElementById('n0Suministro').value = esquema.nivel0.suministro;
        document.getElementById('n0Rdd').value = esquema.nivel0.rdd;
        document.getElementById('n0Dpla').value = esquema.nivel0.dpla;
        document.getElementById('n0Medidor').value = esquema.nivel0.medidor;
        document.getElementById('n0LineaAlim').value = esquema.nivel0.lineaAlim;
        document.getElementById('modalNivel0').classList.remove('oculto');
    } else if (nivel === 1) {
        document.getElementById('n1Nombre').value = esquema.nivel1.nombre;
        document.getElementById('n1Ip').value = esquema.nivel1.ip;
        document.getElementById('n1DobleAislacion').checked = esquema.nivel1.dobleAislacion !== false;
        document.getElementById('n1TipoDisp').value = esquema.nivel1.tipoDisp;
        document.getElementById('n1CurvaPolos').value = esquema.nivel1.curvaPolos;
        document.getElementById('n1In').value = esquema.nivel1.in;
        document.getElementById('n1Pcc').value = esquema.nivel1.pcc;
        document.getElementById('n1Dps').value = esquema.nivel1.dps;
        document.getElementById('n1LineaSec').value = esquema.nivel1.lineaSec;
        document.getElementById('modalNivel1').classList.remove('oculto');
    }
          }

function precargarNivel0PorSuministro() {
    const sum = document.getElementById('n0Suministro').value;
    if (sum.includes('Trifásico')) {
        document.getElementById('n0Medidor').value = 'M - Trifásico 380V';
        document.getElementById('n0LineaAlim').value = 'LA: 4x10 mm² + PE 1x10 mm²';
    } else {
        document.getElementById('n0Medidor').value = 'M - Monofásico 220V';
        document.getElementById('n0LineaAlim').value = 'LA: 2x6 mm² + PE 1x6 mm²';
    }
}

function guardarNivel0() {
    const prevTrifa = esSuministroTrifasico();
    esquema.nivel0.suministro = document.getElementById('n0Suministro').value;
    esquema.nivel0.rdd = document.getElementById('n0Rdd').value.trim() || 'RDD';
    esquema.nivel0.dpla = document.getElementById('n0Dpla').value;
    esquema.nivel0.medidor = document.getElementById('n0Medidor').value.trim() || 'M';
    esquema.nivel0.lineaAlim = document.getElementById('n0LineaAlim').value.trim();

    const nuevoTrifa = esSuministroTrifasico();
    if (prevTrifa !== nuevoTrifa) {
        esquema.nivel1.curvaPolos = nuevoTrifa ? 'C 4x' : 'C 2x';
        esquema.nivel1.tension = nuevoTrifa ? '380' : '220';
        esquema.nivel1.lineaSec = nuevoTrifa
            ? 'LS: 4x10 mm² + PE 1x10 mm²'
            : 'LS: 2x6 mm² + PE 1x6 mm²';

        esquema.tablerosSeccionales.forEach((ts, idx) => {
            ts.tension = nuevoTrifa ? '380' : '220';
            ts.in = nuevoTrifa
                ? String(ts.in || '4x40A').replace(/^2x/, '4x')
                : String(ts.in || '2x40A').replace(/^4x/, '2x');
            if (idx === 0 && ts.origen === 'TP') {
                ts.lineaAlim = esquema.nivel1.lineaSec;
            } else {
                ts.lineaAlim = nuevoTrifa
                    ? String(ts.lineaAlim || '').replace(/2x/g, '4x')
                    : String(ts.lineaAlim || '').replace(/4x/g, '2x');
            }
        });

        const fasesCycle = ['L1', 'L2', 'L3'];
        esquema.circuitos.forEach((c, idx) => {
            if (!nuevoTrifa) {
                c.fase = 'L1';
                c.tension = '220';
                c.curvaPolos = String(c.curvaPolos || 'C 2x').replace('4x', '2x');
            } else if (!String(c.curvaPolos || '').includes('4x') && c.tension !== '380') {
                c.fase = fasesCycle[idx % 3];
            }
        });
    }

    cerrarModalNivel('modalNivel0');
    renderizarTodo();
    guardarEstadoLocal(true);
    mostrarToast("Nivel 0 Actualizado", prevTrifa !== nuevoTrifa
        ? "Suministro y cabeceras TP/TS sincronizados automáticamente."
        : "Acometida y medición guardadas.");
}

function guardarNivel1() {
    esquema.nivel1.nombre = document.getElementById('n1Nombre').value.trim() || 'TP';
    esquema.nivel1.ip = document.getElementById('n1Ip').value;
    esquema.nivel1.dobleAislacion = document.getElementById('n1DobleAislacion').checked;
    esquema.nivel1.tipoDisp = document.getElementById('n1TipoDisp').value;
    esquema.nivel1.curvaPolos = document.getElementById('n1CurvaPolos').value;
    esquema.nivel1.in = document.getElementById('n1In').value;
    esquema.nivel1.pcc = document.getElementById('n1Pcc').value;
    esquema.nivel1.dps = document.getElementById('n1Dps').value;
    esquema.nivel1.lineaSec = document.getElementById('n1LineaSec').value.trim();

    if (esquema.tablerosSeccionales[0] && esquema.tablerosSeccionales[0].origen === 'TP') {
        esquema.tablerosSeccionales[0].lineaAlim = esquema.nivel1.lineaSec;
    }

    cerrarModalNivel('modalNivel1');
    renderizarTodo();
    guardarEstadoLocal(true);
    mostrarToast("Nivel 1 Actualizado", "Tablero Principal actualizado.");
}

// ==========================================
// GESTIÓN DE TABLEROS SECCIONALES (NIVEL 2)
// ==========================================
function abrirModalTS(index = null) {
    editandoTSIndex = index;
    const titulo = document.getElementById('tituloModalTS');
    const selOrigen = document.getElementById('n2Origen');

    selOrigen.innerHTML = `<option value="TP">${escapeHtml(esquema.nivel1.nombre || 'TP')} (Tablero Principal)</option>`;
    esquema.tablerosSeccionales.forEach((t, idx) => {
        if (idx !== index) {
            selOrigen.innerHTML += `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (Subtablero desde ${escapeHtml(t.nombre)})</option>`;
        }
    });

    if (index !== null && esquema.tablerosSeccionales[index]) {
        const ts = esquema.tablerosSeccionales[index];
        titulo.innerHTML = `<i class="fa-solid fa-server corp-accent-color"></i> Editar ${escapeHtml(ts.nombre)}`;
        document.getElementById('n2Nombre').value = ts.nombre;
        document.getElementById('n2Ubicacion').value = ts.ubicacion || '';
        selOrigen.value = ts.origen || 'TP';
        document.getElementById('n2Ip').value = ts.ip || 'IP41';
        document.getElementById('n2LineaAlim').value = ts.lineaAlim || '';
        document.getElementById('n2TipoCab').value = ts.tipoCab || 'ID Clase A';
        document.getElementById('n2In').value = ts.in || '2x40A';
        document.getElementById('n2Sens').value = ts.sens || '30mA';
        document.getElementById('n2Pcc').value = ts.pcc || '3000';
        document.getElementById('n2Pat').value = ts.pat || 'PAT ≤ 40 Ω';
        document.getElementById('n2DobleAislacion').checked = ts.dobleAislacion !== false;
    } else {
        const nro = esquema.tablerosSeccionales.length + 1;
        const esTrifa = esSuministroTrifasico();
        titulo.innerHTML = `<i class="fa-solid fa-plus corp-accent-color"></i> Nuevo Tablero Seccional (TS${nro})`;
        document.getElementById('n2Nombre').value = `TS${nro}`;
        document.getElementById('n2Ubicacion').value = `Tablero Seccional ${nro}`;
        selOrigen.value = 'TP';
        document.getElementById('n2Ip').value = 'IP41';
        document.getElementById('n2LineaAlim').value = esTrifa
            ? `LS${nro}: 4x6 mm² + PE 1x6 mm²`
            : `LS${nro}: 2x4 mm² + PE 1x4 mm²`;
        document.getElementById('n2TipoCab').value = 'ID Clase A';
        document.getElementById('n2In').value = esTrifa ? '4x40A' : '2x40A';
        document.getElementById('n2Sens').value = '30mA';
        document.getElementById('n2Pcc').value = '3000';
        document.getElementById('n2Pat').value = 'PAT ≤ 40 Ω';
        document.getElementById('n2DobleAislacion').checked = true;
    }

    document.getElementById('modalNivel2').classList.remove('oculto');
}

function guardarTS() {
    const esTrifa = esSuministroTrifasico();
    const nro = esquema.tablerosSeccionales.length + 1;
    const obj = {
        id: (editandoTSIndex !== null && esquema.tablerosSeccionales[editandoTSIndex])
            ? esquema.tablerosSeccionales[editandoTSIndex].id
            : `TS_${Date.now().toString(36)}`,
        nombre: document.getElementById('n2Nombre').value.trim() || `TS${nro}`,
        ubicacion: document.getElementById('n2Ubicacion').value.trim(),
        origen: document.getElementById('n2Origen').value || 'TP',
        ip: document.getElementById('n2Ip').value,
        lineaAlim: document.getElementById('n2LineaAlim').value.trim(),
        tipoCab: document.getElementById('n2TipoCab').value,
        in: document.getElementById('n2In').value,
        sens: document.getElementById('n2Sens').value,
        pcc: document.getElementById('n2Pcc').value,
        tension: esTrifa ? '380' : '220',
        pat: document.getElementById('n2Pat').value.trim() || 'PAT ≤ 40 Ω',
        dobleAislacion: document.getElementById('n2DobleAislacion').checked
    };

    if (editandoTSIndex !== null) {
        esquema.tablerosSeccionales[editandoTSIndex] = obj;
        if (editandoTSIndex === 0 && obj.origen === 'TP' && obj.lineaAlim) {
            esquema.nivel1.lineaSec = obj.lineaAlim;
        }
        mostrarToast("Tablero Actualizado", `${obj.nombre} modificado correctamente.`);
    } else {
        esquema.tablerosSeccionales.push(obj);
        mostrarToast("Tablero Agregado", `${obj.nombre} añadido al esquema.`);
    }

    cerrarModalNivel('modalNivel2');
    renderizarTodo();
    guardarEstadoLocal(true);
}

function eliminarTS(index) {
    if (esquema.tablerosSeccionales.length <= 1) {
        mostrarAlertaCorp("No permitido", "Debe existir al menos un Tablero Seccional en el esquema.");
        return;
    }
    const tsEliminado = esquema.tablerosSeccionales[index];
    esquema.tablerosSeccionales.splice(index, 1);
    const fallbackId = esquema.tablerosSeccionales[0].id;

    esquema.tablerosSeccionales.forEach(t => {
        if (t.origen === tsEliminado.id) t.origen = 'TP';
    });
    esquema.circuitos.forEach(c => {
        if (c.tableroId === tsEliminado.id) c.tableroId = fallbackId;
    });

    if (filtroTSCircuitos === tsEliminado.id) filtroTSCircuitos = 'TODOS';
    renderizarTodo();
    guardarEstadoLocal(true);
    mostrarToast("Tablero Eliminado", `${tsEliminado.nombre} eliminado y circuitos reasignados.`);
                  }

// ==========================================
// GESTIÓN DE CIRCUITOS TERMINALES (NIVEL 3)
// ==========================================
function cambiarFiltroTSCircuitos(tsId) {
    filtroTSCircuitos = tsId;
    renderizarTodo();
}

function sincronizarFasePorPolos() {
    const polos = document.getElementById('cCurvaPolos').value;
    const tension = document.getElementById('cTension').value;
    const selFase = document.getElementById('cFase');
    if (polos.includes('4x') || tension === '380') {
        selFase.value = 'L1-L2-L3';
    } else if (selFase.value === 'L1-L2-L3') {
        selFase.value = 'L1';
    }
}

function aplicarPrecargaCircuito() {
    const tipo = document.getElementById('cTipo').value;
    const presets = {
        IUG: { desc: 'Iluminación General', curvaPolos: 'B 2x', in: '10', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 8, dpms: 480 },
        TUG: { desc: 'Tomas Uso General', curvaPolos: 'C 2x', in: '16', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 10, dpms: 2200 },
        TUE: { desc: 'Tomas Uso Especial', curvaPolos: 'C 2x', in: '20', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 4, dpms: 3300 },
        ACU: { desc: 'Aire Acondicionado', curvaPolos: 'C 2x', in: '16', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1, dpms: 1500 },
        MBTF: { desc: 'Muy Baja Tensión (12/24V)', curvaPolos: 'B 2x', in: '6', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 4, dpms: 200 },
        MOTOR: { desc: 'Bomba / Motor', curvaPolos: 'C 2x', in: '16', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1, dpms: 1500 }
    };

    const p = presets[tipo] || presets.TUG;
    document.getElementById('cDesc').value = p.desc;
    document.getElementById('cCurvaPolos').value = p.curvaPolos;
    document.getElementById('cIn').value = p.in;
    document.getElementById('cTension').value = p.tension;
    document.getElementById('cSecLN').value = p.secLN;
    document.getElementById('cSecPE').value = p.secPE;
    document.getElementById('cBocas').value = p.bocas;
    document.getElementById('cDpms').value = p.dpms;
    sincronizarFasePorPolos();
}

function abrirModalCircuito(index = null) {
    editandoCircuitoIndex = index;
    const titulo = document.getElementById('tituloModalCircuito');
    const selTablero = document.getElementById('cTableroId');
    const grupoFase = document.getElementById('grupoFaseCircuito');

    selTablero.innerHTML = esquema.tablerosSeccionales.map(t =>
        `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} ${t.ubicacion ? '(' + escapeHtml(t.ubicacion) + ')' : ''}</option>`
    ).join('');

    if (esSuministroTrifasico()) {
        grupoFase.classList.remove('oculto');
    } else {
        grupoFase.classList.add('oculto');
    }

    if (index !== null && esquema.circuitos[index]) {
        const c = esquema.circuitos[index];
        titulo.innerHTML = `<i class="fa-solid fa-pen" style="color: var(--ngc-neon);"></i> Editar Circuito ${escapeHtml(c.id)}`;
        selTablero.value = c.tableroId || esquema.tablerosSeccionales[0].id;
        document.getElementById('cFase').value = c.fase || 'L1';
        document.getElementById('cId').value = c.id;
        document.getElementById('cTipo').value = c.tipo;
        document.getElementById('cDesc').value = c.desc;
        document.getElementById('cPiaCod').value = c.piaCod;
        document.getElementById('cCurvaPolos').value = c.curvaPolos;
        document.getElementById('cIn').value = c.in;
        document.getElementById('cPcc').value = c.pcc;
        document.getElementById('cTension').value = c.tension;
        document.getElementById('cSecLN').value = c.secLN;
        document.getElementById('cSecPE').value = c.secPE;
        document.getElementById('cBocas').value = c.bocas;
        document.getElementById('cDpms').value = c.dpms;
    } else {
        const nro = esquema.circuitos.length + 1;
        const fasesCycle = ['L1', 'L2', 'L3'];
        titulo.innerHTML = `<i class="fa-solid fa-code-branch" style="color: var(--success-green);"></i> Agregar Circuito C${nro}`;
        selTablero.value = (filtroTSCircuitos !== 'TODOS') ? filtroTSCircuitos : esquema.tablerosSeccionales[0].id;
        document.getElementById('cFase').value = fasesCycle[(nro - 1) % 3];
        document.getElementById('cId').value = `C${nro}`;
        document.getElementById('cTipo').value = nro === 1 ? 'IUG' : 'TUG';
        document.getElementById('cPiaCod').value = `PIA${nro}`;
        document.getElementById('cPcc').value = esquema.tablerosSeccionales[0]?.pcc || '3000';
        aplicarPrecargaCircuito();
    }

    document.getElementById('modalCircuito').classList.remove('oculto');
}

function cerrarModalCircuito() {
    document.getElementById('modalCircuito').classList.add('oculto');
    editandoCircuitoIndex = null;
}

function guardarCircuito() {
    const curvaPolos = document.getElementById('cCurvaPolos').value;
    const tension = document.getElementById('cTension').value;
    let fase = document.getElementById('cFase').value || 'L1';
    if (!esSuministroTrifasico()) {
        fase = 'L1';
    } else if (curvaPolos.includes('4x') || tension === '380') {
        fase = 'L1-L2-L3';
    }

    const nuevo = {
        id: document.getElementById('cId').value.trim() || `C${esquema.circuitos.length + 1}`,
        tableroId: document.getElementById('cTableroId').value || esquema.tablerosSeccionales[0].id,
        fase: fase,
        tipo: document.getElementById('cTipo').value,
        desc: document.getElementById('cDesc').value.trim() || 'Circuito Terminal',
        piaCod: document.getElementById('cPiaCod').value.trim() || `PIA${esquema.circuitos.length + 1}`,
        curvaPolos: curvaPolos,
        in: document.getElementById('cIn').value,
        pcc: document.getElementById('cPcc').value,
        tension: tension,
        secLN: document.getElementById('cSecLN').value,
        secPE: document.getElementById('cSecPE').value,
        bocas: parseInt(document.getElementById('cBocas').value, 10) || 0,
        dpms: parseFloat(document.getElementById('cDpms').value) || 0
    };

    if (editandoCircuitoIndex !== null) {
        esquema.circuitos[editandoCircuitoIndex] = nuevo;
        mostrarToast("Circuito Actualizado", `${nuevo.id} (${nuevo.tipo}) modificado.`);
    } else {
        esquema.circuitos.push(nuevo);
        mostrarToast("Circuito Agregado", `${nuevo.id} (${nuevo.tipo}) añadido al unifilar.`);
    }

    cerrarModalCircuito();
    renderizarTodo();
    guardarEstadoLocal(true);
    pulsarDockUnifilar();
}

function duplicarCircuito(index) {
    const orig = esquema.circuitos[index];
    if (!orig) return;

    const nro = esquema.circuitos.length + 1;
    const fasesCycle = ['L1', 'L2', 'L3'];
    const copia = Object.assign({}, orig, {
        id: `C${nro}`,
        piaCod: `PIA${nro}`,
        fase: esSuministroTrifasico() && !String(orig.curvaPolos).includes('4x')
            ? fasesCycle[(nro - 1) % 3]
            : orig.fase
    });

    esquema.circuitos.splice(index + 1, 0, copia);
    renderizarTodo();
    guardarEstadoLocal(true);
    pulsarDockUnifilar();
    mostrarToast("Circuito Duplicado", `${copia.id} (${copia.tipo}) creado en 1 toque.`);
}

function eliminarCircuito(index) {
    const c = esquema.circuitos[index];
    if (!c) return;
    esquema.circuitos.splice(index, 1);
    renderizarTodo();
    guardarEstadoLocal(true);
    mostrarToast("Circuito Eliminado", `${c.id} quitado del esquema.`);
}

// ==========================================
// CÁLCULOS ELÉCTRICOS Y AUDITORÍA AEA 90364
// ==========================================
const TABLA_IZ_COBRE_PVC = {
    '1.5': 15,
    '2.5': 21,
    '4': 28,
    '6': 36,
    '10': 50,
    '16': 68,
    '25': 89
};

function calcularIbCircuito(c) {
    const dpms = parseFloat(c.dpms) || 0;
    const v = parseFloat(c.tension) || 220;
    const es4P = String(c.curvaPolos || '').includes('4x') || v === 380;
    if (dpms <= 0) return 0;
    return es4P ? (dpms / (Math.sqrt(3) * 380)) : (dpms / v);
}

function validarNormativaUnifilar() {
    const alertas = [];
    const esTrifa = esSuministroTrifasico();
    const cargaFases = { L1: 0, L2: 0, L3: 0 };

    if (esTrifa && !String(esquema.nivel1.curvaPolos || '').includes('4x')) {
        alertas.push(`Tablero Principal (${esquema.nivel1.nombre}): Suministro Trifásico requiere cabecera tetrapolar (4x).`);
    }

    esquema.tablerosSeccionales.forEach(ts => {
        if (esTrifa && String(ts.in || '').startsWith('2x')) {
            alertas.push(`${ts.nombre}: Cabecera bipolar (${ts.in}) bajo suministro Trifásico.`);
        }
    });

    esquema.circuitos.forEach(c => {
        const ib = calcularIbCircuito(c);
        const inVal = parseFloat(c.in) || 16;
        const iz = TABLA_IZ_COBRE_PVC[String(c.secLN)] || 21;
        const secLN = parseFloat(c.secLN) || 2.5;
        const secPE = parseFloat(c.secPE) || 2.5;
        const dpms = parseFloat(c.dpms) || 0;

        if (ib > inVal) {
            alertas.push(`${c.id}: Corriente de proyecto Ib (${ib.toFixed(1)}A) supera calibre PIA In (${inVal}A).`);
        }
        if (inVal > iz) {
            alertas.push(`${c.id}: Calibre PIA In (${inVal}A) supera corriente admisible Iz (${iz}A) del cable de ${c.secLN} mm².`);
        }
        if ((c.tipo === 'TUG' || c.tipo === 'TUE' || c.tipo === 'ACU' || c.tipo === 'MOTOR') && secLN < 2.5) {
            alertas.push(`${c.id} (${c.tipo}): Sección mínima reglamentaria AEA 770 es 2,5 mm².`);
        }
        if (secPE < 2.5) {
            alertas.push(`${c.id}: Conductor de protección PE mínimo según AEA 90364 es 2,5 mm².`);
        }
        if ((c.tipo === 'IUG' || c.tipo === 'TUG') && (parseInt(c.bocas, 10) || 0) > 15) {
            alertas.push(`${c.id} (${c.tipo}): Supera el máximo de 15 bocas por circuito AEA 770.`);
        }

        if (esTrifa) {
            if (c.fase === 'L1-L2-L3') {
                cargaFases.L1 += dpms / 3;
                cargaFases.L2 += dpms / 3;
                cargaFases.L3 += dpms / 3;
            } else if (cargaFases[c.fase] !== undefined) {
                cargaFases[c.fase] += dpms;
            }
        }
    });

    if (esTrifa) {
        const vals = [cargaFases.L1, cargaFases.L2, cargaFases.L3];
        const maxF = Math.max(...vals);
        const minF = Math.min(...vals);
        if (maxF > 0 && ((maxF - minF) / maxF) > 0.25) {
            alertas.push(`Desequilibrio de fases > 25% (L1: ${Math.round(cargaFases.L1)}VA, L2: ${Math.round(cargaFases.L2)}VA, L3: ${Math.round(cargaFases.L3)}VA).`);
        }
    }

    return { alertas, cargaFases };
}

// ==========================================
// RENDERIZADO UNIFICADO DE INTERFAZ Y PLANO
// ==========================================
function renderizarTodo() {
    // 1. Nivel 0
    const r0 = document.getElementById('ui-resumen-nivel-0');
    if (r0) {
        r0.innerHTML = `
            <div class="uni-spec-item"><span>Suministro</span><strong>${escapeHtml(esquema.nivel0.suministro)}</strong></div>
            <div class="uni-spec-item"><span>Acometida / Medidor</span><strong>${escapeHtml(esquema.nivel0.dpla)} • ${escapeHtml(esquema.nivel0.medidor)}</strong></div>
            <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Alimentación</span><strong>${escapeHtml(esquema.nivel0.lineaAlim)}</strong></div>
        `;
    }

    // 2. Nivel 1
    const titTp = document.getElementById('ui-titulo-tp');
    if (titTp) {
        titTp.innerHTML = `<i class="fa-solid fa-box"></i> ${escapeHtml(esquema.nivel1.nombre)} (${escapeHtml(esquema.nivel1.ip)})`;
    }
    const r1 = document.getElementById('ui-resumen-nivel-1');
    if (r1) {
        const dpsTxt = esquema.nivel1.dps && esquema.nivel1.dps !== 'NO' ? ` • DPS ${esquema.nivel1.dps}` : '';
        r1.innerHTML = `
            <div class="uni-spec-item"><span>Cabecera</span><strong>${escapeHtml(esquema.nivel1.tipoDisp)} ${escapeHtml(esquema.nivel1.curvaPolos)}${escapeHtml(esquema.nivel1.in)}A</strong></div>
            <div class="uni-spec-item"><span>Pcc / Extras</span><strong>${escapeHtml(esquema.nivel1.pcc)}A${escapeHtml(dpsTxt)}</strong></div>
            <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Seccional</span><strong>${escapeHtml(esquema.nivel1.lineaSec)}</strong></div>
        `;
    }

    // 3. Nivel 2 (Tableros Seccionales)
    const cantTs = document.getElementById('ui-cant-ts');
    if (cantTs) cantTs.innerText = esquema.tablerosSeccionales.length;

    const listaTsEl = document.getElementById('ui-lista-ts');
    if (listaTsEl) {
        listaTsEl.innerHTML = esquema.tablerosSeccionales.map((ts, idx) => {
            const cantC = esquema.circuitos.filter(c => c.tableroId === ts.id).length;
            const origenLabel = ts.origen === 'TP'
                ? esquema.nivel1.nombre
                : (esquema.tablerosSeccionales.find(x => x.id === ts.origen)?.nombre || 'TP');
            return `
                <div class="uni-ts-block">
                    <div class="uni-ts-block-head">
                        <div>
                            <strong style="color:var(--ngc-neon); font-size:0.86rem;">${escapeHtml(ts.nombre)}</strong>
                            <span style="font-size:0.75rem; color:var(--ngc-text-faded);"> • ${escapeHtml(ts.ubicacion || 'Seccional')} (${escapeHtml(ts.ip)})</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button type="button" class="corp-btn-small primary-action" onclick="abrirModalTS(${idx})"><i class="fa-solid fa-pen"></i></button>
                            ${esquema.tablerosSeccionales.length > 1
                                ? `<button type="button" class="corp-btn-small danger" onclick="eliminarTS(${idx})"><i class="fa-solid fa-trash"></i></button>`
                                : ''}
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--ngc-text-faded); line-height:1.35;">
                        Desde <strong>${escapeHtml(origenLabel)}</strong> • Cabecera: <strong>${escapeHtml(ts.tipoCab)} ${escapeHtml(ts.in)}</strong> (${escapeHtml(ts.sens)}) • ${escapeHtml(ts.pat)} • <strong>${cantC} circ.</strong>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 4. Nivel 3 (Circuitos Terminales + Filtro por TS)
    const cantCircEl = document.getElementById('ui-cant-circuitos');
    if (cantCircEl) cantCircEl.innerText = esquema.circuitos.length;

    const filtroBar = document.getElementById('ui-filtro-ts-circuitos');
    if (filtroBar) {
        if (esquema.tablerosSeccionales.length > 1) {
            filtroBar.classList.remove('oculto');
            filtroBar.innerHTML = `
                <button type="button" class="uni-filter-chip ${filtroTSCircuitos === 'TODOS' ? 'active' : ''}" onclick="cambiarFiltroTSCircuitos('TODOS')">
                    Todos (${esquema.circuitos.length})
                </button>
                ${esquema.tablerosSeccionales.map(ts => {
                    const cnt = esquema.circuitos.filter(c => c.tableroId === ts.id).length;
                    return `<button type="button" class="uni-filter-chip ${filtroTSCircuitos === ts.id ? 'active' : ''}" onclick="cambiarFiltroTSCircuitos('${escapeJs(ts.id)}')">
                        ${escapeHtml(ts.nombre)} (${cnt})
                    </button>`;
                }).join('')}
            `;
        } else {
            filtroBar.classList.add('oculto');
        }
    }

    const listaCircEl = document.getElementById('ui-lista-circuitos');
    const esTrifa = esSuministroTrifasico();
    const mapaTS = {};
    esquema.tablerosSeccionales.forEach(t => { mapaTS[t.id] = t; });

    if (listaCircEl) {
        const filtrados = esquema.circuitos
            .map((c, idx) => ({ c, idx }))
            .filter(item => filtroTSCircuitos === 'TODOS' || item.c.tableroId === filtroTSCircuitos);

        if (filtrados.length === 0) {
            listaCircEl.innerHTML = `<p style="text-align:center; color:var(--ngc-text-faded); font-size:0.8rem; padding:12px 0;">No hay circuitos cargados en este filtro. Tocá <strong>+ Circuito</strong> para agregar.</p>`;
        } else {
            listaCircEl.innerHTML = filtrados.map(({ c, idx }) => {
                const ib = calcularIbCircuito(c);
                const iz = TABLA_IZ_COBRE_PVC[String(c.secLN)] || 21;
                const okNorma = ib <= (parseFloat(c.in) || 16) && (parseFloat(c.in) || 16) <= iz;
                const tsNom = mapaTS[c.tableroId]?.nombre || 'TS1';
                const faseBadge = esTrifa ? ` • <strong>${escapeHtml(c.fase)}</strong>` : '';

                return `
                    <div class="uni-circ-item">
                        <div class="uni-circ-top">
                            <div class="uni-circ-tag">
                                <span>${escapeHtml(c.id)}</span>
                                <span style="color:var(--ngc-text-main); font-weight:700;">${escapeHtml(c.tipo)}</span>
                                ${esquema.tablerosSeccionales.length > 1 ? `<span style="font-size:0.68rem; color:var(--ngc-warning);">[${escapeHtml(tsNom)}]</span>` : ''}
                            </div>
                            <span class="uni-circ-pill ${okNorma ? '' : 'warn'}">
                                ${okNorma ? `Ib ${ib.toFixed(1)}A ≤ In ${c.in}A` : `Revisar Ib ${ib.toFixed(1)}A / In ${c.in}A`}
                            </span>
                        </div>
                        <div class="uni-circ-details">
                            <strong style="color:var(--ngc-text-main);">${escapeHtml(c.desc)}</strong><br>
                            ${escapeHtml(c.piaCod)}: ${escapeHtml(c.curvaPolos)}${escapeHtml(c.in)}A • Cable 2×${escapeHtml(c.secLN)} + PE ${escapeHtml(c.secPE)} mm² • ${c.bocas} ${c.bocas === 1 ? 'boca' : 'bocas'} • <strong>${Math.round(c.dpms)} VA</strong>${faseBadge}
                        </div>
                        <div class="uni-circ-actions">
                            <button type="button" class="corp-btn-small" onclick="duplicarCircuito(${idx})" title="Duplicar circuito">
                                <i class="fa-solid fa-copy"></i> Duplicar
                            </button>
                            <button type="button" class="corp-btn-small primary-action" onclick="abrirModalCircuito(${idx})">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <button type="button" class="corp-btn-small danger" onclick="eliminarCircuito(${idx})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 5. Auditoría AEA, Dock Flotante y Cajón Fullscreen
    const { alertas, cargaFases } = validarNormativaUnifilar();
    const totalBocas = esquema.circuitos.reduce((acc, c) => acc + (parseInt(c.bocas, 10) || 0), 0);
    const totalDpms = esquema.circuitos.reduce((acc, c) => acc + (parseFloat(c.dpms) || 0), 0);
    const totalIb = esquema.circuitos.reduce((acc, c) => acc + calcularIbCircuito(c), 0);

    const bannerAea = document.getElementById('ui-aea-unifilar-status');
    if (bannerAea) {
        if (alertas.length === 0) {
            bannerAea.className = 'pot-aea-banner ok';
            bannerAea.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verificación AEA 90364 OK • ${esquema.circuitos.length} circ. • ${Math.round(totalDpms)} VA (${(totalDpms / 1000).toFixed(2)} kVA).`;
        } else {
            bannerAea.className = 'pot-aea-banner warn';
            bannerAea.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${alertas.length} observación(es) AEA: ${escapeHtml(alertas[0])} <u>Ver detalle</u>`;
        }
    }

    const dockResumen = document.getElementById('dockUnifilarResumen');
    if (dockResumen) {
        dockResumen.innerHTML = `<i class="fa-solid fa-bolt corp-accent-color"></i> ${esquema.circuitos.length} circ. • ${totalBocas} bocas • ${(totalDpms / 1000).toFixed(2)} kVA`;
    }
    const dockCant = document.getElementById('dockCantCircuitos');
    if (dockCant) dockCant.innerText = esquema.circuitos.length;

    // Actualizar contenido del Cajón Fullscreen
    const kpiTs = document.getElementById('drawer-kpi-ts');
    const kpiCirc = document.getElementById('drawer-kpi-circ');
    const kpiBocas = document.getElementById('drawer-kpi-bocas');
    const kpiDpms = document.getElementById('drawer-kpi-dpms');
    if (kpiTs) kpiTs.innerText = esquema.tablerosSeccionales.length;
    if (kpiCirc) kpiCirc.innerText = esquema.circuitos.length;
    if (kpiBocas) kpiBocas.innerText = totalBocas;
    if (kpiDpms) kpiDpms.innerText = `${Math.round(totalDpms)} VA`;

    const boxBalance = document.getElementById('drawer-balance-trifa');
    const detBalance = document.getElementById('drawer-balance-detalle');
    if (boxBalance && detBalance) {
        if (esTrifa) {
            boxBalance.classList.remove('oculto');
            detBalance.innerHTML = `
                <div style="background:var(--ngc-glass); padding:6px 8px; border-radius:7px; text-align:center;">
                    <span style="color:var(--ngc-text-faded); font-size:0.68rem; display:block;">FASE L1 (R)</span>
                    <strong>${Math.round(cargaFases.L1)} VA</strong>
                </div>
                <div style="background:var(--ngc-glass); padding:6px 8px; border-radius:7px; text-align:center;">
                    <span style="color:var(--ngc-text-faded); font-size:0.68rem; display:block;">FASE L2 (S)</span>
                    <strong>${Math.round(cargaFases.L2)} VA</strong>
                </div>
                <div style="background:var(--ngc-glass); padding:6px 8px; border-radius:7px; text-align:center;">
                    <span style="color:var(--ngc-text-faded); font-size:0.68rem; display:block;">FASE L3 (T)</span>
                    <strong>${Math.round(cargaFases.L3)} VA</strong>
                </div>
            `;
        } else {
            boxBalance.classList.add('oculto');
        }
    }

    const drawerAud = document.getElementById('drawer-auditoria-lista');
    if (drawerAud) {
        if (alertas.length === 0) {
            drawerAud.innerHTML = `<div style="color:var(--success-green); font-weight:600;"><i class="fa-solid fa-circle-check"></i> Coordinación térmica (Ib ≤ In ≤ Iz), secciones mínimas y cantidad de bocas cumplen AEA 90364-7-770.</div>`;
        } else {
            drawerAud.innerHTML = alertas.map(a => `<div style="color:var(--ngc-warning);"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(a)}</div>`).join('');
        }
    }

    const drawerListaCirc = document.getElementById('drawer-lista-circuitos');
    if (drawerListaCirc) {
        if (esquema.circuitos.length === 0) {
            drawerListaCirc.innerHTML = `<p style="color:var(--ngc-text-faded); font-size:0.78rem; text-align:center;">Sin circuitos cargados.</p>`;
        } else {
            drawerListaCirc.innerHTML = esquema.circuitos.map((c, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:var(--ngc-bg-input); border:1px solid var(--ngc-privacy-border); border-radius:8px; padding:7px 10px;">
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:0.8rem; font-weight:700; color:var(--ngc-text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <span style="color:var(--ngc-neon);">${escapeHtml(c.id)}</span> • ${escapeHtml(c.desc)}
                        </div>
                        <div style="font-size:0.7rem; color:var(--ngc-text-faded);">
                            ${escapeHtml(c.curvaPolos)}${escapeHtml(c.in)}A • ${escapeHtml(c.secLN)}/${escapeHtml(c.secPE)}mm² • ${Math.round(c.dpms)} VA
                        </div>
                    </div>
                    <button type="button" class="corp-btn-small primary-action" onclick="cerrarDrawerUnifilar(); abrirModalCircuito(${idx});">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // 6. Generar Diagrama Vectorial SVG y Sincronizar Lámina A4
    const svgCode = generarSVGUnifilar();
    sincronizarVistaPreviaPDF(svgCode, { totalBocas, totalDpms, totalIb });
}

// ==========================================
// MOTOR VECTORIAL SVG (SIMBOLOGÍA IEC 60617 / AEA)
// ==========================================
function dibujarSimboloPAT(x, y) {
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 16}" stroke="#15803d" stroke-width="1.8"/>
        <line x1="${x - 10}" y1="${y + 16}" x2="${x + 10}" y2="${y + 16}" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="${x - 6.5}" y1="${y + 20.5}" x2="${x + 6.5}" y2="${y + 20.5}" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="${x - 3}" y1="${y + 25}" x2="${x + 3}" y2="${y + 25}" stroke="#15803d" stroke-width="1.8" stroke-linecap="round"/>
    `;
}

function dibujarSimboloDobleAislacion(x, y, size = 11) {
    const pad = 2.8;
    return `
        <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <rect x="${x + pad}" y="${y + pad}" width="${size - pad * 2}" height="${size - pad * 2}" fill="none" stroke="#0f172a" stroke-width="1.2"/>
    `;
}

function dibujarSimboloPIA(x, y) {
    if (cacheSimboloPIA) {
        const altoDestino = 48;
        const escala = altoDestino / cacheSimboloPIA.h;
        const anchoEscalado = cacheSimboloPIA.w * escala;
        const offsetX = x - (anchoEscalado * 0.515);
        const offsetY = y - 1;

        return `
            <g transform="translate(${offsetX.toFixed(2)}, ${offsetY}) scale(${escala.toFixed(4)})">
                ${cacheSimboloPIA.inner}
            </g>
        `;
    }

    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#0f172a" stroke-width="1.8"/>
        <line x1="${x - 4}" y1="${y + 6}" x2="${x + 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${x + 4}" y1="${y + 6}" x2="${x - 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${x}" y1="${y + 32}" x2="${x - 10}" y2="${y + 12}" stroke="#0f172a" stroke-width="2"/>
        <polyline points="${x - 5},${y + 20} ${x - 14},${y + 20} ${x - 14},${y + 26} ${x - 5},${y + 26}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <path d="M ${x - 14} ${y + 26} A 4 4 0 0 0 ${x - 14} ${y + 33}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <line x1="${x}" y1="${y + 32}" x2="${x}" y2="${y + 46}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function dibujarSimboloID(x, y) {
    if (cacheSimboloID) {
        const altoDestino = 48;
        const escala = altoDestino / cacheSimboloID.h;
        const anchoEscalado = cacheSimboloID.w * escala;
        const offsetX = x - (anchoEscalado * 0.515);
        const offsetY = y - 1;

        return `
            <g transform="translate(${offsetX.toFixed(2)}, ${offsetY}) scale(${escala.toFixed(4)})">
                ${cacheSimboloID.inner}
            </g>
        `;
    }

    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#0f172a" stroke-width="1.8"/>
        <circle cx="${x}" cy="${y + 7}" r="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="${x}" y1="${y + 32}" x2="${x - 10}" y2="${y + 12}" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="${x}" cy="${y + 27}" rx="7.5" ry="3.5" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <polyline points="${x - 7.5},${y + 27} ${x - 15},${y + 27} ${x - 15},${y + 20} ${x - 6},${y + 20}" fill="none" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2,1.5"/>
        <line x1="${x}" y1="${y + 32}" x2="${x}" y2="${y + 46}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function generarSVGUnifilar() {
    const esTrifa = esSuministroTrifasico();
    const colW = 152;
    const tsGap = 78;
    const colorTablero = '#1d4ed8';
    const tableros = esquema.tablerosSeccionales;

    // Organizar niveles jerárquicos de TS (Nivel 2A desde TP, Nivel 2B subtableros desde otro TS)
    const idsTS = new Set(tableros.map(t => t.id));
    const tablerosNivel1 = tableros.filter(t => !t.origen || t.origen === 'TP' || !idsTS.has(t.origen));
    const tablerosHijos = tableros.filter(t => t.origen && t.origen !== 'TP' && idsTS.has(t.origen));

    const gruposPorId = {};
    tableros.forEach(ts => {
        const circs = esquema.circuitos.filter(c => c.tableroId === ts.id);
        const anchoContenido = Math.max(245, circs.length * colW);
        gruposPorId[ts.id] = { ts, circs, ancho: anchoContenido, cx: 0, bottomY: 0 };
    });

    const gruposPrincipales = tablerosNivel1.map(t => gruposPorId[t.id]);
    const gruposSub = tablerosHijos.map(t => gruposPorId[t.id]);

    const anchoFila1 = gruposPrincipales.reduce((acc, g) => acc + g.ancho, 0) + Math.max(0, gruposPrincipales.length - 1) * tsGap;
    const anchoFila2 = gruposSub.reduce((acc, g) => acc + g.ancho, 0) + Math.max(0, gruposSub.length - 1) * tsGap;
    const anchoMaxTS = Math.max(anchoFila1, anchoFila2);

    const svgW = Math.max(720, anchoMaxTS + 110);
    const centerX = Math.round(svgW / 2);

    let g = '';

// ==========================================
    // NIVEL 0: ACOMETIDA Y MEDICIÓN
    // ==========================================
    const yRdd = 24;
    g += `<line x1="${centerX - 130}" y1="${yRdd}" x2="${centerX + 130}" y2="${yRdd}" stroke="#0f172a" stroke-width="2.6"/>`;
    g += `<text x="${centerX - 138}" y="${yRdd + 4}" fill="#0f172a" font-size="10.5" font-weight="800" text-anchor="end">${escapeXml(esquema.nivel0.rdd)}</text>`;

    // Marcas de conductores en acometida
    const marcasLA = esTrifa ? 4 : 2;
    for (let m = 0; m < marcasLA; m++) {
        const my = yRdd + 10 + m * 4.5;
        g += `<line x1="${centerX - 5}" y1="${my + 3}" x2="${centerX + 5}" y2="${my - 2}" stroke="#0f172a" stroke-width="1.3"/>`;
    }
    g += `<text x="${centerX + 12}" y="${yRdd + 18}" fill="#334155" font-size="8.8" font-weight="700">${escapeXml(esquema.nivel0.lineaAlim)}</text>`;

    // DPLA (Fusible de acometida)
    const yDpla = yRdd + 32;
    g += `<line x1="${centerX}" y1="${yRdd}" x2="${centerX}" y2="${yDpla}" stroke="#0f172a" stroke-width="1.8"/>`;
    if (esquema.nivel0.dpla !== 'Sin DPLA') {
        g += `<rect x="${centerX - 6}" y="${yDpla}" width="12" height="22" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>`;
        g += `<line x1="${centerX}" y1="${yDpla}" x2="${centerX}" y2="${yDpla + 22}" stroke="#0f172a" stroke-width="1.3"/>`;
        g += `<text x="${centerX - 12}" y="${yDpla + 14}" fill="#0f172a" font-size="9" font-weight="800" text-anchor="end">${escapeXml(esquema.nivel0.dpla)}</text>`;
    }

    // Medidor (M)
    const yMed = yDpla + 34;
    g += `<line x1="${centerX}" y1="${yDpla + 22}" x2="${centerX}" y2="${yMed}" stroke="#0f172a" stroke-width="1.8"/>`;
    g += `<rect x="${centerX - 15}" y="${yMed}" width="30" height="28" rx="3" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>`;
    g += `<text x="${centerX}" y="${yMed + 18}" fill="#0f172a" font-size="12" font-weight="800" text-anchor="middle">M</text>`;
    g += `<text x="${centerX + 22}" y="${yMed + 17}" fill="#334155" font-size="8.8" font-weight="700">${escapeXml(esquema.nivel0.medidor)}</text>`;

    // ==========================================
    // NIVEL 1: TABLERO PRINCIPAL (TP)
    // ==========================================
    const tpBoxW = 290;
    const tpBoxH = 104;
    const tpX = centerX - Math.round(tpBoxW / 2);
    const tpY = yMed + 44;

    g += `<line x1="${centerX}" y1="${yMed + 28}" x2="${centerX}" y2="${tpY + 12}" stroke="#0f172a" stroke-width="1.8"/>`;
    g += `<rect x="${tpX}" y="${tpY}" width="${tpBoxW}" height="${tpBoxH}" rx="6" fill="rgba(29, 78, 216, 0.025)" stroke="${colorTablero}" stroke-width="1.6" stroke-dasharray="6,4"/>`;
    g += `<text x="${tpX + 10}" y="${tpY + 15}" fill="${colorTablero}" font-size="10.5" font-weight="800">${escapeXml(esquema.nivel1.nombre)} (${escapeXml(esquema.nivel1.ip)})</text>`;
    if (esquema.nivel1.dobleAislacion !== false) {
        g += dibujarSimboloDobleAislacion(tpX + tpBoxW - 22, tpY + 6, 11);
    }

    // Cabecera TP
    const yTpDisp = tpY + 12;
    g += dibujarSimboloPIA(centerX, yTpDisp);
    g += `<text x="${centerX - 18}" y="${yTpDisp + 18}" fill="#0f172a" font-size="9" font-weight="800" text-anchor="end">${escapeXml(esquema.nivel1.tipoDisp)} ${escapeXml(esquema.nivel1.curvaPolos)}${escapeXml(esquema.nivel1.in)}A</text>`;
    g += `<text x="${centerX - 18}" y="${yTpDisp + 30}" fill="#475569" font-size="8.2" font-weight="600" text-anchor="end">Pcc ${escapeXml(esquema.nivel1.pcc)}A • ${escapeXml(esquema.nivel1.tension)}V</text>`;

    // DPS opcional en TP
    if (esquema.nivel1.dps && esquema.nivel1.dps !== 'NO') {
        const dpsX = centerX + 68;
        const yBusTp = yTpDisp + 54;
        g += `<line x1="${centerX}" y1="${yBusTp}" x2="${dpsX}" y2="${yBusTp}" stroke="#0f172a" stroke-width="1.5"/>`;
        g += `<rect x="${dpsX - 9}" y="${yBusTp + 6}" width="18" height="22" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>`;
        g += `<line x1="${dpsX}" y1="${yBusTp}" x2="${dpsX}" y2="${yBusTp + 6}" stroke="#0f172a" stroke-width="1.5"/>`;
        g += `<polygon points="${dpsX},${yBusTp + 10} ${dpsX - 3.5},${yBusTp + 17} ${dpsX + 3.5},${yBusTp + 17}" fill="#0f172a"/>`;
        g += `<text x="${dpsX + 14}" y="${yBusTp + 20}" fill="#334155" font-size="8" font-weight="700">DPS ${escapeXml(esquema.nivel1.dps)}</text>`;
    }

    const yTpBottom = tpY + tpBoxH;
    g += `<line x1="${centerX}" y1="${yTpDisp + 46}" x2="${centerX}" y2="${yTpBottom + 16}" stroke="#0f172a" stroke-width="1.8"/>`;

    // Helper interno para dibujar cada bloque TS
    function renderizarBloqueTS(grupo, tsX, yDistStart, yTsTop, tsBoxH, origenNombre) {
        const { ts, circs, ancho } = grupo;
        const tsCenterX = tsX + Math.round(ancho / 2);
        grupo.cx = tsCenterX;
        grupo.bottomY = yTsTop + tsBoxH;

        // Bajada desde línea de distribución al TS
        g += `<line x1="${tsCenterX}" y1="${yDistStart}" x2="${tsCenterX}" y2="${yTsTop + 14}" stroke="#0f172a" stroke-width="1.8"/>`;
        g += `<text x="${tsCenterX + 8}" y="${yDistStart + 15}" fill="#334155" font-size="8.4" font-weight="700">${escapeXml(ts.lineaAlim || esquema.nivel1.lineaSec)}</text>`;

        // Envolvente del TS
        g += `<rect x="${tsX}" y="${yTsTop}" width="${ancho}" height="${tsBoxH}" rx="7" fill="rgba(29, 78, 216, 0.02)" stroke="${colorTablero}" stroke-width="1.7" stroke-dasharray="6,4"/>`;
        const tituloTs = origenNombre && origenNombre !== 'TP'
            ? `${ts.nombre} (${ts.ip}) ← ${origenNombre}`
            : `${ts.nombre} (${ts.ip})`;
        g += `<text x="${tsX + 10}" y="${yTsTop + 16}" fill="${colorTablero}" font-size="10.5" font-weight="800">${escapeXml(tituloTs)}</text>`;
        if (ts.ubicacion) {
            g += `<text x="${tsX + 10}" y="${yTsTop + 28}" fill="#475569" font-size="8.5" font-weight="600">${escapeXml(ts.ubicacion)}</text>`;
        }
        if (ts.dobleAislacion !== false) {
            g += dibujarSimboloDobleAislacion(tsX + ancho - 22, yTsTop + 7, 11);
        }

        // Cabecera del TS (ID o PIA)
        const yCabTs = yTsTop + 14;
        const esID = String(ts.tipoCab || '').toLowerCase().includes('id');
        g += esID
            ? dibujarSimboloID(tsCenterX, yCabTs)
            : dibujarSimboloPIA(tsCenterX, yCabTs);

        g += `<text x="${tsCenterX - 18}" y="${yCabTs + 20}" fill="#0f172a" font-size="9" font-weight="800" text-anchor="end">${escapeXml(ts.tipoCab)} ${escapeXml(ts.in)}</text>`;
        g += `<text x="${tsCenterX - 18}" y="${yCabTs + 32}" fill="#475569" font-size="8.2" font-weight="600" text-anchor="end">${esID && ts.sens !== 'N/A' ? `IΔn ${escapeXml(ts.sens)} • ` : ''}Pcc ${escapeXml(ts.pcc)}A</text>`;

        // Barra de distribución interna del TS
        const yBus = yCabTs + 58;
        g += `<line x1="${tsCenterX}" y1="${yCabTs + 46}" x2="${tsCenterX}" y2="${yBus}" stroke="#0f172a" stroke-width="1.8"/>`;

        // Bornera PE interna + PAT externa a la derecha del gabinete
        const peBarY = yTsTop + tsBoxH - 22;
        const peBarX1 = tsX + 18;
        const peBarX2 = tsX + ancho - 18;
        const patExtX = tsX + ancho + 26;

        g += `<line x1="${peBarX1}" y1="${peBarY}" x2="${peBarX2}" y2="${peBarY}" stroke="#15803d" stroke-width="1.8" stroke-dasharray="4,2"/>`;
        g += `<text x="${peBarX1}" y="${peBarY - 4}" fill="#15803d" font-size="7.8" font-weight="800">BARRA PE</text>`;
        g += `<line x1="${peBarX2}" y1="${peBarY}" x2="${patExtX}" y2="${peBarY}" stroke="#15803d" stroke-width="1.8"/>`;
        g += `<line x1="${patExtX}" y1="${peBarY}" x2="${patExtX}" y2="${peBarY + 6}" stroke="#15803d" stroke-width="1.8"/>`;
        g += dibujarSimboloPAT(patExtX, peBarY + 6);
        g += `<text x="${patExtX}" y="${peBarY + 41}" fill="#15803d" font-size="8" font-weight="800" text-anchor="middle">${escapeXml(ts.pat || 'PAT ≤ 40 Ω')}</text>`;

        // Circuitos del TS
        if (circs.length === 0) {
            g += `<text x="${tsCenterX}" y="${yBus + 65}" fill="#64748b" font-size="9.5" font-weight="600" text-anchor="middle">Sin circuitos terminales asignados</text>`;
        } else {
            const totalAnchoCircs = (circs.length - 1) * colW;
            const startCx = tsCenterX - Math.round(totalAnchoCircs / 2);
            const firstCx = startCx;
            const lastCx = startCx + totalAnchoCircs;

            if (circs.length > 1) {
                g += `<line x1="${firstCx}" y1="${yBus}" x2="${lastCx}" y2="${yBus}" stroke="#0f172a" stroke-width="2.4"/>`;
            }

            circs.forEach((c, idxC) => {
                const cx = startCx + idxC * colW;
                const yPiaC = yBus + 14;

                g += `<line x1="${cx}" y1="${yBus}" x2="${cx}" y2="${yPiaC}" stroke="#0f172a" stroke-width="1.7"/>`;
                g += dibujarSimboloPIA(cx, yPiaC);

                // Etiquetas de protección a la izquierda de cada PIA
                g += `<text x="${cx - 14}" y="${yPiaC + 14}" fill="#0f172a" font-size="8.6" font-weight="800" text-anchor="end">${escapeXml(c.piaCod)}</text>`;
                g += `<text x="${cx - 14}" y="${yPiaC + 25}" fill="#1e293b" font-size="8.2" font-weight="700" text-anchor="end">${escapeXml(c.curvaPolos)}${escapeXml(c.in)}A</text>`;
                g += `<text x="${cx - 14}" y="${yPiaC + 36}" fill="#475569" font-size="7.6" font-weight="600" text-anchor="end">${escapeXml(c.pcc)}A • ${escapeXml(c.tension)}V</text>`;

                if (esTrifa) {
                    g += `<rect x="${cx + 12}" y="${yPiaC + 8}" width="38" height="13" rx="3" fill="#eff6ff" stroke="#93c5fd" stroke-width="0.8"/>`;
                    g += `<text x="${cx + 31}" y="${yPiaC + 17.5}" fill="#1d4ed8" font-size="7.5" font-weight="800" text-anchor="middle">${escapeXml(c.fase)}</text>`;
                }

                // Salida hacia caja de circuito
                const yCaja = yTsTop + tsBoxH - 76;
                g += `<line x1="${cx}" y1="${yPiaC + 46}" x2="${cx}" y2="${yCaja}" stroke="#0f172a" stroke-width="1.7"/>`;

                // Marcas inclinadas de conductores L;N y PE
                const yMarcas = yPiaC + 62;
                g += `<line x1="${cx - 4.5}" y1="${yMarcas + 2.5}" x2="${cx + 4.5}" y2="${yMarcas - 2}" stroke="#0f172a" stroke-width="1.2"/>`;
                g += `<line x1="${cx - 4.5}" y1="${yMarcas + 6.5}" x2="${cx + 4.5}" y2="${yMarcas + 2}" stroke="#0f172a" stroke-width="1.2"/>`;
                g += `<line x1="${cx - 4.5}" y1="${yMarcas + 10.5}" x2="${cx + 4.5}" y2="${yMarcas + 6}" stroke="#15803d" stroke-width="1.2"/>`;

                g += `<text x="${cx + 8}" y="${yMarcas + 4}" fill="#0f172a" font-size="7.8" font-weight="700">2×${escapeXml(c.secLN)} mm²</text>`;
                g += `<text x="${cx + 8}" y="${yMarcas + 14}" fill="#15803d" font-size="7.6" font-weight="700">PE ${escapeXml(c.secPE)} mm²</text>`;

                // Derivación PE desde bornera hacia el conductor del circuito
                g += `<circle cx="${cx + 4}" cy="${peBarY}" r="2.2" fill="#15803d"/>`;
                g += `<line x1="${cx + 4}" y1="${peBarY}" x2="${cx + 4}" y2="${yCaja}" stroke="#15803d" stroke-width="1.1" stroke-dasharray="2.5,2"/>`;

                // Caja Terminal del Circuito
                const boxW = 132;
                const boxH = 44;
                const bx = cx - Math.round(boxW / 2);
                const descCorta = String(c.desc || '').length > 20 ? String(c.desc).slice(0, 19) + '…' : String(c.desc || '');
                const bocaLabel = `${c.bocas} ${c.bocas === 1 ? 'boca' : 'bocas'}`;

                g += `<rect x="${bx}" y="${yCaja}" width="${boxW}" height="${boxH}" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="1.4"/>`;
                g += `<text x="${cx}" y="${yCaja + 13}" fill="#0f172a" font-size="9.2" font-weight="800" text-anchor="middle">${escapeXml(c.id)} • ${escapeXml(c.tipo)}</text>`;
                g += `<text x="${cx}" y="${yCaja + 25}" fill="#334155" font-size="7.8" font-weight="600" text-anchor="middle">${escapeXml(descCorta)}</text>`;
                g += `<text x="${cx}" y="${yCaja + 37}" fill="#1d4ed8" font-size="8" font-weight="800" text-anchor="middle">${escapeXml(bocaLabel)} • ${Math.round(c.dpms)} VA</text>`;
            });
        }
    }

    // ==========================================
    // NIVEL 2 Y NIVEL 3: TABLEROS SECCIONALES Y CIRCUITOS
    // ==========================================
    const yDistBar = yTpBottom + 16;
    const yTsTop = yDistBar + 26;
    const tsBoxH = 292;

    let cursorX = Math.round((svgW - anchoFila1) / 2);
    const centrosTSFila1 = [];

    gruposPrincipales.forEach((grupo) => {
        const tsCenterX = cursorX + Math.round(grupo.ancho / 2);
        centrosTSFila1.push(tsCenterX);
        cursorX += grupo.ancho + tsGap;
    });

    if (centrosTSFila1.length > 1) {
        g += `<line x1="${centrosTSFila1[0]}" y1="${yDistBar}" x2="${centrosTSFila1[centrosTSFila1.length - 1]}" y2="${yDistBar}" stroke="#0f172a" stroke-width="2"/>`;
    }

    cursorX = Math.round((svgW - anchoFila1) / 2);
    gruposPrincipales.forEach((grupo) => {
        renderizarBloqueTS(grupo, cursorX, yDistBar, yTsTop, tsBoxH, 'TP');
        cursorX += grupo.ancho + tsGap;
    });

    let maxBottomY = yTsTop + tsBoxH;

    // Si hay subtableros en cascada (alimentados desde otro TS)
    if (gruposSub.length > 0) {
        const ySubDist = maxBottomY + 24;
        const ySubTsTop = ySubDist + 26;
        let cursorSubX = Math.round((svgW - anchoFila2) / 2);

        gruposSub.forEach((grupo) => {
            const padre = gruposPorId[grupo.ts.origen];
            const subCenterX = cursorSubX + Math.round(grupo.ancho / 2);

            if (padre) {
                g += `<line x1="${padre.cx}" y1="${padre.bottomY}" x2="${padre.cx}" y2="${ySubDist}" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="4,2"/>`;
                g += `<line x1="${padre.cx}" y1="${ySubDist}" x2="${subCenterX}" y2="${ySubDist}" stroke="#0f172a" stroke-width="1.8"/>`;
            }

            renderizarBloqueTS(grupo, cursorSubX, ySubDist, ySubTsTop, tsBoxH, padre ? padre.ts.nombre : 'TS');
            cursorSubX += grupo.ancho + tsGap;
        });

        maxBottomY = ySubTsTop + tsBoxH;
    }

    const svgH = maxBottomY + 54;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">${g}</svg>`;
}

// ==========================================
// SINCRONIZACIÓN DE LÁMINA A4 Y MEMBRETE
// ==========================================
function actualizarPDFHeaders() {
    const profNombre = (localStorage.getItem('villaser_conf_nombre') || 'VILLASER GESTIÓN').trim();
    const profTel = (localStorage.getItem('villaser_conf_telefono') || '').trim();
    const profLogo = localStorage.getItem('villaser_conf_logo') || '';
    const profMatricula = (localStorage.getItem('villaser_conf_matricula') || '').trim();

    const elEmp = document.getElementById('pdf-empresa-nombre');
    const elMat = document.getElementById('pdf-empresa-matricula');
    const elTel = document.getElementById('pdf-empresa-tel');
    const elLogo = document.getElementById('pdf-logo-img');
    const elFoot = document.getElementById('pdf-footer-contacto');

    if (elEmp) elEmp.innerText = profNombre.toUpperCase();
    if (elMat) elMat.innerText = profMatricula ? `Mat.: ${profMatricula}` : '';
    if (elTel) elTel.innerText = profTel ? `Tel.: ${profTel}` : '';
    if (elFoot) elFoot.innerText = [profNombre, profTel].filter(Boolean).join(' • ');

    if (elLogo) {
        if (profLogo) {
            elLogo.src = profLogo;
            elLogo.style.display = 'block';
        } else {
            elLogo.style.display = 'none';
        }
    }
}

function sincronizarVistaPreviaPDF(svgCode, totales) {
    actualizarPDFHeaders();

    const cli = document.getElementById('cliNombre').value.trim() || 'Cliente';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();

    document.getElementById('pdf-cliente').innerText = cli;
    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');
    document.getElementById('pdf-suministro').innerText = esquema.nivel0.suministro;

    const dirWrap = document.getElementById('pdf-direccion-wrap');
    const proyWrap = document.getElementById('pdf-proyecto-wrap');
    const rowDirProy = document.getElementById('pdf-row-dir-proy');
    if (dirWrap) dirWrap.style.display = dir ? '' : 'none';
    if (proyWrap) proyWrap.style.display = proy ? '' : 'none';
    if (rowDirProy) rowDirProy.style.display = (dir || proy) ? '' : 'none';
    document.getElementById('pdf-direccion').innerText = dir;
    document.getElementById('pdf-proyecto').innerText = proy;

    const svgCont = document.getElementById('pdf-svg-container');
    if (svgCont) svgCont.innerHTML = svgCode;

    const mapaTS = {};
    esquema.tablerosSeccionales.forEach(t => { mapaTS[t.id] = t; });

    const tbody = document.getElementById('pdf-tbody');
    if (tbody) {
        tbody.innerHTML = esquema.circuitos.map(c => {
            const ib = calcularIbCircuito(c);
            const tsNom = mapaTS[c.tableroId]?.nombre || 'TS1';
            return `
                <tr>
                    <td><strong>${escapeHtml(tsNom)}</strong></td>
                    <td><strong>${escapeHtml(c.id)}</strong></td>
                    <td>${escapeHtml(c.tipo)}</td>
                    <td style="text-align:left;">${escapeHtml(c.desc)}</td>
                    <td>${escapeHtml(c.fase)}</td>
                    <td>${c.bocas}</td>
                    <td>${Math.round(c.dpms)}</td>
                    <td>${ib.toFixed(1)}</td>
                    <td>${escapeHtml(c.piaCod)} (${escapeHtml(c.curvaPolos)}${escapeHtml(c.in)}A)</td>
                    <td>2×${escapeHtml(c.secLN)} + PE ${escapeHtml(c.secPE)}</td>
                </tr>
            `;
        }).join('');
    }

    document.getElementById('pdf-total-bocas').innerText = totales.totalBocas;
    document.getElementById('pdf-total-dpms').innerText = `${Math.round(totales.totalDpms)} VA`;
    document.getElementById('pdf-total-ib').innerText = `${totales.totalIb.toFixed(1)} A`;
    document.getElementById('pdf-total-ts').innerText = `${esquema.tablerosSeccionales.length} Tablero(s) Seccional(es)`;

    const refs = document.getElementById('pdf-referencias');
    if (refs) {
        const tsInfo = esquema.tablerosSeccionales.map(t =>
            `<strong>${escapeHtml(t.nombre)}:</strong> ${escapeHtml(t.tipoCab)} ${escapeHtml(t.in)} (${escapeHtml(t.sens)}) • ${escapeHtml(t.pat)}`
        ).join(' | ');

        refs.innerHTML = `
            <div><strong>RDD / DPLA / M:</strong> Red Distribución, Fusible Acometida y Medidor</div>
            <div><strong>${escapeHtml(esquema.nivel1.nombre)}:</strong> ${escapeHtml(esquema.nivel1.tipoDisp)} ${escapeHtml(esquema.nivel1.curvaPolos)}${escapeHtml(esquema.nivel1.in)}A • Pcc ${escapeHtml(esquema.nivel1.pcc)}A</div>
            <div><strong>PIA:</strong> Pequeño Interruptor Automático (Termomagnética IEC 60898)</div>
            <div><strong>ID:</strong> Interruptor Diferencial 30 mA (Protección contra contactos)</div>
            <div><strong>IUG / TUG / ACU:</strong> Iluminación, Tomas Generales y Carga Única</div>
            <div>${tsInfo}</div>
        `;
    }
}

// ==========================================
// VISTA PREVIA A4 FULLSCREEN CON PINCH-TO-ZOOM
// ==========================================
let escalaActualPreview = 1;
let gestosPreviewIniciados = false;

function aplicarEscalaVistaPrevia(nuevaEscala) {
    escalaActualPreview = Math.min(2.4, Math.max(0.42, nuevaEscala));
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla ? plantilla.querySelector('.pdf-container') : null;
    const txtZoom = document.getElementById('txtZoomPreview');

    if (pdfContainer) {
        pdfContainer.style.transformOrigin = 'top left';
        pdfContainer.style.transform = `scale(${escalaActualPreview})`;
        plantilla.style.width = `${Math.round(794 * escalaActualPreview)}px`;
        plantilla.style.height = `${Math.round(1115 * escalaActualPreview)}px`;
        plantilla.style.margin = '0 auto';
    }
    if (txtZoom) {
        txtZoom.innerText = `${Math.round(escalaActualPreview * 100)}%`;
    }
}

function cambiarZoomPreview(delta) {
    aplicarEscalaVistaPrevia(escalaActualPreview + delta);
}

function iniciarGestosPinchPreview() {
    if (gestosPreviewIniciados) return;
    const wrapper = document.getElementById('previewWrapper');
    if (!wrapper) return;
    gestosPreviewIniciados = true;

    let distInicial = 0;
    let escalaBase = 1;
    let ultimoTap = 0;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            distInicial = Math.hypot(dx, dy);
            escalaBase = escalaActualPreview;
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && distInicial > 0) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distActual = Math.hypot(dx, dy);
            aplicarEscalaVistaPrevia(escalaBase * (distActual / distInicial));
        }
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) distInicial = 0;
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const ahora = Date.now();
            if (ahora - ultimoTap < 280) {
                const escalaFit = Math.min(1, (window.innerWidth - 24) / 794);
                aplicarEscalaVistaPrevia(escalaActualPreview > escalaFit * 1.15 ? escalaFit : 1.15);
            }
            ultimoTap = ahora;
        }
    }, { passive: true });
}

function abrirVistaPrevia() {
    cerrarDrawerUnifilar();
    renderizarTodo();

    const modal = document.getElementById('modalVistaPrevia');
    const wrapper = document.getElementById('previewWrapper');
    const plantilla = document.getElementById('plantilla-pdf');

    if (!modal || !wrapper || !plantilla) return;

    plantilla.style.display = 'block';
    wrapper.innerHTML = '';
    wrapper.appendChild(plantilla);

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    const escalaFit = Math.min(1, (window.innerWidth - 24) / 794);
    aplicarEscalaVistaPrevia(escalaFit);
    iniciarGestosPinchPreview();
}

function cerrarVistaPrevia() {
    const modal = document.getElementById('modalVistaPrevia');
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla ? plantilla.querySelector('.pdf-container') : null;
    const aside = document.querySelector('.preview-panel');

    modal.classList.add('oculto');
    document.body.style.overflow = '';

    if (pdfContainer) {
        pdfContainer.style.transform = '';
        pdfContainer.style.transformOrigin = '';
    }
    if (plantilla) {
        plantilla.style.width = '';
        plantilla.style.height = '';
        plantilla.style.margin = '';
        if (aside) {
            plantilla.style.display = '';
            aside.appendChild(plantilla);
        }
    }
}

// ==========================================
// EXPORTACIÓN PDF (RASTERIZACIÓN SVG 3X SIN SELLO)
// ==========================================
function generarPDF() {
    renderizarTodo();
    const shortName = (document.getElementById('cliNombre').value || "Proyecto").trim().split(' ')[0].replace(/[^a-zA-Z0-9_-]/g, '') || "Proyecto";
    const uniqueSuffix = Math.floor(Math.random() * 9000) + 1000;

    document.getElementById('nombreArchivoPDF').value = `Esquema_Unifilar_${shortName}_${uniqueSuffix}`;
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
                                           }

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
}

async function convertirSvgUnifilarAImagen() {
    const contenedor = document.getElementById('pdf-svg-container');
    if (!contenedor) return () => {};

    const svgOriginalHTML = contenedor.innerHTML;
    const svgEl = contenedor.querySelector('svg');
    if (!svgEl) return () => {};

    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    const ancho = (vb && vb.width) ? vb.width : (parseInt(svgEl.getAttribute('width'), 10) || 720);
    const alto = (vb && vb.height) ? vb.height : (parseInt(svgEl.getAttribute('height'), 10) || 420);

    const svgClon = svgEl.cloneNode(true);
    svgClon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClon.setAttribute('width', ancho);
    svgClon.setAttribute('height', alto);

    const xml = new XMLSerializer().serializeToString(svgClon);
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

    try {
        const pngDataUrl = await new Promise((resolve, reject) => {
            const imgLoader = new Image();
            imgLoader.onload = () => {
                try {
                    const escala = 3;
                    const canvas = document.createElement('canvas');
                    canvas.width = ancho * escala;
                    canvas.height = alto * escala;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(escala, escala);
                    ctx.drawImage(imgLoader, 0, 0, ancho, alto);
                    resolve(canvas.toDataURL('image/png'));
                } catch (err) {
                    reject(err);
                }
            };
            imgLoader.onerror = reject;
            imgLoader.src = dataUri;
        });

        const imgFinal = document.createElement('img');
        imgFinal.src = pngDataUrl;
        imgFinal.alt = 'Esquema Unifilar';
        imgFinal.style.cssText = 'width: 100%; max-height: 430px; height: auto; object-fit: contain; display: block; margin: 0 auto;';
        contenedor.innerHTML = '';
        contenedor.appendChild(imgFinal);

        return () => { contenedor.innerHTML = svgOriginalHTML; };
    } catch (e) {
        console.warn('Error rasterizando SVG:', e);
        return () => { contenedor.innerHTML = svgOriginalHTML; };
    }
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    if (permiteGuardarNube && clienteDesdeAgenda) {
        guardarBorradorFirebase(false, true);
    }

    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    const modalAbierto = !document.getElementById('modalVistaPrevia').classList.contains('oculto');

    if (!modalAbierto) {
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

    const restaurarSvg = await convertirSvgUnifilarAImagen();
    const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Esquema_Unifilar';

    const opt = {
        margin: 0,
        filename: `${nombreFinal}.pdf`,
        image: { type: 'png' },
        html2canvas: { scale: 3, useCORS: true, letterRendering: true, scrollY: 0, width: 794, height: 1115 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    try {
        await html2pdf()
            .set(opt)
            .from(element)
            .toPdf()
            .get('pdf')
            .then((pdf) => {
                const totalPages = pdf.internal.getNumberOfPages();
                for (let i = totalPages; i > 1; i--) {
                    pdf.deletePage(i);
                }
            })
            .save();

        cerrarModalPDF();
        mostrarToast("PDF Generado", "Plano Unifilar A4 descargado correctamente.");
    } catch (error) {
        mostrarAlertaCorp("Error", "Ocurrió un error al generar el PDF.");
    } finally {
        restaurarSvg();
        btn.innerHTML = "Descargar";
        element.style.width = '';
        element.style.height = '';
        element.style.overflow = '';

        if (marcaAgua) marcaAgua.style.display = 'flex';
        if (modalAbierto) {
            aplicarEscalaVistaPrevia(escalaActualPreview);
        } else if (window.innerWidth < 992) {
            element.style.display = 'none';
        }
    }
}

// ==========================================
// WHATSAPP EJECUTIVO (INTEGRACIÓN GLOBAL)
// ==========================================
function prepararEnvioWhatsApp() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'VILLASER GESTIÓN';
    const cli = document.getElementById('cliNombre').value.trim() || 'Cliente';
    const proy = document.getElementById('cliProyecto').value.trim();
    const totalDpms = esquema.circuitos.reduce((acc, c) => acc + (parseFloat(c.dpms) || 0), 0);

    let msg = `*${profNombre.toUpperCase()} - ESQUEMA UNIFILAR*\n`;
    msg += `*Cliente:* ${cli}\n`;
    if (proy) msg += `*Proyecto:* ${proy}\n`;
    msg += `\n*Estructura General (AEA 90364):*\n`;
    msg += `• Suministro: ${esquema.nivel0.suministro}\n`;
    msg += `• ${esquema.nivel1.nombre} (${esquema.nivel1.ip}): ${esquema.nivel1.tipoDisp} ${esquema.nivel1.curvaPolos}${esquema.nivel1.in}A\n`;
    esquema.tablerosSeccionales.forEach(t => {
        msg += `• ${t.nombre} (${t.ip}): ${t.tipoCab} ${t.in} (${t.sens}) • ${t.pat}\n`;
    });
    msg += `• Potencia Total (DPMS): ${Math.round(totalDpms)} VA\n\n`;

    msg += `*Circuitos Terminales (${esquema.circuitos.length}):*\n`;
    esquema.circuitos.forEach(c => {
        msg += `• *${c.id} (${c.tipo}):* ${c.desc} — PIA ${c.curvaPolos}${c.in}A • 2×${c.secLN}+PE${c.secPE}mm² (${c.bocas} bocas • ${Math.round(c.dpms)} VA)\n`;
    });

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, msg);
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

// ==========================================
// FIREBASE: GUARDAR, ABRIR Y ELIMINAR BORRADORES
// ==========================================
function guardarBorradorFirebase(pedirNombre = true, silencioso = false) {
    const uid = obtenerUid();
    if (!uid || !db) {
        if (!silencioso) mostrarAlertaCorp("Sin Sesión", "No se detectó sesión activa para guardar en la nube.");
        return;
    }
    if (!permiteGuardarNube || !clienteDesdeAgenda) {
        if (!silencioso) mostrarAlertaCorp("Cliente no Agendado", "Vinculá el cliente desde Agenda para guardar borradores en la nube.");
        return;
    }

    const cli = document.getElementById('cliNombre').value.trim() || 'Proyecto';
    const proy = document.getElementById('cliProyecto').value.trim();
    const sugerido = nombreBorradorActual || (proy ? `${cli} — ${proy}` : `${cli} — Unifilar`);

    if (pedirNombre) {
        document.getElementById('inputNombreBorrador').value = sugerido;
        document.getElementById('modalGuardarBorrador').classList.remove('oculto');
    } else {
        ejecutarGuardarNube(sugerido, !silencioso);
    }
}

function cerrarModalGuardarBorrador() {
    document.getElementById('modalGuardarBorrador').classList.add('oculto');
}

function ejecutarGuardarBorrador() {
    const nombreIngresado = document.getElementById('inputNombreBorrador').value.trim();
    if (!nombreIngresado) {
        mostrarAlertaCorp("Faltan Datos", "Debes ingresar un nombre para el borrador.");
        return;
    }
    nombreBorradorActual = nombreIngresado;
    cerrarModalGuardarBorrador();
    ejecutarGuardarNube(nombreBorradorActual, true);
}

function ejecutarGuardarNube(nombreFinal, mostrarAlerta) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    actualizarResumenProyectoUI('syncing');

    const cliNombre = document.getElementById('cliNombre').value.trim();
    const cliDireccion = document.getElementById('cliDireccion').value.trim();
    const cliProyecto = document.getElementById('cliProyecto').value.trim();

    const docId = nombreFinal.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `unifilar_${Date.now()}`;

    const payload = {
        nombreBorrador: nombreFinal,
        cliNombre,
        cliDireccion,
        cliProyecto,
        telefonoClienteActual,
        esquema,
        fechaGuardado: Date.now()
    };

    db.collection("perfiles").doc(uid).collection("borradores_unifilar").doc(docId).set(payload)
        .then(() => {
            actualizarResumenProyectoUI('synced');
            guardarEstadoLocal(false);
            if (mostrarAlerta) mostrarToast("Guardado en Nube", "Esquema unifilar sincronizado.");
        })
        .catch(() => {
            actualizarResumenProyectoUI('ready');
            if (mostrarAlerta) mostrarAlertaCorp("Error", "No se pudo guardar el borrador en la nube.");
        });
}

async function abrirModalBorradores() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp("Sin Sesión", "Iniciá sesión para ver tus borradores en la nube.");
        return;
    }

    const modal = document.getElementById('modalBorradores');
    const lista = document.getElementById('listaBorradores');
    lista.innerHTML = '<p style="text-align:center; color:var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando esquemas...</p>';
    modal.classList.remove('oculto');

    try {
        const snap = await db.collection("perfiles").doc(uid).collection("borradores_unifilar").orderBy("fechaGuardado", "desc").get();
        if (snap.empty) {
            lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No hay esquemas unifilares guardados en la nube.</p>';
            return;
        }

        lista.innerHTML = '';
        snap.forEach(doc => {
            const d = doc.data();
            const cantC = d.esquema && Array.isArray(d.esquema.circuitos) ? d.esquema.circuitos.length : 0;
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.innerHTML = `
                <div>
                    <h4>${escapeHtml(d.nombreBorrador || doc.id)}</h4>
                    <small>${escapeHtml(d.cliNombre || 'Cliente')} • ${cantC} circuitos</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="corp-btn-small primary-action" onclick="cargarBorradorNube('${escapeJs(doc.id)}')">Abrir</button>
                    <button type="button" class="corp-btn-small danger" onclick="confirmarEliminarBorrador('${escapeJs(doc.id)}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al consultar borradores.</p>';
    }
}

async function cargarBorradorNube(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    try {
        const doc = await db.collection("perfiles").doc(uid).collection("borradores_unifilar").doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('cliNombre').value = data.cliNombre || '';
            document.getElementById('cliDireccion').value = data.cliDireccion || '';
            document.getElementById('cliProyecto').value = data.cliProyecto || '';

            if (data.esquema) esquema = normalizarEsquema(data.esquema);
            if (data.telefonoClienteActual !== undefined) telefonoClienteActual = data.telefonoClienteActual;

            filtroTSCircuitos = 'TODOS';
            clienteDesdeAgenda = true;
            permiteGuardarNube = true;
            nombreBorradorActual = data.nombreBorrador || null;

            const modalBorr = document.getElementById('modalBorradores');
            if (modalBorr) modalBorr.classList.add('oculto');
            if (typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();

            avanzarPasoTrabajo(true);
            actualizarResumenProyectoUI('synced');
            guardarEstadoLocal(false);
            mostrarToast("Esquema Abierto", "Los datos han sido cargados.");
        }
    } catch (e) {
        mostrarAlertaCorp("Error", "Error al cargar el borrador.");
    }
                              }

function confirmarEliminarBorrador(docId) {
    borradorPendienteEliminar = docId;
    document.getElementById('modalConfirmarEliminar').classList.remove('oculto');
}

function cerrarModalEliminarBorrador() {
    document.getElementById('modalConfirmarEliminar').classList.add('oculto');
    borradorPendienteEliminar = null;
}

async function ejecutarEliminarBorrador() {
    const uid = obtenerUid();
    if (!uid || !db || !borradorPendienteEliminar) return;

    const docId = borradorPendienteEliminar;
    cerrarModalEliminarBorrador();

    try {
        await db.collection("perfiles").doc(uid).collection("borradores_unifilar").doc(docId).delete();
        mostrarToast("Eliminado", "Borrador eliminado de la nube.");
        abrirModalBorradores();
    } catch (e) {
        mostrarAlertaCorp("Error", "No se pudo eliminar el borrador.");
    }
}

// ==========================================
// MENÚ INFERIOR SCROLL (13 MÓDULOS GLOBALES)
// ==========================================
function generarMenuInferior() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;

    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '#', active: true },
        { nombre: 'Topografico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-compass-drafting', url: '../croquis/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
    ];

    footer.innerHTML = '';

    modulos.forEach(mod => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `corp-nav-item ${mod.active ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid ${mod.icon}"></i><span>${mod.nombre}</span>`;
        btn.onclick = () => {
            if (!mod.active) window.location.replace(mod.url);
        };
        footer.appendChild(btn);
    });

    requestAnimationFrame(() => {
        const btnActivo = footer.querySelector('.corp-nav-item.active');
        if (btnActivo) {
            const footerRect = footer.getBoundingClientRect();
            const btnRect = btnActivo.getBoundingClientRect();
            footer.scrollLeft += (btnRect.left - footerRect.left) - (footerRect.width / 2) + (btnRect.width / 2);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', generarMenuInferior);
} else {
    generarMenuInferior();
}
