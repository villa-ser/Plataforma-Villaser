// ==========================================================================
// MÓDULO ESQUEMA TOPOGRÁFICO ELÉCTRICO (DISPOSICIÓN FÍSICA DIN) - VILLASER
// ==========================================================================
let db = null;
let uidSeguro = null;
let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let borradorPendienteEliminar = null;
let telefonoClienteActual = "";

const STORAGE_KEY_TOPO = 'topografico_estado_actual';

// Catálogo de precarga normativa por tipo de dispositivo DIN
const PRESETS_DISPOSITIVOS = {
    ID:   { modulos: 2, tag: 'ID1',  calibre: '2x40A • 30mA Clase AC', color: 'azul',    destino: 'Protección Diferencial General', cable: '2x6 + PE mm² Cu' },
    PIA:  { modulos: 2, tag: 'C1',   calibre: '2x16A Curva C 4.5kA',   color: 'azul',    destino: 'TUG - Tomas de Uso General',     cable: '2x2.5 + PE mm² Cu' },
    DPS:  { modulos: 2, tag: 'DPS1', calibre: 'Clase II • 20kA / 275V',color: 'naranja', destino: 'Protección Sobretensiones',       cable: '2x6 + PE(10) mm²' },
    PT:   { modulos: 2, tag: 'PT1',  calibre: '2x40A • 175V-245V',     color: 'naranja', destino: 'Protector Alta/Baja Tensión',     cable: '2x6 mm² Cu' },
    SEC:  { modulos: 2, tag: 'IG',   calibre: '2x40A Corte General',   color: 'rojo',    destino: 'Interruptor Cabecera Tablero',    cable: '2x6 + PE mm² Cu' },
    CONT: { modulos: 2, tag: 'KM1',  calibre: '25A AC-1 Bobina 220V',  color: 'negro',   destino: 'Comando / Automatismo',           cable: '2x2.5 + PE mm² Cu' },
    MED:  { modulos: 1, tag: 'PL1',  calibre: '220VCA LED Verde',      color: 'gris',    destino: 'Señalización Presencia Tensión',  cable: '1x1.5 mm² Cu' },
    BORN: { modulos: 2, tag: 'BR1',  calibre: 'Tetra/Bipolar 80A',     color: 'gris',    destino: 'Repartidor Modular',              cable: '2x6 mm² Cu' },
    RES:  { modulos: 1, tag: 'RES',  calibre: 'Tapa Ciega DIN 18mm',   color: 'gris',    destino: 'Reserva Térmica AEA 90364',       cable: '-' }
};

// Estado principal del gabinete topográfico
let estadoGabinete = {
    nombre: 'TS1',
    ip: 'IP41 • PVC Autoextinguible',
    montaje: 'De Embutir',
    filasCount: 1,
    modulosPorFila: 12,
    borneras: 'PE',
    filas: [
        [
            { tipo: 'ID',  modulos: 2, tag: 'ID1', calibre: '2x40A • 30mA AC', color: 'azul', destino: 'Cabecera Diferencial TS1', cable: '2x6 + PE mm²' },
            { tipo: 'PIA', modulos: 2, tag: 'C1',  calibre: '2x10A Curva C',   color: 'azul', destino: 'IUG - Iluminación General', cable: '2x1.5 + PE mm²' },
            { tipo: 'PIA', modulos: 2, tag: 'C2',  calibre: '2x16A Curva C',   color: 'azul', destino: 'TUG - Tomas Uso General',   cable: '2x2.5 + PE mm²' },
            { tipo: 'PIA', modulos: 2, tag: 'C3',  calibre: '2x20A Curva C',   color: 'azul', destino: 'ACU - Aire Acondicionado',  cable: '2x4 + PE mm²' }
        ]
    ]
};

