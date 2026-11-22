let db = null;
const SHEET_ID = '1XfQoCkNMXy5WLhQciVrRoc1Pz6yeKKiAZljR_KYpohM';
const URL_MATERIALES = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Hoja1`;
const CACHE_DB_KEY = 'villaser_cache_db_materiales_v1';

let dbMateriales = [];
let listaItems = [];
let uidSeguro = null;

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let timerAutoSave = null;

// ==========================================
// UTILIDADES GENERALES
// ==========================================
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizarTexto(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function step(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const min = el.min ? parseInt(el.min, 10) : 1;
    const actual = parseInt(el.value || 0, 10);
    el.value = Math.max(min, actual + val);
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
function arrancarModulo() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (user) {
                        uidSeguro = user.uid;
                        window.currentUserUid = user.uid;
                        actualizarEstadoNubePill('ready');
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Modo local activo.", e);
    }

    try {
        cargarEstadoGuardado();
    } catch (e) {
        localStorage.removeItem('materiales_estado_actual');
    }

    fetchData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarModulo);
} else {
    arrancarModulo();
}

function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof window.currentUserUid !== 'undefined' && window.currentUserUid) return window.currentUserUid;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function') {
        const user = firebase.auth().currentUser;
        if (user) return user.uid;
    }
    return null;
}

// ==========================================
// FETCH OFFLINE-FIRST Y CATÁLOGO
// ==========================================
function mostrarInterfazLista() {
    document.getElementById('loading').classList.add('oculto');
    document.getElementById('app').classList.remove('oculto');
    if (listaItems.length > 0) {
        avanzarPasoTrabajo();
    }
}

async function fetchData() {
    let tieneCache = false;

    // 1. Arranque instantáneo desde caché local (funciona sin señal en obra)
    try {
        const cacheRaw = localStorage.getItem(CACHE_DB_KEY);
        if (cacheRaw) {
            const parsed = JSON.parse(cacheRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                dbMateriales = parsed;
                poblarTemas();
                mostrarInterfazLista();
                tieneCache = true;
            }
        }
    } catch (e) {
        localStorage.removeItem(CACHE_DB_KEY);
    }

    // 2. Actualización en segundo plano desde Google Sheets
    try {
        const res = await fetch(URL_MATERIALES);
        const txt = await res.text();
        const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));

        const frescos = json.table.rows.map(r => ({
            tema: (r.c[0]?.v || '').toString().trim(),
            concepto: (r.c[1]?.v || '').toString().trim(),
            nivel3: (r.c[2]?.v || '').toString().trim(),
            nivel4: (r.c[3]?.v || '').toString().trim(),
            nivel5: (r.c[4]?.v || '').toString().trim()
        })).filter(i => i.tema && i.concepto && i.concepto !== "Concepto");

        if (frescos.length > 0) {
            dbMateriales = frescos;
            try {
                localStorage.setItem(CACHE_DB_KEY, JSON.stringify(frescos));
            } catch (errStorage) { /* Ignorar si cuota llena */ }

            // Solo repoblar si el usuario aún no seleccionó una categoría
            if (!document.getElementById('selTema')?.value) {
                poblarTemas();
            }
            if (!tieneCache) {
                mostrarInterfazLista();
            }
        }
    } catch (e) {
        if (!tieneCache) {
            document.getElementById('loading').innerHTML = `
                <i class="fa-solid fa-wifi" style="color: var(--error-red); font-size: 2rem; margin-bottom: 10px;"></i>
                <br>Sin conexión y sin catálogo guardado.<br><br>
                <button class="corp-btn primary-action" onclick="location.reload()">Reintentar</button>`;
        } else {
            mostrarToast("Modo Sin Conexión", "Usando catálogo guardado localmente.");
        }
    }
}

// ==========================================
// MOTOR DE CASCADA CON BUSCADOR INTEGRADO
// ==========================================
function llenarSelectAcordeon(idSuffix, dataArray, onChangeCallback) {
    const hiddenInput = document.getElementById('sel' + idSuffix);
    const summary = document.getElementById('sum' + idSuffix);
    const list = document.getElementById('list' + idSuffix);
    const details = document.getElementById('det' + idSuffix);

    if (!hiddenInput || !summary || !list || !details) return;

    list.innerHTML = '';
    hiddenInput.value = '';
    summary.innerText = '-- SELECCIONE --';

    const unicos = [...new Set(dataArray)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));

    if (unicos.length === 0) {
        details.setAttribute('disabled', 'true');
        details.style.pointerEvents = 'none';
        details.style.opacity = '0.5';
        details.removeAttribute('open');
    } else {
        details.removeAttribute('disabled');
        details.style.pointerEvents = 'auto';
        details.style.opacity = '1';

        // Agregar buscador interno si hay más de 6 opciones
        if (unicos.length > 6) {
            const searchWrap = document.createElement('div');
            searchWrap.className = 'pres-select-search-wrap';

            const searchInput = document.createElement('input');
            searchInput.type = 'search';
            searchInput.className = 'corp-input pres-select-search';
            searchInput.placeholder = 'Buscar opción...';
            searchInput.onclick = (e) => e.stopPropagation();

            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'pres-select-empty oculto';
            emptyMsg.innerText = 'Sin coincidencias';

            searchInput.oninput = (e) => {
                const q = normalizarTexto(e.target.value);
                let visibles = 0;
                list.querySelectorAll('.corp-select-option').forEach(opt => {
                    const match = normalizarTexto(opt.innerText).includes(q);
                    opt.style.display = match ? '' : 'none';
                    if (match) visibles++;
                });
                emptyMsg.classList.toggle('oculto', visibles > 0);
            };

            searchWrap.appendChild(searchInput);
            list.appendChild(searchWrap);
            list.appendChild(emptyMsg);

            details.ontoggle = () => {
                if (details.open) {
                    setTimeout(() => searchInput.focus(), 50);
                }
            };
        } else {
            details.ontoggle = null;
        }

        unicos.forEach(val => {
            const option = document.createElement('div');
            option.className = 'corp-select-option';
            option.innerText = val;
            option.onclick = () => {
                hiddenInput.value = val;
                summary.innerText = val;
                details.removeAttribute('open');
                if (onChangeCallback) onChangeCallback();
                actualizarPreviewSeleccion();
            };
            list.appendChild(option);
        });
    }
    actualizarPreviewSeleccion();
}

function actualizarPreviewSeleccion() {
    const wrap = document.getElementById('previewSeleccionWrap');
    const txt = document.getElementById('previewSeleccionTexto');
    if (!wrap || !txt) return;

    const partes = [
        document.getElementById('selTema')?.value,
        document.getElementById('selConcepto')?.value,
        document.getElementById('selNivel3')?.value,
        document.getElementById('selNivel4')?.value,
        document.getElementById('selNivel5')?.value
    ].filter(Boolean);

    if (partes.length > 0) {
        txt.innerText = partes.join(' | ');
        wrap.classList.remove('oculto');
    } else {
        wrap.classList.add('oculto');
    }
}

function poblarTemas() {
    llenarSelectAcordeon('Tema', dbMateriales.map(i => i.tema), cambioTema);
}

function cambioTema() {
    const t = document.getElementById('selTema').value;
    llenarSelectAcordeon('Concepto', dbMateriales.filter(i => i.tema === t).map(i => i.concepto), cambioConcepto);
    llenarSelectAcordeon('Nivel3', []);
    llenarSelectAcordeon('Nivel4', []);
    llenarSelectAcordeon('Nivel5', []);
}

function cambioConcepto() {
    const t = document.getElementById('selTema').value;
    const c = document.getElementById('selConcepto').value;
    llenarSelectAcordeon('Nivel3', dbMateriales.filter(i => i.tema === t && i.concepto === c).map(i => i.nivel3), cambioNivel3);
    llenarSelectAcordeon('Nivel4', []);
    llenarSelectAcordeon('Nivel5', []);
}

function cambioNivel3() {
    const t = document.getElementById('selTema').value;
    const c = document.getElementById('selConcepto').value;
    const n3 = document.getElementById('selNivel3').value;
    llenarSelectAcordeon('Nivel4', dbMateriales.filter(i => i.tema === t && i.concepto === c && i.nivel3 === n3).map(i => i.nivel4), cambioNivel4);
    llenarSelectAcordeon('Nivel5', []);
}

function cambioNivel4() {
    const t = document.getElementById('selTema').value;
    const c = document.getElementById('selConcepto').value;
    const n3 = document.getElementById('selNivel3').value;
    const n4 = document.getElementById('selNivel4').value;
    llenarSelectAcordeon('Nivel5', dbMateriales.filter(i => i.tema === t && i.concepto === c && i.nivel3 === n3 && i.nivel4 === n4).map(i => i.nivel5));
}

document.addEventListener('click', function(event) {
    const details = document.querySelectorAll('.corp-custom-select');
    details.forEach(det => {
        if (!det.contains(event.target)) {
            det.removeAttribute('open');
        }
    });
});

// ==========================================
// GESTIÓN DE CLIENTE Y FLUJO DE PASOS
// ==========================================
function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
}

function irAAgendarCliente() {
    guardarClienteGlobal();
    if (typeof window.accionAgendarCliente === 'function') {
        window.accionAgendarCliente();
    } else {
        window.location.href = '../agenda/index.html';
    }
}

function seleccionarContacto(nombre, dir) {
    document.getElementById('cliNombre').value = nombre;
    document.getElementById('cliDireccion').value = dir || '';
    clienteDesdeAgenda = true;
    permiteGuardarNube = true;
    guardarClienteGlobal();
    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal();
    mostrarToast("Cliente Seleccionado", "Datos importados de la agenda.");
}

function iniciarLista() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Faltan Datos", "Por favor, ingresá al menos el Nombre del Cliente.");
        return;
    }
    if (!clienteDesdeAgenda && permiteGuardarNube) {
        document.getElementById('modalOpcionesCliente').classList.remove('oculto');
        return;
    }
    avanzarPasoTrabajo();
}

function opcionBuscarAgenda() {
    document.getElementById('modalOpcionesCliente').classList.add('oculto');
    if (typeof abrirModalAgendaGlobal === 'function') abrirModalAgendaGlobal();
}

function opcionContinuarSinAgenda() {
    document.getElementById('modalOpcionesCliente').classList.add('oculto');
    document.getElementById('modalAdvertenciaBorrador').classList.remove('oculto');
}

function confirmarListaTemporal() {
    permiteGuardarNube = false;
    document.getElementById('modalAdvertenciaBorrador').classList.add('oculto');
    avanzarPasoTrabajo();
}

function cancelarListaTemporal() {
    document.getElementById('modalAdvertenciaBorrador').classList.add('oculto');
}

function avanzarPasoTrabajo() {
    document.getElementById('step-cliente').classList.add('oculto');
    const stepTrabajo = document.getElementById('step-trabajo');
    stepTrabajo.classList.remove('oculto');
    stepTrabajo.classList.add('flex-column', 'gap-15');
    actualizarCabeceraClienteActivo();
    guardarClienteGlobal();
    renderTabla();
}

function volverEditarCliente() {
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    const btnIniciar = document.getElementById('btnIniciarLista');
    if (btnIniciar) {
        btnIniciar.innerHTML = listaItems.length > 0
            ? `<i class="fa-solid fa-arrow-right"></i> Volver a la Lista (${listaItems.length})`
            : `<i class="fa-solid fa-play"></i> Comenzar Carga`;
    }
}

function actualizarCabeceraClienteActivo() {
    const nombre = document.getElementById('cliNombre').value.trim() || 'Sin nombre';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();

    const elNombre = document.getElementById('headerCliNombre');
    const elMeta = document.getElementById('headerCliMeta');
    if (elNombre) elNombre.innerText = nombre;
    if (elMeta) {
        const metaPartes = [
            dir ? `📍 ${dir}` : '',
            proy ? `📁 ${proy}` : ''
        ].filter(Boolean);
        elMeta.innerText = metaPartes.length > 0 ? metaPartes.join(' · ') : 'Sin dirección ni proyecto especificado';
    }

    actualizarEstadoNubePill(permiteGuardarNube && clienteDesdeAgenda ? 'ready' : 'local');
}

function actualizarEstadoNubePill(estado) {
    const pill = document.getElementById('cloudStatusPill');
    if (!pill) return;

    pill.className = 'pres-cloud-pill ' + estado;
    if (!permiteGuardarNube || !clienteDesdeAgenda) {
        pill.className = 'pres-cloud-pill local';
        pill.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Temporal';
        return;
    }

    switch (estado) {
        case 'syncing':
            pill.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Guardando...';
            break;
        case 'synced':
            pill.innerHTML = '<i class="fa-solid fa-cloud-check"></i> En Nube';
            break;
        default:
            pill.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizable';
            break;
    }
}

// ==========================================
// BORRADORES EN NUBE (FIREBASE)
// ==========================================
function generarDocIdBorrador(nombre, proyecto) {
    const base = [nombre, proyecto].filter(Boolean).join('_') || 'borrador';
    return normalizarTexto(base).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function dispararAutoGuardadoNube() {
    if (!permiteGuardarNube || !clienteDesdeAgenda || listaItems.length === 0) return;
    if (!obtenerUid() || !db) return;

    clearTimeout(timerAutoSave);
    timerAutoSave = setTimeout(() => {
        guardarBorradorFirebase(false);
    }, 2500);
}

function guardarBorradorFirebase(mostrarAlerta = false) {
    const uid = obtenerUid();
    if (!uid || !db) {
        if (mostrarAlerta) mostrarAlertaCorp("Error de Sesión", "No se detectó sesión activa para guardar en la nube.");
        return;
    }
    if (!permiteGuardarNube || !clienteDesdeAgenda) {
        if (mostrarAlerta) mostrarAlertaCorp("Cliente Temporal", "Agendá o seleccioná el cliente desde la Agenda para habilitar el guardado en la nube.");
        return;
    }

    const cliNombre = document.getElementById('cliNombre').value.trim();
    const cliDireccion = document.getElementById('cliDireccion').value.trim();
    const cliProyecto = document.getElementById('cliProyecto').value.trim();
    const obsGenerales = document.getElementById('obsGenerales').value;

    if (listaItems.length === 0 && !cliNombre) return;

    actualizarEstadoNubePill('syncing');

    const nombreBorrador = cliProyecto ? `${cliNombre} — ${cliProyecto}` : cliNombre;
    const estado = {
        cliNombre,
        cliDireccion,
        cliProyecto,
        nombreBorrador,
        obsGenerales,
        items: listaItems,
        fechaGuardado: Date.now()
    };

    const docId = generarDocIdBorrador(cliNombre, cliProyecto);

    db.collection("perfiles").doc(uid).collection("materiales").doc(docId).set(estado)
        .then(() => {
            actualizarEstadoNubePill('synced');
            if (mostrarAlerta) mostrarToast("Guardado en Nube", "Lista sincronizada correctamente.");
        })
        .catch(e => {
            console.error("Error guardando borrador:", e);
            actualizarEstadoNubePill('ready');
            if (mostrarAlerta) mostrarAlertaCorp("Error", "No se pudo guardar en la nube. Verificá tu conexión.");
        });
}

function mostrarAlertaCorp(titulo, mensaje) {
    document.getElementById('modalAlertaTitulo').innerText = titulo;
    document.getElementById('modalAlertaMensaje').innerText = mensaje;
    document.getElementById('modalAlertaCorp').classList.remove('oculto');
}

function cerrarModalAlertaCorp() {
    document.getElementById('modalAlertaCorp').classList.add('oculto');
}

function abrirModalBorradores() {
    const uid = obtenerUid();
    if (!uid || !db) {
        mostrarAlertaCorp("Sin Sesión", "Iniciá sesión para acceder a tus borradores en la nube.");
        return;
    }

    const inputNombre = document.getElementById('cliNombre');
    const nombreBuscado = inputNombre ? inputNombre.value.trim() : '';

    document.getElementById('modalBorradores').classList.remove('oculto');
    const sub = document.getElementById('subtituloBorradores');
    const cont = document.getElementById('listaBorradores');

    sub.innerText = nombreBuscado
        ? `Filtrando por: "${nombreBuscado}"`
        : 'Mostrando todas tus listas guardadas en la nube';

    cont.innerHTML = `<div style="text-align:center; padding: 15px;"><i class="fa-solid fa-circle-notch fa-spin" style="color: var(--ngc-neon);"></i> Buscando...</div>`;

    const ref = db.collection("perfiles").doc(uid).collection("materiales");
    const consulta = nombreBuscado ? ref.where("cliNombre", "==", nombreBuscado).get() : ref.get();

    consulta.then((snapshot) => {
        cont.innerHTML = '';
        if (snapshot.empty) {
            cont.innerHTML = `
                <p style="text-align:center; color: var(--ngc-text-faded); margin-bottom: 10px;">
                    No se encontraron borradores${nombreBuscado ? ' para este cliente' : ''}.
                </p>
                ${nombreBuscado ? `<button class="corp-btn-small" style="width:100%;" onclick="document.getElementById('cliNombre').value=''; abrirModalBorradores();">Ver todos mis borradores</button>` : ''}`;
            return;
        }

        let borradores = [];
        snapshot.forEach((doc) => borradores.push({ id: doc.id, data: doc.data() }));
        borradores.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        borradores.forEach((b) => {
            const f = b.data.fechaGuardado ? new Date(b.data.fechaGuardado).toLocaleDateString('es-AR') : '';
            const tituloBor = escapeHTML(b.data.nombreBorrador || b.data.cliNombre || 'Sin título');
            const cantItems = Array.isArray(b.data.items) ? b.data.items.length : 0;

            const div = document.createElement('div');
            div.className = "modal-list-item";
            div.style.borderLeft = "3px solid var(--ngc-neon)";

            div.innerHTML = `
                <div style="flex: 1; min-width: 0; padding-right: 10px;">
                    <h4 style="word-break: break-word; line-height: 1.25; margin-bottom: 4px;">${tituloBor}</h4>
                    <small style="color: var(--ngc-text-faded);">${cantItems} ítems · ${f}</small>
                </div>
                <div style="display:flex; gap:5px; flex-shrink: 0;">
                    <button class="corp-btn-small" onclick="cargarBorradorNube('${escapeHTML(b.id)}')">Abrir</button>
                    <button class="corp-btn-small danger" onclick="eliminarBorradorNube('${escapeHTML(b.id)}', this)"><i class="fa-solid fa-trash"></i></button>
                </div>`;
            cont.appendChild(div);
        });
    }).catch(err => {
        console.error(err);
        cont.innerHTML = `<p style="text-align:center; color: var(--error-red);">Error al leer borradores.</p>`;
    });
}

function cargarBorradorNube(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;

    db.collection("perfiles").doc(uid).collection("materiales").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            data.clienteDesdeAgenda = true;
            data.permiteGuardarNube = true;
            localStorage.setItem('materiales_estado_actual', JSON.stringify(data));
            cargarEstadoGuardado();
            guardarClienteGlobal();
            avanzarPasoTrabajo();
            actualizarEstadoNubePill('synced');
            if (typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();
            mostrarToast("Borrador Abierto", "Datos cargados desde la nube.");
        }
    });
}

function eliminarBorradorNube(docId, btnElement) {
    const uid = obtenerUid();
    if (!uid || !db) return;
    if (confirm("¿Eliminar este borrador de la nube definitivamente?")) {
        db.collection("perfiles").doc(uid).collection("materiales").doc(docId).delete().then(() => {
            btnElement.closest('.modal-list-item').remove();
            mostrarToast("Eliminado", "Borrador quitado de la nube.");
        });
    }
}

// ==========================================
// MEMORIA LOCAL Y GESTIÓN DE ÍTEMS
// ==========================================
function guardarClienteGlobal() {
    localStorage.setItem('villaser_cliente_global', JSON.stringify({
        nombre: document.getElementById('cliNombre').value.trim(),
        direccion: document.getElementById('cliDireccion').value.trim(),
        proyecto: document.getElementById('cliProyecto').value.trim()
    }));
    guardarEstadoLocal();
}

function guardarEstadoLocal() {
    localStorage.setItem('materiales_estado_actual', JSON.stringify({
        cliNombre: document.getElementById('cliNombre').value,
        cliDireccion: document.getElementById('cliDireccion').value,
        cliProyecto: document.getElementById('cliProyecto').value,
        obsGenerales: document.getElementById('obsGenerales').value,
        items: listaItems,
        clienteDesdeAgenda,
        permiteGuardarNube
    }));
}

function cargarEstadoGuardado() {
    const estadoStr = localStorage.getItem('materiales_estado_actual') || localStorage.getItem('villaser_cliente_global');
    if (estadoStr) {
        const estado = JSON.parse(estadoStr);
        if (estado.cliNombre || estado.nombre) document.getElementById('cliNombre').value = estado.cliNombre || estado.nombre;
        if (estado.cliDireccion || estado.direccion) document.getElementById('cliDireccion').value = estado.cliDireccion || estado.direccion;
        if (estado.cliProyecto || estado.proyecto) document.getElementById('cliProyecto').value = estado.cliProyecto || estado.proyecto;
        if (estado.obsGenerales) document.getElementById('obsGenerales').value = estado.obsGenerales;
        listaItems = Array.isArray(estado.items) ? estado.items : [];
        if (estado.clienteDesdeAgenda !== undefined) clienteDesdeAgenda = estado.clienteDesdeAgenda;
        if (estado.permiteGuardarNube !== undefined) permiteGuardarNube = estado.permiteGuardarNube;
    }
}

function alCambiarNotasGlobales() {
    guardarEstadoLocal();
    sincronizarVistaPreviaPDF();
    dispararAutoGuardadoNube();
}

function ejecutarNuevaLista() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';
    document.getElementById('obsGenerales').value = '';

    listaItems = [];
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;

    const btnIniciar = document.getElementById('btnIniciarLista');
    if (btnIniciar) btnIniciar.innerHTML = `<i class="fa-solid fa-play"></i> Comenzar Carga`;

    guardarEstadoLocal();
    guardarClienteGlobal();

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    renderTabla();
}

function mostrarToast(titulo, mensaje) {
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMessage').innerText = mensaje;
    const toast = document.getElementById('toastCliente');
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 50);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 400);
    }, 3000);
}

function agregarTrabajo() {
    const valConcepto = document.getElementById('selConcepto').value;

    if (!valConcepto) {
        return mostrarAlertaCorp("Falta Material", "Seleccioná al menos una Categoría y un Material, o usá el botón + Manual.");
    }

    const valTema = document.getElementById('selTema').value;
    const valNivel3 = document.getElementById('selNivel3').value;
    const valNivel4 = document.getElementById('selNivel4').value;
    const valNivel5 = document.getElementById('selNivel5').value;

    const partes = [valTema, valConcepto, valNivel3, valNivel4, valNivel5];
    const nombreCompleto = partes.filter(Boolean).join(' | ');

    const qty = Math.max(1, parseInt(document.getElementById('cantidad').value, 10) || 1);
    const nota = document.getElementById('obsManual').value.trim();
    const radioUnidad = document.querySelector('input[name="tipoUnidad"]:checked');
    const unidad = radioUnidad ? radioUnidad.value : 'UNID';

    listaItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        material: nombreCompleto,
        cantidad: qty,
        unidad: unidad,
        nota: nota
    });

    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();

    // Limpiar selección manteniendo la Categoría para agilizar cargas múltiples
    document.getElementById('obsManual').value = "";
    document.getElementById('cantidad').value = 1;
    cambioTema();
    mostrarToast("Agregado", `${qty} ${unidad} sumado a la lista.`);
}

// ==========================================
// ÍTEM MANUAL Y EDICIÓN DE ÍTEMS
// ==========================================
function abrirModalItemManual() {
    document.getElementById('manMaterial').value = '';
    document.getElementById('manCantidad').value = 1;
    document.getElementById('manNota').value = '';
    document.getElementById('manUnitUnid').checked = true;
    document.getElementById('modalItemManual').classList.remove('oculto');
    setTimeout(() => document.getElementById('manMaterial').focus(), 80);
}

function cerrarModalItemManual() {
    document.getElementById('modalItemManual').classList.add('oculto');
}

function guardarItemManual() {
    const mat = document.getElementById('manMaterial').value.trim();
    if (!mat) {
        mostrarAlertaCorp("Falta Descripción", "Ingresá el nombre o descripción del material.");
        return;
    }
    const qty = Math.max(1, parseInt(document.getElementById('manCantidad').value, 10) || 1);
    const nota = document.getElementById('manNota').value.trim();
    const radio = document.querySelector('input[name="manTipoUnidad"]:checked');
    const unidad = radio ? radio.value : 'UNID';

    listaItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        material: mat,
        cantidad: qty,
        unidad: unidad,
        nota: nota
    });

    cerrarModalItemManual();
    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();
    mostrarToast("Material Manual Agregado", mat);
}

function abrirModalEditarItem(id) {
    const item = listaItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editMaterial').value = item.material;
    document.getElementById('editCantidad').value = item.cantidad;
    document.getElementById('editNota').value = item.nota || '';

    const radios = document.querySelectorAll('input[name="editTipoUnidad"]');
    let marcoAlguno = false;
    radios.forEach(r => {
        if (r.value === item.unidad) {
            r.checked = true;
            marcoAlguno = true;
        }
    });
    if (!marcoAlguno) document.getElementById('editUnitUnid').checked = true;

    document.getElementById('modalEditarItem').classList.remove('oculto');
}

function cerrarModalEditarItem() {
    document.getElementById('modalEditarItem').classList.add('oculto');
}

function guardarEdicionItem() {
    const id = parseInt(document.getElementById('editItemId').value, 10);
    const item = listaItems.find(i => i.id === id);
    if (!item) return;

    const nuevoMat = document.getElementById('editMaterial').value.trim();
    if (!nuevoMat) {
        mostrarAlertaCorp("Falta Descripción", "La descripción del material no puede quedar vacía.");
        return;
    }

    const radio = document.querySelector('input[name="editTipoUnidad"]:checked');
    item.material = nuevoMat;
    item.cantidad = Math.max(1, parseInt(document.getElementById('editCantidad').value, 10) || 1);
    item.unidad = radio ? radio.value : 'UNID';
    item.nota = document.getElementById('editNota').value.trim();

    cerrarModalEditarItem();
    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();
    mostrarToast("Actualizado", "Ítem modificado correctamente.");
}

function ajustarCantidadItem(id, delta) {
    const item = listaItems.find(i => i.id === id);
    if (!item) return;
    const nueva = (parseInt(item.cantidad, 10) || 1) + delta;
    if (nueva < 1) return;
    item.cantidad = nueva;
    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();
}

function duplicarItem(id) {
    const idx = listaItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const orig = listaItems[idx];
    const copia = {
        ...orig,
        id: Date.now() + Math.floor(Math.random() * 1000)
    };
    listaItems.splice(idx + 1, 0, copia);
    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();
    mostrarToast("Duplicado", "Se creó una copia del ítem.");
}

function borrarItem(id) {
    listaItems = listaItems.filter(i => i.id !== id);
    guardarEstadoLocal();
    renderTabla();
    dispararAutoGuardadoNube();
}

// ==========================================
// RENDERIZADO DE TABLA Y MÉTRICAS
// ==========================================
function calcularResumenUnidades() {
    const totalesPorUnidad = {};
    listaItems.forEach(i => {
        const u = i.unidad || 'UNID';
        const q = parseFloat(i.cantidad) || 0;
        totalesPorUnidad[u] = (totalesPorUnidad[u] || 0) + q;
    });
    return Object.entries(totalesPorUnidad)
        .map(([u, total]) => `${total} ${u}`)
        .join(' · ');
}

function renderTabla() {
    const tbody = document.getElementById('cuerpoTabla');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Actualizar métricas y contadores
    const desglose = calcularResumenUnidades();
    const elMetricItems = document.getElementById('metricTotalItems');
    const elMetricDesglose = document.getElementById('metricDesglose');
    const elBadge = document.getElementById('badgeCountLista');
    const wrapFiltro = document.getElementById('wrapFiltroLista');
    const strip = document.getElementById('stripSubtotalesLista');

    if (elMetricItems) elMetricItems.innerText = `${listaItems.length} ${listaItems.length === 1 ? 'ítem' : 'ítems'}`;
    if (elMetricDesglose) elMetricDesglose.innerText = desglose || 'Sin carga';
    if (elBadge) elBadge.innerText = listaItems.length;
    if (wrapFiltro) wrapFiltro.classList.toggle('oculto', listaItems.length < 5);

    if (strip) {
        strip.classList.toggle('oculto', listaItems.length === 0);
        document.getElementById('stripTotalLineas').innerText = `Total: ${listaItems.length} ${listaItems.length === 1 ? 'material' : 'materiales'}`;
        document.getElementById('stripTotalUnidades').innerText = desglose;
    }

    const filtroEl = document.getElementById('filtroListaCargada');
    const filtroTexto = filtroEl && !wrapFiltro.classList.contains('oculto') ? normalizarTexto(filtroEl.value) : '';

    const itemsFiltrados = filtroTexto
        ? listaItems.filter(i => normalizarTexto(`${i.material} ${i.nota}`).includes(filtroTexto))
        : listaItems;

    if (itemsFiltrados.length === 0) {
        tbody.innerHTML = `<p style="text-align:center; color: var(--ngc-text-faded); font-size: 0.85rem; padding: 15px 0;">
            ${listaItems.length === 0 ? 'Todavía no agregaste materiales a esta lista.' : 'Ningún material coincide con el filtro.'}
        </p>`;
    } else {
        itemsFiltrados.forEach(i => {
            const div = document.createElement('div');
            div.className = 'modal-list-item';
            div.style.cssText = 'border-left: 4px solid var(--ngc-neon); border-radius: 8px; flex-direction: column; align-items: stretch; gap: 8px;';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="line-height: 1.3; word-break: break-word;">${escapeHTML(i.material)}</h4>
                        <small style="display: block; margin-top: 2px;">${i.nota ? escapeHTML(i.nota) : 'Sin nota'}</small>
                    </div>
                    <div style="font-weight: 800; color: var(--ngc-neon); text-align: right; font-size: 1.05rem; flex-shrink: 0;">
                        ${escapeHTML(i.cantidad)} <span style="font-size: 0.72rem; font-weight: 700;">${escapeHTML(i.unidad)}</span>
                    </div>
                </div>
                <div class="pres-item-actions-bar" style="margin-top: 2px; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px;">
                        <button type="button" class="pres-mini-act" onclick="ajustarCantidadItem(${i.id}, -1)" title="Restar 1"><i class="fa-solid fa-minus"></i></button>
                        <button type="button" class="pres-mini-act" onclick="ajustarCantidadItem(${i.id}, 1)" title="Sumar 1"><i class="fa-solid fa-plus"></i></button>
                        <button type="button" class="pres-mini-act" onclick="abrirModalEditarItem(${i.id})"><i class="fa-solid fa-pen"></i> Editar</button>
                        <button type="button" class="pres-mini-act" onclick="duplicarItem(${i.id})" title="Duplicar ítem"><i class="fa-solid fa-copy"></i></button>
                    </div>
                    <button type="button" class="pres-mini-act" style="color: var(--error-red); border-color: rgba(228, 30, 63, 0.35);" onclick="borrarItem(${i.id})" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;
            tbody.appendChild(div);
        });
    }

    sincronizarVistaPreviaPDF();
}

// ==========================================
// MENÚ ACCIONES AGRUPADAS
// ==========================================
function toggleAccionesMenu() {
    document.getElementById('contenedorAcciones').classList.toggle('oculto');
}

// ==========================================
// WHATSAPP
// ==========================================
function prepararEnvioWhatsApp() {
    if (listaItems.length === 0) return mostrarAlertaCorp("Atención", "Agregá materiales primero.");

    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL';
    const proy = document.getElementById('cliProyecto').value.trim();
    const cli = document.getElementById('cliNombre').value.trim();

    let msg = `*${profNombre.toUpperCase()} - LISTA DE MATERIALES*\n`;
    if (cli) msg += `Cliente: ${cli}\n`;
    if (proy) msg += `Proyecto: ${proy}\n`;
    msg += `\n`;

    listaItems.forEach(i => {
        msg += `• ${i.cantidad} ${i.unidad} | ${i.material}${i.nota ? ' (' + i.nota + ')' : ''}\n`;
    });

    const og = document.getElementById('obsGenerales').value.trim();
    if (og) msg += `\n*Notas:* ${og}`;

    const uid = obtenerUid();

    if (uid && db && cli) {
        db.collection("perfiles").doc(uid).collection("contactos").where("nombre", "==", cli).get().then(snap => {
            let tel = null;
            if (!snap.empty) {
                const data = snap.docs[0].data();
                tel = data.tel || data.telefono;
            }
            abrirModalWspGlobal(tel, msg);
        }).catch(() => abrirModalWspGlobal(null, msg));
    } else {
        abrirModalWspGlobal(null, msg);
    }
      }

// ==========================================
// SINCRONIZACIÓN PDF Y VISTA PREVIA
// ==========================================
function actualizarPDFHeaders() {
    const profNombre = (localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL INDEPENDIENTE').trim();
    const profTel = (localStorage.getItem('villaser_conf_telefono') || '').trim();
    const profSlogan = (localStorage.getItem('villaser_conf_slogan') || '').trim();
    const profLogo = localStorage.getItem('villaser_conf_logo') || '';
    const profCuit = (localStorage.getItem('villaser_conf_cuit') || '').trim();
    const profMatricula = (localStorage.getItem('villaser_conf_matricula') || '').trim();

    let profEmail = (localStorage.getItem('villaser_conf_email') || '').trim();
    if (!profEmail && typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        profEmail = firebase.auth().currentUser.email || '';
    }

    const imgPdf = document.getElementById('pdf-img-logo');
    const txtPdf = document.getElementById('pdf-text-logo');
    const elProfNombre = document.getElementById('pdf-prof-nombre');

    if (imgPdf && txtPdf) {
        if (profLogo && profLogo.startsWith('data:image')) {
            imgPdf.src = profLogo;
            imgPdf.style.display = 'block';
            txtPdf.style.display = 'none';
            if (elProfNombre) {
                elProfNombre.innerText = profNombre;
                elProfNombre.style.display = 'block';
            }
        } else {
            imgPdf.style.display = 'none';
            txtPdf.innerText = profNombre.toUpperCase();
            txtPdf.style.display = 'block';
            if (elProfNombre) elProfNombre.style.display = 'none';
        }
    }

    const elSlogan = document.getElementById('pdf-slogan');
    if (elSlogan) {
        if (profSlogan) {
            elSlogan.innerText = profSlogan;
            elSlogan.style.display = 'block';
        } else {
            elSlogan.style.display = 'none';
        }
    }

    const lineaRegistro = [
        profMatricula ? `Mat.: ${profMatricula}` : '',
        profCuit ? `CUIT: ${profCuit}` : ''
    ].filter(Boolean).join(' | ');

    const lineaContacto = [
        profTel ? `Tel: ${profTel}` : '',
        profEmail ? `Email: ${profEmail}` : ''
    ].filter(Boolean).join(' | ');

    const elHeaderContacto = document.getElementById('pdf-header-contacto');
    if (elHeaderContacto) {
        elHeaderContacto.innerHTML = [escapeHTML(lineaRegistro), escapeHTML(lineaContacto)].filter(Boolean).join('<br>');
    }

    const elFooterBrand = document.getElementById('pdf-footer-brand');
    if (elFooterBrand) elFooterBrand.innerText = profNombre;
}

function sincronizarVistaPreviaPDF() {
    actualizarPDFHeaders();

    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');
    document.getElementById('pdf-cliente').innerText = document.getElementById('cliNombre').value.trim() || 'Sin nombre';

    const dir = document.getElementById('cliDireccion').value.trim();
    const rowDir = document.getElementById('pdf-row-direccion');
    if (rowDir) rowDir.style.display = dir ? '' : 'none';
    document.getElementById('pdf-direccion').innerText = dir;

    const proy = document.getElementById('cliProyecto').value.trim();
    const rowProy = document.getElementById('pdf-row-proyecto');
    if (rowProy) rowProy.style.display = proy ? '' : 'none';
    document.getElementById('pdf-proyecto').innerText = proy;

    const tbody = document.getElementById('pdf-tbody');
    tbody.innerHTML = '';

    listaItems.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600; color: #0f172a;">${escapeHTML(i.material)}</td>
            <td style="color: #475569;">${escapeHTML(i.nota)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHTML(i.cantidad)}</td>
            <td style="text-align: center; font-size: 11px; font-weight: 600;">${escapeHTML(i.unidad)}</td>`;
        tbody.appendChild(tr);
    });

    const elFooterResumen = document.getElementById('pdf-footer-resumen');
    if (elFooterResumen) {
        const desglose = calcularResumenUnidades();
        elFooterResumen.innerText = desglose
            ? `Total: ${listaItems.length} ítems (${desglose})`
            : 'Listado sujeto a verificación en obra';
    }

    const notas = document.getElementById('obsGenerales').value.trim();
    const notasBox = document.getElementById('pdf-notas-box');
    if (notasBox) notasBox.style.display = notas ? 'block' : 'none';
    document.getElementById('pdf-notas').innerText = notas;
}

