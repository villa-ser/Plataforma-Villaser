// ==========================================
// INICIALIZACIÓN Y ESTADO JERÁRQUICO UNIFILAR
// ==========================================
let db = null;
let uidSeguro = null;

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let telefonoClienteActual = "";
let editandoCircuitoIndex = null;
let editandoTSIndex = null;
let filtroTSCircuitos = 'TODOS';
let nivel3Colapsado = false;

// ==========================================
// PRECARGA DE SÍMBOLOS SVG EXTERNOS
// ==========================================
let cacheSimboloPIA = null;
let cacheSimboloID = null;

async function cargarArchivoSVG(ruta) {
    const resp = await fetch(ruta);
    if (!resp.ok) return null;
    const xmlText = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    const vb = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const w = (vb.length === 4 && vb[2] > 0) ? vb[2] : (parseFloat(svgEl.getAttribute('width')) || 120);
    const h = (vb.length === 4 && vb[3] > 0) ? vb[3] : (parseFloat(svgEl.getAttribute('height')) || 180);

    return {
        inner: svgEl.innerHTML,
        w: w,
        h: h
    };
}

async function precargarSimbolosExternos() {
    try {
        const [pia, id] = await Promise.all([
            cargarArchivoSVG('simbolos/Termomagnetica.svg').catch(() => null),
            cargarArchivoSVG('simbolos/Diferencial.svg').catch(() => null)
        ]);

        if (pia) cacheSimboloPIA = pia;
        if (id) cacheSimboloID = id;

        // Si ya estamos en la pantalla de trabajo, redibuja el plano con los símbolos cargados
        const stepTrabajo = document.getElementById('step-trabajo');
        if (stepTrabajo && !stepTrabajo.classList.contains('oculto')) {
            renderizarTodo();
        }
    } catch (err) {
        console.warn('No se pudieron cargar los símbolos SVG externos, se usa respaldo:', err);
    }
}

// Mapa de admisibilidad térmica AEA 90364 (Cu en cañería embutida)
const MAPA_IZ_AEA = { "1.5": 15, "2.5": 21, "4": 28, "6": 36, "10": 50, "16": 66 };

// Colores normalizados IRAM 2183 para fases en trifásico
const COLORES_FASE = {
    'L1': '#92400e',       // Marrón
    'L2': '#0f172a',       // Negro
    'L3': '#dc2626',       // Rojo
    'L1-L2-L3': '#1d4ed8'  // Trifásico
};

// Precargas normativas por tipo de circuito
const PRECARGAS_CIRCUITO = {
    IUG:   { desc: 'Iluminación Uso General', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 8,  dpms: 528 },
    TUG:   { desc: 'Tomas Uso General',       curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 10, dpms: 2200 },
    TUE:   { desc: 'Tomas Uso Especial',      curvaPolos: 'C 2x', in: '20', pcc: '3000', tension: '220', secLN: '4',   secPE: '4',   bocas: 2,  dpms: 3300 },
    ACU:   { desc: 'Aire Acondicionado',      curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1353 },
    MBTF:  { desc: 'Muy Baja Tensión Func.',  curvaPolos: 'B 2x', in: '6',  pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 2,  dpms: 200 },
    MOTOR: { desc: 'Electrobomba / Motor',    curvaPolos: 'C 2x', in: '10', pcc: '4500', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1100 }
};

function crearEstadoInicialUnifilar() {
    return {
        nivel0: {
            suministro: 'Monofásico 220V',
            rdd: 'RDD',
            dpla: 'DPLA',
            medidor: 'M',
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
            { id: 'C1', tableroId: 'TS_1', fase: 'L1', tipo: 'IUG', desc: 'Iluminación General', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '6',  pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 9,  dpms: 360 },
            { id: 'C2', tableroId: 'TS_1', fase: 'L1', tipo: 'TUG', desc: 'Tomas Uso General 1', piaCod: 'PIA2', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 11, dpms: 2200 },
            { id: 'C3', tableroId: 'TS_1', fase: 'L1', tipo: 'TUG', desc: 'Tomas Uso General 2', piaCod: 'PIA3', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 7,  dpms: 2200 },
            { id: 'C4', tableroId: 'TS_1', fase: 'L1', tipo: 'ACU', desc: 'Aire Acondicionado',  piaCod: 'PIA4', curvaPolos: 'C 2x', in: '10', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1353 }
        ]
    };
}

let esquema = crearEstadoInicialUnifilar();

// Compatibilidad total con borradores previos (migración transparente)
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
    } else if (raw.nivel2) {
        est.tablerosSeccionales = [{
            id: 'TS_1',
            nombre: raw.nivel2.nombre || 'TS1',
            ubicacion: 'Tablero Seccional General',
            ip: raw.nivel2.ip || 'IP41',
            dobleAislacion: true,
            origen: 'TP',
            lineaAlim: est.nivel1.lineaSec || 'LS: 2x6 mm² + PE 1x6 mm²',
            tipoCab: raw.nivel2.tipoCab || 'ID Clase A',
            in: raw.nivel2.in || '2x40A',
            sens: raw.nivel2.sens || '30mA',
            pcc: raw.nivel2.pcc || '3000',
            tension: raw.nivel2.tension || '220',
            pat: (raw.nivel1 && raw.nivel1.pat) ? raw.nivel1.pat : 'PAT ≤ 40 Ω'
        }];
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
        est.circuitos = base.circuitos;
    }

    return est;
}

function esSuministroTrifasico() {
    return String(esquema.nivel0.suministro || '').toLowerCase().includes('trif');
}

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
    generarMenuInferior();
    actualizarPDFHeaders();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarModulo);
} else {
    arrancarModulo();
}

function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        return firebase.auth().currentUser.uid;
    }
    return null;
}

function escaparXML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ==========================================
// FLUJO CLIENTE Y AGENDA (ESTÁNDAR VILLASER)
// ==========================================
function seleccionarContacto(nombre, dir, tel = "") {
    document.getElementById('cliNombre').value = nombre;
    document.getElementById('cliDireccion').value = dir;
    telefonoClienteActual = tel;

    clienteDesdeAgenda = true;
    permiteGuardarNube = true;

    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    actualizarResumenProyectoUI();
    mostrarToast("Cliente Seleccionado", "Importado de agenda.");
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
}

function iniciarUnifilar() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Datos incompletos", "Por favor, ingresá al menos el Nombre del Cliente.");
        return;
    }

    if (!clienteDesdeAgenda) {
        document.getElementById('modalAgendarCliente').classList.remove('oculto');
        return;
    }

    avanzarPasoTrabajo();
}

function actualizarResumenProyectoUI(estadoSync = null) {
    const elNombre = document.getElementById('ui-proyecto-cliente');
    const elDetalle = document.getElementById('ui-proyecto-detalle');
    const elBadge = document.getElementById('ui-cloud-badge');
    if (!elNombre || !elDetalle) return;

    const nombre = document.getElementById('cliNombre').value.trim() || 'Cliente sin nombre';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();

    elNombre.innerText = nombre;
    const partes = [proy, dir].filter(Boolean);
    elDetalle.innerText = partes.length > 0 ? partes.join(' • ') : 'Esquema Unifilar AEA 90364';

    if (elBadge) {
        if (!permiteGuardarNube) {
            elBadge.className = 'pres-cloud-pill local';
            elBadge.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Solo Local';
        } else if (estadoSync === 'syncing') {
            elBadge.className = 'pres-cloud-pill syncing';
            elBadge.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Guardando...';
        } else if (estadoSync === 'synced' || nombreBorradorActual) {
            elBadge.className = 'pres-cloud-pill synced';
            elBadge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
        } else {
            elBadge.className = 'pres-cloud-pill ready';
            elBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> Nube Lista';
        }
    }
}

function volverAEditarCliente() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function avanzarPasoTrabajo() {
    document.getElementById('step-cliente').classList.add('oculto');
    const st = document.getElementById('step-trabajo');
    st.classList.remove('oculto');
    st.classList.add('flex-column', 'gap-15');
    actualizarResumenProyectoUI();
    renderizarTodo();
}

function opcionBuscarAgenda() {
    document.getElementById('modalAgendarCliente').classList.add('oculto');
    if (typeof abrirModalAgendaGlobal === 'function') abrirModalAgendaGlobal();
}

function accionAgendarCliente() {
    const nombre = encodeURIComponent(document.getElementById('cliNombre').value.trim());
    const dir = encodeURIComponent(document.getElementById('cliDireccion').value.trim());
    window.location.href = `../agenda/index.html?nombre=${nombre}&dir=${dir}`;
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

function ejecutarNuevoUnifilar() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';

    esquema = crearEstadoInicialUnifilar();
    filtroTSCircuitos = 'TODOS';
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = "";

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    renderizarTodo();
}

// ==========================================
// ALERTAS Y TOASTS
// ==========================================
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
    setTimeout(() => toast.classList.add('mostrar'), 100);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 400);
    }, 3500);
}

// ==========================================
// PLANTILLAS RÁPIDAS E IMPORTADOR DE POTENCIA
// ==========================================
function aplicarPlantillaUnifilar(tipo) {
    filtroTSCircuitos = 'TODOS';
    if (tipo === 'mono_770') {
        esquema = crearEstadoInicialUnifilar();
        mostrarToast("Plantilla Cargada", "Vivienda Monofásica AEA 770 precargada.");
    } else if (tipo === 'trifa_770') {
        esquema = {
            nivel0: {
                suministro: 'Trifásico 380/220V',
                rdd: 'RDD (3x380/220V)',
                dpla: 'DPLA - Fusible NH',
                medidor: 'M - Trifásico',
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
                dps: 'SI',
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
                    pat: 'PAT ≤ 10 Ω'
                }
            ],
            circuitos: [
                { id: 'C1', tableroId: 'TS_1', fase: 'L1', tipo: 'IUG', desc: 'Iluminación Planta Baja', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 10, dpms: 660 },
                { id: 'C2', tableroId: 'TS_1', fase: 'L2', tipo: 'TUG', desc: 'Tomas Uso General',       piaCod: 'PIA2', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 12, dpms: 2200 },
                { id: 'C3', tableroId: 'TS_1', fase: 'L3', tipo: 'TUE', desc: 'Tomas Cocina / Lavadero', piaCod: 'PIA3', curvaPolos: 'C 2x', in: '20', pcc: '3000', tension: '220', secLN: '4',   secPE: '4',   bocas: 3,  dpms: 3300 },
                { id: 'C4', tableroId: 'TS_1', fase: 'L1', tipo: 'ACU', desc: 'Aire Acondicionado',      piaCod: 'PIA4', curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1800 }
            ]
        };
        mostrarToast("Plantilla Cargada", "Estructura Trifásica 380/220V precargada.");
    } else if (tipo === 'vacio') {
        const primerTs = esquema.tablerosSeccionales[0]?.id || 'TS_1';
        esquema.circuitos = [
            { id: 'C1', tableroId: primerTs, fase: 'L1', tipo: 'IUG', desc: 'Iluminación', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 1, dpms: 100 }
        ];
        mostrarToast("Reiniciado", "Esquema base listo para completar.");
    }
    renderizarTodo();
}