// ==========================================================================
// INICIALIZACIÓN Y SESIÓN FIREBASE
// ==========================================================================
function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        uidSeguro = firebase.auth().currentUser.uid;
        return uidSeguro;
    }
    return null;
}
function obtenerUidSeguro() { return obtenerUid(); }

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            firebase.auth().onAuthStateChanged(user => {
                if (user) {
                    uidSeguro = user.uid;
                    actualizarBadgeNube();
                }
            });
        }
    } catch (e) {
        console.warn('Aviso Firebase Topográfico:', e);
    }

    generarMenuInferiorLocal();
    cargarEstadoInicial();
});

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
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '#', active: true },
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
// MEMORIA GLOBAL DE CLIENTE Y FLUJO DE PASOS
// ==========================================================================
function cargarEstadoInicial() {
    const rawTopo = localStorage.getItem(STORAGE_KEY_TOPO);
    if (rawTopo) {
        try {
            const data = JSON.parse(rawTopo);
            if (data && data.estadoGabinete) {
                document.getElementById('cliNombre').value = data.cliNombre || '';
                document.getElementById('cliDireccion').value = data.cliDireccion || '';
                document.getElementById('cliProyecto').value = data.cliProyecto || '';
                document.getElementById('obsGenerales').value = data.obsGenerales || '';
                estadoGabinete = normalizarEstadoGabinete(data.estadoGabinete);
                clienteDesdeAgenda = !!data.clienteDesdeAgenda;
                permiteGuardarNube = data.permiteGuardarNube !== false;
                nombreBorradorActual = data.nombreBorrador || null;
                telefonoClienteActual = data.telefonoClienteActual || '';

                if (data.enTrabajo && data.cliNombre) {
                    avanzarPasoTrabajo(false);
                    return;
                }
            }
        } catch (e) { console.warn('Error leyendo estado topográfico:', e); }
    }

    // Absorbe cliente activo de la PWA si no había sesión propia
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

function guardarClienteGlobal() {
    const payload = {
        nombre: document.getElementById('cliNombre').value.trim(),
        direccion: document.getElementById('cliDireccion').value.trim(),
        proyecto: document.getElementById('cliProyecto').value.trim(),
        telefono: telefonoClienteActual || ''
    };
    if (payload.nombre) {
        localStorage.setItem('villaser_cliente_global', JSON.stringify(payload));
    }
}

function guardarEstadoLocal(enTrabajo = true) {
    const payload = {
        cliNombre: document.getElementById('cliNombre').value.trim(),
        cliDireccion: document.getElementById('cliDireccion').value.trim(),
        cliProyecto: document.getElementById('cliProyecto').value.trim(),
        obsGenerales: document.getElementById('obsGenerales').value,
        estadoGabinete,
        clienteDesdeAgenda,
        permiteGuardarNube,
        nombreBorrador: nombreBorradorActual,
        telefonoClienteActual,
        enTrabajo
    };
    localStorage.setItem(STORAGE_KEY_TOPO, JSON.stringify(payload));
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
}

function seleccionarContacto(nombre, dir, tel = '') {
    document.getElementById('cliNombre').value = nombre || '';
    document.getElementById('cliDireccion').value = dir || '';
    telefonoClienteActual = tel || '';
    clienteDesdeAgenda = true;
    permiteGuardarNube = true;
    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    guardarClienteGlobal();
    mostrarToast('Cliente Seleccionado', `${nombre} vinculado desde Agenda.`);
}

function iniciarTopografico() {
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
    renderizarTodoTopografico();
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
    document.getElementById('ui-proyecto-detalle').innerText = [dir, proy].filter(Boolean).join(' • ') || 'Obra eléctrica';
}

function actualizarBadgeNube() {
    const badge = document.getElementById('ui-cloud-badge');
    if (!badge) return;
    if (!permiteGuardarNube) {
        badge.className = 'pres-cloud-pill local';
        badge.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Modo Local';
    } else {
        badge.className = 'pres-cloud-pill ready';
        badge.innerHTML = '<i class="fa-solid fa-cloud"></i> Nube Lista';
    }
}

// ==========================================================================
// GESTIÓN DE GABINETE, PLANTILLAS E IMPORTACIÓN DE UNIFILAR / POTENCIA
// ==========================================================================
function abrirModalGabinete() {
    document.getElementById('gabNombre').value = estadoGabinete.nombre || 'TS1';
    document.getElementById('gabIP').value = estadoGabinete.ip || 'IP41 • PVC Autoextinguible';
    document.getElementById('gabMontaje').value = estadoGabinete.montaje || 'De Embutir';
    document.getElementById('gabFilas').value = String(estadoGabinete.filasCount || 1);
    document.getElementById('gabModulosPorFila').value = String(estadoGabinete.modulosPorFila || 12);
    document.getElementById('gabBorneras').value = estadoGabinete.borneras || 'PE';
    document.getElementById('modalGabinete').classList.remove('oculto');
}

function cerrarModalGabinete() {
    document.getElementById('modalGabinete').classList.add('oculto');
}

function guardarConfigGabinete() {
    const nuevasFilas = parseInt(document.getElementById('gabFilas').value, 10) || 1;
    const nuevosModulos = parseInt(document.getElementById('gabModulosPorFila').value, 10) || 12;

    estadoGabinete.nombre = document.getElementById('gabNombre').value.trim() || 'TS1';
    estadoGabinete.ip = document.getElementById('gabIP').value;
    estadoGabinete.montaje = document.getElementById('gabMontaje').value;
    estadoGabinete.filasCount = nuevasFilas;
    estadoGabinete.modulosPorFila = nuevosModulos;
    estadoGabinete.borneras = document.getElementById('gabBorneras').value;

    while (estadoGabinete.filas.length < nuevasFilas) {
        estadoGabinete.filas.push([]);
    }
    if (estadoGabinete.filas.length > nuevasFilas) {
        const excedentes = estadoGabinete.filas.slice(nuevasFilas).flat();
        estadoGabinete.filas = estadoGabinete.filas.slice(0, nuevasFilas);
        if (excedentes.length > 0) {
            estadoGabinete.filas[nuevasFilas - 1].push(...excedentes);
        }
    }

    cerrarModalGabinete();
    guardarEstadoLocal(true);
    renderizarTodoTopografico();
    mostrarToast('Gabinete Actualizado', `${estadoGabinete.nombre} (${nuevasFilas}×${nuevosModulos}M)`);
}

function aplicarPlantillaTopografico(tipo) {
    if (tipo === 'mono_12') {
        estadoGabinete = {
            nombre: 'TS1',
            ip: 'IP41 • PVC Autoextinguible',
            montaje: 'De Embutir',
            filasCount: 1,
            modulosPorFila: 12,
            borneras: 'PE',
            filas: [[
                { tipo: 'ID',  modulos: 2, tag: 'ID1', calibre: '2x40A • 30mA AC', color: 'azul', destino: 'Cabecera Diferencial TS1', cable: '2x6 + PE mm²' },
                { tipo: 'PIA', modulos: 2, tag: 'C1',  calibre: '2x10A Curva C',   color: 'azul', destino: 'IUG - Iluminación',       cable: '2x1.5 + PE mm²' },
                { tipo: 'PIA', modulos: 2, tag: 'C2',  calibre: '2x16A Curva C',   color: 'azul', destino: 'TUG - Tomas Generales',   cable: '2x2.5 + PE mm²' },
                { tipo: 'PIA', modulos: 2, tag: 'C3',  calibre: '2x20A Curva C',   color: 'azul', destino: 'ACU - Aire Acondicionado',cable: '2x4 + PE mm²' }
            ]]
        };
    } else if (tipo === 'bifila_24') {
        estadoGabinete = {
            nombre: 'TSG',
            ip: 'IP41 • PVC Autoextinguible',
            montaje: 'De Embutir',
            filasCount: 2,
            modulosPorFila: 12,
            borneras: 'PE_N',
            filas: [
                [
                    { tipo: 'SEC', modulos: 2, tag: 'IG',   calibre: '2x40A Corte General',    color: 'rojo',    destino: 'Seccionador Cabecera',   cable: '2x10 + PE mm²' },
                    { tipo: 'DPS', modulos: 2, tag: 'DPS1', calibre: 'Clase II • 20kA 275V',   color: 'naranja', destino: 'Descargador Sobretensión', cable: '2x6 + PE(10) mm²' },
                    { tipo: 'PT',  modulos: 2, tag: 'PT1',  calibre: '2x40A • 175V-245V',      color: 'naranja', destino: 'Protector Tensión',       cable: '2x10 mm²' },
                    { tipo: 'ID',  modulos: 2, tag: 'ID1',  calibre: '2x40A • 30mA Clase A',   color: 'azul',    destino: 'Diferencial Grupo 1',     cable: '2x6 + PE mm²' }
                ],
                [
                    { tipo: 'PIA', modulos: 2, tag: 'C1', calibre: '2x10A Curva C', color: 'azul',  destino: 'IUG - Iluminación PB/PA', cable: '2x1.5 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C2', calibre: '2x16A Curva C', color: 'azul',  destino: 'TUG - Tomas Cocina',      cable: '2x2.5 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C3', calibre: '2x16A Curva C', color: 'azul',  destino: 'TUG - Tomas Dormitorios', cable: '2x2.5 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C4', calibre: '2x20A Curva C', color: 'negro', destino: 'TUE - Horno / Microondas',cable: '2x4 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C5', calibre: '2x20A Curva C', color: 'negro', destino: 'ACU - Climatización',     cable: '2x4 + PE mm²' }
                ]
            ]
        };
    } else if (tipo === 'trifa_36') {
        estadoGabinete = {
            nombre: 'TS-TRI',
            ip: 'IP54 • Estanco',
            montaje: 'De Superficie',
            filasCount: 3,
            modulosPorFila: 12,
            borneras: 'PE_N',
            filas: [
                [
                    { tipo: 'SEC', modulos: 4, tag: 'IG',   calibre: '4x40A Tetrapolar',       color: 'rojo',    destino: 'Corte General Trifásico', cable: '4x10 + PE mm²' },
                    { tipo: 'DPS', modulos: 4, tag: 'DPS1', calibre: '3P+N Clase II 20kA',     color: 'naranja', destino: 'Protección Transitorios', cable: '4x6 + PE(10) mm²' }
                ],
                [
                    { tipo: 'ID',  modulos: 4, tag: 'ID-T', calibre: '4x40A • 30mA Trifásico', color: 'azul',    destino: 'Diferencial Trifásico',   cable: '4x6 + PE mm²' },
                    { tipo: 'PIA', modulos: 4, tag: 'C1',   calibre: '4x25A Curva C 6kA',      color: 'negro',   destino: 'Fuerza Motriz / Bomba',   cable: '4x4 + PE mm²' }
                ],
                [
                    { tipo: 'ID',  modulos: 2, tag: 'ID-M', calibre: '2x25A • 30mA Monofásico',color: 'azul',    destino: 'Diferencial Servicios',   cable: '2x4 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C2',   calibre: '2x10A Curva C',          color: 'azul',    destino: 'IUG - Iluminación Tablero',cable: '2x1.5 + PE mm²' },
                    { tipo: 'PIA', modulos: 2, tag: 'C3',   calibre: '2x16A Curva C',          color: 'azul',    destino: 'TUG - Tomas Servicio',    cable: '2x2.5 + PE mm²' }
                ]
            ]
        };
    } else {
        estadoGabinete.filas = Array.from({ length: estadoGabinete.filasCount }, () => []);
    }

    guardarEstadoLocal(true);
    renderizarTodoTopografico();
    mostrarToast('Plantilla Aplicada', 'Disposición física cargada en el tablero.');
}

function abrirModalImportarModulo(origen) {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp('Sin Conexión', 'Necesitás sesión activa en la nube para importar proyectos.');
        return;
    }

    const modal = document.getElementById('modalImportarModulo');
    const lista = document.getElementById('listaImportarModulo');
    const titulo = document.getElementById('tituloModalImportar');
    const sub = document.getElementById('subtituloModalImportar');

    const coleccion = origen === 'unifilar' ? 'borradores_unifilar' : 'borradores_potencia';
    titulo.innerHTML = origen === 'unifilar'
        ? '<i class="fa-solid fa-diagram-project corp-accent-color"></i> Importar de Unifilar'
        : '<i class="fa-solid fa-bolt" style="color:var(--ngc-warning);"></i> Importar de Potencia';
    sub.innerText = `Seleccioná un borrador guardado en ${origen.toUpperCase()} para generar el layout físico:`;

    lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando proyectos...</p>';
    modal.classList.remove('oculto');

    db.collection('perfiles').doc(uid).collection(coleccion).get()
        .then(snap => {
            if (snap.empty) {
                lista.innerHTML = `<p style="text-align:center; color:var(--ngc-text-faded);">No hay borradores guardados en ${origen}.</p>`;
                return;
            }
            lista.innerHTML = '';
            snap.forEach(doc => {
                const d = doc.data();
                const div = document.createElement('div');
                div.className = 'modal-list-item';
                div.innerHTML = `
                    <div>
                        <h4>${d.nombreBorrador || doc.id}</h4>
                        <small>${d.cliNombre || 'Sin cliente'} • ${d.cliProyecto || ''}</small>
                    </div>
                    <button type="button" class="corp-btn-small primary-action">Importar</button>
                `;
                div.querySelector('button').onclick = () => {
                    procesarImportacionDesdeModulo(origen, d);
                    cerrarModalImportarModulo();
                };
                lista.appendChild(div);
            });
        })
        .catch(() => {
            lista.innerHTML = '<p style="color:var(--error-red); text-align:center;">Error al consultar la nube.</p>';
        });
}