// ==========================================
// VISTA PREVIA MÓVIL Y ZOOM TÁCTIL
// ==========================================
let escalaBasePreview = 1;
let escalaActualPreview = 1;
let anchoRealA4 = 800;
let altoRealA4 = 1122;
let zoomPreviewInicializado = false;

function aplicarEscalaVistaPrevia(nuevaEscala) {
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla ? plantilla.querySelector('.pdf-container') : null;
    if (!plantilla || !pdfContainer) return;

    escalaActualPreview = Math.max(escalaBasePreview, Math.min(2.5, nuevaEscala));
    pdfContainer.style.transformOrigin = 'top left';
    pdfContainer.style.transform = `scale(${escalaActualPreview})`;
    plantilla.style.width = `${anchoRealA4 * escalaActualPreview}px`;
    plantilla.style.height = `${altoRealA4 * escalaActualPreview}px`;
}

function inicializarZoomVistaPrevia() {
    if (zoomPreviewInicializado) return;
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');
    if (!contenedor) return;

    let distInicial = 0;
    let escalaInicialPellizco = 1;

    contenedor.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            distInicial = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            escalaInicialPellizco = escalaActualPreview;
        }
    }, { passive: true });

    contenedor.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && distInicial > 0) {
            e.preventDefault();
            const rect = contenedor.getBoundingClientRect();
            const centroX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centroY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const puntoX = centroX - rect.left + contenedor.scrollLeft;
            const puntoY = centroY - rect.top + contenedor.scrollTop;
            const escalaPrevia = escalaActualPreview;

            const distActual = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            aplicarEscalaVistaPrevia(escalaInicialPellizco * (distActual / distInicial));

            const factorCambio = escalaActualPreview / escalaPrevia;
            contenedor.scrollLeft = (puntoX * factorCambio) - (centroX - rect.left);
            contenedor.scrollTop = (puntoY * factorCambio) - (centroY - rect.top);
        }
    }, { passive: false });

    contenedor.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            distInicial = 0;
        }
    }, { passive: true });

    zoomPreviewInicializado = true;
}

