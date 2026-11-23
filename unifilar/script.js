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

// Mapa de admisibilidad térmica AEA 90364 (Cu en cañería embutida)
const MAPA_IZ_AEA = { "1.5": 15, "2.5": 21, "4": 28, "6": 36, "10": 50, "16": 66 };

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
            tipoDisp: 'PIA',
            curvaPolos: 'C 2x',
            in: '32',
            pcc: '4500',
            tension: '220',
            dps: 'NO',
            pat: 'PAT',
            lineaSec: 'LS: 2x6 mm² + PE 1x6 mm²'
        },
        nivel2: {
            nombre: 'TS1',
            ip: 'IP41',
            tipoCab: 'ID Clase A',
            in: '2x40A',
            sens: '30mA',
            pcc: '3000',
            tension: '220'
        },
        circuitos: [
            { id: 'C1', tipo: 'IUG', desc: 'Iluminación General', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '6',  pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 9,  dpms: 360 },
            { id: 'C2', tipo: 'TUG', desc: 'Tomas Uso General 1', piaCod: 'PIA2', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 11, dpms: 2200 },
            { id: 'C3', tipo: 'TUG', desc: 'Tomas Uso General 2', piaCod: 'PIA3', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 7,  dpms: 2200 },
            { id: 'C4', tipo: 'ACU', desc: 'Aire Acondicionado',  piaCod: 'PIA4', curvaPolos: 'C 2x', in: '10', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1353 }
        ]
    };
}