async function abrirModalImportarPotencia() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Falta Cliente", "Ingresá el nombre del cliente para buscar sus cálculos de Potencia.");
        return;
    }

    document.getElementById('modalImportarPotencia').classList.remove('oculto');
    const lista = document.getElementById('listaBorradoresPotencia');
    lista.innerHTML = '<div style="text-align: center; color: var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando cálculos en Potencia...</div>';

    const uid = obtenerUid();
    if (!uid || !db) {
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Sin conexión a la nube.</div>';
        return;
    }

    try {
        const snapshot = await db.collection("perfiles").doc(uid).collection("borradores_potencia")
            .where('cliNombre', '==', nombre)
            .get();

        let docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
        docs.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        lista.innerHTML = '';
        if (docs.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded);">No hay cálculos de Potencia guardados para este cliente.</p>';
            return;
        }

        docs.forEach(b => {
            const p = b.data;
            const fechaStr = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : 'Sin fecha';
            const cantCirc = (p.circuitos || []).length;
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.style.borderLeft = '3px solid var(--ngc-warning)';
            div.innerHTML = `
                <div style="flex:1; min-width:0; padding-right:10px;">
                    <h4>${escaparXML(p.nombreBorrador || p.cliProyecto || p.cliNombre)}</h4>
                    <small>${fechaStr} • ${cantCirc} circuitos • ${p.suministro || 'MONOFÁSICO'}</small>
                </div>
                <button type="button" class="corp-btn-small success-btn" onclick="importarDesdeBorradorPotencia('${b.id}')">Importar</button>
            `;
            lista.appendChild(div);
        });
    } catch (e) {
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Error al consultar Potencia.</div>';
    }
}

function cerrarModalImportarPotencia() {
    document.getElementById('modalImportarPotencia').classList.add('oculto');
}

async function importarDesdeBorradorPotencia(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    try {
        const doc = await db.collection("perfiles").doc(uid).collection("borradores_potencia").doc(docId).get();
        if (!doc.exists) return;

        const data = doc.data();
        const esTrifa = data.suministro === 'TRIFÁSICO';

        const bocasPorCirc = {};
        const descPorCirc = {};
        (data.listaAmbientes || []).forEach(amb => {
            if (amb.circIUG) bocasPorCirc[amb.circIUG] = (bocasPorCirc[amb.circIUG] || 0) + (amb.bIUG || 0);
            if (amb.circTUG) bocasPorCirc[amb.circTUG] = (bocasPorCirc[amb.circTUG] || 0) + (amb.bTUG || 0);
            if (Array.isArray(amb.esps)) {
                amb.esps.forEach(esp => {
                    if (esp.circ) {
                        bocasPorCirc[esp.circ] = (bocasPorCirc[esp.circ] || 0) + (esp.bocas || 0);
                        if (esp.desc) descPorCirc[esp.circ] = esp.desc;
                    }
                });
            }
        });

        esquema.nivel0.suministro = esTrifa ? 'Trifásico 380/220V' : 'Monofásico 220V';
        esquema.nivel0.medidor = esTrifa ? 'M - Trifásico' : 'M - Monofásico 220V';

        const cs = data.circuitoCS || {};
        const secCS = cs.seccionLN || '6';
        const peCS = cs.seccionPE || secCS;
        const inCS = cs.in || '32';
        const lsTexto = `LS: ${esTrifa ? '4' : '2'}x${secCS} mm² + PE 1x${peCS} mm²`;

        esquema.nivel0.lineaAlim = `LA: ${esTrifa ? '4' : '2'}x${secCS} mm² + PE 1x${peCS} mm²`;
        esquema.nivel1.curvaPolos = esTrifa ? 'C 4x' : 'C 2x';
        esquema.nivel1.in = String(inCS);
        esquema.nivel1.tension = esTrifa ? '380' : '220';
        esquema.nivel1.lineaSec = lsTexto;

        const tsPrincipal = esquema.tablerosSeccionales[0];
        tsPrincipal.lineaAlim = lsTexto;
        tsPrincipal.in = esTrifa ? '4x40A' : '2x40A';
        tsPrincipal.tension = esTrifa ? '380' : '220';

        const fasesRotacion = ['L1', 'L2', 'L3'];
        esquema.circuitos = (data.circuitos || []).map((c, idx) => {
            const ten = String(c.tension || '220');
            const polos = ten === '380' ? '4x' : '2x';
            const curva = c.tipo === 'IUG' || c.tipo === 'TUG' ? 'B' : 'C';
            const secLN = String(c.seccionLN || (c.tipo === 'IUG' ? '1.5' : '2.5'));
            const secPE = String(c.seccionPE || '2.5');
            const faseAsignada = ten === '380' ? 'L1-L2-L3' : (esTrifa ? fasesRotacion[idx % 3] : 'L1');
            return {
                id: c.id || `C${idx + 1}`,
                tableroId: tsPrincipal.id,
                fase: faseAsignada,
                tipo: c.tipo || 'TUG',
                desc: descPorCirc[c.id] || (PRECARGAS_CIRCUITO[c.tipo]?.desc || c.tipo),
                piaCod: `PIA${idx + 1}`,
                curvaPolos: `${curva} ${polos}`,
                in: String(c.in || (c.tipo === 'IUG' ? '10' : '16')),
                pcc: '3000',
                tension: ten,
                secLN: secLN,
                secPE: secPE,
                bocas: bocasPorCirc[c.id] || 0,
                dpms: Math.round(parseFloat(c.dpms) || 0)
            };
        });

        cerrarModalImportarPotencia();
        renderizarTodo();
        mostrarToast("Importado con Éxito", `Se cargaron ${esquema.circuitos.length} circuitos desde Potencia.`);
    } catch (e) {
        mostrarAlertaCorp("Error", "No se pudo importar el cálculo de Potencia.");
    }
}

// ==========================================
// CONTROLADORES DE MODALES POR NIVEL (0, 1 Y TS)
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
    esquema.nivel0.suministro = document.getElementById('n0Suministro').value;
    esquema.nivel0.rdd = document.getElementById('n0Rdd').value.trim() || 'RDD';
    esquema.nivel0.dpla = document.getElementById('n0Dpla').value;
    esquema.nivel0.medidor = document.getElementById('n0Medidor').value;
    esquema.nivel0.lineaAlim = document.getElementById('n0LineaAlim').value.trim();
    cerrarModalNivel('modalNivel0');
    renderizarTodo();
    mostrarToast("Nivel 0 Actualizado", "Acometida y medición guardadas.");
}

function guardarNivel1() {
    esquema.nivel1.nombre = document.getElementById('n1Nombre').value.trim() || 'TP';
    esquema.nivel1.ip = document.getElementById('n1Ip').value;
    esquema.nivel1.dobleAislacion = document.getElementById('n1DobleAislacion').checked;
    esquema.nivel1.tipoDisp = document.getElementById('n1TipoDisp').value;
    esquema.nivel1.curvaPolos = document.getElementById('n1CurvaPolos').value;
    esquema.nivel1.in = document.getElementById('n1In').value;
    esquema.nivel1.pcc = document.getElementById('n1Pcc').value;
    esquema.nivel1.tension = esquema.nivel1.curvaPolos.includes('4x') ? '380' : '220';
    esquema.nivel1.dps = document.getElementById('n1Dps').value;
    esquema.nivel1.lineaSec = document.getElementById('n1LineaSec').value.trim();

    // Mantiene sincronizada la línea seccional de TS1 si está alimentado desde TP
    if (esquema.tablerosSeccionales[0] && esquema.tablerosSeccionales[0].origen === 'TP') {
        esquema.tablerosSeccionales[0].lineaAlim = esquema.nivel1.lineaSec;
    }

    cerrarModalNivel('modalNivel1');
    renderizarTodo();
    mostrarToast("Nivel 1 Actualizado", "Tablero Principal actualizado.");
                               }

// ==========================================
// GESTIÓN DE MÚLTIPLES TABLEROS Y SUBTABLEROS SECCIONALES (NIVEL 2)
// ==========================================
function abrirModalTS(index = null) {
    editandoTSIndex = index;
    const titulo = document.getElementById('tituloModalTS');
    const selOrigen = document.getElementById('n2Origen');

    // Poblar opciones de origen: TP u otro TS (para Subtableros Seccionales)
    selOrigen.innerHTML = `<option value="TP">${escaparXML(esquema.nivel1.nombre)} (Tablero Principal)</option>`;
    esquema.tablerosSeccionales.forEach((t, idx) => {
        if (index === null || idx !== index) {
            selOrigen.innerHTML += `<option value="${escaparXML(t.id)}">Subtablero desde ${escaparXML(t.nombre)}</option>`;
        }
    });

    if (index !== null && esquema.tablerosSeccionales[index]) {
        const ts = esquema.tablerosSeccionales[index];
        titulo.innerHTML = `<i class="fa-solid fa-pen" style="color: var(--ngc-neon);"></i> Editar ${escaparXML(ts.nombre)}`;
        document.getElementById('n2Nombre').value = ts.nombre;
        document.getElementById('n2Ubicacion').value = ts.ubicacion || '';
        document.getElementById('n2Ip').value = ts.ip;
        document.getElementById('n2DobleAislacion').checked = ts.dobleAislacion !== false;
        selOrigen.value = ts.origen || 'TP';
        document.getElementById('n2LineaAlim').value = ts.lineaAlim || esquema.nivel1.lineaSec;
        document.getElementById('n2TipoCab').value = ts.tipoCab;
        document.getElementById('n2In').value = ts.in;
        document.getElementById('n2Sens').value = ts.sens;
        document.getElementById('n2Pcc').value = ts.pcc;
        document.getElementById('n2Pat').value = ts.pat || 'PAT ≤ 40 Ω';
    } else {
        const num = esquema.tablerosSeccionales.length + 1;
        titulo.innerHTML = `<i class="fa-solid fa-plus" style="color: var(--ngc-neon);"></i> Agregar TS${num} / Subtablero`;
        document.getElementById('n2Nombre').value = `TS${num}`;
        document.getElementById('n2Ubicacion').value = num === 2 ? 'Primer Piso / Minitaller' : `Sector ${num}`;
        document.getElementById('n2Ip').value = 'IP41';
        document.getElementById('n2DobleAislacion').checked = true;
        selOrigen.value = 'TP';
        document.getElementById('n2LineaAlim').value = `LS${num}: 2x4 mm² + PE 1x4 mm²`;
        document.getElementById('n2TipoCab').value = 'ID Clase A';
        document.getElementById('n2In').value = esSuministroTrifasico() ? '4x40A' : '2x40A';
        document.getElementById('n2Sens').value = '30mA';
        document.getElementById('n2Pcc').value = '3000';
        document.getElementById('n2Pat').value = 'PAT ≤ 40 Ω';
    }

    document.getElementById('modalNivel2').classList.remove('oculto');
}