function abrirVistaPreviaMobile() {
    if (listaItems.length === 0) {
        mostrarAlertaCorp("Faltan Datos", "Agregá materiales para ver la vista previa.");
        return;
    }
    sincronizarVistaPreviaPDF();

    const modal = document.getElementById('modalVistaPrevia');
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla.querySelector('.pdf-container');

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    plantilla.style.display = 'inline-block';
    plantilla.style.textAlign = 'left';
    plantilla.style.position = 'relative';
    plantilla.style.overflow = 'hidden';
    plantilla.style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
    contenedor.appendChild(plantilla);

    if (pdfContainer) {
        pdfContainer.style.transform = 'none';
        anchoRealA4 = pdfContainer.offsetWidth || 800;
        altoRealA4 = pdfContainer.offsetHeight || 1122;
    }

    const anchoDisponible = Math.max(280, contenedor.clientWidth - 30);
    escalaBasePreview = Math.min(1, anchoDisponible / anchoRealA4);
    aplicarEscalaVistaPrevia(escalaBasePreview);

    contenedor.scrollTop = 0;
    contenedor.scrollLeft = 0;
    inicializarZoomVistaPrevia();
}

function cerrarVistaPrevia() {
    const plantilla = document.getElementById('plantilla-pdf');
    const pdfContainer = plantilla ? plantilla.querySelector('.pdf-container') : null;
    const aside = document.querySelector('.preview-panel');

    if (pdfContainer) {
        pdfContainer.style.transform = '';
        pdfContainer.style.transformOrigin = '';
    }

    plantilla.style.width = '';
    plantilla.style.height = '';
    plantilla.style.display = '';
    plantilla.style.textAlign = '';
    plantilla.style.position = '';
    plantilla.style.overflow = '';
    plantilla.style.boxShadow = '';

    if (aside) aside.appendChild(plantilla);

    document.getElementById('modalVistaPrevia').classList.add('oculto');
    document.body.style.overflow = '';
    }

