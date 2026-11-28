// ============================================================================
// MÓDULO TABLERO TOPOGRÁFICO (RIEL DIN + IRAM 2183 + OFFLINE-FIRST)
// ============================================================================

const db = firebase.firestore();
const STORAGE_KEY_TOPO = 'topografico_estado_actual';
const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
const VIEWPORT_ZOOM = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';

// Mapas de polaridad reglamentarios IRAM 2183
const MAPAS_POLARIDAD = {
    'L1+N': ['L1', 'N'],
    'L2+N': ['L2', 'N'],
    'L3+N': ['L3', 'N'],
    'N+L1': ['N', 'L1'],
    'L1-L2-L3-N': ['L1', 'L2', 'L3', 'N'],
    'N-L1-L2-L3': ['N', 'L1', 'L2', 'L3'],
    'L1-L2-L3': ['L1', 'L2', 'L3'],
    'L1': ['L1'],
    'L2': ['L2'],
    'L3': ['L3'],
    'NONE': []
};

const COLORES_IRAM = {
    'L1': { hex: '#78350f', texto: '#ffffff', label: 'L1' },
    'L2': { hex: '#1e293b', texto: '#ffffff', label: 'L2' },
    'L3': { hex: '#dc2626', texto: '#ffffff', label: 'L3' },
    'N':  { hex: '#0284c7', texto: '#ffffff', label: 'N' },
    'PE': { hex: '#16a34a', texto: '#ffffff', label: 'PE' }
};

const PRECARGAS_TOPO = {
    'id_2p_40': { codigo: 'ID1', nombre: 'Interruptor Diferencial 40A 30mA', modulos: 2, polos: 'L1+N', calibre: '40A • 30mA AC', tipo: 'ID', bornera: 'Peine / Barras TS' },
    'id_4p_40': { codigo: 'ID1', nombre: 'Interruptor Diferencial Tetrapolar 40A', modulos: 4, polos: 'L1-L2-L3-N', calibre: '40A • 30mA AC', tipo: 'ID', bornera: 'Peine 3F+N' },
    'pia_2p_c10': { codigo: 'C1', nombre: 'PIA Bipolar C10 - Iluminación (IUG)', modulos: 2, polos: 'L1+N', calibre: 'C10A • 4.5kA', tipo: 'PIA', bornera: '2x1.5mm² + PE' },
    'pia_2p_c16': { codigo: 'C2', nombre: 'PIA Bipolar C16 - Tomacorrientes (TUG)', modulos: 2, polos: 'L1+N', calibre: 'C16A • 4.5kA', tipo: 'PIA', bornera: '2x2.5mm² + PE' },
    'pia_2p_c20': { codigo: 'C3', nombre: 'PIA Bipolar C20 - Especiales (TUE/ACU)', modulos: 2, polos: 'L2+N', calibre: 'C20A • 4.5kA', tipo: 'PIA', bornera: '2x2.5mm² + PE' },
    'pia_2p_c25': { codigo: 'IG', nombre: 'PIA Bipolar C25 - Cabecera General', modulos: 2, polos: 'L1+N', calibre: 'C25A • 6kA', tipo: 'PIA', bornera: '2x4mm² + PE' },
    'pia_2p_c32': { codigo: 'IG', nombre: 'PIA Bipolar C32 - Cabecera General', modulos: 2, polos: 'L1+N', calibre: 'C32A • 6kA', tipo: 'PIA', bornera: '2x6mm² + PE' },
    'pia_4p_c25': { codigo: 'IG', nombre: 'PIA Tetrapolar C25 - Cabecera Trifásica', modulos: 4, polos: 'L1-L2-L3-N', calibre: 'C25A • 6kA', tipo: 'PIA', bornera: '4x4mm² + PE' },
    'pia_4p_c32': { codigo: 'IG', nombre: 'PIA Tetrapolar C32 - Cabecera Trifásica', modulos: 4, polos: 'L1-L2-L3-N', calibre: 'C32A • 6kA', tipo: 'PIA', bornera: '4x6mm² + PE' },
    'dps_2p': { codigo: 'DPS', nombre: 'Descargador Sobretensiones Tipo 2 (1P+N)', modulos: 2, polos: 'L1+N', calibre: 'In 20kA • Uc 275V', tipo: 'DPS', bornera: 'Cable 6mm² a Bornera PE' },
    'dps_4p': { codigo: 'DPS', nombre: 'Descargador Sobretensiones Tipo 2 (3P+N)', modulos: 4, polos: 'L1-L2-L3-N', calibre: 'In 20kA • Uc 275V', tipo: 'DPS', bornera: 'Cable 6mm² a Bornera PE' },
    'relevador_1m': { codigo: 'PT1', nombre: 'Protector de Alta y Baja Tensión DIN', modulos: 2, polos: 'L1+N', calibre: '40A • Corte Auto', tipo: 'CONT', bornera: 'Entrada / Salida Cabecera' },
    'piloto_1m': { codigo: 'LP1', nombre: 'Luz Piloto LED Señalización Presencia', modulos: 1, polos: 'L1', calibre: '230V AC • LED', tipo: 'PILOTO', bornera: '1.5mm² + N' },
    'reserva_1m': { codigo: 'RES', nombre: 'Espacio Reserva / Tapa Ciega DIN', modulos: 1, polos: 'NONE', calibre: 'Reserva AEA', tipo: 'RESERVA', bornera: 'Libre' }
};

let estadoTopo = {
    cliente: {
        nombre: '',
        direccion: '',
        proyecto: '',
        telefono: '',
        agendado: false,
        contactoId: ''
    },
    gabinetes: [
        {
            id: 'gab_1',
            codigo: 'TS1',
            nombre: 'Tablero Seccional Principal',
            modulos: 12,
            ip: 'IP41 • PVC Autoextinguible',
            montaje: 'Embutir',
            borneras: 'PE + Neutro',
            peineActivo: true,
            dispositivos: []
        }
    ],
    gabineteActivoId: 'gab_1',
    mostrarPolos: true,
    observaciones: '',
    borradorId: null
};

let agendaCacheTopo = [];
let borradoresCacheTopo = [];
let timerAutoNube = null;

// ============================================================================
// UTILIDADES Y SEGURIDAD
// ============================================================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function obtenerUid() {
    const u = firebase.auth().currentUser;
    return u ? u.uid : null;
}

function mostrarAlertaCorp(titulo, mensaje, tipo = 'info') {
    const modal = document.getElementById('modalAlertaCorp');
    const ico = document.getElementById('alertaCorpIcono');
    document.getElementById('alertaCorpTitulo').textContent = titulo;
    document.getElementById('alertaCorpMensaje').textContent = mensaje;
    if (tipo === 'error') {
        ico.className = 'fa-solid fa-triangle-exclamation';
        ico.style.color = 'var(--error-red)';
    } else if (tipo === 'success') {
        ico.className = 'fa-solid fa-circle-check';
        ico.style.color = 'var(--success-green)';
    } else {
        ico.className = 'fa-solid fa-circle-info';
        ico.style.color = 'var(--ngc-neon)';
    }
    modal.classList.remove('oculto');
}

function cerrarAlertaCorp() {
    document.getElementById('modalAlertaCorp').classList.add('oculto');
}

function obtenerGabineteActivo() {
    let gab = estadoTopo.gabinetes.find(g => g.id === estadoTopo.gabineteActivoId);
    if (!gab && estadoTopo.gabinetes.length > 0) {
        gab = estadoTopo.gabinetes[0];
        estadoTopo.gabineteActivoId = gab.id;
    }
    return gab;
}

// ============================================================================
// ARRANQUE Y PERSISTENCIA OFFLINE-FIRST
// ============================================================================
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
        await inicializarModuloTopografico();
    } finally {
        const loader = document.getElementById('loading');
        if (loader) loader.style.display = 'none';
    }
});