function cerrarModalImportarModulo() {
    document.getElementById('modalImportarModulo').classList.add('oculto');
}

function procesarImportacionDesdeModulo(origen, data) {
    const dispositivos = [];

    if (origen === 'unifilar') {
        const esTrifa = data.nivel0 && data.nivel0.sistema && data.nivel0.sistema.toLowerCase().includes('trif');
        const polosCab = esTrifa ? 4 : 2;
        if (data.nivel1 && data.nivel1.dps) {
            dispositivos.push({ tipo: 'DPS', modulos: polosCab, tag: 'DPS', calibre: 'Clase II • 20kA', color: 'naranja', destino: 'Protección Sobretensiones', cable: 'PE 10 mm²' });
        }
        if (data.nivel2) {
            dispositivos.push({
                tipo: 'ID',
                modulos: polosCab,
                tag: 'ID1',
                calibre: `${polosCab}x${data.nivel2.idCalibre || '40'}A • ${data.nivel2.idSens || '30mA'}`,
                color: 'azul',
                destino: `Cabecera ${data.nivel2.nombre || 'TS1'}`,
                cable: data.nivel1?.lsCable || '2x6 + PE mm²'
            });
        }
        const circs = Array.isArray(data.circuitos) ? data.circuitos : [];
        circs.forEach((c, idx) => {
            const p = parseInt(c.polos, 10) || (esTrifa ? 4 : 2);
            dispositivos.push({
                tipo: 'PIA',
                modulos: Math.min(4, Math.max(1, p)),
                tag: c.codigo || `C${idx + 1}`,
                calibre: `${p}x${c.calibre || 16}A Curva ${c.curva || 'C'}`,
                color: 'azul',
                destino: `${c.tipo || 'CIR'} - ${c.destino || 'Circuito terminal'}`,
                cable: c.cable || '2x2.5 + PE mm²'
            });
        });
        estadoGabinete.nombre = (data.nivel2 && data.nivel2.nombre) ? data.nivel2.nombre : 'TS1';
    } else {
        // Importación desde Módulo Potencia
        dispositivos.push({ tipo: 'ID', modulos: 2, tag: 'ID1', calibre: '2x40A • 30mA AC', color: 'azul', destino: 'Cabecera Diferencial', cable: '2x6 + PE mm²' });
        const circs = Array.isArray(data.circuitos) ? data.circuitos : [];
        circs.forEach((c, idx) => {
            dispositivos.push({
                tipo: 'PIA',
                modulos: 2,
                tag: c.id || `C${idx + 1}`,
                calibre: `2x${c.pia || 16}A Curva C`,
                color: 'azul',
                destino: `${c.tipo || 'CIR'} - ${c.descripcion || 'Circuito'}`,
                cable: c.cable || '2x2.5 + PE mm²'
            });
        });
    }

    if (dispositivos.length === 0) {
        mostrarAlertaCorp('Sin Circuitos', 'El borrador seleccionado no contenía circuitos configurados.');
        return;
    }

    // Distribuye automáticamente en filas de 12 módulos respetando reserva térmica
    const modPorFila = 12;
    const filas = [[]];
    let modActuales = 0;
    dispositivos.forEach(dev => {
        if (modActuales + dev.modulos > modPorFila) {
            filas.push([]);
            modActuales = 0;
        }
        filas[filas.length - 1].push(dev);
        modActuales += dev.modulos;
    });

    estadoGabinete.filasCount = Math.min(4, filas.length);
    estadoGabinete.modulosPorFila = modPorFila;
    estadoGabinete.filas = filas.slice(0, 4);
    if (filas.length > 4) {
        estadoGabinete.filas[3].push(...filas.slice(4).flat());
    }

    guardarEstadoLocal(true);
    renderizarTodoTopografico();
    mostrarToast('Importado con Éxito', `${dispositivos.length} dispositivos ubicados en riel DIN.`);
                                     }