function guardarTS() {
    const nombre = document.getElementById('n2Nombre').value.trim() || `TS${esquema.tablerosSeccionales.length + 1}`;
    const inVal = document.getElementById('n2In').value;
    const datosTS = {
        id: editandoTSIndex !== null ? esquema.tablerosSeccionales[editandoTSIndex].id : `TS_${Date.now()}`,
        nombre: nombre,
        ubicacion: document.getElementById('n2Ubicacion').value.trim(),
        ip: document.getElementById('n2Ip').value,
        dobleAislacion: document.getElementById('n2DobleAislacion').checked,
        origen: document.getElementById('n2Origen').value || 'TP',
        lineaAlim: document.getElementById('n2LineaAlim').value.trim() || 'LS: 2x6 mm² + PE 1x6 mm²',
        tipoCab: document.getElementById('n2TipoCab').value,
        in: inVal,
        sens: document.getElementById('n2Sens').value,
        pcc: document.getElementById('n2Pcc').value,
        tension: inVal.startsWith('4x') ? '380' : '220',
        pat: document.getElementById('n2Pat').value.trim() || 'PAT ≤ 40 Ω'
    };

    if (editandoTSIndex !== null) {
        esquema.tablerosSeccionales[editandoTSIndex] = datosTS;
        if (editandoTSIndex === 0 && datosTS.origen === 'TP') {
            esquema.nivel1.lineaSec = datosTS.lineaAlim;
        }
        mostrarToast("Tablero Actualizado", `${datosTS.nombre} modificado correctamente.`);
    } else {
        esquema.tablerosSeccionales.push(datosTS);
        mostrarToast("Tablero Agregado", `${datosTS.nombre} incorporado al esquema.`);
    }

    cerrarModalNivel('modalNivel2');
    renderizarTodo();
}

function eliminarTS(index) {
    if (index === 0 || esquema.tablerosSeccionales.length <= 1) {
        mostrarAlertaCorp("Tablero Principal Seccional", "Debe existir al menos un Tablero Seccional (TS1) en el esquema.");
        return;
    }
    const tsEliminado = esquema.tablerosSeccionales[index];
    const tsDestino = esquema.tablerosSeccionales[0].id;

    // Reasigna circuitos y posibles subtableros dependientes al TS1 para no perder datos
    esquema.circuitos.forEach(c => {
        if (c.tableroId === tsEliminado.id) c.tableroId = tsDestino;
    });
    esquema.tablerosSeccionales.forEach(t => {
        if (t.origen === tsEliminado.id) t.origen = 'TP';
    });

    esquema.tablerosSeccionales.splice(index, 1);
    if (filtroTSCircuitos === tsEliminado.id) filtroTSCircuitos = 'TODOS';
    renderizarTodo();
    mostrarToast("Tablero Eliminado", `${tsEliminado.nombre} eliminado; sus circuitos pasaron a ${esquema.tablerosSeccionales[0].nombre}.`);
}