// ==========================================
// GENERACIÓN DE PDF FINAL
// ==========================================
function generarPDF() {
    if (listaItems.length === 0) return mostrarAlertaCorp("Atención", "No hay materiales para generar el PDF.");
    sincronizarVistaPreviaPDF();

    const inputNombre = document.getElementById('cliNombre');
    const sugerido = inputNombre && inputNombre.value.trim()
        ? inputNombre.value.trim().replace(/\s+/g, '_')
        : 'Cliente';
    const uniqueSuffix = Math.floor(Math.random() * 9000) + 1000;

    document.getElementById('nombreArchivoPDF').value = `Materiales_${sugerido}_${uniqueSuffix}`;
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    if (permiteGuardarNube && clienteDesdeAgenda) guardarBorradorFirebase(false);

    const element = document.getElementById('plantilla-pdf');
    const selloAgua = document.getElementById('selloAguaPDF');
    if (selloAgua) selloAgua.style.display = 'none';

    element.style.display = 'block';
    window.scrollTo(0, 0);

    const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Materiales';

    const opt = {
        margin: 0,
        filename: `${nombreFinal}.pdf`,
        image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    try {
        await html2pdf().set(opt).from(element).save();
        cerrarModalPDF();
    } catch (e) {
        console.error(e);
        mostrarAlertaCorp("Error", "No se pudo generar el PDF.");
        btn.innerHTML = "Descargar";
    } finally {
        if (window.innerWidth < 992) {
            element.style.display = 'none';
        } else {
            element.style.display = '';
        }
        if (selloAgua) selloAgua.style.display = 'flex';
    }
}

// ==========================================
// MENÚ INFERIOR SCROLL (MATCH GLOBAL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;
    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '#', active: true },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
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
});