// ==========================================================================
// CRUD DE DISPOSITIVOS EN FILAS DIN
// ==========================================================================
function abrirModalDispositivo(filaIdx, editIdx = -1) {
    document.getElementById('devFilaIndex').value = filaIdx;
    document.getElementById('devEditIndex').value = editIdx;

    if (editIdx >= 0 && estadoGabinete.filas[filaIdx] && estadoGabinete.filas[filaIdx][editIdx]) {
        const d = estadoGabinete.filas[filaIdx][editIdx];
        document.getElementById('tituloModalDispositivo').innerHTML = '<i class="fa-solid fa-pen corp-accent-color"></i> Editar Dispositivo DIN';
        document.getElementById('devTipo').value = d.tipo || 'PIA';
        document.getElementById('devModulos').value = String(d.modulos || 2);
        document.getElementById('devTag').value = d.tag || '';
        document.getElementById('devCalibre').value = d.calibre || '';
        document.getElementById('devColor').value = d.color || 'azul';
        document.getElementById('devDestino').value = d.destino || '';
        document.getElementById('devCable').value = d.cable || '';
    } else {
        document.getElementById('tituloModalDispositivo').innerHTML = `<i class="fa-solid fa-plus-circle corp-accent-color"></i> Agregar en Fila ${filaIdx + 1}`;
        document.getElementById('devTipo').value = 'PIA';
        aplicarPrecargaDispositivo();
        const totalExistentes = estadoGabinete.filas.flat().filter(x => x.tipo === 'PIA').length;
        document.getElementById('devTag').value = `C${totalExistentes + 1}`;
    }

    document.getElementById('modalDispositivoTopo').classList.remove('oculto');
}

function cerrarModalDispositivo() {
    document.getElementById('modalDispositivoTopo').classList.add('oculto');
}

function aplicarPrecargaDispositivo() {
    const tipo = document.getElementById('devTipo').value;
    const p = PRESETS_DISPOSITIVOS[tipo] || PRESETS_DISPOSITIVOS.PIA;
    document.getElementById('devModulos').value = String(p.modulos);
    document.getElementById('devTag').value = p.tag;
    document.getElementById('devCalibre').value = p.calibre;
    document.getElementById('devColor').value = p.color;
    document.getElementById('devDestino').value = p.destino;
    document.getElementById('devCable').value = p.cable;
}

function guardarDispositivoTopo() {
    const filaIdx = parseInt(document.getElementById('devFilaIndex').value, 10) || 0;
    const editIdx = parseInt(document.getElementById('devEditIndex').value, 10);

    const dispositivo = {
        tipo: document.getElementById('devTipo').value,
        modulos: parseInt(document.getElementById('devModulos').value, 10) || 2,
        tag: document.getElementById('devTag').value.trim() || 'DEV',
        calibre: document.getElementById('devCalibre').value.trim() || '-',
        color: document.getElementById('devColor').value,
        destino: document.getElementById('devDestino').value.trim() || 'Circuito',
        cable: document.getElementById('devCable').value.trim() || '-'
    };

    if (!estadoGabinete.filas[filaIdx]) estadoGabinete.filas[filaIdx] = [];

    if (editIdx >= 0) {
        estadoGabinete.filas[filaIdx][editIdx] = dispositivo;
    } else {
        estadoGabinete.filas[filaIdx].push(dispositivo);
    }

    cerrarModalDispositivo();
    guardarEstadoLocal(true);
    renderizarTodoTopografico();
}