async function inicializarModuloTopografico() {
    generarMenuInferior();

    // 1. Verificar si venimos desde Agenda abriendo un borrador específico
    const pendienteRaw = localStorage.getItem('villaser_abrir_borrador_pendiente');
    if (pendienteRaw) {
        try {
            const pend = JSON.parse(pendienteRaw);
            if (pend && pend.modulo === 'topografico' && pend.id) {
                localStorage.removeItem('villaser_abrir_borrador_pendiente');
                const uid = obtenerUid();
                if (uid) {
                    const doc = await db.collection('usuarios').doc(uid).collection('borradores_topografico').doc(pend.id).get();
                    if (doc.exists) {
                        aplicarDatosBorradorTopo(doc.id, doc.data());
                        entrarAPantallaTrabajo();
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudo abrir borrador pendiente:', e);
        }
    }

    // 2. Restaurar estado local si existe
    const guardado = localStorage.getItem(STORAGE_KEY_TOPO);
    if (guardado) {
        try {
            const parsed = JSON.parse(guardado);
            if (parsed && parsed.cliente) {
                estadoTopo = Object.assign({}, estadoTopo, parsed);
                if (!Array.isArray(estadoTopo.gabinetes) || estadoTopo.gabinetes.length === 0) {
                    estadoTopo.gabinetes = [{
                        id: 'gab_1', codigo: 'TS1', nombre: 'Tablero Seccional Principal',
                        modulos: 12, ip: 'IP41 • PVC Autoextinguible', montaje: 'Embutir',
                        borneras: 'PE + Neutro', peineActivo: true, dispositivos: []
                    }];
                    estadoTopo.gabineteActivoId = 'gab_1';
                }
                poblarCamposClienteDesdeEstado();
                if (estadoTopo.cliente.nombre && estadoTopo.cliente.direccion && estadoTopo.cliente.proyecto) {
                    entrarAPantallaTrabajo();
                    return;
                }
            }
        } catch (e) {
            console.warn('Error leyendo caché local topográfico:', e);
        }
    }

    // 3. Si no hay trabajo activo, revisar cliente global compartido entre módulos
    const cliGlobalRaw = localStorage.getItem('villaser_cliente_global');
    if (cliGlobalRaw) {
        try {
            const cg = JSON.parse(cliGlobalRaw);
            if (cg && cg.nombre) {
                estadoTopo.cliente.nombre = cg.nombre || '';
                estadoTopo.cliente.direccion = cg.direccion || '';
                estadoTopo.cliente.proyecto = cg.proyecto || '';
                estadoTopo.cliente.telefono = cg.telefono || '';
                estadoTopo.cliente.agendado = Boolean(cg.agendado || cg.id);
                estadoTopo.cliente.contactoId = cg.id || cg.contactoId || '';
                poblarCamposClienteDesdeEstado();
            }
        } catch (e) {}
    }
}

function poblarCamposClienteDesdeEstado() {
    document.getElementById('cliNombre').value = estadoTopo.cliente.nombre || '';
    document.getElementById('cliDireccion').value = estadoTopo.cliente.direccion || '';
    document.getElementById('cliProyecto').value = estadoTopo.cliente.proyecto || '';
    document.getElementById('cliTelefono').value = estadoTopo.cliente.telefono || '';
    const obsEl = document.getElementById('obsGeneralesTopo');
    if (obsEl) obsEl.value = estadoTopo.observaciones || '';
}

function guardarEstadoLocalTopo() {
    estadoTopo.cliente.nombre = document.getElementById('cliNombre').value.trim();
    estadoTopo.cliente.direccion = document.getElementById('cliDireccion').value.trim();
    estadoTopo.cliente.proyecto = document.getElementById('cliProyecto').value.trim();
    estadoTopo.cliente.telefono = document.getElementById('cliTelefono').value.trim();

    try {
        localStorage.setItem(STORAGE_KEY_TOPO, JSON.stringify(estadoTopo));
        if (estadoTopo.cliente.nombre) {
            localStorage.setItem('villaser_cliente_global', JSON.stringify({
                nombre: estadoTopo.cliente.nombre,
                direccion: estadoTopo.cliente.direccion,
                proyecto: estadoTopo.cliente.proyecto,
                telefono: estadoTopo.cliente.telefono,
                agendado: estadoTopo.cliente.agendado,
                id: estadoTopo.cliente.contactoId
            }));
        }
    } catch (e) {
        console.warn('Error guardando localStorage:', e);
    }
}

function programarAutoNube() {
    if (!estadoTopo.cliente.agendado) return;
    clearTimeout(timerAutoNube);
    timerAutoNube = setTimeout(() => {
        guardarBorradorFirebase(false, true);
    }, 2500);
}

// ============================================================================
// FLUJO PASO 1 -> PASO 2 Y AGENDA
// ============================================================================
async function iniciarTopografico() {
    guardarEstadoLocalTopo();
    const { nombre, direccion, proyecto } = estadoTopo.cliente;
    if (!nombre || !direccion || !proyecto) {
        mostrarAlertaCorp('Datos Incompletos', 'Completá Cliente, Dirección y Proyecto para iniciar el tablero.', 'error');
        return;
    }

    if (estadoTopo.cliente.agendado) {
        entrarAPantallaTrabajo();
        return;
    }

    const uid = obtenerUid();
    if (!uid || !navigator.onLine) {
        entrarAPantallaTrabajo();
        return;
    }

    try {
        const snap = await db.collection('usuarios').doc(uid).collection('contactos')
            .where('nombre', '==', nombre).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            estadoTopo.cliente.agendado = true;
            estadoTopo.cliente.contactoId = doc.id;
            if (!estadoTopo.cliente.telefono && doc.data().telefono) {
                estadoTopo.cliente.telefono = doc.data().telefono;
            }
            guardarEstadoLocalTopo();
            entrarAPantallaTrabajo();
        } else {
            document.getElementById('modalConfirmarSinAgenda').classList.remove('oculto');
        }
    } catch (e) {
        entrarAPantallaTrabajo();
    }
}

function continuarSinAgendarTopo() {
    document.getElementById('modalConfirmarSinAgenda').classList.add('oculto');
    estadoTopo.cliente.agendado = false;
    guardarEstadoLocalTopo();
    entrarAPantallaTrabajo();
}

async function agendarYContinuarTopo() {
    document.getElementById('modalConfirmarSinAgenda').classList.add('oculto');
    const uid = obtenerUid();
    if (uid) {
        try {
            const ref = await db.collection('usuarios').doc(uid).collection('contactos').add({
                nombre: estadoTopo.cliente.nombre,
                direccion: estadoTopo.cliente.direccion,
                telefono: estadoTopo.cliente.telefono || '',
                notas: 'Creado desde Tablero Topográfico',
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
            });
            estadoTopo.cliente.agendado = true;
            estadoTopo.cliente.contactoId = ref.id;
            guardarEstadoLocalTopo();
        } catch (e) {
            console.warn('Error agendando contacto:', e);
        }
    }
    entrarAPantallaTrabajo();
}

function entrarAPantallaTrabajo() {
    document.getElementById('step-cliente').classList.add('oculto');
    document.getElementById('step-trabajo').classList.remove('oculto');
    document.getElementById('dockTopograficoFlotante').classList.remove('oculto');

    document.getElementById('ui-cli-nombre').textContent = estadoTopo.cliente.nombre;
    document.getElementById('ui-cli-sub').textContent = `${estadoTopo.cliente.direccion} • ${estadoTopo.cliente.proyecto}`;
    document.getElementById('obsGeneralesTopo').value = estadoTopo.observaciones || '';

    actualizarBadgeNube(estadoTopo.cliente.agendado ? 'synced' : 'local');
    renderizarTodoTopografico();
}

function volverAEditarCliente() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('dockTopograficoFlotante').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    poblarCamposClienteDesdeEstado();
}

function actualizarBadgeNube(estado) {
    const badge = document.getElementById('ui-cloud-badge');
    if (!badge) return;
    if (estado === 'saving') {
        badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando';
        badge.style.color = '#f59e0b';
    } else if (estado === 'synced') {
        badge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Nube OK';
        badge.style.color = 'var(--success-green)';
    } else if (estado === 'error') {
        badge.innerHTML = '<i class="fa-solid fa-cloud-exclamation"></i> Sin Nube';
        badge.style.color = 'var(--error-red)';
    } else {
        badge.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Local';
        badge.style.color = 'var(--ngc-text-faded)';
    }
}

// ============================================================================
// AGENDA GLOBAL
// ============================================================================
async function abrirModalAgendaGlobal() {
    const modal = document.getElementById('modalAgenda');
    const lista = document.getElementById('listaAgendaGlobal');
    document.getElementById('buscadorAgendaInput').value = '';
    lista.innerHTML = '<div style="text-align:center; padding:20px; color:var(--ngc-text-faded);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando clientes...</div>';
    modal.classList.remove('oculto');

    const uid = obtenerUid();
    if (!uid) {
        lista.innerHTML = '<div style="text-align:center; padding:16px; color:var(--error-red);">Sesión no iniciada.</div>';
        return;
    }
    try {
        const snap = await db.collection('usuarios').doc(uid).collection('contactos').orderBy('nombre').get();
        agendaCacheTopo = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarListaAgenda(agendaCacheTopo);
    } catch (e) {
        lista.innerHTML = '<div style="text-align:center; padding:16px; color:var(--error-red);">Error al leer Agenda.</div>';
    }
}

function filtrarAgendaGlobal() {
    const q = document.getElementById('buscadorAgendaInput').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtrados = agendaCacheTopo.filter(c => {
        const nom = (c.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const dir = (c.direccion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nom.includes(q) || dir.includes(q);
    });
    renderizarListaAgenda(filtrados);
}

function renderizarListaAgenda(listaClientes) {
    const cont = document.getElementById('listaAgendaGlobal');
    if (!listaClientes.length) {
        cont.innerHTML = '<div style="text-align:center; padding:16px; color:var(--ngc-text-faded);">Sin clientes coincidentes.</div>';
        return;
    }
    cont.innerHTML = listaClientes.map(c => `
        <div class="modal-list-item" style="cursor:pointer;" onclick="seleccionarContacto('${escapeHtml(c.id)}')">
            <div style="font-weight:800; color:var(--ngc-text-main);">${escapeHtml(c.nombre)}</div>
            <div style="font-size:0.78rem; color:var(--ngc-text-faded);">${escapeHtml(c.direccion || 'Sin dirección')} ${c.telefono ? '• ' + escapeHtml(c.telefono) : ''}</div>
        </div>
    `).join('');
}

function seleccionarContacto(id) {
    const c = agendaCacheTopo.find(item => item.id === id);
    if (!c) return;
    estadoTopo.cliente.nombre = c.nombre || '';
    estadoTopo.cliente.direccion = c.direccion || '';
    estadoTopo.cliente.telefono = c.telefono || '';
    estadoTopo.cliente.agendado = true;
    estadoTopo.cliente.contactoId = c.id;
    poblarCamposClienteDesdeEstado();
    guardarEstadoLocalTopo();
    cerrarModalAgendaGlobal();
}

function cerrarModalAgendaGlobal() {
    document.getElementById('modalAgenda').classList.add('oculto');
}

// ============================================================================
// GESTIÓN DE GABINETES
// ============================================================================
function abrirModalGabinete(gabId) {
    const modal = document.getElementById('modalGabinete');
    if (gabId) {
        const gab = estadoTopo.gabinetes.find(g => g.id === gabId);
        if (!gab) return;
        document.getElementById('tituloModalGabinete').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Gabinete';
        document.getElementById('editGabId').value = gab.id;
        document.getElementById('gabCodigo').value = gab.codigo;
        document.getElementById('gabNombre').value = gab.nombre;
        document.getElementById('gabModulos').value = String(gab.modulos);
        document.getElementById('gabIP').value = gab.ip;
        document.getElementById('gabMontaje').value = gab.montaje;
        document.getElementById('gabBorneras').value = gab.borneras;
    } else {
        const n = estadoTopo.gabinetes.length + 1;
        document.getElementById('tituloModalGabinete').innerHTML = '<i class="fa-solid fa-plus"></i> Nuevo Gabinete';
        document.getElementById('editGabId').value = '';
        document.getElementById('gabCodigo').value = `TS${n}`;
        document.getElementById('gabNombre').value = `Tablero Seccional ${n}`;
        document.getElementById('gabModulos').value = '12';
        document.getElementById('gabIP').value = 'IP41 • PVC Autoextinguible';
        document.getElementById('gabMontaje').value = 'Embutir';
        document.getElementById('gabBorneras').value = 'PE + Neutro';
    }
    modal.classList.remove('oculto');
}

function cerrarModalGabinete() {
    document.getElementById('modalGabinete').classList.add('oculto');
}

function guardarGabinete() {
    const editId = document.getElementById('editGabId').value;
    const codigo = document.getElementById('gabCodigo').value.trim() || 'TS1';
    const nombre = document.getElementById('gabNombre').value.trim() || 'Tablero Seccional';
    const modulos = parseInt(document.getElementById('gabModulos').value, 10) || 12;
    const ip = document.getElementById('gabIP').value;
    const montaje = document.getElementById('gabMontaje').value;
    const borneras = document.getElementById('gabBorneras').value;

    if (editId) {
        const gab = estadoTopo.gabinetes.find(g => g.id === editId);
        if (gab) {
            gab.codigo = codigo;
            gab.nombre = nombre;
            gab.modulos = modulos;
            gab.ip = ip;
            gab.montaje = montaje;
            gab.borneras = borneras;
        }
    } else {
        const nuevoId = 'gab_' + Date.now();
        estadoTopo.gabinetes.push({
            id: nuevoId,
            codigo,
            nombre,
            modulos,
            ip,
            montaje,
            borneras,
            peineActivo: true,
            dispositivos: []
        });
        estadoTopo.gabineteActivoId = nuevoId;
    }

    cerrarModalGabinete();
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function seleccionarGabineteActivo(gabId) {
    estadoTopo.gabineteActivoId = gabId;
    guardarEstadoLocalTopo();
    renderizarTodoTopografico();
}

function eliminarGabinete(gabId) {
    if (estadoTopo.gabinetes.length <= 1) {
        mostrarAlertaCorp('Acción no permitida', 'Debe existir al menos un gabinete en el proyecto.', 'error');
        return;
    }
    estadoTopo.gabinetes = estadoTopo.gabinetes.filter(g => g.id !== gabId);
    estadoTopo.gabineteActivoId = estadoTopo.gabinetes[0].id;
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

// ============================================================================
// GESTIÓN DE DISPOSITIVOS EN RIEL DIN (ALTA, EDICIÓN, DUPLICADO, REORDEN)
// ============================================================================
function aplicarPrecargaDispositivo() {
    const key = document.getElementById('devPrecarga').value;
    const p = PRECARGAS_TOPO[key];
    if (!p) return;
    document.getElementById('devCodigo').value = p.codigo;
    document.getElementById('devNombre').value = p.nombre;
    document.getElementById('devModulos').value = String(p.modulos);
    document.getElementById('devPolos').value = p.polos;
    document.getElementById('devCalibre').value = p.calibre;
    document.getElementById('devTipo').value = p.tipo;
    document.getElementById('devBornera').value = p.bornera;
}

function sincronizarPolosConModulos() {
    const mods = parseInt(document.getElementById('devModulos').value, 10);
    const polosEl = document.getElementById('devPolos');
    if (mods === 1 && polosEl.value.includes('+')) polosEl.value = 'L1';
    if (mods === 2 && !polosEl.value.includes('+')) polosEl.value = 'L1+N';
    if (mods === 3) polosEl.value = 'L1-L2-L3';
    if (mods === 4) polosEl.value = 'L1-L2-L3-N';
}

function abrirModalDispositivo(devId) {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    const modal = document.getElementById('modalDispositivoTopo');

    if (devId) {
        const dev = gab.dispositivos.find(d => d.id === devId);
        if (!dev) return;
        document.getElementById('tituloModalDispositivo').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Dispositivo DIN';
        document.getElementById('editDevId').value = dev.id;
        document.getElementById('devPrecarga').value = '';
        document.getElementById('devCodigo').value = dev.codigo;
        document.getElementById('devNombre').value = dev.nombre;
        document.getElementById('devModulos').value = String(dev.modulos);
        document.getElementById('devPolos').value = dev.polos;
        document.getElementById('devCalibre').value = dev.calibre;
        document.getElementById('devTipo').value = dev.tipo;
        document.getElementById('devBornera').value = dev.bornera;
    } else {
        const nextNum = gab.dispositivos.filter(d => d.tipo === 'PIA').length + 1;
        document.getElementById('tituloModalDispositivo').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Agregar Dispositivo DIN';
        document.getElementById('editDevId').value = '';
        document.getElementById('devPrecarga').value = '';
        document.getElementById('devCodigo').value = `C${nextNum}`;
        document.getElementById('devNombre').value = `PIA Bipolar C16 - Circuito ${nextNum}`;
        document.getElementById('devModulos').value = '2';
        document.getElementById('devPolos').value = 'L1+N';
        document.getElementById('devCalibre').value = 'C16A • 4.5kA';
        document.getElementById('devTipo').value = 'PIA';
        document.getElementById('devBornera').value = '2x2.5mm² + PE';
    }
    modal.classList.remove('oculto');
}

function cerrarModalDispositivo() {
    document.getElementById('modalDispositivoTopo').classList.add('oculto');
}

function guardarDispositivoTopo() {
    const gab = obtenerGabineteActivo();
    if (!gab) return;

    const editId = document.getElementById('editDevId').value;
    const codigo = document.getElementById('devCodigo').value.trim() || 'C1';
    const nombre = document.getElementById('devNombre').value.trim() || 'Dispositivo DIN';
    const modulos = parseInt(document.getElementById('devModulos').value, 10) || 2;
    const polos = document.getElementById('devPolos').value;
    const calibre = document.getElementById('devCalibre').value.trim();
    const tipo = document.getElementById('devTipo').value;
    const bornera = document.getElementById('devBornera').value.trim();

    if (editId) {
        const dev = gab.dispositivos.find(d => d.id === editId);
        if (dev) {
            Object.assign(dev, { codigo, nombre, modulos, polos, calibre, tipo, bornera });
        }
    } else {
        gab.dispositivos.push({
            id: 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            codigo,
            nombre,
            modulos,
            polos,
            calibre,
            tipo,
            bornera
        });
    }

    cerrarModalDispositivo();
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function duplicarDispositivoTopo(devId) {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    const idx = gab.dispositivos.findIndex(d => d.id === devId);
    if (idx === -1) return;
    const orig = gab.dispositivos[idx];

    // Incrementar código automáticamente si termina en número (ej: C1 -> C2)
    let nuevoCodigo = orig.codigo;
    const match = orig.codigo.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
        nuevoCodigo = `${match[1]}${parseInt(match[2], 10) + 1}`;
    }

    const copia = {
        ...orig,
        id: 'dev_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        codigo: nuevoCodigo
    };

    gab.dispositivos.splice(idx + 1, 0, copia);
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function moverDispositivoTopo(devId, delta) {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    const idx = gab.dispositivos.findIndex(d => d.id === devId);
    const destino = idx + delta;
    if (idx === -1 || destino < 0 || destino >= gab.dispositivos.length) return;
    const temp = gab.dispositivos[idx];
    gab.dispositivos[idx] = gab.dispositivos[destino];
    gab.dispositivos[destino] = temp;
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function eliminarDispositivoTopo(devId) {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    gab.dispositivos = gab.dispositivos.filter(d => d.id !== devId);
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function toggleMostrarPolos() {
    estadoTopo.mostrarPolos = !estadoTopo.mostrarPolos;
    guardarEstadoLocalTopo();
    renderizarTodoTopografico();
}

function togglePeineGabineteActivo() {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    gab.peineActivo = !gab.peineActivo;
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
}

function actualizarObservacionesTopo() {
    estadoTopo.observaciones = document.getElementById('obsGeneralesTopo').value;
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarVistaPreviaA4();
        }

// ============================================================================
// CÁLCULO DE MÉTRICAS, EQUILIBRIO DE FASES Y RENDERIZADO UNIFICADO
// ============================================================================
function calcularMetricasGabinete(gab) {
    let modulosOcupados = 0;
    const fases = { L1: 0, L2: 0, L3: 0 };

    gab.dispositivos.forEach(d => {
        modulosOcupados += (parseInt(d.modulos, 10) || 1);
        const listaPolos = MAPAS_POLARIDAD[d.polos] || [];
        // Contabilizar circuitos terminales / cargas en fases
        if (d.tipo !== 'ID' && d.tipo !== 'DPS' && d.tipo !== 'RESERVA') {
            if (listaPolos.includes('L1')) fases.L1++;
            if (listaPolos.includes('L2')) fases.L2++;
            if (listaPolos.includes('L3')) fases.L3++;
        }
    });

    const modulosLibres = Math.max(0, gab.modulos - modulosOcupados);
    const excedido = modulosOcupados > gab.modulos;
    const porcentaje = Math.min(100, Math.round((modulosOcupados / gab.modulos) * 100));

    return { modulosOcupados, modulosLibres, excedido, porcentaje, fases };
}

function renderizarTodoTopografico() {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    const metricas = calcularMetricasGabinete(gab);

    // 1. Tabs de Gabinetes
    const tabsCont = document.getElementById('tabsGabinetesTopo');
    tabsCont.innerHTML = estadoTopo.gabinetes.map(g => {
        const m = calcularMetricasGabinete(g);
        const activo = g.id === gab.id ? 'active' : '';
        return `
            <button type="button" class="topo-gab-chip ${activo}" onclick="seleccionarGabineteActivo('${escapeHtml(g.id)}')">
                <i class="fa-solid fa-server"></i> ${escapeHtml(g.codigo)} (${m.modulosOcupados}/${g.modulos})
            </button>
        `;
    }).join('');

    // 2. Detalle del Gabinete Activo
    document.getElementById('detalleGabineteActivo').innerHTML = `
        <div style="background: var(--ngc-bg-input); border: 1px solid var(--ngc-privacy-border); border-radius: 9px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="min-width: 0;">
                <div style="font-size: 0.86rem; font-weight: 800; color: var(--ngc-text-main);">${escapeHtml(gab.codigo)} — ${escapeHtml(gab.nombre)}</div>
                <div style="font-size: 0.74rem; color: var(--ngc-text-faded); margin-top: 2px;">${gab.modulos} mód. DIN • ${escapeHtml(gab.ip)} • ${escapeHtml(gab.montaje)}</div>
            </div>
            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button type="button" class="topo-mini-btn" onclick="abrirModalGabinete('${escapeHtml(gab.id)}')" title="Editar gabinete"><i class="fa-solid fa-pen"></i></button>
                ${estadoTopo.gabinetes.length > 1 ? `<button type="button" class="topo-mini-btn danger" onclick="eliminarGabinete('${escapeHtml(gab.id)}')" title="Eliminar gabinete"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>
    `;

    // 3. Subtítulo y Barra de Ocupación DIN
    const subRiel = document.getElementById('subtituloRielActivo');
    subRiel.textContent = `${metricas.modulosOcupados} / ${gab.modulos} módulos ocupados (${metricas.modulosLibres} libres)`;
    subRiel.style.color = metricas.excedido ? 'var(--error-red)' : 'var(--ngc-text-faded)';

    document.getElementById('txtPorcentajeRiel').textContent = `${metricas.porcentaje}%`;
    const barra = document.getElementById('barraOcupacionTopo');
    barra.style.width = `${metricas.porcentaje}%`;
    barra.style.background = metricas.excedido ? 'var(--error-red)' : (metricas.porcentaje > 85 ? '#f59e0b' : 'var(--ngc-neon)');

    const btnPolos = document.getElementById('btnTogglePolos');
    btnPolos.className = `topo-mini-btn ${estadoTopo.mostrarPolos ? 'accent' : ''}`;
    btnPolos.innerHTML = `<i class="fa-solid fa-plug"></i> Polaridad IRAM: ${estadoTopo.mostrarPolos ? 'ON' : 'OFF'}`;

    const btnPeine = document.getElementById('btnTogglePeine');
    btnPeine.className = `topo-mini-btn ${gab.peineActivo ? 'accent' : ''}`;
    btnPeine.innerHTML = `<i class="fa-solid fa-grip-lines"></i> Peine DIN: ${gab.peineActivo ? 'ON' : 'OFF'}`;

    // 4. Listado Compacto de Dispositivos en Riel DIN
    const listaCont = document.getElementById('listaDispositivosTopo');
    if (!gab.dispositivos.length) {
        listaCont.innerHTML = `
            <div style="text-align: center; padding: 22px 12px; border: 1px dashed var(--ngc-privacy-border); border-radius: 10px; color: var(--ngc-text-faded); font-size: 0.82rem;">
                <i class="fa-solid fa-microchip" style="font-size: 1.5rem; margin-bottom: 6px; display: block; color: var(--ngc-neon);"></i>
                Todavía no hay dispositivos en <strong>${escapeHtml(gab.codigo)}</strong>.<br>Tocá <strong>+ Dispositivo</strong> o importá desde Unifilar / Potencia.
            </div>
        `;
    } else {
        let posActual = 1;
        listaCont.innerHTML = gab.dispositivos.map((d, index) => {
            const mods = parseInt(d.modulos, 10) || 1;
            const posFin = posActual + mods - 1;
            const rangoTxt = mods === 1 ? `M${posActual}` : `M${posActual}–M${posFin}`;
            posActual = posFin + 1;

            const polosArr = MAPAS_POLARIDAD[d.polos] || [];
            const polosHtml = polosArr.map(p => `<span class="topo-fase-pill fase-${p}">${p}</span>`).join(' ');

            return `
                <div class="topo-dev-row">
                    <div class="topo-dev-top">
                        <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="background: rgba(var(--ngc-neon-rgb), 0.16); color: var(--ngc-neon); font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 5px;">${rangoTxt} (${mods}M)</span>
                                <span style="font-weight: 900; font-size: 0.82rem; color: var(--ngc-text-main);">${escapeHtml(d.codigo)}</span>
                                <span style="font-size: 0.82rem; font-weight: 700; color: var(--ngc-text-main);">${escapeHtml(d.nombre)}</span>
                            </div>
                            <div style="font-size: 0.74rem; color: var(--ngc-text-faded); margin-top: 4px;">
                                ${escapeHtml(d.calibre || d.tipo)} ${d.bornera ? '• ' + escapeHtml(d.bornera) : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 3px; flex-shrink: 0;">${polosHtml}</div>
                    </div>
                    <div class="topo-dev-actions">
                        <button type="button" class="topo-mini-btn" onclick="moverDispositivoTopo('${escapeHtml(d.id)}', -1)" ${index === 0 ? 'disabled style="opacity:0.4;"' : ''} title="Mover izquierda"><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" class="topo-mini-btn" onclick="moverDispositivoTopo('${escapeHtml(d.id)}', 1)" ${index === gab.dispositivos.length - 1 ? 'disabled style="opacity:0.4;"' : ''} title="Mover derecha"><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" class="topo-mini-btn accent" onclick="duplicarDispositivoTopo('${escapeHtml(d.id)}')" title="Duplicar dispositivo"><i class="fa-solid fa-copy"></i> Duplicar</button>
                        <button type="button" class="topo-mini-btn" onclick="abrirModalDispositivo('${escapeHtml(d.id)}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="topo-mini-btn danger" onclick="eliminarDispositivoTopo('${escapeHtml(d.id)}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 5. Actualizar Dock Flotante y KPIs del Cajón
    document.getElementById('dockTopoResumen').textContent =
        `${gab.codigo} • ${metricas.modulosOcupados}/${gab.modulos} mód. • ${gab.dispositivos.length} disp.`;

    const dockAlerta = document.getElementById('dockTopoAlerta');
    if (metricas.excedido) {
        dockAlerta.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> +${metricas.modulosOcupados - gab.modulos} mód.`;
        dockAlerta.style.color = 'var(--error-red)';
    } else {
        dockAlerta.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${metricas.modulosLibres} libres`;
        dockAlerta.style.color = 'var(--success-green)';
    }

    document.getElementById('kpiTopoOcupados').textContent = `${metricas.modulosOcupados} / ${gab.modulos}`;
    document.getElementById('kpiTopoLibres').textContent = metricas.excedido ? `-${metricas.modulosOcupados - gab.modulos}` : `${metricas.modulosLibres}`;
    document.getElementById('kpiTopoLibres').style.color = metricas.excedido ? 'var(--error-red)' : 'var(--success-green)';
    document.getElementById('kpiTopoDispositivos').textContent = `${gab.dispositivos.length}`;

    document.getElementById('kpiFaseL1').textContent = `${metricas.fases.L1} circ.`;
    document.getElementById('kpiFaseL2').textContent = `${metricas.fases.L2} circ.`;
    document.getElementById('kpiFaseL3').textContent = `${metricas.fases.L3} circ.`;

    const boxAuditoria = document.getElementById('boxAlertaAuditoriaTopo');
    if (metricas.excedido) {
        boxAuditoria.style.background = 'rgba(239, 68, 68, 0.14)';
        boxAuditoria.style.color = '#ef4444';
        boxAuditoria.style.borderColor = 'rgba(239, 68, 68, 0.35)';
        boxAuditoria.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Capacidad excedida:</strong> Los dispositivos ocupan ${metricas.modulosOcupados} módulos en un gabinete de ${gab.modulos}. Ampliá el gabinete o quitá elementos.`;
    } else if (metricas.modulosLibres < Math.ceil(gab.modulos * 0.2)) {
        boxAuditoria.style.background = 'rgba(245, 158, 11, 0.14)';
        boxAuditoria.style.color = '#f59e0b';
        boxAuditoria.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        boxAuditoria.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <strong>Reserva AEA 90364-7-770:</strong> Te quedan ${metricas.modulosLibres} módulos libres (se recomienda al menos 20% de reserva física).`;
    } else {
        boxAuditoria.style.background = 'rgba(40, 167, 69, 0.12)';
        boxAuditoria.style.color = 'var(--success-green)';
        boxAuditoria.style.borderColor = 'rgba(40, 167, 69, 0.3)';
        boxAuditoria.innerHTML = `<i class="fa-solid fa-circle-check"></i> Gabinete conforme: ${metricas.modulosLibres} módulos disponibles (${Math.round((metricas.modulosLibres / gab.modulos) * 100)}% reserva).`;
    }

    // 6. Actualizar Lámina A4
    renderizarVistaPreviaA4();
}

// ============================================================================
// MOTOR GRÁFICO SVG PARAMÉTRICO DE TABLERO TOPOGRÁFICO
// ============================================================================
function generarSVGTopografico(gab) {
    const totalMods = Math.max(4, parseInt(gab.modulos, 10) || 12);
    const modW = totalMods <= 8 ? 44 : (totalMods <= 16 ? 34 : 26);
    const rielAncho = totalMods * modW;
    const margenX = 56;
    const svgW = Math.max(540, rielAncho + margenX * 2);
    const inicioRielX = (svgW - rielAncho) / 2;
    const svgH = 340;
    const rielY = 128;
    const devH = 96;

    const metricas = calcularMetricasGabinete(gab);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="720" height="335" style="max-width:100%; height:auto; font-family: Arial, Helvetica, sans-serif;">`;

    // Fondo y Gabinete Exterior
    svg += `<rect x="14" y="12" width="${svgW - 28}" height="${svgH - 24}" rx="12" fill="#e2e8f0" stroke="#334155" stroke-width="2.5"/>`;
    svg += `<rect x="24" y="22" width="${svgW - 48}" height="${svgH - 44}" rx="8" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>`;

    // Placa Identificatoria Superior
    const placaW = Math.min(340, svgW - 90);
    const placaX = (svgW - placaW) / 2;
    svg += `<rect x="${placaX}" y="28" width="${placaW}" height="34" rx="5" fill="#0f172a"/>`;
    svg += `<text x="${svgW / 2}" y="43" fill="#ffffff" font-size="11.5" font-weight="bold" text-anchor="middle">${escapeHtml(gab.codigo)} - ${escapeHtml(gab.nombre).slice(0, 34)}</text>`;
    svg += `<text x="${svgW / 2}" y="56" fill="#93c5fd" font-size="9" font-weight="bold" text-anchor="middle">${gab.modulos} MÓDULOS DIN • ${escapeHtml(gab.ip)} • ${escapeHtml(gab.montaje).toUpperCase()}</text>`;

    // Riel DIN Metálico 35mm
    svg += `<rect x="${inicioRielX - 10}" y="${rielY + 34}" width="${rielAncho + 20}" height="28" rx="2" fill="#cbd5e1" stroke="#475569" stroke-width="1.2"/>`;
    svg += `<line x1="${inicioRielX - 10}" y1="${rielY + 41}" x2="${inicioRielX + rielAncho + 10}" y2="${rielY + 41}" stroke="#64748b" stroke-width="1"/>`;
    svg += `<line x1="${inicioRielX - 10}" y1="${rielY + 55}" x2="${inicioRielX + rielAncho + 10}" y2="${rielY + 55}" stroke="#64748b" stroke-width="1"/>`;

    // Grilla de Slots Vacíos y Numeración de Módulos
    for (let i = 0; i < totalMods; i++) {
        const sx = inicioRielX + i * modW;
        svg += `<rect x="${sx}" y="${rielY}" width="${modW}" height="${devH}" fill="none" stroke="#cbd5e1" stroke-dasharray="3,2" stroke-width="1"/>`;
        svg += `<text x="${sx + modW / 2}" y="${rielY - 6}" fill="#64748b" font-size="8.5" font-weight="bold" text-anchor="middle">${i + 1}</text>`;
    }

    // Dibujo de Dispositivos Instalados
    let cursorX = inicioRielX;
    let cursorMod = 0;
    const centrosPeine = [];

    gab.dispositivos.forEach((d) => {
        const mods = parseInt(d.modulos, 10) || 1;
        const w = mods * modW;
        const x = cursorX;
        const y = rielY;
        const excede = (cursorMod + mods) > totalMods;

        const cuerpoFill = d.tipo === 'RESERVA' ? '#e2e8f0' : '#ffffff';
        const bordeStroke = excede ? '#dc2626' : '#1e293b';

        // Carcasa del dispositivo
        svg += `<rect x="${x + 1}" y="${y}" width="${w - 2}" height="${devH}" rx="3" fill="${cuerpoFill}" stroke="${bordeStroke}" stroke-width="1.8"/>`;

        // Franja superior de identificación
        const headerColor = d.tipo === 'ID' ? '#1d4ed8' : (d.tipo === 'DPS' ? '#b45309' : (d.tipo === 'RESERVA' ? '#64748b' : '#0f172a'));
        svg += `<rect x="${x + 1}" y="${y}" width="${w - 2}" height="18" rx="2" fill="${headerColor}"/>`;
        svg += `<text x="${x + w / 2}" y="${y + 12.5}" fill="#ffffff" font-size="9.5" font-weight="bold" text-anchor="middle">${escapeHtml(d.codigo)}</text>`;

        // Bornes superiores e inferiores + Puntas IRAM 2183
        const polosArr = MAPAS_POLARIDAD[d.polos] || [];
        if (d.tipo !== 'RESERVA') {
            const cantPolos = Math.max(1, polosArr.length || mods);
            const pasoPolo = w / cantPolos;

            for (let p = 0; p < cantPolos; p++) {
                const px = x + pasoPolo * p + pasoPolo / 2;
                // Tornillo superior e inferior
                svg += `<circle cx="${px}" cy="${y + 24}" r="3.2" fill="#94a3b8" stroke="#334155" stroke-width="1"/>`;
                svg += `<circle cx="${px}" cy="${y + devH - 8}" r="3.2" fill="#94a3b8" stroke="#334155" stroke-width="1"/>`;

                if (estadoTopo.mostrarPolos && polosArr[p]) {
                    const faseKey = polosArr[p];
                    const col = COLORES_IRAM[faseKey] || COLORES_IRAM['L1'];
                    // Cable superior corto
                    svg += `<line x1="${px}" y1="${y - 16}" x2="${px}" y2="${y}" stroke="${col.hex}" stroke-width="3.2" stroke-linecap="round"/>`;
                    svg += `<rect x="${px - 7}" y="${y - 28}" width="14" height="11" rx="2" fill="${col.hex}"/>`;
                    svg += `<text x="${px}" y="${y - 20}" fill="${col.texto}" font-size="7.5" font-weight="bold" text-anchor="middle">${col.label}</text>`;

                    // Cable inferior de salida
                    svg += `<line x1="${px}" y1="${y + devH}" x2="${px}" y2="${y + devH + 14}" stroke="${col.hex}" stroke-width="3" stroke-linecap="round"/>`;

                    if (gab.peineActivo && d.tipo !== 'DPS') {
                        centrosPeine.push({ x: px, color: col.hex });
                    }
                }
            }

            // Palanca / Actuador central
            if (d.tipo === 'PIA' || d.tipo === 'ID') {
                const palancaFill = d.tipo === 'ID' ? '#2563eb' : '#0f172a';
                svg += `<rect x="${x + 6}" y="${y + 42}" width="${w - 12}" height="12" rx="2" fill="${palancaFill}"/>`;
                if (d.tipo === 'ID') {
                    // Botón Test "T"
                    svg += `<rect x="${x + w - 15}" y="${y + 29}" width="9" height="9" rx="1.5" fill="#facc15" stroke="#854d0e" stroke-width="0.8"/>`;
                    svg += `<text x="${x + w - 10.5}" y="${y + 36}" fill="#0f172a" font-size="7" font-weight="bold" text-anchor="middle">T</text>`;
                }
            } else if (d.tipo === 'DPS') {
                svg += `<rect x="${x + 6}" y="${y + 38}" width="${w - 12}" height="20" rx="2" fill="#16a34a"/>`;
                svg += `<text x="${x + w / 2}" y="${y + 51}" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">OK</text>`;
            }

            // Calibre impreso en el frente
            svg += `<text x="${x + w / 2}" y="${y + 68}" fill="#0f172a" font-size="8.2" font-weight="bold" text-anchor="middle">${escapeHtml((d.calibre || '').split('•')[0].trim()).slice(0, 10)}</text>`;
        } else {
            svg += `<text x="${x + w / 2}" y="${y + 52}" fill="#64748b" font-size="8" font-weight="bold" text-anchor="middle">RES</text>`;
        }

        cursorX += w;
        cursorMod += mods;
    });

    // Peine de distribución superior si está activo y hay al menos 2 puntos
    if (gab.peineActivo && centrosPeine.length >= 2) {
        const x1 = centrosPeine[0].x;
        const x2 = centrosPeine[centrosPeine.length - 1].x;
        svg += `<rect x="${x1 - 4}" y="${rielY - 12}" width="${(x2 - x1) + 8}" height="6" rx="2" fill="#f59e0b" stroke="#92400e" stroke-width="1"/>`;
    }

    // Borneras Inferiores (PE y Neutro)
    if (gab.borneras !== 'Sin Bornera') {
        const bornY = 266;
        svg += `<rect x="44" y="${bornY}" width="190" height="24" rx="4" fill="#dcfce7" stroke="#16a34a" stroke-width="1.4"/>`;
        svg += `<text x="139" y="${bornY + 15}" fill="#15803d" font-size="9" font-weight="bold" text-anchor="middle">BORNERA TIERRA (PE) • IRAM 2183</text>`;

        if (gab.borneras === 'PE + Neutro') {
            svg += `<rect x="${svgW - 234}" y="${bornY}" width="190" height="24" rx="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.4"/>`;
            svg += `<text x="${svgW - 139}" y="${bornY + 15}" fill="#0369a1" font-size="9" font-weight="bold" text-anchor="middle">BORNERA NEUTRO (N) • CELESTE</text>`;
        }
    }

    // Pie resumen dentro del gabinete
    svg += `<text x="${svgW / 2}" y="${svgH - 22}" fill="#334155" font-size="9" font-weight="bold" text-anchor="middle">OCUPACIÓN: ${metricas.modulosOcupados}/${gab.modulos} MÓD. (${metricas.modulosLibres} LIBRES) • EQUILIBRIO: L1:${metricas.fases.L1} | L2:${metricas.fases.L2} | L3:${metricas.fases.L3}</text>`;

    svg += `</svg>`;
    return svg;
}

function renderizarVistaPreviaA4() {
    const gab = obtenerGabineteActivo();
    if (!gab) return;
    const metricas = calcularMetricasGabinete(gab);

    // Credenciales del profesional guardadas en Configuración
    const empNombre = localStorage.getItem('villaser_conf_empresa') || 'PLATAFORMA VILLASER';
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'Instalador Electricista Habilitado';
    const profMat = localStorage.getItem('villaser_conf_matricula') || '';
    const profTel = localStorage.getItem('villaser_conf_telefono') || '';
    const logoBase64 = localStorage.getItem('villaser_conf_logo') || '';

    document.getElementById('pdf-empresa-nombre').textContent = empNombre.toUpperCase();
    const logoImg = document.getElementById('pdf-img-logo');
    if (logoBase64 && logoBase64.startsWith('data:image')) {
        logoImg.src = logoBase64;
        logoImg.style.display = 'inline-block';
    } else {
        logoImg.removeAttribute('src');
        logoImg.style.display = 'none';
    }

    const hoy = new Date().toLocaleDateString('es-AR');
    document.getElementById('pdf-fecha').textContent = `Fecha: ${hoy}`;
    document.getElementById('pdf-cliente').textContent = estadoTopo.cliente.nombre || '-';
    document.getElementById('pdf-proyecto').textContent = estadoTopo.cliente.proyecto || '-';
    document.getElementById('pdf-direccion').textContent = estadoTopo.cliente.direccion || '-';
    document.getElementById('pdf-gabinete-info').textContent = `${gab.codigo} (${gab.modulos} mód. • ${gab.ip})`;

    document.getElementById('svgTopoRenderTarget').innerHTML = generarSVGTopografico(gab);
    document.getElementById('pdf-resumen-fases').textContent = `Equilibrio: L1: ${metricas.fases.L1} | L2: ${metricas.fases.L2} | L3: ${metricas.fases.L3}`;

    const tbody = document.getElementById('pdf-tbody-dispositivos');
    if (!gab.dispositivos.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:10px; text-align:center; border:1px solid #cbd5e1; color:#64748b;">Sin dispositivos cargados en ${escapeHtml(gab.codigo)}.</td></tr>`;
    } else {
        let pos = 1;
        tbody.innerHTML = gab.dispositivos.map(d => {
            const mods = parseInt(d.modulos, 10) || 1;
            const rango = mods === 1 ? `M${pos}` : `M${pos}-M${pos + mods - 1}`;
            pos += mods;
            return `
                <tr>
                    <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${rango}</td>
                    <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${escapeHtml(d.codigo)}</td>
                    <td style="padding:4px 6px; border:1px solid #cbd5e1;">${escapeHtml(d.nombre)}</td>
                    <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center;">${escapeHtml(d.calibre || '-')}</td>
                    <td style="padding:4px 5px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${escapeHtml(d.polos || '-')}</td>
                    <td style="padding:4px 6px; border:1px solid #cbd5e1;">${escapeHtml(d.bornera || '-')}</td>
                </tr>
            `;
        }).join('');
    }

    const obsBox = document.getElementById('pdf-bloque-obs');
    if (estadoTopo.observaciones && estadoTopo.observaciones.trim()) {
        obsBox.style.display = 'block';
        document.getElementById('pdf-obs-texto').textContent = estadoTopo.observaciones.trim();
    } else {
        obsBox.style.display = 'none';
    }

    const firmaExtra = [profMat ? `Mat.: ${profMat}` : '', profTel ? `Tel.: ${profTel}` : ''].filter(Boolean).join(' • ');
    document.getElementById('pdf-profesional-firma').textContent = profNombre;
    document.getElementById('pdf-profesional-extra').textContent = firmaExtra || 'Generado con Plataforma Villaser';
}

// ============================================================================
// CAJÓN FULLSCREEN Y VISTA PREVIA MÓVIL CON ZOOM TÁCTIL
// ============================================================================
function abrirCajonTopografico() {
    renderizarTodoTopografico();
    const gab = obtenerGabineteActivo();
    document.getElementById('cajonTopoTitulo').innerHTML = `<i class="fa-solid fa-table-cells"></i> Resumen ${escapeHtml(gab ? gab.codigo : 'Tablero')}`;
    document.getElementById('modalListaTopografico').classList.remove('oculto');
}

function cerrarCajonTopografico() {
    document.getElementById('modalListaTopografico').classList.add('oculto');
}

function abrirVistaPreviaMovil() {
    renderizarVistaPreviaA4();
    const original = document.getElementById('plantilla-pdf');
    const target = document.getElementById('mobilePreviewTarget');
    target.innerHTML = '';
    const clon = original.cloneNode(true);
    clon.id = 'plantilla-pdf-clon-movil';
    clon.style.transformOrigin = 'top left';
    target.appendChild(clon);

    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', VIEWPORT_ZOOM);

    document.getElementById('modalVistaPreviaMovil').classList.remove('oculto');
}

function cerrarVistaPreviaMovil() {
    document.getElementById('modalVistaPreviaMovil').classList.add('oculto');
    document.getElementById('mobilePreviewTarget').innerHTML = '';
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', VIEWPORT_LOCKED);
}

// ============================================================================
// EXPORTACIÓN PDF BLINDADA (SIN BLOQUEOS EN CHROME ANDROID)
// ============================================================================
function generarPDF() {
    cerrarCajonTopografico();
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
}

async function convertirSvgTopoAImagen(contenedorClonado) {
    const svgEl = contenedorClonado.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

    const img = new Image();
    img.src = dataUrl;
    if (img.decode) {
        await img.decode();
    } else {
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 670;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngImg = document.createElement('img');
    pngImg.src = canvas.toDataURL('image/png');
    pngImg.style.width = '100%';
    pngImg.style.height = 'auto';
    pngImg.style.display = 'block';

    const target = contenedorClonado.querySelector('#svgTopoRenderTarget');
    if (target) {
        target.innerHTML = '';
        target.appendChild(pngImg);
    }
}

async function ejecutarDescargaPDF() {
    const btnConfirmar = document.getElementById('btnConfirmarPDF');
    const textoOrig = btnConfirmar.innerHTML;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    let sandbox = null;
    try {
        renderizarVistaPreviaA4();
        const original = document.getElementById('plantilla-pdf');
        const clon = original.cloneNode(true);
        clon.id = 'plantilla-pdf-export';

        // Ocultar sello de agua en el PDF exportado
        const marca = clon.querySelector('#marcaAguaPDF');
        if (marca) marca.style.display = 'none';

        sandbox = document.createElement('div');
        sandbox.style.position = 'absolute';
        sandbox.style.left = '-9999px';
        sandbox.style.top = '0';
        sandbox.style.width = '794px';
        sandbox.style.background = '#ffffff';
        sandbox.appendChild(clon);
        document.body.appendChild(sandbox);

        await convertirSvgTopoAImagen(clon);

        const gab = obtenerGabineteActivo();
        const cliLimpio = (estadoTopo.cliente.nombre || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        const sufijo = Math.floor(1000 + Math.random() * 9000);
        const nombreArchivo = `Topografico_${gab ? gab.codigo : 'TS1'}_${cliLimpio}_${sufijo}.pdf`;

        const opt = {
            margin: 0,
            filename: nombreArchivo,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: {
                scale: 2,
                useCORS: false,
                windowWidth: 794,
                windowHeight: 1115,
                ignoreElements: (el) => el.id === 'marcaAguaPDF' || (el.tagName === 'IMG' && !el.getAttribute('src'))
            },
            jsPDF: { unit: 'px', format: [794, 1122], orientation: 'portrait' }
        };

        const promesaPdf = html2pdf().set(opt).from(clon).save();
        const timeoutPdf = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo agotado generando PDF')), 18000));
        await Promise.race([promesaPdf, timeoutPdf]);

        cerrarModalPDF();
        if (estadoTopo.cliente.agendado) {
            guardarBorradorFirebase(false, true);
        }
    } catch (err) {
        console.error('Error generando PDF topográfico:', err);
        mostrarAlertaCorp('Error al exportar PDF', 'No se pudo generar el archivo en este intento. Verificá que haya dispositivos cargados e intentá nuevamente.', 'error');
    } finally {
        if (sandbox && sandbox.parentNode) sandbox.parentNode.removeChild(sandbox);
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = textoOrig;
    }
}

// ============================================================================
// WHATSAPP DIRECTO
// ============================================================================
function abrirModalWhatsApp() {
    cerrarCajonTopografico();
    const gab = obtenerGabineteActivo();
    const metricas = calcularMetricasGabinete(gab);
    document.getElementById('waTelefono').value = estadoTopo.cliente.telefono || '';

    const lineasDisp = gab.dispositivos.map((d, i) => `${i + 1}. [${d.codigo}] ${d.nombre} (${d.calibre || d.tipo} • ${d.polos})`).join('\n');
    const msg = `*PLANO TOPOGRÁFICO DE TABLERO - VILLASER*\n` +
        `👤 *Cliente:* ${estadoTopo.cliente.nombre}\n` +
        `📍 *Obra:* ${estadoTopo.cliente.direccion}\n` +
        `⚡ *Gabinete:* ${gab.codigo} - ${gab.nombre} (${gab.modulos} mód. DIN)\n` +
        `📊 *Ocupación:* ${metricas.modulosOcupados}/${gab.modulos} mód. (${metricas.modulosLibres} libres)\n` +
        `⚖️ *Equilibrio Fases:* L1: ${metricas.fases.L1} | L2: ${metricas.fases.L2} | L3: ${metricas.fases.L3}\n\n` +
        `*Dispositivos:*\n${lineasDisp || 'Sin dispositivos cargados'}`;

    document.getElementById('waMensaje').value = msg;
    document.getElementById('modalWhatsApp').classList.remove('oculto');
}

function cerrarModalWhatsApp() {
    document.getElementById('modalWhatsApp').classList.add('oculto');
}

function enviarWhatsAppDirecto() {
    const tel = document.getElementById('waTelefono').value.replace(/\D/g, '');
    const texto = encodeURIComponent(document.getElementById('waMensaje').value);
    const url = tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    cerrarModalWhatsApp();
    window.open(url, '_blank');
}

// ============================================================================
// IMPORTACIÓN DESDE UNIFILAR Y POTENCIA
// ============================================================================
async function abrirModalImportarFuente(tipo) {
    const modal = document.getElementById('modalImportarFuente');
    const lista = document.getElementById('listaFuentesImportables');
    document.getElementById('tituloModalImportar').innerHTML = tipo === 'unifilar'
        ? '<i class="fa-solid fa-diagram-project"></i> Importar desde Unifilar'
        : '<i class="fa-solid fa-bolt"></i> Importar desde Potencia';

    lista.innerHTML = '<div style="text-align:center; padding:18px; color:var(--ngc-text-faded);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando proyectos...</div>';
    modal.classList.remove('oculto');

    const uid = obtenerUid();
    const coleccion = tipo === 'unifilar' ? 'borradores_unifilar' : 'borradores_potencia';

    // Incluir también borrador local activo de ese módulo si existe
    const items = [];
    const localKey = tipo === 'unifilar' ? 'unifilar_estado_actual' : 'potencia_estado_actual';
    const localRaw = localStorage.getItem(localKey);
    if (localRaw) {
        try {
            const loc = JSON.parse(localRaw);
            if (loc && loc.cliente && loc.cliente.nombre) {
                items.push({ id: 'LOCAL', titulo: `[Local en curso] ${loc.cliente.nombre} - ${loc.cliente.proyecto || ''}`, data: loc });
            }
        } catch (e) {}
    }

    if (uid && navigator.onLine) {
        try {
            const snap = await db.collection('usuarios').doc(uid).collection(coleccion).orderBy('fechaActualizacion', 'desc').limit(20).get();
            snap.docs.forEach(d => {
                const data = d.data();
                const nomCli = data.cliente ? data.cliente.nombre : (data.cliNombre || 'Sin nombre');
                const proy = data.cliente ? data.cliente.proyecto : (data.cliProyecto || '');
                items.push({ id: d.id, titulo: `${nomCli} — ${proy}`, data });
            });
        } catch (e) {
            console.warn('Error leyendo colección para importar:', e);
        }
    }

    if (!items.length) {
        lista.innerHTML = '<div style="text-align:center; padding:16px; color:var(--ngc-text-faded);">No se encontraron borradores disponibles.</div>';
        return;
    }

    window._fuentesImportablesCache = items;
    lista.innerHTML = items.map((it, idx) => `
        <div class="modal-list-item" style="cursor:pointer;" onclick="ejecutarImportacionFuente('${tipo}', ${idx})">
            <div style="font-weight:800; color:var(--ngc-text-main);">${escapeHtml(it.titulo)}</div>
            <div style="font-size:0.75rem; color:var(--ngc-neon); margin-top:3px;"><i class="fa-solid fa-file-import"></i> Tocar para volcar al tablero activo</div>
        </div>
    `).join('');
}

function cerrarModalImportarFuente() {
    document.getElementById('modalImportarFuente').classList.add('oculto');
}

function ejecutarImportacionFuente(tipo, idx) {
    const item = (window._fuentesImportablesCache || [])[idx];
    const gab = obtenerGabineteActivo();
    if (!item || !gab) return;

    const data = item.data;
    const fasesCiclo = ['L1+N', 'L2+N', 'L3+N'];
    let faseIdx = 0;

    if (tipo === 'unifilar') {
        const circuitos = data.circuitos || [];
        if (!circuitos.length) {
            mostrarAlertaCorp('Sin circuitos', 'El borrador de Unifilar seleccionado no tiene circuitos cargados.', 'error');
            return;
        }
        // Agregar cabecera ID si existe en nivel2
        const ts = (data.tablerosSeccionales && data.tablerosSeccionales[0]) || null;
        if (ts) {
            gab.dispositivos.push({
                id: 'dev_' + Date.now() + '_id',
                codigo: 'ID1',
                nombre: `Interruptor Diferencial ${ts.in || '40A'}`,
                modulos: ts.polos === '4x' ? 4 : 2,
                polos: ts.polos === '4x' ? 'L1-L2-L3-N' : 'L1+N',
                calibre: `${ts.in || '40A'} • 30mA`,
                tipo: 'ID',
                bornera: 'Cabecera TS'
            });
        }
        circuitos.forEach((c, i) => {
            const pol = c.polos === '4x' ? 'L1-L2-L3-N' : fasesCiclo[faseIdx++ % 3];
            gab.dispositivos.push({
                id: 'dev_' + Date.now() + '_' + i,
                codigo: c.codigo || `C${i + 1}`,
                nombre: `PIA ${c.curva || 'C'}${c.in || '16'} - ${c.destino || 'Circuito'}`,
                modulos: c.polos === '4x' ? 4 : 2,
                polos: pol,
                calibre: `${c.curva || 'C'}${c.in || '16'}A • ${c.pcc || '4.5kA'}`,
                tipo: 'PIA',
                bornera: `${c.seccionFase || '2.5mm²'} + PE`
            });
        });
    } else {
        const circuitos = data.circuitos || [];
        if (!circuitos.length) {
            mostrarAlertaCorp('Sin circuitos', 'El borrador de Potencia seleccionado no tiene circuitos.', 'error');
            return;
        }
        circuitos.forEach((c, i) => {
            const esTrif = String(c.tension || '').includes('380');
            const pol = esTrif ? 'L1-L2-L3-N' : fasesCiclo[faseIdx++ % 3];
            gab.dispositivos.push({
                id: 'dev_' + Date.now() + '_' + i,
                codigo: c.id || c.codigo || `C${i + 1}`,
                nombre: `PIA ${c.proteccion || 'C16'} - ${c.tipo || c.descripcion || 'Circuito'}`,
                modulos: esTrif ? 4 : 2,
                polos: pol,
                calibre: `${c.proteccion || 'C16A'} • 4.5kA`,
                tipo: 'PIA',
                bornera: `${c.seccion || '2.5mm²'} + PE`
            });
        });
    }

    cerrarModalImportarFuente();
    guardarEstadoLocalTopo();
    programarAutoNube();
    renderizarTodoTopografico();
    mostrarAlertaCorp('Importación Exitosa', `Se agregaron los dispositivos al gabinete ${gab.codigo}.`, 'success');
}

// ============================================================================
// FIREBASE FIRESTORE (GUARDAR Y ABRIR BORRADORES)
// ============================================================================
async function guardarBorradorFirebase(mostrarFeedback = true, silencioso = false) {
    const uid = obtenerUid();
    if (!uid) {
        if (!silencioso) mostrarAlertaCorp('Sin sesión', 'Iniciá sesión para guardar en la nube.', 'error');
        return;
    }
    if (!navigator.onLine) {
        actualizarBadgeNube('error');
        if (!silencioso) mostrarAlertaCorp('Sin conexión', 'Los cambios quedaron guardados localmente en tu dispositivo.', 'info');
        return;
    }

    actualizarBadgeNube('saving');
    try {
        const colRef = db.collection('usuarios').doc(uid).collection('borradores_topografico');
        const docId = estadoTopo.borradorId || `topo_${Date.now()}`;
        const payload = {
            ...estadoTopo,
            borradorId: docId,
            tituloResumen: `${estadoTopo.cliente.nombre || 'Cliente'} - ${estadoTopo.cliente.proyecto || 'Tablero'}`,
            fechaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        const promesaSave = colRef.doc(docId).set(payload, { merge: true });
        const timeoutSave = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout Firestore')), 10000));
        await Promise.race([promesaSave, timeoutSave]);

        estadoTopo.borradorId = docId;
        guardarEstadoLocalTopo();
        actualizarBadgeNube('synced');

        if (mostrarFeedback && !silencioso) {
            mostrarAlertaCorp('Guardado en la Nube', 'El plano topográfico quedó respaldado en Firebase.', 'success');
        }
    } catch (e) {
        console.warn('Error guardando borrador topográfico:', e);
        actualizarBadgeNube('error');
        if (!silencioso) {
            mostrarAlertaCorp('Error de sincronización', 'No se pudo guardar en la nube ahora, pero tus datos siguen seguros en memoria local.', 'error');
        }
    }
}

async function abrirModalBorradores() {
    cerrarCajonTopografico();
    const modal = document.getElementById('modalBorradores');
    const cont = document.getElementById('listaBorradoresContainer');
    document.getElementById('filtroBorradoresInput').value = '';
    cont.innerHTML = '<div style="text-align:center; padding:18px; color:var(--ngc-text-faded);"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando borradores...</div>';
    modal.classList.remove('oculto');

    const uid = obtenerUid();
    if (!uid) {
        cont.innerHTML = '<div style="text-align:center; padding:16px; color:var(--error-red);">Iniciá sesión para ver tus borradores.</div>';
        return;
    }
    try {
        const snap = await db.collection('usuarios').doc(uid).collection('borradores_topografico')
            .orderBy('fechaActualizacion', 'desc').limit(30).get();
        borradoresCacheTopo = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarListaBorradores(borradoresCacheTopo);
    } catch (e) {
        cont.innerHTML = '<div style="text-align:center; padding:16px; color:var(--error-red);">Error al consultar la nube.</div>';
    }
}

function filtrarListaBorradores() {
    const q = document.getElementById('filtroBorradoresInput').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const filtrados = borradoresCacheTopo.filter(b => {
        const nom = (b.cliente?.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const proy = (b.cliente?.proyecto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return nom.includes(q) || proy.includes(q);
    });
    renderizarListaBorradores(filtrados);
}

function renderizarListaBorradores(lista) {
    const cont = document.getElementById('listaBorradoresContainer');
    if (!lista.length) {
        cont.innerHTML = '<div style="text-align:center; padding:16px; color:var(--ngc-text-faded);">No hay borradores guardados.</div>';
        return;
    }
    cont.innerHTML = lista.map(b => {
        const cli = b.cliente?.nombre || 'Sin cliente';
        const proy = b.cliente?.proyecto || 'Sin proyecto';
        const cantGab = Array.isArray(b.gabinetes) ? b.gabinetes.length : 1;
        return `
            <div class="modal-list-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="min-width:0; flex:1; cursor:pointer;" onclick="cargarBorradorTopo('${escapeHtml(b.id)}')">
                    <div style="font-weight:800; color:var(--ngc-text-main);">${escapeHtml(cli)}</div>
                    <div style="font-size:0.76rem; color:var(--ngc-text-faded);">${escapeHtml(proy)} • ${cantGab} gabinete(s)</div>
                </div>
                <button type="button" class="topo-mini-btn accent" onclick="cargarBorradorTopo('${escapeHtml(b.id)}')">Abrir</button>
            </div>
        `;
    }).join('');
}

function cargarBorradorTopo(id) {
    const b = borradoresCacheTopo.find(item => item.id === id);
    if (!b) return;
    aplicarDatosBorradorTopo(id, b);
    cerrarModalBorradores();
    entrarAPantallaTrabajo();
}

function aplicarDatosBorradorTopo(id, data) {
    estadoTopo = {
        cliente: data.cliente || { nombre: '', direccion: '', proyecto: '', telefono: '', agendado: true, contactoId: '' },
        gabinetes: Array.isArray(data.gabinetes) && data.gabinetes.length ? data.gabinetes : [{
            id: 'gab_1', codigo: 'TS1', nombre: 'Tablero Seccional Principal',
            modulos: 12, ip: 'IP41 • PVC Autoextinguible', montaje: 'Embutir',
            borneras: 'PE + Neutro', peineActivo: true, dispositivos: []
        }],
        gabineteActivoId: data.gabineteActivoId || (data.gabinetes && data.gabinetes[0]?.id) || 'gab_1',
        mostrarPolos: data.mostrarPolos !== undefined ? data.mostrarPolos : true,
        observaciones: data.observaciones || '',
        borradorId: id
    };
    poblarCamposClienteDesdeEstado();
    guardarEstadoLocalTopo();
}

function cerrarModalBorradores() {
    document.getElementById('modalBorradores').classList.add('oculto');
}

// ============================================================================
// REINICIAR TABLERO
// ============================================================================
function confirmarNuevoTopografico() {
    document.getElementById('modalConfirmarNuevo').classList.remove('oculto');
}

function cerrarModalConfirmarNuevo() {
    document.getElementById('modalConfirmarNuevo').classList.add('oculto');
}

function ejecutarNuevoTopografico() {
    cerrarModalConfirmarNuevo();
    cerrarCajonTopografico();
    localStorage.removeItem(STORAGE_KEY_TOPO);
    estadoTopo = {
        cliente: { nombre: '', direccion: '', proyecto: '', telefono: '', agendado: false, contactoId: '' },
        gabinetes: [{
            id: 'gab_1', codigo: 'TS1', nombre: 'Tablero Seccional Principal',
            modulos: 12, ip: 'IP41 • PVC Autoextinguible', montaje: 'Embutir',
            borneras: 'PE + Neutro', peineActivo: true, dispositivos: []
        }],
        gabineteActivoId: 'gab_1',
        mostrarPolos: true,
        observaciones: '',
        borradorId: null
    };
    poblarCamposClienteDesdeEstado();
    volverAEditarCliente();
}

// ============================================================================
// MENÚ INFERIOR SCROLL (13 MÓDULOS GLOBALES)
// ============================================================================
function generarMenuInferior() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;

    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topografico', icon: 'fa-table-cells', url: '#', active: true },
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