let esquema = crearEstadoInicialUnifilar();

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
                tipoDisp: 'PIA',
                curvaPolos: 'C 4x',
                in: '40',
                pcc: '6000',
                tension: '380',
                dps: 'SI',
                pat: 'PAT ≤ 10 Ω',
                lineaSec: 'LS: 4x10 mm² + PE 1x10 mm²'
            },
            nivel2: {
                nombre: 'TS1',
                ip: 'IP41',
                tipoCab: 'ID Clase A',
                in: '4x40A',
                sens: '30mA',
                pcc: '4500',
                tension: '380'
            },
            circuitos: [
                { id: 'C1', tipo: 'IUG', desc: 'Iluminación Planta Baja', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 10, dpms: 660 },
                { id: 'C2', tipo: 'TUG', desc: 'Tomas Uso General',       piaCod: 'PIA2', curvaPolos: 'B 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 12, dpms: 2200 },
                { id: 'C3', tipo: 'TUE', desc: 'Tomas Cocina / Lavadero', piaCod: 'PIA3', curvaPolos: 'C 2x', in: '20', pcc: '3000', tension: '220', secLN: '4',   secPE: '4',   bocas: 3,  dpms: 3300 },
                { id: 'C4', tipo: 'ACU', desc: 'Aire Acondicionado',      piaCod: 'PIA4', curvaPolos: 'C 2x', in: '16', pcc: '3000', tension: '220', secLN: '2.5', secPE: '2.5', bocas: 1,  dpms: 1800 }
            ]
        };
        mostrarToast("Plantilla Cargada", "Estructura Trifásica 380/220V precargada.");
    } else if (tipo === 'vacio') {
        esquema.circuitos = [
            { id: 'C1', tipo: 'IUG', desc: 'Iluminación', piaCod: 'PIA1', curvaPolos: 'B 2x', in: '10', pcc: '3000', tension: '220', secLN: '1.5', secPE: '2.5', bocas: 1, dpms: 100 }
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

        // Calcular bocas por circuito desde listaAmbientes
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
        const secCS = cs.seccionLN || (esTrifa ? '6' : '6');
        const peCS = cs.seccionPE || secCS;
        const inCS = cs.in || '32';

        esquema.nivel0.lineaAlim = `LA: ${esTrifa ? '4' : '2'}x${secCS} mm² + PE 1x${peCS} mm²`;
        esquema.nivel1.curvaPolos = esTrifa ? 'C 4x' : 'C 2x';
        esquema.nivel1.in = String(inCS);
        esquema.nivel1.tension = esTrifa ? '380' : '220';
        esquema.nivel1.lineaSec = `LS: ${esTrifa ? '4' : '2'}x${secCS} mm² + PE 1x${peCS} mm²`;

        esquema.nivel2.in = esTrifa ? '4x40A' : '2x40A';
        esquema.nivel2.tension = esTrifa ? '380' : '220';

        esquema.circuitos = (data.circuitos || []).map((c, idx) => {
            const ten = String(c.tension || '220');
            const polos = ten === '380' ? '4x' : '2x';
            const curva = c.tipo === 'IUG' || c.tipo === 'TUG' ? 'B' : 'C';
            const secLN = String(c.seccionLN || (c.tipo === 'IUG' ? '1.5' : '2.5'));
            const secPE = String(c.seccionPE || '2.5');
            return {
                id: c.id || `C${idx + 1}`,
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
// CONTROLADORES DE MODALES POR NIVEL
// ==========================================
function cerrarModalNivel(idModal) {
    document.getElementById(idModal).classList.add('oculto');
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
        document.getElementById('n1TipoDisp').value = esquema.nivel1.tipoDisp;
        document.getElementById('n1CurvaPolos').value = esquema.nivel1.curvaPolos;
        document.getElementById('n1In').value = esquema.nivel1.in;
        document.getElementById('n1Pcc').value = esquema.nivel1.pcc;
        document.getElementById('n1Dps').value = esquema.nivel1.dps;
        document.getElementById('n1Pat').value = esquema.nivel1.pat;
        document.getElementById('n1LineaSec').value = esquema.nivel1.lineaSec;
        document.getElementById('modalNivel1').classList.remove('oculto');
    } else if (nivel === 2) {
        document.getElementById('n2Nombre').value = esquema.nivel2.nombre;
        document.getElementById('n2Ip').value = esquema.nivel2.ip;
        document.getElementById('n2TipoCab').value = esquema.nivel2.tipoCab;
        document.getElementById('n2In').value = esquema.nivel2.in;
        document.getElementById('n2Sens').value = esquema.nivel2.sens;
        document.getElementById('n2Pcc').value = esquema.nivel2.pcc;
        document.getElementById('modalNivel2').classList.remove('oculto');
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
    esquema.nivel1.tipoDisp = document.getElementById('n1TipoDisp').value;
    esquema.nivel1.curvaPolos = document.getElementById('n1CurvaPolos').value;
    esquema.nivel1.in = document.getElementById('n1In').value;
    esquema.nivel1.pcc = document.getElementById('n1Pcc').value;
    esquema.nivel1.tension = esquema.nivel1.curvaPolos.includes('4x') ? '380' : '220';
    esquema.nivel1.dps = document.getElementById('n1Dps').value;
    esquema.nivel1.pat = document.getElementById('n1Pat').value.trim() || 'PAT';
    esquema.nivel1.lineaSec = document.getElementById('n1LineaSec').value.trim();
    cerrarModalNivel('modalNivel1');
    renderizarTodo();
    mostrarToast("Nivel 1 Actualizado", "Tablero Principal actualizado.");
}

function guardarNivel2() {
    esquema.nivel2.nombre = document.getElementById('n2Nombre').value.trim() || 'TS1';
    esquema.nivel2.ip = document.getElementById('n2Ip').value;
    esquema.nivel2.tipoCab = document.getElementById('n2TipoCab').value;
    esquema.nivel2.in = document.getElementById('n2In').value;
    esquema.nivel2.sens = document.getElementById('n2Sens').value;
    esquema.nivel2.pcc = document.getElementById('n2Pcc').value;
    esquema.nivel2.tension = esquema.nivel2.in.startsWith('4x') ? '380' : '220';
    cerrarModalNivel('modalNivel2');
    renderizarTodo();
    mostrarToast("Nivel 2 Actualizado", "Tablero Seccional actualizado.");
}

// ==========================================
// GESTIÓN DE CIRCUITOS (NIVEL 3 + PRECARGA)
// ==========================================
function abrirModalCircuito(index = null) {
    editandoCircuitoIndex = index;
    const titulo = document.getElementById('tituloModalCircuito');

    if (index !== null && esquema.circuitos[index]) {
        const c = esquema.circuitos[index];
        titulo.innerHTML = `<i class="fa-solid fa-pen" style="color: var(--ngc-warning);"></i> Editar ${c.id}`;
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
}

function cerrarModalCircuito() {
    document.getElementById('modalCircuito').classList.add('oculto');
    editandoCircuitoIndex = null;
}

function guardarCircuito() {
    const nuevo = {
        id: document.getElementById('cId').value.trim() || `C${esquema.circuitos.length + 1}`,
        tipo: document.getElementById('cTipo').value,
        desc: document.getElementById('cDesc').value.trim() || 'Circuito Terminal',
        piaCod: document.getElementById('cPiaCod').value.trim() || `PIA${esquema.circuitos.length + 1}`,
        curvaPolos: document.getElementById('cCurvaPolos').value,
        in: document.getElementById('cIn').value,
        pcc: document.getElementById('cPcc').value,
        tension: document.getElementById('cTension').value,
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
    // Nivel 0
    document.getElementById('ui-resumen-nivel-0').innerHTML = `
        <div class="uni-spec-item"><span>Red / Suministro</span><strong>${escaparXML(esquema.nivel0.rdd)} • ${escaparXML(esquema.nivel0.suministro)}</strong></div>
        <div class="uni-spec-item"><span>Protección / Medidor</span><strong>${escaparXML(esquema.nivel0.dpla)} • ${escaparXML(esquema.nivel0.medidor)}</strong></div>
        <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Alimentación</span><strong>${escaparXML(esquema.nivel0.lineaAlim)}</strong></div>
    `;

    // Nivel 1
    document.getElementById('ui-titulo-tp').innerHTML = `<i class="fa-solid fa-box"></i> ${escaparXML(esquema.nivel1.nombre)} (${escaparXML(esquema.nivel1.ip)})`;
    document.getElementById('ui-resumen-nivel-1').innerHTML = `
        <div class="uni-spec-item"><span>Cabecera General</span><strong>${escaparXML(esquema.nivel1.tipoDisp)} ${escaparXML(esquema.nivel1.curvaPolos)}${escaparXML(esquema.nivel1.in)}A</strong></div>
        <div class="uni-spec-item"><span>Poder Corte / Tierra</span><strong>Pcc ${escaparXML(esquema.nivel1.pcc)}A • ${escaparXML(esquema.nivel1.pat)}</strong></div>
        <div class="uni-spec-item" style="grid-column: span 2;"><span>Línea Seccional (LS)</span><strong>${escaparXML(esquema.nivel1.lineaSec)}</strong></div>
    `;

    // Nivel 2
    document.getElementById('ui-titulo-ts').innerHTML = `<i class="fa-solid fa-server"></i> ${escaparXML(esquema.nivel2.nombre)} (${escaparXML(esquema.nivel2.ip)})`;
    document.getElementById('ui-resumen-nivel-2').innerHTML = `
        <div class="uni-spec-item"><span>Cabecera Seccional</span><strong>${escaparXML(esquema.nivel2.tipoCab)} ${escaparXML(esquema.nivel2.in)}</strong></div>
        <div class="uni-spec-item"><span>Sensibilidad / Pcc</span><strong>IΔn ${escaparXML(esquema.nivel2.sens)} • Pcc ${escaparXML(esquema.nivel2.pcc)}A</strong></div>
    `;

    // Nivel 3: Circuitos + Auditoría AEA
    const lista = document.getElementById('ui-lista-circuitos');
    document.getElementById('ui-cant-circuitos').innerText = esquema.circuitos.length;
    lista.innerHTML = '';

    const alertasAEA = [];
    const inCabeceraTP = parseFloat(esquema.nivel1.in) || 32;

    esquema.circuitos.forEach((c, idx) => {
        const ib = calcularIbCircuito(c);
        const iz = MAPA_IZ_AEA[String(c.secLN)] || 21;
        const pIn = parseFloat(c.in) || 16;
        const cumpleCoord = (ib <= pIn && pIn <= iz);

        if (!cumpleCoord) {
            alertasAEA.push(`${c.id}: revisar Ib (${ib.toFixed(2)}A) ≤ In (${pIn}A) ≤ Iz (${iz}A)`);
        }
        if (pIn > inCabeceraTP) {
            alertasAEA.push(`${c.id}: In (${pIn}A) supera cabecera TP (${inCabeceraTP}A)`);
        }

        const pillClass = cumpleCoord ? 'uni-circ-pill' : 'uni-circ-pill warn';
        const pillText = cumpleCoord ? `✓ Ib=${ib.toFixed(2)}A ≤ In=${pIn}A ≤ Iz=${iz}A` : `⚠ Revisar Ib=${ib.toFixed(2)}A / In=${pIn}A`;

        lista.innerHTML += `
            <div class="uni-circ-item">
                <div class="uni-circ-top">
                    <span class="uni-circ-tag">${escaparXML(c.id)} • ${escaparXML(c.tipo)} <small style="color:var(--ngc-text-faded); font-weight:600;">(${escaparXML(c.piaCod)})</small></span>
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

    const banner = document.getElementById('ui-aea-unifilar-status');
    if (alertasAEA.length === 0) {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verificación AEA 90364 OK • ${esquema.circuitos.length} circuitos coordinados.`;
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
function dibujarSimboloPIA(x, y, polosStr) {
    const es4P = String(polosStr || '').includes('4x');
    const marcasPolos = es4P
        ? `<line x1="${x - 6}" y1="${y + 22}" x2="${x + 6}" y2="${y + 18}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 26}" x2="${x + 6}" y2="${y + 22}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 30}" x2="${x + 6}" y2="${y + 26}" stroke="#0f172a" stroke-width="1.4"/>
           <line x1="${x - 6}" y1="${y + 34}" x2="${x + 6}" y2="${y + 30}" stroke="#0f172a" stroke-width="1.4"/>`
        : `<line x1="${x - 6}" y1="${y + 24}" x2="${x + 6}" y2="${y + 19}" stroke="#0f172a" stroke-width="1.5"/>
           <line x1="${x - 6}" y1="${y + 29}" x2="${x + 6}" y2="${y + 24}" stroke="#0f172a" stroke-width="1.5"/>`;

    return `
        <!-- Línea superior e inferior -->
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#0f172a" stroke-width="1.8"/>
        <!-- Cruz seccionamiento -->
        <line x1="${x - 4}" y1="${y + 6}" x2="${x + 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${x + 4}" y1="${y + 6}" x2="${x - 4}" y2="${y + 14}" stroke="#0f172a" stroke-width="1.6"/>
        <!-- Contacto móvil abierto -->
        <line x1="${x}" y1="${y + 36}" x2="${x - 10}" y2="${y + 12}" stroke="#0f172a" stroke-width="2"/>
        <!-- Disparador Térmico y Magnético -->
        <polyline points="${x - 5},${y + 22} ${x - 14},${y + 22} ${x - 14},${y + 28} ${x - 5},${y + 28}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        <path d="M ${x - 14} ${y + 28} A 4 4 0 0 0 ${x - 14} ${y + 35}" fill="none" stroke="#0f172a" stroke-width="1.3"/>
        ${marcasPolos}
        <line x1="${x}" y1="${y + 36}" x2="${x}" y2="${y + 46}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function dibujarSimboloID(x, y) {
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#0f172a" stroke-width="1.8"/>
        <circle cx="${x}" cy="${y + 10}" r="2.2" fill="#0f172a"/>
        <!-- Contacto móvil -->
        <line x1="${x}" y1="${y + 36}" x2="${x - 10}" y2="${y + 12}" stroke="#0f172a" stroke-width="2"/>
        <!-- Toroide diferencial -->
        <ellipse cx="${x}" cy="${y + 42}" rx="8" ry="3.2" fill="none" stroke="#0f172a" stroke-width="1.4"/>
        <polyline points="${x - 8},${y + 42} ${x - 14},${y + 42} ${x - 14},${y + 24} ${x - 5},${y + 24}" fill="none" stroke="#0f172a" stroke-width="1.2" stroke-dasharray="2,2"/>
        <line x1="${x}" y1="${y + 36}" x2="${x}" y2="${y + 52}" stroke="#0f172a" stroke-width="1.8"/>
    `;
}

function dibujarSimboloPAT(x, y) {
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 14}" stroke="#15803d" stroke-width="1.8"/>
        <line x1="${x - 11}" y1="${y + 14}" x2="${x + 11}" y2="${y + 14}" stroke="#15803d" stroke-width="2"/>
        <line x1="${x - 7}" y1="${y + 18}" x2="${x + 7}" y2="${y + 18}" stroke="#15803d" stroke-width="1.8"/>
        <line x1="${x - 3}" y1="${y + 22}" x2="${x + 3}" y2="${y + 22}" stroke="#15803d" stroke-width="1.6"/>
    `;
}

function generarSVGUnifilar() {
    const nCirc = Math.max(1, esquema.circuitos.length);
    const colW = 152;
    const width = Math.max(700, nCirc * colW + 100);
    const cx = Math.round(width / 2);
    const height = 655;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="width: 100%; max-height: 465px; height: auto; display: block; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background:#ffffff;">`;
    
    // --- NIVEL 0: RDD, DPLA, MEDIDOR ---
    // Red Distribuidora
    svg += `
        <rect x="${cx - 42}" y="12" width="84" height="24" rx="4" fill="#f1f5f9" stroke="#0f172a" stroke-width="1.5"/>
        <text x="${cx}" y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel0.rdd)}</text>
        <line x1="${cx}" y1="36" x2="${cx}" y2="54" stroke="#0f172a" stroke-width="1.8"/>
    `;

    // DPLA (Fusible / Protección Acometida)
    svg += `
        <rect x="${cx - 8}" y="54" width="16" height="26" fill="#ffffff" stroke="#0f172a" stroke-width="1.6"/>
        <line x1="${cx}" y1="54" x2="${cx}" y2="80" stroke="#0f172a" stroke-width="1.4"/>
        <text x="${cx + 16}" y="71" text-anchor="start" font-size="10" font-weight="700" fill="#334155">${escaparXML(esquema.nivel0.dpla)}</text>
        <line x1="${cx}" y1="80" x2="${cx}" y2="96" stroke="#0f172a" stroke-width="1.8"/>
    `;

    // Medidor (M)
    svg += `
        <circle cx="${cx}" cy="112" r="16" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${cx}" y="116" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">M</text>
        <text x="${cx + 22}" y="110" text-anchor="start" font-size="9.5" font-weight="700" fill="#334155">${escaparXML(esquema.nivel0.medidor)}</text>
        <text x="${cx + 22}" y="121" text-anchor="start" font-size="8.5" fill="#64748b">${escaparXML(esquema.nivel0.suministro)}</text>
        <line x1="${cx}" y1="128" x2="${cx}" y2="156" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${cx + 10}" y="146" text-anchor="start" font-size="9" font-weight="600" fill="#475569">${escaparXML(esquema.nivel0.lineaAlim)}</text>
    `;

    // --- NIVEL 1: TABLERO PRINCIPAL (TP) ---
    const tpW = 240;
    const tpX = cx - tpW / 2;
    const tpY = 156;
    const tpH = 88;

    svg += `
        <rect x="${tpX}" y="${tpY}" width="${tpW}" height="${tpH}" rx="4" fill="#fafafa" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="5,3"/>
        <text x="${tpX + 8}" y="${tpY + 15}" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel1.nombre)}</text>
        <text x="${tpX + 8}" y="${tpY + 27}" font-size="9.5" font-weight="700" fill="#475569">${escaparXML(esquema.nivel1.ip)}</text>
    `;

    // PAT conectada al TP
    svg += `
        <line x1="${tpX - 28}" y1="${tpY + 46}" x2="${tpX}" y2="${tpY + 46}" stroke="#15803d" stroke-width="1.6"/>
        ${dibujarSimboloPAT(tpX - 28, tpY + 46)}
        <text x="${tpX - 28}" y="${tpY + 39}" text-anchor="middle" font-size="9" font-weight="800" fill="#15803d">${escaparXML(esquema.nivel1.pat)}</text>
    `;

    // Protección General TP
    svg += dibujarSimboloPIA(cx, tpY + 18, esquema.nivel1.curvaPolos);
    svg += `
        <text x="${cx + 14}" y="${tpY + 34}" font-size="10" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel1.tipoDisp)} ${escaparXML(esquema.nivel1.curvaPolos)}${escaparXML(esquema.nivel1.in)}A</text>
        <text x="${cx + 14}" y="${tpY + 46}" font-size="9" font-weight="600" fill="#334155">Pcc ${escaparXML(esquema.nivel1.pcc)}A • ${escaparXML(esquema.nivel1.tension)}V</text>
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

    // Línea Seccional (LS) entre TP y TS
    svg += `
        <line x1="${cx}" y1="${tpY + 64}" x2="${cx}" y2="282" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${cx + 10}" y="266" text-anchor="start" font-size="9.5" font-weight="700" fill="#334155">${escaparXML(esquema.nivel1.lineaSec)}</text>
    `;

    // --- NIVEL 2: TABLERO SECCIONAL (TS) ---
    const tsW = width - 48;
    const tsX = 24;
    const tsY = 282;
    const tsH = 260;

    svg += `
        <rect x="${tsX}" y="${tsY}" width="${tsW}" height="${tsH}" rx="5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
        <text x="${tsX + 10}" y="${tsY + 18}" font-size="12" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel2.nombre)}</text>
        <text x="${tsX + 10}" y="${tsY + 31}" font-size="10" font-weight="700" fill="#475569">${escaparXML(esquema.nivel2.ip)}</text>
    `;

    // Cabecera TS (ID)
    svg += dibujarSimboloID(cx, tsY + 12);
    svg += `
        <text x="${cx + 16}" y="${tsY + 28}" font-size="10.5" font-weight="800" fill="#0f172a">${escaparXML(esquema.nivel2.tipoCab)} ${escaparXML(esquema.nivel2.in)}</text>
        <text x="${cx + 16}" y="${tsY + 40}" font-size="9.5" font-weight="600" fill="#334155">IΔn ${escaparXML(esquema.nivel2.sens)} • Pcc ${escaparXML(esquema.nivel2.pcc)}A • ${escaparXML(esquema.nivel2.tension)}V</text>
    `;

    // --- NIVEL 3: BARRA DE DISTRIBUCIÓN Y CIRCUITOS TERMINALES ---
    const totalSpan = (nCirc - 1) * colW;
    const startX = cx - totalSpan / 2;
    const endX = cx + totalSpan / 2;
    const busY = tsY + 76;

    // Bajada desde ID a la barra
    svg += `<line x1="${cx}" y1="${tsY + 64}" x2="${cx}" y2="${busY}" stroke="#0f172a" stroke-width="1.8"/>`;

    // Barra horizontal de fases/neutro
    if (nCirc > 1) {
        svg += `<line x1="${startX}" y1="${busY}" x2="${endX}" y2="${busY}" stroke="#0f172a" stroke-width="2.4"/>`;
    }

    // Barra PE interna del TS con símbolo tierra a la izquierda
    const peBarY = tsY + 186;
    const peStart = Math.max(tsX + 34, startX - 24);
    const peEnd = Math.min(tsX + tsW - 20, endX + 24);
    svg += `
        <line x1="${peStart}" y1="${peBarY}" x2="${peEnd}" y2="${peBarY}" stroke="#15803d" stroke-width="1.6" stroke-dasharray="4,2"/>
        ${dibujarSimboloPAT(peStart, peBarY)}
        <text x="${peStart}" y="${peBarY - 5}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#15803d">PE</text>
    `;

    // Dibujar cada rama de circuito
    esquema.circuitos.forEach((c, i) => {
        const rx = startX + i * colW;
        const ib = calcularIbCircuito(c);

        // Nodo en barra principal
        svg += `<circle cx="${rx}" cy="${busY}" r="3.2" fill="#0f172a"/>`;
        svg += `<line x1="${rx}" y1="${busY}" x2="${rx}" y2="${busY + 16}" stroke="#0f172a" stroke-width="1.8"/>`;

        // Símbolo PIA del circuito
        svg += dibujarSimboloPIA(rx, busY + 16, c.curvaPolos);

        // Etiquetas técnicas de la protección PIA
        svg += `
            <text x="${rx + 12}" y="${busY + 30}" font-size="9.5" font-weight="800" fill="#0f172a">${escaparXML(c.piaCod)}</text>
            <text x="${rx + 12}" y="${busY + 41}" font-size="9" font-weight="700" fill="#1e293b">${escaparXML(c.curvaPolos)}${escaparXML(c.in)}A</text>
            <text x="${rx + 12}" y="${busY + 51}" font-size="8" fill="#475569">Pcc ${escaparXML(c.pcc)}A</text>
            <text x="${rx + 12}" y="${busY + 60}" font-size="8" fill="#475569">${escaparXML(c.tension)}V</text>
        `;

        // Línea de salida del circuito pasando por barra PE hasta el borne inferior
        const salidaTop = busY + 62;
        const salidaBottom = tsY + tsH + 34;
        svg += `<line x1="${rx}" y1="${salidaTop}" x2="${rx}" y2="${salidaBottom}" stroke="#0f172a" stroke-width="1.8"/>`;

        // Derivación PE desde la barra PE hacia el cable del circuito
        svg += `
            <circle cx="${rx + 14}" cy="${peBarY}" r="2.3" fill="#15803d"/>
            <line x1="${rx + 14}" y1="${peBarY}" x2="${rx + 14}" y2="${salidaBottom}" stroke="#15803d" stroke-width="1.3" stroke-dasharray="3,2"/>
            <text x="${rx + 18}" y="${peBarY + 24}" font-size="8" font-weight="700" fill="#15803d">PE 1x${String(c.secPE).replace('.', ',')}mm²</text>
        `;

        // Etiqueta de cable L;N fuera del tablero
        const polosNum = String(c.curvaPolos).includes('4x') ? '4' : '2';
        svg += `
            <text x="${rx - 6}" y="${tsY + tsH + 18}" text-anchor="end" font-size="8.5" font-weight="700" fill="#334155">${polosNum}x${String(c.secLN).replace('.', ',')}mm²</text>
        `;

        // Caja terminal del circuito (C1 IUG, C2 TUG, etc.)
        const boxW = 122;
        const boxX = rx - boxW / 2;
        const boxY = salidaBottom;
        svg += `
            <rect x="${boxX}" y="${boxY}" width="${boxW}" height="56" rx="5" fill="#f8fafc" stroke="#0f172a" stroke-width="1.4"/>
            <text x="${rx}" y="${boxY + 15}" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${escaparXML(c.id)} • ${escaparXML(c.tipo)}</text>
            <text x="${rx}" y="${boxY + 28}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#334155">${escaparXML(c.desc.slice(0, 22))}</text>
            <text x="${rx}" y="${boxY + 41}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0f172a">${c.bocas} bocas • ${c.dpms} VA</text>
            <text x="${rx}" y="${boxY + 52}" text-anchor="middle" font-size="8" font-weight="700" fill="#2374E1">Ib = ${ib.toFixed(2)} A</text>
        `;
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

    // Tabla Resumen Horizontal por Circuitos (idéntica al PDF adjunto)
    const tabla = document.getElementById('pdf-tabla-circuitos');
    let rowCirc = `<tr><th style="background:#0f172a; color:#fff; padding:5px; border:1px solid #0f172a; text-align:left;">Circuito</th>`;
    let rowBocas = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Cantidad de Bocas</td>`;
    let rowDpms = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">DPMS (VA)</td>`;
    let rowIb = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Corriente Ib (A)</td>`;
    let rowProt = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Protección PIA</td>`;
    let rowCable = `<tr><td style="background:#f8fafc; font-weight:700; padding:4px; border:1px solid #cbd5e1; text-align:left;">Cable L;N / PE (mm²)</td>`;

    esquema.circuitos.forEach(c => {
        const ib = calcularIbCircuito(c).toFixed(2).replace('.', ',');
        rowCirc += `<th style="background:#0f172a; color:#fff; padding:5px; border:1px solid #0f172a;">${escaparXML(c.id)} ${escaparXML(c.tipo)}</th>`;
        rowBocas += `<td style="padding:4px; border:1px solid #cbd5e1;">${c.bocas}</td>`;
        rowDpms += `<td style="padding:4px; border:1px solid #cbd5e1;">${c.dpms}</td>`;
        rowIb += `<td style="padding:4px; border:1px solid #cbd5e1;">${ib}</td>`;
        rowProt += `<td style="padding:4px; border:1px solid #cbd5e1;">${escaparXML(c.curvaPolos)}${escaparXML(c.in)}A</td>`;
        rowCable += `<td style="padding:4px; border:1px solid #cbd5e1;">${String(c.secLN).replace('.', ',')} / ${String(c.secPE).replace('.', ',')}</td>`;
    });

    rowCirc += `</tr>`;
    rowBocas += `</tr>`;
    rowDpms += `</tr>`;
    rowIb += `</tr>`;
    rowProt += `</tr>`;
    rowCable += `</tr>`;
    tabla.innerHTML = `<thead>${rowCirc}</thead><tbody>${rowBocas}${rowDpms}${rowIb}${rowProt}${rowCable}</tbody>`;

    // Referencias Técnicas Dinámicas
    const refs = [
        ['RDD', 'Red de Distribución de la Distribuidora'],
        ['LA / LP', 'Línea de Alimentación / Línea Principal'],
        ['DPLA', 'Dispositivo de Protección de la Línea de Alimentación'],
        ['M', 'Medidor de Energía Eléctrica'],
        [esquema.nivel1.nombre, 'Tablero Principal'],
        ['LS', 'Línea Seccional'],
        [esquema.nivel2.nombre, 'Tablero Seccional'],
        ['ID', 'Interruptor Diferencial (Disyuntor)'],
        ['PIA', 'Pequeño Interruptor Automático (Termomagnética)'],
        ['PAT / PE', 'Puesta a Tierra / Conductor de Protección']
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
    const ancho = (vb && vb.width) ? vb.width : (parseInt(svgEl.getAttribute('width'), 10) || 700);
    const alto = (vb && vb.height) ? vb.height : (parseInt(svgEl.getAttribute('height'), 10) || 655);

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
                const escala = 3; // Calidad imprenta (~300 DPI)
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

    // Bloquea la caja exacta A4 durante la captura para evitar desbordes
    element.style.width = '794px';
    element.style.height = '1115px';
    element.style.overflow = 'hidden';

    const marcaAgua = document.getElementById('marcaAguaPDF');
    if (marcaAgua) marcaAgua.style.display = 'none';

    // Convierte el SVG de #pdf-svg-container en imagen PNG nítida para html2canvas
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
                // Elimina cualquier página extra en blanco antes de descargar
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
    let m = `*${profNombre.toUpperCase()} - ESQUEMA UNIFILAR*\n`;
    m += `*Cliente:* ${document.getElementById('cliNombre').value || 'Sin Nombre'}\n`;
    if (document.getElementById('cliDireccion').value.trim()) {
        m += `*Dirección:* ${document.getElementById('cliDireccion').value.trim()}\n`;
    }
    m += `\n*Estructura de Tableros:*\n`;
    m += `• *Suministro:* ${esquema.nivel0.suministro} (${esquema.nivel0.lineaAlim})\n`;
    m += `• *${esquema.nivel1.nombre} (${esquema.nivel1.ip}):* ${esquema.nivel1.tipoDisp} ${esquema.nivel1.curvaPolos}${esquema.nivel1.in}A • ${esquema.nivel1.lineaSec}\n`;
    m += `• *${esquema.nivel2.nombre} (${esquema.nivel2.ip}):* ${esquema.nivel2.tipoCab} ${esquema.nivel2.in} (${esquema.nivel2.sens})\n\n`;

    m += `*Circuitos Terminales (${esquema.circuitos.length}):*\n`;
    esquema.circuitos.forEach(c => {
        m += `• *${c.id} (${c.tipo}):* ${c.curvaPolos}${c.in}A • Cable ${c.secLN}mm² + PE ${c.secPE}mm² • ${c.bocas} bocas (${c.dpms} VA)\n`;
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

            if (data.esquema) esquema = data.esquema;
            if (data.telefonoClienteActual !== undefined) telefonoClienteActual = data.telefonoClienteActual;

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


        