function moverDispositivoFila(filaIdx, idx, delta) {
    const arr = estadoGabinete.filas[filaIdx];
    if (!arr) return;
    const nuevoIdx = idx + delta;
    if (nuevoIdx < 0 || nuevoIdx >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[nuevoIdx];
    arr[nuevoIdx] = temp;
    guardarEstadoLocal(true);
    renderizarTodoTopografico();
}

function duplicarDispositivoFila(filaIdx, idx) {
    const arr = estadoGabinete.filas[filaIdx];
    if (!arr || !arr[idx]) return;
    const copia = Object.assign({}, arr[idx]);
    if (/^C\d+$/i.test(copia.tag)) {
        const cant = estadoGabinete.filas.flat().filter(x => x.tipo === 'PIA').length;
        copia.tag = `C${cant + 1}`;
    }
    arr.splice(idx + 1, 0, copia);
    guardarEstadoLocal(true);
    renderizarTodoTopografico();
}

function eliminarDispositivoFila(filaIdx, idx) {
    if (!estadoGabinete.filas[filaIdx]) return;
    estadoGabinete.filas[filaIdx].splice(idx, 1);
    guardarEstadoLocal(true);
    renderizarTodoTopografico();
}

// ==========================================================================
// RENDERIZADO DE INTERFAZ Y AUDITORÍA NORMATIVA AEA 90364-7-770
// ==========================================================================
function renderizarTodoTopografico() {
    const capFila = estadoGabinete.modulosPorFila || 12;
    const cantFilas = estadoGabinete.filasCount || 1;
    const capTotal = capFila * cantFilas;

    let ocupadosTotal = 0;
    let hayDesborde = false;
    let tieneID = false;

    const contFilas = document.getElementById('ui-contenedor-filas');
    contFilas.innerHTML = '';

    for (let f = 0; f < cantFilas; f++) {
        const devs = estadoGabinete.filas[f] || [];
        const ocupadosFila = devs.reduce((acc, d) => acc + (parseInt(d.modulos, 10) || 1), 0);
        ocupadosTotal += ocupadosFila;
        if (ocupadosFila > capFila) hayDesborde = true;
        if (devs.some(d => d.tipo === 'ID')) tieneID = true;

        const pct = Math.min(100, Math.round((ocupadosFila / capFila) * 100));
        const libresFila = capFila - ocupadosFila;
        const fillClass = libresFila < 0 ? 'over' : (pct > 80 ? 'warn' : '');

        const card = document.createElement('div');
        card.className = 'topo-row-card gpu-accel';
        card.innerHTML = `
            <div class="topo-row-header">
                <div>
                    <div class="topo-row-title"><i class="fa-solid fa-grip-lines corp-accent-color"></i> Riel DIN • Fila ${f + 1}</div>
                    <small style="font-size:0.72rem; color:${libresFila < 0 ? 'var(--error-red)' : 'var(--ngc-text-faded)'}; font-weight:700;">
                        ${ocupadosFila} / ${capFila} M ocupados • ${libresFila >= 0 ? `${libresFila} M libres` : `¡EXCEDIDO POR ${Math.abs(libresFila)} M!`}
                    </small>
                </div>
                <button type="button" class="corp-btn-small success-btn" onclick="abrirModalDispositivo(${f}, -1)">
                    <i class="fa-solid fa-plus"></i> Dispositivo
                </button>
            </div>
            <div class="topo-capacity-track">
                <div class="topo-capacity-fill ${fillClass}" style="width:${pct}%;"></div>
            </div>
            <div class="topo-dev-list" id="lista-fila-${f}"></div>
        `;
        contFilas.appendChild(card);

        const listaEl = card.querySelector(`#lista-fila-${f}`);
        if (devs.length === 0) {
            listaEl.innerHTML = `<div style="text-align:center; padding:12px; font-size:0.78rem; color:var(--ngc-text-faded); border:1px dashed var(--ngc-privacy-border); border-radius:8px;">Riel vacío (${capFila} módulos disponibles para reserva o montaje)</div>`;
        } else {
            let posInicio = 1;
            devs.forEach((d, idx) => {
                const posFin = posInicio + d.modulos - 1;
                const rangoTxt = d.modulos === 1 ? `M${posInicio}` : `M${posInicio}–M${posFin}`;
                posInicio = posFin + 1;

                const item = document.createElement('div');
                item.className = 'topo-dev-item';
                item.innerHTML = `
                    <div class="topo-dev-top">
                        <span class="topo-dev-tag">
                            <span style="color:var(--ngc-neon);">[${escapeHtml(d.tag)}]</span> ${escapeHtml(d.destino)}
                        </span>
                        <span class="topo-mod-badge">${rangoTxt} (${d.modulos}M)</span>
                    </div>
                    <div class="topo-dev-meta">
                        <strong>${escapeHtml(d.tipo)}</strong> • ${escapeHtml(d.calibre)} • Cond: ${escapeHtml(d.cable)}
                    </div>
                    <div class="topo-dev-actions">
                        <button type="button" class="corp-btn-small" onclick="moverDispositivoFila(${f}, ${idx}, -1)" title="Mover a la izquierda"><i class="fa-solid fa-arrow-left"></i></button>
                        <button type="button" class="corp-btn-small" onclick="moverDispositivoFila(${f}, ${idx}, 1)" title="Mover a la derecha"><i class="fa-solid fa-arrow-right"></i></button>
                        <button type="button" class="corp-btn-small" onclick="duplicarDispositivoFila(${f}, ${idx})" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
                        <button type="button" class="corp-btn-small primary-action" onclick="abrirModalDispositivo(${f}, ${idx})"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="corp-btn-small danger" onclick="eliminarDispositivoFila(${f}, ${idx})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                listaEl.appendChild(item);
            });
        }
    }

    // Actualiza KPIs de gabinete
    const libresTotal = capTotal - ocupadosTotal;
    const pctReserva = capTotal > 0 ? Math.round((libresTotal / capTotal) * 100) : 0;
    const pctOcupado = capTotal > 0 ? Math.round((ocupadosTotal / capTotal) * 100) : 0;

    document.getElementById('ui-titulo-gabinete').innerText = `${estadoGabinete.nombre} • ${estadoGabinete.ip}`;
    document.getElementById('ui-stat-capacidad').innerText = `${capTotal} M (${cantFilas}×${capFila})`;
    document.getElementById('ui-stat-ocupados').innerText = `${ocupadosTotal} M (${pctOcupado}%)`;

    const elReserva = document.getElementById('ui-stat-reserva');
    if (libresTotal < 0) {
        elReserva.style.color = 'var(--error-red)';
        elReserva.innerText = `${libresTotal} M (Excedido)`;
    } else if (pctReserva < 20) {
        elReserva.style.color = 'var(--ngc-warning)';
        elReserva.innerText = `${libresTotal} M (${pctReserva}% < 20%)`;
    } else {
        elReserva.style.color = 'var(--success-green)';
        elReserva.innerText = `${libresTotal} M (${pctReserva}% OK)`;
    }

    // Banner de auditoría normativa AEA 90364-7-770
    const banner = document.getElementById('ui-aea-topo-status');
    if (hayDesborde) {
        banner.className = 'pot-aea-banner err';
        banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <strong>Error Físico:</strong> Hay filas que superan los módulos DIN del gabinete.';
    } else if (!tieneID && ocupadosTotal > 0) {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = '<i class="fa-solid fa-shield-halved"></i> <strong>Advertencia AEA 770:</strong> No se detectó Interruptor Diferencial (ID ≤ 30mA) en el tablero.';
    } else if (pctReserva < 20) {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = `<i class="fa-solid fa-temperature-half"></i> <strong>Reserva Térmica (${pctReserva}%):</strong> AEA 90364-7-770 exige ≥ 20% de módulos libres.`;
    } else {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Tablero Conforme AEA 90364:</strong> Disposición física correcta y ${pctReserva}% de reserva térmica libre.`;
    }

    // Renderiza SVG en pantalla y en plantilla PDF A4
    const svgHTML = generarSVGTopografico();
    document.getElementById('contenedorSvgPantalla').innerHTML = svgHTML;
    actualizarVistaPreviaPDF(svgHTML);
}

// ==========================================================================
// MOTOR VECTORIAL PARAMÉTRICO SVG (FRENTE MUERTO DE TABLERO DIN)
// ==========================================================================
function generarSVGTopografico() {
    const capFila = estadoGabinete.modulosPorFila || 12;
    const cantFilas = estadoGabinete.filasCount || 1;
    const modW = 34;          // Ancho en px de 1 módulo DIN (18 mm reales)
    const devH = 92;          // Alto cuerpo aparato modular DIN (85 mm reales)
    const rowPitch = 148;     // Paso vertical entre filas DIN
    const padX = 36;
    const headerH = 44;
    const footerBusH = estadoGabinete.borneras !== 'NONE' ? 42 : 16;

    const innerW = capFila * modW;
    const cabW = innerW + padX * 2;
    const cabH = headerH + cantFilas * rowPitch + footerBusH + 14;
    const svgW = cabW + 24;
    const svgH = cabH + 24;

    const palette = {
        azul:    { handle: '#1d4ed8', badge: '#dbeafe', text: '#1e3a8a' },
        rojo:    { handle: '#dc2626', badge: '#fee2e2', text: '#7f1d1d' },
        negro:   { handle: '#1e293b', badge: '#e2e8f0', text: '#0f172a' },
        naranja: { handle: '#ea580c', badge: '#ffedd5', text: '#7c2d12' },
        gris:    { handle: '#64748b', badge: '#f1f5f9', text: '#334155' }
    };

    let s = `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">`;

    // Marco exterior de gabinete
    s += `<rect x="12" y="12" width="${cabW}" height="${cabH}" rx="8" fill="#f8fafc" stroke="#0f172a" stroke-width="2.2"/>`;
    s += `<rect x="18" y="18" width="${cabW - 12}" height="${cabH - 12}" rx="5" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>`;

    // Tornillos de esquina del frente muerto
    [[25, 25], [cabW - 1, 25], [25, cabH - 1], [cabW - 1, cabH - 1]].forEach(([cx, cy]) => {
        s += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>`;
        s += `<line x1="${cx - 2}" y1="${cy - 2}" x2="${cx + 2}" y2="${cy + 2}" stroke="#475569" stroke-width="1"/>`;
    });

    // Placa identificatoria superior del tablero
    s += `<rect x="${padX + 12}" y="22" width="${innerW}" height="24" rx="3" fill="#0f172a"/>`;
    s += `<text x="${padX + 20}" y="38" fill="#ffffff" font-size="11" font-weight="bold">${escapeXml(estadoGabinete.nombre)} — ${escapeXml(estadoGabinete.montaje.toUpperCase())}</text>`;
    s += `<text x="${padX + innerW + 4}" y="38" fill="#cbd5e1" font-size="9.5" font-weight="bold" text-anchor="end">${escapeXml(estadoGabinete.ip)} (${cantFilas}×${capFila}M)</text>`;

    // Dibujo de cada fila / riel DIN
    for (let f = 0; f < cantFilas; f++) {
        const yBase = 12 + headerH + f * rowPitch;
        const xStart = 12 + padX;

        // Etiqueta lateral de fila
        s += `<text x="${xStart - 7}" y="${yBase + 66}" fill="#475569" font-size="9.5" font-weight="bold" text-anchor="end">F${f + 1}</text>`;

        // Riel DIN metálico de fondo (35 mm)
        s += `<rect x="${xStart - 6}" y="${yBase + 44}" width="${innerW + 12}" height="34" fill="#e2e8f0" stroke="#64748b" stroke-width="1"/>`;
        s += `<rect x="${xStart - 6}" y="${yBase + 50}" width="${innerW + 12}" height="22" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.8"/>`;

        // Regla numerada de módulos DIN arriba del calado
        for (let m = 0; m < capFila; m++) {
            const mx = xStart + m * modW;
            s += `<rect x="${mx}" y="${yBase + 4}" width="${modW}" height="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.7"/>`;
            s += `<text x="${mx + modW / 2}" y="${yBase + 13}" fill="#64748b" font-size="7.5" font-weight="bold" text-anchor="middle">${m + 1}</text>`;
        }

        // Calado rectangular del frente muerto
        s += `<rect x="${xStart}" y="${yBase + 16}" width="${innerW}" height="${devH}" fill="#f8fafc" stroke="#334155" stroke-width="1.3"/>`;

        // Dispositivos montados sobre el riel
        const devs = estadoGabinete.filas[f] || [];
        let cursorMod = 0;

        devs.forEach(dev => {
            const mods = parseInt(dev.modulos, 10) || 1;
            const dx = xStart + cursorMod * modW;
            const dw = mods * modW;
            const dy = yBase + 16;
            const pal = palette[dev.color] || palette.azul;

            // Cuerpo modular
            s += `<rect x="${dx + 0.8}" y="${dy + 0.8}" width="${dw - 1.6}" height="${devH - 1.6}" rx="2" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;

            // Bornes superiores e inferiores por polo
            for (let p = 0; p < mods; p++) {
                const px = dx + p * modW + modW / 2;
                if (p > 0) {
                    s += `<line x1="${dx + p * modW}" y1="${dy + 2}" x2="${dx + p * modW}" y2="${dy + devH - 2}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2,2"/>`;
                }
                if (dev.tipo !== 'RES') {
                    // Borne superior
                    s += `<circle cx="${px}" cy="${dy + 9}" r="3.3" fill="#e2e8f0" stroke="#475569" stroke-width="0.9"/>`;
                    s += `<line x1="${px - 2}" y1="${dy + 9}" x2="${px + 2}" y2="${dy + 9}" stroke="#334155" stroke-width="0.9"/>`;
                    // Borne inferior
                    s += `<circle cx="${px}" cy="${dy + devH - 9}" r="3.3" fill="#e2e8f0" stroke="#475569" stroke-width="0.9"/>`;
                    s += `<line x1="${px - 2}" y1="${dy + devH - 9}" x2="${px + 2}" y2="${dy + devH - 9}" stroke="#334155" stroke-width="0.9"/>`;
                }
            }

            if (dev.tipo === 'RES') {
                // Tapa ciega DIN
                s += `<line x1="${dx + 4}" y1="${dy + 4}" x2="${dx + dw - 4}" y2="${dy + devH - 4}" stroke="#cbd5e1" stroke-width="1"/>`;
                s += `<line x1="${dx + dw - 4}" y1="${dy + 4}" x2="${dx + 4}" y2="${dy + devH - 4}" stroke="#cbd5e1" stroke-width="1"/>`;
                s += `<text x="${dx + dw / 2}" y="${dy + 49}" fill="#64748b" font-size="8" font-weight="bold" text-anchor="middle">RES</text>`;
            } else {
                // Etiqueta superior tipo/calibre
                s += `<rect x="${dx + 3}" y="${dy + 16}" width="${dw - 6}" height="13" rx="2" fill="${pal.badge}"/>`;
                s += `<text x="${dx + dw / 2}" y="${dy + 25.5}" fill="${pal.text}" font-size="8" font-weight="bold" text-anchor="middle">${escapeXml(dev.tipo)}</text>`;

                // Palanca / Actuador central
                const handleW = Math.max(14, dw - 14);
                const handleX = dx + (dw - handleW) / 2;
                s += `<rect x="${handleX}" y="${dy + 42}" width="${handleW}" height="12" rx="2" fill="${pal.handle}" stroke="#0f172a" stroke-width="0.8"/>`;

                // Botón TEST en Interruptor Diferencial (ID)
                if (dev.tipo === 'ID') {
                    s += `<rect x="${dx + 5}" y="${dy + 31}" width="11" height="8" rx="1.5" fill="#facc15" stroke="#854d0e" stroke-width="0.7"/>`;
                    s += `<text x="${dx + 10.5}" y="${dy + 37.2}" fill="#422006" font-size="6.5" font-weight="bold" text-anchor="middle">T</text>`;
                }

                // Visor de estado en DPS o Protector de Tensión
                if (dev.tipo === 'DPS' || dev.tipo === 'PT') {
                    s += `<rect x="${dx + dw / 2 - 6}" y="${dy + 31}" width="12" height="7" rx="1" fill="#22c55e" stroke="#14532d" stroke-width="0.7"/>`;
                }

                // Texto calibre abreviado en cuerpo
                const calShort = (dev.calibre || '').split('•')[0].trim().slice(0, mods * 5 + 3);
                s += `<text x="${dx + dw / 2}" y="${dy + 65}" fill="#0f172a" font-size="7.5" font-weight="bold" text-anchor="middle">${escapeXml(calShort)}</text>`;
            }

            // Porta-etiqueta grabado debajo del aparato
            s += `<rect x="${dx + 2}" y="${dy + devH + 3}" width="${dw - 4}" height="15" rx="2" fill="#0f172a"/>`;
            s += `<text x="${dx + dw / 2}" y="${dy + devH + 13.5}" fill="#ffffff" font-size="8.5" font-weight="bold" text-anchor="middle">${escapeXml(dev.tag)}</text>`;

            cursorMod += mods;
        });

        // Espacios libres restantes en el riel (Reserva DIN)
        for (let rem = cursorMod; rem < capFila; rem++) {
            const rx = xStart + rem * modW;
            const ry = yBase + 16;
            s += `<rect x="${rx + 1}" y="${ry + 1}" width="${modW - 2}" height="${devH - 2}" fill="none" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3,2"/>`;
            s += `<text x="${rx + modW / 2}" y="${ry + 49}" fill="#94a3b8" font-size="7" text-anchor="middle">LIBRE</text>`;
        }
    }

    // Borneras inferiores (PE / N)
    if (estadoGabinete.borneras !== 'NONE') {
        const yBus = 12 + headerH + cantFilas * rowPitch + 4;
        const xBus = 12 + padX;
        const busW = estadoGabinete.borneras === 'PE_N' ? (innerW / 2 - 6) : innerW;

        // Barra PE (Verde/Amarillo)
        s += `<rect x="${xBus}" y="${yBus}" width="${busW}" height="22" rx="3" fill="#dcfce7" stroke="#15803d" stroke-width="1.2"/>`;
        s += `<text x="${xBus + 8}" y="${yBus + 14.5}" fill="#14532d" font-size="9" font-weight="bold">BARRA PE (TIERRA)</text>`;
        for (let b = 0; b < 6; b++) {
            const bx = xBus + busW - 14 - b * 14;
            if (bx > xBus + 105) {
                s += `<circle cx="${bx}" cy="${yBus + 11}" r="3" fill="#eab308" stroke="#15803d" stroke-width="0.8"/>`;
            }
        }

        // Barra Neutro (Azul) si aplica
        if (estadoGabinete.borneras === 'PE_N') {
            const xN = xBus + innerW / 2 + 6;
            s += `<rect x="${xN}" y="${yBus}" width="${busW}" height="22" rx="3" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.2"/>`;
            s += `<text x="${xN + 8}" y="${yBus + 14.5}" fill="#1e3a8a" font-size="9" font-weight="bold">BARRA NEUTRO (N)</text>`;
            for (let b = 0; b < 6; b++) {
                const bx = xN + busW - 14 - b * 14;
                if (bx > xN + 105) {
                    s += `<circle cx="${bx}" cy="${yBus + 11}" r="3" fill="#93c5fd" stroke="#1d4ed8" stroke-width="0.8"/>`;
                }
            }
        }
    }

    s += `</svg>`;
    return s;
                                           }

// ==========================================================================
// SINCRONIZACIÓN DE LÁMINA A4 Y EXPORTACIÓN PDF (1 PÁGINA EXACTA)
// ==========================================================================
function actualizarVistaPreviaPDF(svgHTMLOpt) {
    const svgHTML = svgHTMLOpt || generarSVGTopografico();
    const hoy = new Date().toLocaleDateString('es-AR');

    document.getElementById('pdf-fecha').innerText = hoy;
    document.getElementById('pdf-cliente').innerText = document.getElementById('cliNombre').value.trim() || '-';
    document.getElementById('pdf-dir').innerText = document.getElementById('cliDireccion').value.trim() || '-';
    document.getElementById('pdf-proyecto').innerText = document.getElementById('cliProyecto').value.trim() || '-';

    const capTotal = (estadoGabinete.filasCount || 1) * (estadoGabinete.modulosPorFila || 12);
    const ocupTotal = estadoGabinete.filas.flat().reduce((a, d) => a + (parseInt(d.modulos, 10) || 1), 0);
    const libres = Math.max(0, capTotal - ocupTotal);
    const pctRes = capTotal > 0 ? Math.round((libres / capTotal) * 100) : 0;

    document.getElementById('pdf-sub-gabinete').innerText = `${estadoGabinete.nombre} • ${estadoGabinete.ip} • Capacidad: ${capTotal}M (Reserva: ${libres}M / ${pctRes}%)`;

    const svgCont = document.getElementById('pdf-svg-container');
    if (svgCont) svgCont.innerHTML = svgHTML;

    const tbody = document.getElementById('pdf-tbody-dispositivos');
    tbody.innerHTML = '';

    estadoGabinete.filas.forEach((devs, fIdx) => {
        let pos = 1;
        devs.forEach((d, idx) => {
            const pFin = pos + d.modulos - 1;
            const posLabel = d.modulos === 1 ? `F${fIdx + 1} • M${pos}` : `F${fIdx + 1} • M${pos}-${pFin}`;
            pos = pFin + 1;

            const tr = document.createElement('tr');
            tr.style.background = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
            tr.innerHTML = `
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 700;">${posLabel}</td>
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${d.modulos}M</td>
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a;">${escapeHtml(d.tag)}</td>
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1;"><strong>${escapeHtml(d.tipo)}</strong> • ${escapeHtml(d.calibre)}</td>
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${escapeHtml(d.destino)}</td>
                <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">${escapeHtml(d.cable)}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:8px; text-align:center; border:1px solid #cbd5e1; color:#64748b;">Gabinete sin dispositivos configurados.</td></tr>';
    }

    const notas = document.getElementById('obsGenerales').value.trim();
    document.getElementById('pdf-notas-texto').innerText = notas || 'Paso modular DIN estándar 18 mm. Distribución interna conforme a AEA 90364-7-770 con reserva térmica verificada.';

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
    if (!profEmail && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
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

async function convertirSvgTopoAImagen() {
    const contenedor = document.getElementById('pdf-svg-container');
    if (!contenedor) return () => {};

    const svgOriginalHTML = contenedor.innerHTML;
    const svgEl = contenedor.querySelector('svg');
    if (!svgEl) return () => {};

    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    const ancho = (vb && vb.width) ? vb.width : (parseInt(svgEl.getAttribute('width'), 10) || 480);
    const alto = (vb && vb.height) ? vb.height : (parseInt(svgEl.getAttribute('height'), 10) || 260);

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
                    const escala = 2;
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
        imgFinal.alt = 'Esquema Topográfico';
        imgFinal.style.cssText = 'width: 100%; max-height: 430px; height: auto; object-fit: contain; display: block; margin: 0 auto;';
        contenedor.innerHTML = '';
        contenedor.appendChild(imgFinal);

        return () => { contenedor.innerHTML = svgOriginalHTML; };
    } catch (e) {
        console.warn('Error rasterizando SVG:', e);
        return () => { contenedor.innerHTML = svgOriginalHTML; };
    }
}

function generarPDF() {
    actualizarVistaPreviaPDF();
    const sugerido = document.getElementById('cliNombre').value.trim().replace(/\s+/g, '_') || 'Cliente';
    const sufijo = Math.floor(Math.random() * 9000) + 1000;
    document.getElementById('nombreArchivoPDF').value = `Esquema_Topografico_${sugerido}_${sufijo}`;
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
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
    }

    const element = document.getElementById('plantilla-pdf');
    const pdfContainer = element ? element.querySelector('.pdf-container') : null;
    const modalVista = document.getElementById('modalVistaPrevia');
    const modalAbierto = modalVista && !modalVista.classList.contains('oculto');
    const teniaClaseOculto = element ? element.classList.contains('oculto') : false;

    if (!modalAbierto && element) {
        element.classList.remove('oculto');
        element.style.display = 'block';
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
        restaurarSvg = await convertirSvgTopoAImagen();
        const inputNombre = document.getElementById('nombreArchivoPDF');
        const nombreFinal = (inputNombre && inputNombre.value.trim()) || 'Esquema_Topografico';

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
        mostrarToast('Éxito', 'Esquema Topográfico PDF generado.');

        if (typeof permiteGuardarNube !== 'undefined' && permiteGuardarNube) {
            try {
                guardarBorradorFirebase(false, true);
            } catch (errNube) {
                console.warn('Aviso respaldo automático en nube:', errNube);
            }
        }
    } catch (error) {
        console.error('Error generando PDF Topográfico:', error);
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

        if (modalAbierto) {
            aplicarEscalaVistaPrevia(escalaActualPreview);
        } else if (element && window.innerWidth < 992) {
            element.style.display = 'none';
        }
    }
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
    const proy = document.getElementById('cliProyecto').value.trim() || '-';
    const capTotal = (estadoGabinete.filasCount || 1) * (estadoGabinete.modulosPorFila || 12);

    let msg = `*${profNombre.toUpperCase()} - ESQUEMA TOPOGRÁFICO*\n`;
    msg += `*Cliente:* ${cli}\n`;
    msg += `*Proyecto:* ${proy}\n`;
    msg += `*Gabinete:* ${estadoGabinete.nombre} (${estadoGabinete.ip} • ${capTotal} Módulos DIN)\n\n`;

    estadoGabinete.filas.forEach((devs, fIdx) => {
        if (devs.length > 0) {
            msg += `*FILA ${fIdx + 1}:*\n`;
            devs.forEach(d => {
                msg += `• *[${d.tag}]* (${d.modulos}M) ${d.tipo} ${d.calibre} → ${d.destino}\n`;
            });
            msg += `\n`;
        }
    });

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, msg);
    }
}

// ==========================================================================
// BORRADORES EN FIREBASE (perfiles/{uid}/borradores_topografico)
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
        const fecha = new Date().toISOString().slice(0, 10);
        document.getElementById('inputNombreBorrador').value = nombreBorradorActual || `Topografico_${cli}_${fecha}`;
        document.getElementById('modalGuardarBorrador').classList.remove('oculto');
        return;
    }

    const nombreFinal = nombreBorradorActual || `Topografico_${Date.now()}`;
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

function serializarGabineteParaFirestore(gab) {
    const base = normalizarEstadoGabinete(gab);
    return {
        nombre: base.nombre,
        ip: base.ip,
        montaje: base.montaje,
        filasCount: base.filasCount,
        modulosPorFila: base.modulosPorFila,
        borneras: base.borneras,
        // Firestore no admite arrays anidados ([[...]]), se serializan como objetos por fila
        filas: base.filas.map((dispositivos, idx) => ({
            filaIndex: idx,
            dispositivos: dispositivos.map(d => ({ ...d }))
        }))
    };
}

function normalizarEstadoGabinete(rawGab) {
    const gab = Object.assign({
        nombre: 'TS1',
        ip: 'IP41 • PVC Autoextinguible',
        montaje: 'De Embutir',
        filasCount: 1,
        modulosPorFila: 12,
        borneras: 'PE',
        filas: [[]]
    }, rawGab || {});

    if (Array.isArray(gab.filas)) {
        gab.filas = gab.filas.map(f => {
            if (Array.isArray(f)) return f;
            if (f && Array.isArray(f.dispositivos)) return f.dispositivos;
            return [];
        });
    } else {
        gab.filas = [[]];
    }

    while (gab.filas.length < (gab.filasCount || 1)) {
        gab.filas.push([]);
    }
    return gab;
}

function ejecutarGuardadoEnNube(nombreDoc, silencioso) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    const badge = document.getElementById('ui-cloud-badge');
    if (badge) {
        badge.className = 'pres-cloud-pill saving';
        badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    }

    const manejarErrorNube = (err) => {
        console.error('Error guardando borrador topográfico:', err);
        if (badge) {
            if (silencioso) {
                actualizarBadgeNube();
            } else {
                badge.className = 'pres-cloud-pill local';
                badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error Nube`;
            }
        }
        if (!silencioso) {
            mostrarAlertaCorp('Error de Nube', `No se pudo sincronizar con Firebase (${err?.code || err?.message || 'error'}).`);
        }
    };

    try {
        const docId = nombreDoc.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

        const payload = JSON.parse(JSON.stringify({
            cliNombre: document.getElementById('cliNombre').value.trim(),
            cliDireccion: document.getElementById('cliDireccion').value.trim(),
            cliProyecto: document.getElementById('cliProyecto').value.trim(),
            obsGenerales: document.getElementById('obsGenerales').value,
            estadoGabinete: serializarGabineteParaFirestore(estadoGabinete),
            nombreBorrador: nombreDoc,
            telefonoClienteActual: telefonoClienteActual || '',
            fechaGuardado: Date.now()
        }));

        const escritura = db.collection('perfiles').doc(uid).collection('borradores_topografico').doc(docId).set(payload);
        const timeoutNube = new Promise((_, reject) =>
            setTimeout(() => reject({ code: 'timeout', message: 'Tiempo de espera agotado' }), 8000)
        );

        Promise.race([escritura, timeoutNube])
            .then(() => {
                if (badge) {
                    badge.className = 'pres-cloud-pill saved';
                    badge.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
                }
                if (!silencioso) mostrarToast('Guardado en Nube', `Borrador "${nombreDoc}" sincronizado.`);
            })
            .catch(manejarErrorNube);
    } catch (syncErr) {
        manejarErrorNube(syncErr);
    }
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

    db.collection('perfiles').doc(uid).collection('borradores_topografico').orderBy('fechaGuardado', 'desc').get()
        .then(snap => {
            if (snap.empty) {
                lista.innerHTML = '<p style="text-align:center; color:var(--ngc-text-faded);">No tenés esquemas topográficos guardados aún.</p>';
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
                        <small>${escapeHtml(d.cliNombre || 'Sin cliente')} • ${escapeHtml(d.estadoGabinete?.nombre || 'TS1')}</small>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="corp-btn-small primary-action" onclick="cargarBorradorTopografico('${escapeJs(doc.id)}')">Abrir</button>
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

function cargarBorradorTopografico(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    db.collection('perfiles').doc(uid).collection('borradores_topografico').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const d = doc.data();
        document.getElementById('cliNombre').value = d.cliNombre || '';
        document.getElementById('cliDireccion').value = d.cliDireccion || '';
        document.getElementById('cliProyecto').value = d.cliProyecto || '';
        document.getElementById('obsGenerales').value = d.obsGenerales || '';
        if (d.estadoGabinete) {
            estadoGabinete = normalizarEstadoGabinete(d.estadoGabinete);
        }

        clienteDesdeAgenda = true;
        permiteGuardarNube = true;
        nombreBorradorActual = d.nombreBorrador || docId;
        telefonoClienteActual = d.telefonoClienteActual || '';

        cerrarModalBorradores();
        avanzarPasoTrabajo(true);
        mostrarToast('Borrador Cargado', `Esquema "${nombreBorradorActual}" listo.`);
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

    db.collection('perfiles').doc(uid).collection('borradores_topografico').doc(idBorrar).delete()
        .then(() => {
            mostrarToast('Eliminado', 'Borrador borrado de la nube.');
            abrirModalBorradores();
        });
          }

// ==========================================================================
// REINICIO DE MÓDULO Y UTILIDADES
// ==========================================================================
function ejecutarNuevoTopografico() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';
    document.getElementById('obsGenerales').value = '';

    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = '';

    aplicarPlantillaTopografico('mono_12');
    localStorage.removeItem(STORAGE_KEY_TOPO);

    const acc = document.getElementById('accionesMenu');
    if (acc) acc.classList.add('oculto');

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
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