// ==========================================
// GESTIÓN DE CIRCUITOS (NIVEL 3 COLAPSABLE + FASES)
// ==========================================
function toggleNivel3Circuitos() {
    nivel3Colapsado = !nivel3Colapsado;
    const body = document.getElementById('ui-body-nivel-3');
    const hint = document.getElementById('ui-resumen-colapsado-n3');
    const icon = document.getElementById('icon-toggle-nivel3');

    if (nivel3Colapsado) {
        body.classList.add('oculto');
        hint.classList.remove('oculto');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    } else {
        body.classList.remove('oculto');
        hint.classList.add('oculto');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

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

function abrirModalCircuito(index = null) {
    editandoCircuitoIndex = index;
    const titulo = document.getElementById('tituloModalCircuito');
    const selTablero = document.getElementById('cTableroId');
    const grupoFase = document.getElementById('grupoFaseCircuito');

    // Poblar selector de tablero destino
    selTablero.innerHTML = esquema.tablerosSeccionales
        .map(ts => `<option value="${escaparXML(ts.id)}">${escaparXML(ts.nombre)}${ts.ubicacion ? ' • ' + escaparXML(ts.ubicacion) : ''}</option>`)
        .join('');

    // Mostrar selector de fase solo en suministro trifásico
    if (esSuministroTrifasico()) {
        grupoFase.classList.remove('oculto');
    } else {
        grupoFase.classList.add('oculto');
    }

    if (index !== null && esquema.circuitos[index]) {
        const c = esquema.circuitos[index];
        titulo.innerHTML = `<i class="fa-solid fa-pen" style="color: var(--ngc-warning);"></i> Editar ${c.id}`;
        selTablero.value = c.tableroId || esquema.tablerosSeccionales[0].id;
        document.getElementById('cFase').value = c.fase || 'L1';
        document.getElementById('cId').value = c.id;
        document.getElementById('cTipo').value = c.tipo;
        document.getElementById('cDesc').value = c.desc;
        document.getElementById('cPiaCod').value = c.piaCod;
        document.getElementById('cCurvaPolos').value = c.curvaPolos;
        document.getElementById('cIn').value = String(c.in);
        document.getElementById('cPcc').value = String(c.pcc);
        document.getElementById('cTension').value = String(c.tension);
        document.getElementById('cSecLN').value = String(c.secLN);
        document.getElementById('cSecPE').value = String(c.secPE);
        document.getElementById('cBocas').value = c.bocas;
        document.getElementById('cDpms').value = c.dpms;
    } else {
        const num = esquema.circuitos.length + 1;
        titulo.innerHTML = `<i class="fa-solid fa-plus" style="color: var(--success-green);"></i> Agregar Circuito C${num}`;
        selTablero.value = (filtroTSCircuitos !== 'TODOS') ? filtroTSCircuitos : esquema.tablerosSeccionales[0].id;
        const fasesAuto = ['L1', 'L2', 'L3'];
        document.getElementById('cFase').value = esSuministroTrifasico() ? fasesAuto[(num - 1) % 3] : 'L1';
        document.getElementById('cId').value = `C${num}`;
        document.getElementById('cPiaCod').value = `PIA${num}`;
        document.getElementById('cTipo').value = 'TUG';
        aplicarPrecargaCircuito();
    }

    document.getElementById('modalCircuito').classList.remove('oculto');
}

function aplicarPrecargaCircuito() {
    const tipo = document.getElementById('cTipo').value;
    const p = PRECARGAS_CIRCUITO[tipo] || PRECARGAS_CIRCUITO.TUG;
    document.getElementById('cDesc').value = p.desc;
    document.getElementById('cCurvaPolos').value = p.curvaPolos;
    document.getElementById('cIn').value = p.in;
    document.getElementById('cPcc').value = p.pcc;
    document.getElementById('cTension').value = p.tension;
    document.getElementById('cSecLN').value = p.secLN;
    document.getElementById('cSecPE').value = p.secPE;
    document.getElementById('cBocas').value = p.bocas;
    document.getElementById('cDpms').value = p.dpms;
    sincronizarFasePorPolos();
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
      }

function moverCircuito(index, delta) {
    const destino = index + delta;
    if (destino < 0 || destino >= esquema.circuitos.length) return;
    const temp = esquema.circuitos[index];
    esquema.circuitos[index] = esquema.circuitos[destino];
    esquema.circuitos[destino] = temp;
    renderizarTodo();
}

function eliminarCircuito(index) {
    if (esquema.circuitos.length <= 1) {
        mostrarAlertaCorp("Mínimo Requerido", "El esquema debe tener al menos un circuito terminal.");
        return;
    }
    esquema.circuitos.splice(index, 1);
    renderizarTodo();
}

function calcularIbCircuito(c) {
    const p = parseFloat(c.dpms) || 0;
    const v = parseFloat(c.tension) || 220;
    if (v === 380) return p / (1.732 * 380);
    return p / v;
}

// ==========================================
// RENDERIZADO DE TARJETAS Y AUDITORÍA AEA
// ==========================================
function renderizarTodo() {
    esquema = normalizarEsquema(esquema);
    const esTrifa = esSuministroTrifasico();

    // Nivel 0
    document.getElementById('ui-resumen-nivel-0').innerHTML = `
        <div class="uni-spec-item"><span>Red / Suministro</span><strong>${escaparXML(esquema.nivel0.rdd)} • ${escaparXML(esquema.nivel0.suministro)}</strong></div>
        <div class="uni-spec-item"><span>Protección / Medidor</span><strong>${escaparXML(esquema.nivel0.dpla)} • ${escaparXML(esquema.nivel0.medidor)}</strong></div>
        <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Alimentación</span><strong>${escaparXML(esquema.nivel0.lineaAlim)}</strong></div>
    `;

    // Nivel 1 (Sin PAT + con indicador Doble Aislación Clase II)
    const badgeClase2TP = esquema.nivel1.dobleAislacion ? ` <span title="Doble Aislación Clase II" style="border:1.5px solid currentColor; padding:0 4px; font-size:0.75rem; border-radius:2px;">回</span>` : '';
    document.getElementById('ui-titulo-tp').innerHTML = `<i class="fa-solid fa-box"></i> ${escaparXML(esquema.nivel1.nombre)} (${escaparXML(esquema.nivel1.ip)})${badgeClase2TP}`;
    document.getElementById('ui-resumen-nivel-1').innerHTML = `
        <div class="uni-spec-item"><span>Cabecera General</span><strong>${escaparXML(esquema.nivel1.tipoDisp)} ${escaparXML(esquema.nivel1.curvaPolos)}${escaparXML(esquema.nivel1.in)}A</strong></div>
        <div class="uni-spec-item"><span>Poder Corte / Envolvente</span><strong>Pcc ${escaparXML(esquema.nivel1.pcc)}A • ${esquema.nivel1.dobleAislacion ? 'Clase II (回)' : 'Clase I'}</strong></div>
        <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Seccional (LS)</span><strong>${escaparXML(esquema.nivel1.lineaSec)}</strong></div>
    `;

    // Nivel 2: Lista de Tableros y Subtableros Seccionales
    const listaTS = document.getElementById('ui-lista-ts');
    document.getElementById('ui-titulo-ts').innerHTML = `<i class="fa-solid fa-server"></i> Tableros Seccionales (${esquema.tablerosSeccionales.length})`;
    listaTS.innerHTML = '';

    const mapaTS = {};
    esquema.tablerosSeccionales.forEach(t => { mapaTS[t.id] = t; });

    esquema.tablerosSeccionales.forEach((ts, idx) => {
        const origenObj = ts.origen === 'TP' ? null : mapaTS[ts.origen];
        const origenTexto = origenObj ? `Subtablero desde ${origenObj.nombre}` : `Desde ${esquema.nivel1.nombre}`;
        const badgeC2 = ts.dobleAislacion ? `<span title="Doble Aislación Clase II" style="border:1.5px solid currentColor; padding:0 4px; font-size:0.72rem; border-radius:2px; margin-left:4px;">回</span>` : '';
        const cantCircTS = esquema.circuitos.filter(c => c.tableroId === ts.id).length;

        listaTS.innerHTML += `
            <div class="uni-ts-card">
                <div class="uni-circ-top">
                    <span class="uni-circ-tag" style="color:var(--ngc-text-main);">
                        <i class="fa-solid fa-server corp-accent-color"></i> ${escaparXML(ts.nombre)} (${escaparXML(ts.ip)})${badgeC2}
                    </span>
                    <span class="uni-circ-pill" style="background:rgba(35,116,225,0.14); color:var(--ngc-neon);">${escaparXML(origenTexto)}</span>
                </div>
                <div class="uni-circ-details">
                    ${ts.ubicacion ? `<strong>${escaparXML(ts.ubicacion)}</strong> • ` : ''}Cabecera: <b>${escaparXML(ts.tipoCab)} ${escaparXML(ts.in)}</b> (IΔn ${escaparXML(ts.sens)} • Pcc ${escaparXML(ts.pcc)}A)<br>
                    Alimentación: <b>${escaparXML(ts.lineaAlim)}</b> • Bornera PE → <b style="color:var(--success-green);">${escaparXML(ts.pat)}</b> • <b>${cantCircTS} circ.</b>
                </div>
                <div class="uni-circ-actions">
                    <button type="button" class="pres-mini-act" style="color:var(--ngc-neon);" onclick="abrirModalTS(${idx})"><i class="fa-solid fa-pen"></i> Editar ${escaparXML(ts.nombre)}</button>
                    ${idx > 0 ? `<button type="button" class="pres-mini-act" style="color:var(--error-red);" onclick="eliminarTS(${idx})"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    });

    // Nivel 3: Filtros por TS (si hay >1 TS), resumen colapsado y lista de circuitos
    const filtroBar = document.getElementById('ui-filtro-ts-circuitos');
    if (esquema.tablerosSeccionales.length > 1) {
        filtroBar.classList.remove('oculto');
        let htmlFiltros = `<button type="button" class="uni-preset-chip" style="${filtroTSCircuitos === 'TODOS' ? 'border-color:var(--ngc-neon); color:var(--ngc-neon);' : ''}" onclick="cambiarFiltroTSCircuitos('TODOS')">Todos (${esquema.circuitos.length})</button>`;
        esquema.tablerosSeccionales.forEach(ts => {
            const cnt = esquema.circuitos.filter(c => c.tableroId === ts.id).length;
            const activo = filtroTSCircuitos === ts.id ? 'border-color:var(--ngc-neon); color:var(--ngc-neon);' : '';
            htmlFiltros += `<button type="button" class="uni-preset-chip" style="${activo}" onclick="cambiarFiltroTSCircuitos('${escaparXML(ts.id)}')">${escaparXML(ts.nombre)} (${cnt})</button>`;
        });
        filtroBar.innerHTML = htmlFiltros;
    } else {
        filtroBar.classList.add('oculto');
        filtroTSCircuitos = 'TODOS';
    }

    const totalDpms = esquema.circuitos.reduce((acc, c) => acc + (parseFloat(c.dpms) || 0), 0);
    document.getElementById('ui-cant-circuitos').innerText = esquema.circuitos.length;
    document.getElementById('ui-texto-colapsado-n3').innerText = `${esquema.circuitos.length} circuitos • Carga total: ${totalDpms.toLocaleString('es-AR')} VA`;

    const lista = document.getElementById('ui-lista-circuitos');
    lista.innerHTML = '';

    const alertasAEA = [];
    const inCabeceraTP = parseFloat(esquema.nivel1.in) || 32;
    const cargaPorFase = { L1: 0, L2: 0, L3: 0 };

    esquema.circuitos.forEach((c, idx) => {
        const ib = calcularIbCircuito(c);
        const iz = MAPA_IZ_AEA[String(c.secLN)] || 21;
        const pIn = parseFloat(c.in) || 16;
        const cumpleCoord = (ib <= pIn && pIn <= iz);

        if (esTrifa) {
            const va = parseFloat(c.dpms) || 0;
            if (c.fase === 'L1-L2-L3') {
                cargaPorFase.L1 += va / 3;
                cargaPorFase.L2 += va / 3;
                cargaPorFase.L3 += va / 3;
            } else if (cargaPorFase[c.fase] !== undefined) {
                cargaPorFase[c.fase] += va;
            }
        }

        if (!cumpleCoord) {
            alertasAEA.push(`${c.id}: revisar Ib (${ib.toFixed(2)}A) ≤ In (${pIn}A) ≤ Iz (${iz}A)`);
        }
        if (pIn > inCabeceraTP) {
            alertasAEA.push(`${c.id}: In (${pIn}A) supera cabecera TP (${inCabeceraTP}A)`);
        }

        if (filtroTSCircuitos !== 'TODOS' && c.tableroId !== filtroTSCircuitos) return;

        const tsObj = mapaTS[c.tableroId] || esquema.tablerosSeccionales[0];
        const badgeTS = esquema.tablerosSeccionales.length > 1 ? ` <span class="uni-fase-badge">${escaparXML(tsObj.nombre)}</span>` : '';
        const badgeFase = esTrifa ? ` <span class="uni-fase-badge" style="color:${COLORES_FASE[c.fase] || 'var(--ngc-neon)'};">${escaparXML(c.fase)}</span>` : '';

        const pillClass = cumpleCoord ? 'uni-circ-pill' : 'uni-circ-pill warn';
        const pillText = cumpleCoord ? `✓ Ib=${ib.toFixed(2)}A ≤ In=${pIn}A ≤ Iz=${iz}A` : `⚠ Revisar Ib=${ib.toFixed(2)}A / In=${pIn}A`;

        lista.innerHTML += `
            <div class="uni-circ-item">
                <div class="uni-circ-top">
                    <span class="uni-circ-tag">${escaparXML(c.id)} • ${escaparXML(c.tipo)} <small style="color:var(--ngc-text-faded); font-weight:600;">(${escaparXML(c.piaCod)})</small>${badgeTS}${badgeFase}</span>
                    <span class="${pillClass}">${pillText}</span>
                </div>
                <div class="uni-circ-details">
                    <strong>${escaparXML(c.desc)}</strong><br>
                    Protección: <b>${escaparXML(c.curvaPolos)}${pIn}A</b> (Pcc ${escaparXML(c.pcc)}A • ${escaparXML(c.tension)}V) • Cable: <b>${String(c.secLN).replace('.', ',')} mm² + PE ${String(c.secPE).replace('.', ',')} mm²</b> • Bocas: <b>${c.bocas}</b> • DPMS: <b>${c.dpms} VA</b>
                </div>
                <div class="uni-circ-actions">
                    <button type="button" class="pres-mini-act" onclick="moverCircuito(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.4;"' : ''}><i class="fa-solid fa-arrow-left"></i></button>
                    <button type="button" class="pres-mini-act" onclick="moverCircuito(${idx}, 1)" ${idx === esquema.circuitos.length - 1 ? 'disabled style="opacity:0.4;"' : ''}><i class="fa-solid fa-arrow-right"></i></button>
                    <button type="button" class="pres-mini-act" style="color:var(--ngc-warning);" onclick="abrirModalCircuito(${idx})"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button type="button" class="pres-mini-act" style="color:var(--error-red);" onclick="eliminarCircuito(${idx})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    // Chequeo de equilibrio de fases en trifásico
    let resumenFasesTxt = '';
    if (esTrifa) {
        const vals = [cargaPorFase.L1, cargaPorFase.L2, cargaPorFase.L3];
        const maxF = Math.max(...vals);
        const minF = Math.min(...vals);
        resumenFasesTxt = ` • Fases: L1=${Math.round(cargaPorFase.L1)}VA | L2=${Math.round(cargaPorFase.L2)}VA | L3=${Math.round(cargaPorFase.L3)}VA`;
        if (maxF > 0 && ((maxF - minF) / maxF) > 0.25) {
            alertasAEA.push(`Desbalance de fases >25% (L1:${Math.round(cargaPorFase.L1)}VA, L2:${Math.round(cargaPorFase.L2)}VA, L3:${Math.round(cargaPorFase.L3)}VA)`);
        }
    }

    const banner = document.getElementById('ui-aea-unifilar-status');
    if (alertasAEA.length === 0) {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verificación AEA 90364 OK • ${esquema.circuitos.length} circuitos coordinados${resumenFasesTxt}`;
    } else {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${alertasAEA.join(' • ')}`;
    }

    const svgCode = generarSVGUnifilar();
    document.getElementById('contenedorSvgPantalla').innerHTML = svgCode;
    sincronizarVistaPreviaPDF(svgCode);
}

// ==========================================
// MOTOR VECTORIAL SVG (SIMBOLOGÍA IEC 60617 / AEA)
// ==========================================
function dibujarSimboloDobleAislacion(x, y, size = 11) {
    const pad = 2.8;
    return `
        <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <rect x="${x + pad}" y="${y + pad}" width="${size - pad * 2}" height="${size - pad * 2}" fill="none" stroke="#0f172a" stroke-width="1.2"/>
    `;
}

function dibujarSimboloPIA(x, y, polosStr) {
    const es4P = String(polosStr || '').includes('4x');
    const marcasPolos = es4P
        ? `<line x1="${x - 5.5}" y1="${y + 33}" x2="${x + 5.5}" y2="${y + 29.5}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
           <line x1="${x - 5.5}" y1="${y + 36.5}" x2="${x + 5.5}" y2="${y + 33}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
           <line x1="${x - 5.5}" y1="${y + 40}" x2="${x + 5.5}" y2="${y + 36.5}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
           <line x1="${x - 5.5}" y1="${y + 43.5}" x2="${x + 5.5}" y2="${y + 40}" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>`
        : `<line x1="${x - 5.5}" y1="${y + 37.5}" x2="${x + 5.5}" y2="${y + 33.5}" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>
           <line x1="${x - 5.5}" y1="${y + 42}" x2="${x + 5.5}" y2="${y + 38}" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>`;

    // Inserta Termomagnetica.svg alineado al eje X y empalmado de y a y+46
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
            ${marcasPolos}
        `;
    }

    // Respaldo vectorial instantáneo mientras termina el fetch
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#0f172a" stroke-width="1.8"/>
        <line x1="${x - 4}" y1="${y + 6}" x2="${x + 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${x + 4}" y1="${y + 6}" x2="${x - 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${x}" y1="${y + 32}" x2="${x - 10}" y2="${y + 12}" stroke="#0f172a" stroke-width="2"/>
        <polyline points="${x - 5},${y + 20} ${x - 14},${y + 20} ${x - 14},${y + 26} ${x - 5},${y + 26}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <path d="M ${x - 14} ${y + 26} A 4 4 0 0 0 ${x - 14} ${y + 33}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        ${marcasPolos}
        <line x1="${x}" y1="${y + 32}" x2="${x}" y2="${y + 46}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function dibujarSimboloID(x, y, polosStr) {
    const es4P = String(polosStr || '').includes('4x');
    const marcasPolos = es4P
        ? `<line x1="${x - 6}" y1="${y + 30}" x2="${x + 6}" y2="${y + 26}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 34}" x2="${x + 6}" y2="${y + 30}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 38}" x2="${x + 6}" y2="${y + 34}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 42}" x2="${x + 6}" y2="${y + 38}" stroke="#0f172a" stroke-width="1.4"/>`
        : `<line x1="${x - 6}" y1="${y + 32}" x2="${x + 6}" y2="${y + 27}" stroke="#0f172a" stroke-width="1.5"/>
           <line x1="${x - 6}" y1="${y + 37}" x2="${x + 6}" y2="${y + 32}" stroke="#0f172a" stroke-width="1.5"/>`;

    // Inserta Diferencial.svg alineado al eje X y empalmado sin corte de y a y+52
    if (cacheSimboloID) {
        const altoDestino = 56;
        const escala = altoDestino / cacheSimboloID.h;
        const anchoEscalado = cacheSimboloID.w * escala;
        const offsetX = x - (anchoEscalado * 0.515);
        const offsetY = y - 1;

        return `
            <g transform="translate(${offsetX.toFixed(2)}, ${offsetY}) scale(${escala.toFixed(4)})">
                ${cacheSimboloID.inner}
            </g>
            ${marcasPolos}
        `;
    }

    // Respaldo vectorial instantáneo si Diferencial.svg aún no cargó
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 22}" stroke="#0f172a" stroke-width="1.8"/>
        <ellipse cx="${x}" cy="${y + 11}" rx="7" ry="4" fill="none" stroke="#0f172a" stroke-width="1.4"/>
        <line x1="${x - 7}" y1="${y + 11}" x2="${x - 14}" y2="${y + 11}" stroke="#0f172a" stroke-width="1.3"/>
        <rect x="${x - 22}" y="${y + 6}" width="8" height="10" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>
        <line x1="${x}" y1="${y + 42}" x2="${x - 10}" y2="${y + 20}" stroke="#0f172a" stroke-width="2"/>
        ${marcasPolos}
        <line x1="${x}" y1="${y + 42}" x2="${x}" y2="${y + 52}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function generarSVGUnifilar() {
    const esTrifa = esSuministroTrifasico();
    const colW = 152;
    const tsGap = 78; // Espacio suficiente entre TS para que quepa la PAT externa sin chocar
    const colorTablero = '#1d4ed8'; // Azul técnico para contorno discontinuo de envolventes

    // Calcular geometría de cada Tablero Seccional
    const bloquesTS = esquema.tablerosSeccionales.map(ts => {
        const circs = esquema.circuitos.filter(c => c.tableroId === ts.id);
        const nC = Math.max(1, circs.length);
        const w = Math.max(250, nC * colW + 46);
        return { ts, circs, w };
    });

    const anchoTotalTS = bloquesTS.reduce((acc, b) => acc + b.w, 0) + Math.max(0, bloquesTS.length - 1) * tsGap;
    const marginLeft = 64; // Margen izquierdo amplio para la PAT externa de TS1
    const width = Math.max(720, anchoTotalTS + marginLeft + 44);
    const cx = Math.round(width / 2);
    const height = 670;

    // Posicionar horizontalmente cada TS centrado en el plano
    let cursorX = Math.max(marginLeft, Math.round((width - anchoTotalTS) / 2));
    bloquesTS.forEach(b => {
        b.x = cursorX;
        b.cx = Math.round(cursorX + b.w / 2);
        cursorX += b.w + tsGap;
    });

    const mapaBloquesTS = {};
    bloquesTS.forEach(b => { mapaBloquesTS[b.ts.id] = b; });

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="width: 100%; max-height: 475px; height: auto; display: block; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background:#ffffff;">`;

    // --- NIVEL 0: RDD, DPLA, MEDIDOR ---
    svg += `
        <rect x="${cx - 42}" y="12" width="84" height="24" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.5"/>
        <text x="${cx}" y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel0.rdd)}</text>
        <line x1="${cx}" y1="36" x2="${cx}" y2="54" stroke="#0f172a" stroke-width="1.8"/>

        <rect x="${cx - 8}" y="54" width="16" height="26" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${cx}" y1="54" x2="${cx}" y2="80" stroke="#0f172a" stroke-width="1.4"/>
        <text x="${cx + 16}" y="71" text-anchor="start" font-size="10" font-weight="700" fill="#334155">${escaparXML(esquema.nivel0.dpla)}</text>
        <line x1="${cx}" y1="80" x2="${cx}" y2="96" stroke="#0f172a" stroke-width="1.8"/>

        <circle cx="${cx}" cy="112" r="16" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${cx}" y="116" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">M</text>
        <text x="${cx + 22}" y="110" text-anchor="start" font-size="9.5" font-weight="700" fill="#334155">${escaparXML(esquema.nivel0.medidor)}</text>
        <text x="${cx + 22}" y="121" text-anchor="start" font-size="8.5" fill="#64748b">${escaparXML(esquema.nivel0.suministro)}</text>
        <line x1="${cx}" y1="128" x2="${cx}" y2="156" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${cx + 10}" y="146" text-anchor="start" font-size="9" font-weight="600" fill="#475569">${escaparXML(esquema.nivel0.lineaAlim)}</text>
    `;

    // --- NIVEL 1: TABLERO PRINCIPAL (TP) - LÍNEA ENTRECORTADA DE OTRO COLOR, SIN PAT, CON [回] ---
    const tpW = 250;
    const tpX = cx - tpW / 2;
    const tpY = 156;
    const tpH = 88;
    const tpNombreAnchoAprox = esquema.nivel1.nombre.length * 7;

    svg += `
        <rect x="${tpX}" y="${tpY}" width="${tpW}" height="${tpH}" rx="4" fill="#f8fafc" stroke="${colorTablero}" stroke-width="1.9" stroke-dasharray="6,4"/>
        <text x="${tpX + 8}" y="${tpY + 15}" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel1.nombre)}</text>
        ${esquema.nivel1.dobleAislacion ? dibujarSimboloDobleAislacion(tpX + 12 + tpNombreAnchoAprox, tpY + 5, 11) : ''}
        <text x="${tpX + 8}" y="${tpY + 27}" font-size="9" font-weight="700" fill="#475569">${escaparXML(esquema.nivel1.ip)}${esquema.nivel1.dobleAislacion ? ' • Clase II' : ''}</text>
    `;

    // Protección General TP
    svg += `<line x1="${cx}" y1="${tpY}" x2="${cx}" y2="${tpY + 18}" stroke="#0f172a" stroke-width="1.8"/>`;
    svg += dibujarSimboloPIA(cx, tpY + 18, esquema.nivel1.curvaPolos);
    svg += `
        <text x="${cx + 16}" y="${tpY + 34}" font-size="10" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel1.tipoDisp)} ${escaparXML(esquema.nivel1.curvaPolos)}${escaparXML(esquema.nivel1.in)}A</text>
        <text x="${cx + 16}" y="${tpY + 46}" font-size="9" font-weight="600" fill="#334155">Pcc ${escaparXML(esquema.nivel1.pcc)}A • ${escaparXML(esquema.nivel1.tension)}V</text>
    `;

    // DPS opcional en TP
    if (esquema.nivel1.dps === 'SI') {
        const dpsX = tpX + tpW - 36;
        svg += `
            <line x1="${cx}" y1="${tpY + 14}" x2="${dpsX}" y2="${tpY + 14}" stroke="#0f172a" stroke-width="1.3"/>
            <line x1="${dpsX}" y1="${tpY + 14}" x2="${dpsX}" y2="${tpY + 28}" stroke="#0f172a" stroke-width="1.3"/>
            <rect x="${dpsX - 7}" y="${tpY + 28}" width="14" height="22" fill="#fff" stroke="#0f172a" stroke-width="1.4"/>
            <polygon points="${dpsX},${tpY + 32} ${dpsX - 3},${tpY + 39} ${dpsX + 3},${tpY + 39}" fill="#0f172a"/>
            <text x="${dpsX}" y="${tpY + 62}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f172a">DPS</text>
        `;
    }

    // --- CONEXIONES DE SALIDA DE TP HACIA TABLEROS SECCIONALES ---
    const tsY = 290;
    const tsH = 264;
    const directBlocks = bloquesTS.filter(b => b.ts.origen === 'TP' || !mapaBloquesTS[b.ts.origen]);

    if (directBlocks.length === 1) {
        const b0 = directBlocks[0];
        svg += `
            <line x1="${cx}" y1="${tpY + 64}" x2="${b0.cx}" y2="${tsY}" stroke="#0f172a" stroke-width="1.8"/>
            <text x="${b0.cx + 10}" y="270" text-anchor="start" font-size="9.5" font-weight="700" fill="#334155">${escaparXML(b0.ts.lineaAlim || esquema.nivel1.lineaSec)}</text>
        `;
    } else if (directBlocks.length > 1) {
        const splitY = 262;
        const minX = Math.min(cx, ...directBlocks.map(b => b.cx));
        const maxX = Math.max(cx, ...directBlocks.map(b => b.cx));
        svg += `<line x1="${cx}" y1="${tpY + 64}" x2="${cx}" y2="${splitY}" stroke="#0f172a" stroke-width="1.8"/>`;
        svg += `<line x1="${minX}" y1="${splitY}" x2="${maxX}" y2="${splitY}" stroke="#0f172a" stroke-width="1.8"/>`;
        directBlocks.forEach(b => {
            svg += `
                <circle cx="${b.cx}" cy="${splitY}" r="3" fill="#0f172a"/>
                <line x1="${b.cx}" y1="${splitY}" x2="${b.cx}" y2="${tsY}" stroke="#0f172a" stroke-width="1.8"/>
                <text x="${b.cx + 7}" y="${splitY + 18}" text-anchor="start" font-size="8.5" font-weight="700" fill="#334155">${escaparXML(b.ts.lineaAlim)}</text>
            `;
        });
    }

    // --- NIVEL 2 Y NIVEL 3: DIBUJO DE CADA TABLERO SECCIONAL Y SUS CIRCUITOS ---
    bloquesTS.forEach(b => {
        const { ts, circs, x: tsX, w: tsW, cx: tsCx } = b;
        const tsNombreAnchoAprox = ts.nombre.length * 7.5;

        // Envolvente TS con línea entrecortada azul técnico + Símbolo Doble Aislación [回]
        svg += `
            <rect x="${tsX}" y="${tsY}" width="${tsW}" height="${tsH}" rx="5" fill="#ffffff" stroke="${colorTablero}" stroke-width="1.9" stroke-dasharray="6,4"/>
            <text x="${tsX + 10}" y="${tsY + 18}" font-size="12" font-weight="800" fill="#0f172a">${escaparXML(ts.nombre)}</text>
            ${ts.dobleAislacion ? dibujarSimboloDobleAislacion(tsX + 14 + tsNombreAnchoAprox, tsY + 8, 11) : ''}
            <text x="${tsX + 10}" y="${tsY + 31}" font-size="9.5" font-weight="700" fill="#475569">${escaparXML(ts.ip)}${ts.dobleAislacion ? ' • Clase II' : ''}</text>
            ${ts.ubicacion ? `<text x="${tsX + 10}" y="${tsY + 42}" font-size="8" font-weight="600" fill="#64748b">${escaparXML(ts.ubicacion.slice(0, 34))}</text>` : ''}
        `;

        // Cabecera TS (ID o PIA)
        const esCabPIA = String(ts.tipoCab || '').startsWith('PIA Seccionadora');
        if (esCabPIA) {
            svg += `<line x1="${tsCx}" y1="${tsY}" x2="${tsCx}" y2="${tsY + 18}" stroke="#0f172a" stroke-width="1.8"/>`;
            svg += dibujarSimboloPIA(tsCx, tsY + 18, ts.in);
        } else {
            svg += dibujarSimboloID(tsCx, tsY + 12, ts.in);
        }
        svg += `
            <text x="${tsCx + 16}" y="${tsY + 28}" font-size="10.5" font-weight="800" fill="#0f172a">${escaparXML(ts.tipoCab)} ${escaparXML(ts.in)}</text>
            <text x="${tsCx + 16}" y="${tsY + 40}" font-size="9" font-weight="600" fill="#334155">${ts.sens !== 'N/A' ? `IΔn ${escaparXML(ts.sens)} • ` : ''}Pcc ${escaparXML(ts.pcc)}A</text>
        `;

        // Barra de distribución del TS (empalmada en tsY + 58 para evitar corte en el diferencial)
        const nCirc = circs.length;
        const totalSpan = Math.max(0, (nCirc - 1) * colW);
        const startX = tsCx - totalSpan / 2;
        const endX = tsCx + totalSpan / 2;
        const busY = tsY + 78;

        svg += `<line x1="${tsCx}" y1="${tsY + 58}" x2="${tsCx}" y2="${busY}" stroke="#0f172a" stroke-width="1.8"/>`;
        if (nCirc > 1) {
            svg += `<line x1="${startX}" y1="${busY}" x2="${endX}" y2="${busY}" stroke="#0f172a" stroke-width="2.4"/>`;
        }

        // Si este TS alimenta a un Subtablero Seccional (origen === ts.id), dibuja derivación desde su barra
        const subTableros = bloquesTS.filter(sub => sub.ts.origen === ts.id);
        subTableros.forEach((sub, sIdx) => {
            const tapX = Math.min(tsX + tsW - 16, endX + 18);
            const routeY = tsY - 16 - sIdx * 10;
            svg += `
                <circle cx="${tapX}" cy="${busY}" r="3" fill="#0f172a"/>
                <polyline points="${tapX},${busY} ${tapX},${routeY} ${sub.cx},${routeY} ${sub.cx},${tsY}" fill="none" stroke="#0f172a" stroke-width="1.6"/>
                <text x="${sub.cx + 6}" y="${routeY - 3}" font-size="8.5" font-weight="700" fill="#334155">${escaparXML(sub.ts.lineaAlim)}</text>
            `;
        });

        // BORNERA PE INTERNA DEL TS + SALIDA HACIA PAT FUERA DEL TABLERO
        const peBarY = tsY + 194;
        const peStart = Math.max(tsX + 24, startX - 18);
        const peEnd = Math.min(tsX + tsW - 18, endX + 24);
        const borneraW = Math.max(60, peEnd - peStart);
        const patExtX = tsX - 26;

        svg += `
            <!-- Rectángulo Bornera PE dentro del TS -->
            <rect x="${peStart}" y="${peBarY}" width="${borneraW}" height="12" rx="2" fill="#dcfce7" stroke="#15803d" stroke-width="1.4"/>
            <text x="${peStart + 4}" y="${peBarY - 4}" text-anchor="start" font-size="8" font-weight="800" fill="#15803d">Bornera PE</text>

            <!-- Conductor PE que sale desde la bornera hacia afuera del TS hasta la PAT externa -->
            <circle cx="${peStart + 6}" cy="${peBarY + 6}" r="2.5" fill="#15803d"/>
            <line x1="${patExtX}" y1="${peBarY + 6}" x2="${peStart + 6}" y2="${peBarY + 6}" stroke="#15803d" stroke-width="1.8"/>
            ${dibujarSimboloPAT(patExtX, peBarY + 6)}
            <text x="${patExtX}" y="${peBarY - 2}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#15803d">${escaparXML(ts.pat)}</text>
        `;

        // Circuitos asignados a este TS
        if (nCirc === 0) {
            svg += `<text x="${tsCx}" y="${busY + 45}" text-anchor="middle" font-size="9.5" fill="#94a3b8" font-style="italic">Sin circuitos asignados en ${escaparXML(ts.nombre)}</text>`;
        } else {
            circs.forEach((c, i) => {
                const rx = startX + i * colW;
                const ib = calcularIbCircuito(c);

                // Nodo en barra principal
                svg += `<circle cx="${rx}" cy="${busY}" r="3.2" fill="#0f172a"/>`;
                svg += `<line x1="${rx}" y1="${busY}" x2="${rx}" y2="${busY + 16}" stroke="#0f172a" stroke-width="1.8"/>`;

                // Indicador de Fase en Trifásico (L1 / L2 / L3 / L1-L2-L3)
                if (esTrifa && c.fase) {
                    const colorF = COLORES_FASE[c.fase] || '#0f172a';
                    svg += `<text x="${rx - 6}" y="${busY + 12}" text-anchor="end" font-size="8.5" font-weight="800" fill="${colorF}">${escaparXML(c.fase)}</text>`;
                }

                // Símbolo PIA del circuito
                svg += dibujarSimboloPIA(rx, busY + 16, c.curvaPolos);

                // Etiquetas técnicas de la protección PIA en 3 líneas compactas sin pisar el símbolo
                svg += `
                    <text x="${rx + 14}" y="${busY + 30}" font-size="9.5" font-weight="800" fill="#0f172a">${escaparXML(c.piaCod)}</text>
                    <text x="${rx + 14}" y="${busY + 41}" font-size="9" font-weight="700" fill="#1e293b">${escaparXML(c.curvaPolos)}${escaparXML(c.in)}A</text>
                    <text x="${rx + 14}" y="${busY + 51}" font-size="7.8" fill="#475569">Pcc ${escaparXML(c.pcc)}A • ${escaparXML(c.tension)}V</text>
                `;

                // Línea de salida del circuito hasta la caja terminal
                const salidaTop = busY + 62;
                const salidaBottom = tsY + tsH + 34;
                svg += `<line x1="${rx}" y1="${salidaTop}" x2="${rx}" y2="${salidaBottom}" stroke="#0f172a" stroke-width="1.8"/>`;

                // Borne PE en la Bornera PE + bajada hacia el circuito
                const peX = rx + 14;
                svg += `
                    <circle cx="${peX}" cy="${peBarY + 6}" r="2.6" fill="#15803d"/>
                    <line x1="${peX}" y1="${peBarY + 6}" x2="${peX}" y2="${salidaBottom}" stroke="#15803d" stroke-width="1.3" stroke-dasharray="3,2"/>
                    <text x="${peX + 4}" y="${peBarY + 28}" font-size="8" font-weight="700" fill="#15803d">PE 1x${String(c.secPE).replace('.', ',')}mm²</text>
                `;

                // Etiqueta de cable L;N fuera del tablero
                const polosNum = String(c.curvaPolos).includes('4x') ? '4' : '2';
                svg += `
                    <text x="${rx - 6}" y="${tsY + tsH + 18}" text-anchor="end" font-size="8.5" font-weight="700" fill="#334155">${polosNum}x${String(c.secLN).replace('.', ',')}mm²</text>
                `;

                // Caja terminal del circuito
                const boxW = 124;
                const boxX = rx - boxW / 2;
                const boxY = salidaBottom;
                const labelBocas = Number(c.bocas) === 1 ? '1 boca' : `${c.bocas} bocas`;
                svg += `
                    <rect x="${boxX}" y="${boxY}" width="${boxW}" height="58" rx="5" fill="#f8fafc" stroke="#0f172a" stroke-width="1.4"/>
                    <text x="${rx}" y="${boxY + 15}" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(c.id)} • ${escaparXML(c.tipo)}</text>
                    <text x="${rx}" y="${boxY + 28}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#334155">${escaparXML(c.desc.slice(0, 22))}</text>
                    <text x="${rx}" y="${boxY + 41}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f172a">${labelBocas} • ${c.dpms} VA</text>
                    <text x="${rx}" y="${boxY + 53}" text-anchor="middle" font-size="8" font-weight="700" fill="#2374E1">Ib = ${ib.toFixed(2)} A${esTrifa ? ` • ${escaparXML(c.fase)}` : ''}</text>
                `;
            });
        }
    });

    svg += `</svg>`;
    return svg;
}


// ==========================================
// SINCRONIZACIÓN LÁMINA A4 Y MEMBRETE
// ==========================================
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
    if (elTelFooter) {
        elTelFooter.innerText = profCuit ? `CUIT: ${profCuit}` : '';
    }

    const imgPdf = document.getElementById('pdf-img-logo');
    const txtPdf = document.getElementById('pdf-text-logo');
    if (imgPdf && txtPdf) {
        if (profLogo && profLogo.startsWith('data:image')) {
            imgPdf.src = profLogo;
            imgPdf.style.display = 'block';
            txtPdf.style.display = 'none';
        } else {
            imgPdf.style.display = 'none';
            txtPdf.innerText = profNombre.toUpperCase();
            txtPdf.style.display = 'block';
        }
    }
}

function sincronizarVistaPreviaPDF(svgCode) {
    actualizarPDFHeaders();
    const esTrifa = esSuministroTrifasico();
    const multiTS = esquema.tablerosSeccionales.length > 1;
    const mapaTS = {};
    esquema.tablerosSeccionales.forEach(t => { mapaTS[t.id] = t; });

    const cliNombre = document.getElementById('cliNombre').value.trim() || 'Sin Nombre';
    const cliDir = document.getElementById('cliDireccion').value.trim();
    const cliProy = document.getElementById('cliProyecto').value.trim();

    document.getElementById('pdf-cliente').innerText = cliNombre;
    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');

    const lblDir = document.getElementById('lbl-pdf-dir');
    const valDir = document.getElementById('pdf-dir');
    lblDir.style.display = cliDir ? 'block' : 'none';
    valDir.style.display = cliDir ? 'block' : 'none';
    valDir.innerText = cliDir;

    const lblProy = document.getElementById('lbl-pdf-proyecto');
    const valProy = document.getElementById('pdf-proyecto');
    lblProy.style.display = cliProy ? 'block' : 'none';
    valProy.style.display = cliProy ? 'block' : 'none';
    valProy.innerText = cliProy;

    document.getElementById('pdf-svg-container').innerHTML = svgCode;

    // Tabla Resumen Horizontal por Circuitos
    const tabla = document.getElementById('pdf-tabla-circuitos');
    let rowCirc = `<tr><th style="background:#0f172a; color:#fff; padding:5px; border:1px solid #0f172a; text-align:left;">Circuito</th>`;
    let rowTab = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Tablero</td>`;
    let rowFase = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Fase Asignada</td>`;
    let rowBocas = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Cantidad de Bocas</td>`;
    let rowDpms = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">DPMS (VA)</td>`;
    let rowIb = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Corriente Ib (A)</td>`;
    let rowProt = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Protección PIA</td>`;
    let rowCable = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Cable L;N / PE (mm²)</td>`;

    esquema.circuitos.forEach(c => {
        const ib = calcularIbCircuito(c).toFixed(2).replace('.', ',');
        const tsName = (mapaTS[c.tableroId] || esquema.tablerosSeccionales[0]).nombre;
        rowCirc += `<th style="background:#0f172a; color:#fff; padding:5px; border:1px solid #0f172a;">${escaparXML(c.id)} ${escaparXML(c.tipo)}</th>`;
        rowTab += `<td style="padding:4px; border:1px solid #cbd5e1; font-weight:700;">${escaparXML(tsName)}</td>`;
        rowFase += `<td style="padding:4px; border:1px solid #cbd5e1; font-weight:700;">${escaparXML(c.fase || 'L1')}</td>`;
        rowBocas += `<td style="padding:4px; border:1px solid #cbd5e1;">${c.bocas}</td>`;
        rowDpms += `<td style="padding:4px; border:1px solid #cbd5e1;">${c.dpms}</td>`;
        rowIb += `<td style="padding:4px; border:1px solid #cbd5e1;">${ib}</td>`;
        rowProt += `<td style="padding:4px; border:1px solid #cbd5e1;">${escaparXML(c.curvaPolos)}${escaparXML(c.in)}A</td>`;
        rowCable += `<td style="padding:4px; border:1px solid #cbd5e1;">${String(c.secLN).replace('.', ',')} / ${String(c.secPE).replace('.', ',')}</td>`;
    });

    rowCirc += `</tr>`;
    rowTab += `</tr>`;
    rowFase += `</tr>`;
    rowBocas += `</tr>`;
    rowDpms += `</tr>`;
    rowIb += `</tr>`;
    rowProt += `</tr>`;
    rowCable += `</tr>`;

    let bodyRows = '';
    if (multiTS) bodyRows += rowTab;
    if (esTrifa) bodyRows += rowFase;
    bodyRows += `${rowBocas}${rowDpms}${rowIb}${rowProt}${rowCable}`;

    tabla.innerHTML = `<thead>${rowCirc}</thead><tbody>${bodyRows}</tbody>`;

    // Referencias Técnicas Dinámicas
    const nombresTS = esquema.tablerosSeccionales.map(t => t.nombre).join(' / ');
    const refs = [
        ['RDD', 'Red de Distribución de la Distribuidora'],
        ['LA / LP', 'Línea de Alimentación / Línea Principal'],
        ['DPLA', 'Dispositivo de Protección de la Línea de Alimentación'],
        ['M', 'Medidor de Energía Eléctrica'],
        [esquema.nivel1.nombre, 'Tablero Principal (Sin PAT • Envolvente Clase II)'],
        ['LS', 'Línea Seccional'],
        [nombresTS, 'Tablero(s) Seccional(es) / Subtablero(s)'],
        ['ID', 'Interruptor Diferencial (Disyuntor)'],
        ['PIA', 'Pequeño Interruptor Automático (Termomagnética)'],
        ['Bornera PE / PAT', 'Barra de Protección Interna y Puesta a Tierra Externa'],
        ['Línea Azul Discontinua', 'Contorno de Envolvente de Tablero Eléctrico'],
        ['回 (Doble Cuadrado)', 'Aislación Clase II / Doble Aislación (IEC 60417)']
    ];
    if (esquema.nivel1.dps === 'SI') {
        refs.push(['DPS', 'Dispositivo de Protección contra Sobretensiones']);
    }

    document.getElementById('pdf-referencias-grid').innerHTML = refs
        .map(([sigla, desc]) => `<div><strong style="color:#0f172a;">${escaparXML(sigla)}:</strong> ${escaparXML(desc)}</div>`)
        .join('');
}

// ==========================================
// ACCIONES, VISTA PREVIA CON ZOOM Y PDF
// ==========================================
function toggleAccionesMenu() {
    const menu = document.getElementById('accionesMenu');
    if (menu.classList.contains('oculto')) {
        menu.classList.remove('oculto');
        setTimeout(() => menu.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    } else {
        menu.classList.add('oculto');
    }
}

let escalaBasePreview = 1;
let escalaActualPreview = 1;
let anchoRealA4 = 794;
let altoRealA4 = 1123;
let zoomListenersInicializados = false;

function aplicarEscalaVistaPrevia(nuevaEscala) {
    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    if (!element || !pdfContainer) return;

    escalaActualPreview = Math.max(escalaBasePreview, Math.min(2.5, nuevaEscala));
    pdfContainer.style.transformOrigin = 'top left';
    pdfContainer.style.transform = `scale(${escalaActualPreview})`;
    element.style.width = `${anchoRealA4 * escalaActualPreview}px`;
    element.style.height = `${altoRealA4 * escalaActualPreview}px`;
}

function inicializarZoomVistaPrevia() {
    if (zoomListenersInicializados) return;
    const wrapper = document.getElementById('previewWrapper');
    if (!wrapper) return;

    let distInicial = 0;
    let escalaInicialPellizco = 1;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            distInicial = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            escalaInicialPellizco = escalaActualPreview;
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && distInicial > 0) {
            e.preventDefault();
            const rect = wrapper.getBoundingClientRect();
            const centroX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centroY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const puntoX = centroX - rect.left + wrapper.scrollLeft;
            const puntoY = centroY - rect.top + wrapper.scrollTop;
            const escalaPrevia = escalaActualPreview;

            const distActual = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            aplicarEscalaVistaPrevia(escalaInicialPellizco * (distActual / distInicial));

            const factorCambio = escalaActualPreview / escalaPrevia;
            wrapper.scrollLeft = (puntoX * factorCambio) - (centroX - rect.left);
            wrapper.scrollTop = (puntoY * factorCambio) - (centroY - rect.top);
        }
    }, { passive: false });

    wrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) distInicial = 0;
    }, { passive: true });

    zoomListenersInicializados = true;
      }

function abrirVistaPrevia() {
    renderizarTodo();

    const modal = document.getElementById('modalVistaPrevia');
    const previewWrapper = document.getElementById('previewWrapper');
    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element.querySelector('.pdf-container');

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    element.style.display = 'inline-block';
    element.style.textAlign = 'left';
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
    previewWrapper.appendChild(element);

    if (pdfContainer) {
        pdfContainer.style.transform = 'none';
        anchoRealA4 = pdfContainer.offsetWidth || 794;
        altoRealA4 = pdfContainer.offsetHeight || 1123;
    }

    const anchoDisponible = Math.max(280, previewWrapper.clientWidth - 24);
    escalaBasePreview = Math.min(1, anchoDisponible / anchoRealA4);
    aplicarEscalaVistaPrevia(escalaBasePreview);

    previewWrapper.scrollTop = 0;
    previewWrapper.scrollLeft = 0;
    inicializarZoomVistaPrevia();
}

function cerrarVistaPrevia() {
    document.getElementById('modalVistaPrevia').classList.add('oculto');
    document.body.style.overflow = '';

    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    if (pdfContainer) {
        pdfContainer.style.transform = '';
        pdfContainer.style.transformOrigin = '';
    }

    element.style.width = '';
    element.style.height = '';
    element.style.display = '';
    element.style.textAlign = '';
    element.style.position = '';
    element.style.overflow = '';
    element.style.boxShadow = '';

    const originalContainer = document.querySelector('.preview-panel');
    if (originalContainer) originalContainer.appendChild(element);
    if (window.innerWidth < 992) element.style.display = 'none';
}

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
    const alto = (vb && vb.height) ? vb.height : (parseInt(svgEl.getAttribute('height'), 10) || 670);

    const svgClon = svgEl.cloneNode(true);
    svgClon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClon.setAttribute('width', ancho);
    svgClon.setAttribute('height', alto);

    const xml = new XMLSerializer().serializeToString(svgClon);
    const svgBlob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], {
        type: 'image/svg+xml;charset=utf-8'
    });
    const urlBlob = URL.createObjectURL(svgBlob);

    try {
        const pngDataUrl = await new Promise((resolve, reject) => {
            const imgLoader = new Image();
            imgLoader.onload = () => {
                const escala = 3;
                const canvas = document.createElement('canvas');
                canvas.width = ancho * escala;
                canvas.height = alto * escala;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(escala, escala);
                ctx.drawImage(imgLoader, 0, 0, ancho, alto);
                URL.revokeObjectURL(urlBlob);
                resolve(canvas.toDataURL('image/png'));
            };
            imgLoader.onerror = (err) => {
                URL.revokeObjectURL(urlBlob);
                reject(err);
            };
            imgLoader.src = urlBlob;
        });

        contenedor.innerHTML = `<img src="${pngDataUrl}" alt="Esquema Unifilar" style="width: 100%; max-height: 465px; height: auto; object-fit: contain; display: block; margin: 0 auto;">`;
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    } catch (e) {
        console.warn('No se pudo rasterizar el SVG, se usa respaldo vectorial:', e);
        return () => {
            contenedor.innerHTML = svgOriginalHTML;
        };
    }
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    if (permiteGuardarNube) {
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
        mostrarToast("Éxito", "Plano Unifilar PDF generado.");
    } catch (error) {
        mostrarAlertaCorp("Error", "Ocurrió un error al generar el PDF.");
        btn.innerHTML = "Descargar";
    } finally {
        restaurarSvg();
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
// WHATSAPP Y BORRADORES EN FIREBASE
// ==========================================
function prepararEnvioWhatsApp() {
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL';
    const esTrifa = esSuministroTrifasico();
    const mapaTS = {};
    esquema.tablerosSeccionales.forEach(t => { mapaTS[t.id] = t; });

    let m = `*${profNombre.toUpperCase()} - ESQUEMA UNIFILAR*\n`;
    m += `*Cliente:* ${document.getElementById('cliNombre').value || 'Sin Nombre'}\n`;
    if (document.getElementById('cliDireccion').value.trim()) {
        m += `*Dirección:* ${document.getElementById('cliDireccion').value.trim()}\n`;
    }
    m += `\n*Estructura de Tableros:*\n`;
    m += `• *Suministro:* ${esquema.nivel0.suministro} (${esquema.nivel0.lineaAlim})\n`;
    m += `• *${esquema.nivel1.nombre} (${esquema.nivel1.ip}${esquema.nivel1.dobleAislacion ? ' • Clase II' : ''}):* ${esquema.nivel1.tipoDisp} ${esquema.nivel1.curvaPolos}${esquema.nivel1.in}A\n`;

    esquema.tablerosSeccionales.forEach(ts => {
        m += `• *${ts.nombre} (${ts.ip}${ts.dobleAislacion ? ' • Clase II' : ''}):* ${ts.tipoCab} ${ts.in} (${ts.sens}) • ${ts.pat}\n`;
    });

    m += `\n*Circuitos Terminales (${esquema.circuitos.length}):*\n`;
    esquema.circuitos.forEach(c => {
        const tsName = (mapaTS[c.tableroId] || esquema.tablerosSeccionales[0]).nombre;
        const faseTxt = esTrifa ? ` [${c.fase}]` : '';
        m += `• *${c.id} (${tsName} • ${c.tipo})${faseTxt}:* ${c.curvaPolos}${c.in}A • Cable ${c.secLN}mm² + PE ${c.secPE}mm² • ${c.bocas} bocas (${c.dpms} VA)\n`;
    });

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, m);
    }
}

function guardarBorradorFirebase(mostrarAlerta = false, autoGuardado = false) {
    const uid = obtenerUid();
    if (!uid || !db) {
        if (mostrarAlerta) mostrarAlertaCorp("Error", "Sesión no detectada para la nube.");
        return;
    }
    if (!permiteGuardarNube) {
        if (mostrarAlerta) mostrarAlertaCorp("Bloqueado", "Cliente no agendado. No se guarda en nube.");
        return;
    }

    const nombreCli = (document.getElementById('cliNombre').value.trim() || 'Sin_Nombre').replace(/\s+/g, '_');
    const proyCli = (document.getElementById('cliProyecto').value.trim() || 'Unifilar').replace(/\s+/g, '_');
    const fechaHoy = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    const nombreSugerido = `${nombreCli}_${proyCli}_${fechaHoy}`;

    if (!autoGuardado) {
        document.getElementById('inputNombreBorrador').value = nombreBorradorActual || nombreSugerido;
        document.getElementById('modalGuardarBorrador').classList.remove('oculto');
    } else {
        ejecutarGuardarNube(nombreBorradorActual || nombreSugerido, false);
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
    actualizarResumenProyectoUI('syncing');

    const estado = {
        cliNombre: document.getElementById('cliNombre').value,
        cliDireccion: document.getElementById('cliDireccion').value,
        cliProyecto: document.getElementById('cliProyecto').value,
        esquema: esquema,
        fechaGuardado: Date.now(),
        nombreBorrador: nombreFinal,
        telefonoClienteActual: telefonoClienteActual
    };

    const docId = nombreFinal.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    db.collection("perfiles").doc(uid).collection("borradores_unifilar").doc(docId).set(estado)
        .then(() => {
            actualizarResumenProyectoUI('synced');
            if (mostrarAlerta) mostrarToast("Guardado", "Esquema sincronizado con la nube.");
        })
        .catch(() => {
            actualizarResumenProyectoUI();
            if (mostrarAlerta) mostrarAlertaCorp("Error", "Error al guardar el esquema.");
        });
}

let idBorradorAEliminar = null;
let btnBorradorAEliminar = null;

function eliminarBorradorNube(docId, btnElement) {
    idBorradorAEliminar = docId;
    btnBorradorAEliminar = btnElement;
    document.getElementById('modalConfirmarEliminar').classList.remove('oculto');
}

function cerrarModalEliminarBorrador() {
    document.getElementById('modalConfirmarEliminar').classList.add('oculto');
    idBorradorAEliminar = null;
    btnBorradorAEliminar = null;
}

function ejecutarEliminarBorrador() {
    const uid = obtenerUid();
    if (!uid || !db || !idBorradorAEliminar) return;

    db.collection("perfiles").doc(uid).collection("borradores_unifilar").doc(idBorradorAEliminar).delete()
        .then(() => {
            if (btnBorradorAEliminar) btnBorradorAEliminar.closest('div.modal-list-item')?.remove();
            cerrarModalEliminarBorrador();
            mostrarToast("Eliminado", "Borrador eliminado de la nube.");
        })
        .catch(() => {
            mostrarAlertaCorp("Error", "No se pudo eliminar el borrador.");
            cerrarModalEliminarBorrador();
        });
}

async function abrirModalBorradores() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Falta Cliente", "Ingresá el Nombre del Cliente primero para buscar sus esquemas.");
        return;
    }

    document.getElementById('modalBorradores').classList.remove('oculto');
    const lista = document.getElementById('listaBorradores');
    lista.innerHTML = '<div style="text-align: center; color: var(--ngc-neon);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando...</div>';

    const uid = obtenerUid();
    if (!uid || !db) {
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Sin conexión a la nube.</div>';
        return;
    }

    try {
        const snapshot = await db.collection("perfiles").doc(uid).collection("borradores_unifilar")
            .where('cliNombre', '==', nombre)
            .get();

        let docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
        docs.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        lista.innerHTML = '';
        if (docs.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded);">No hay esquemas guardados para este cliente.</p>';
            return;
        }

        docs.forEach(b => {
            const p = b.data;
            const fechaStr = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : 'Sin fecha';
            const cantC = p.esquema?.circuitos?.length || 0;
            lista.innerHTML += `
                <div class="modal-list-item" style="border-left: 3px solid var(--ngc-neon);">
                    <div style="flex: 1; min-width: 0; padding-right: 10px;">
                        <h4 style="word-break: break-word; line-height: 1.2; margin-bottom: 5px;">${escaparXML(p.nombreBorrador || p.cliNombre)}</h4>
                        <small style="color: var(--ngc-text-faded);">${fechaStr} • ${cantC} circuitos</small>
                    </div>
                    <div style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button type="button" class="corp-btn-small" onclick="cargarBorradorNube('${b.id}')">Abrir</button>
                        <button type="button" class="corp-btn-small danger" onclick="eliminarBorradorNube('${b.id}', this)"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Error al cargar borradores.</div>';
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

            if (typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();

            document.getElementById('step-cliente').classList.add('oculto');
            const st = document.getElementById('step-trabajo');
            st.classList.remove('oculto');
            st.classList.add('flex-column', 'gap-15');

            actualizarResumenProyectoUI('synced');
            renderizarTodo();
            mostrarToast("Esquema Abierto", "Los datos han sido cargados.");
        }
    } catch (e) {
        mostrarAlertaCorp("Error", "Error al cargar el borrador.");
    }
}

// ==========================================
// MENÚ INFERIOR TIPO APP
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
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-compass-drafting', url: '../croquis/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
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
            const footerRect = footer.getBoundingClientRect();
            const btnRect = btnActivo.getBoundingClientRect();
            footer.scrollLeft += (btnRect.left - footerRect.left) - (footerRect.width / 2) + (btnRect.width / 2);
        }
    });
}
