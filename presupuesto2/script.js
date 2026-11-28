let db = null;
const SHEET_ID = '1tZbCYSBxx3suGLKmE_bXi_hEm0iH0yqQedqR7kdShEU';
const URL_PRECIOS = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Hoja1`; 
const CACHE_PRECIOS_KEY = 'villaser_cache_precios_v1';

let dbPrecios = [];
let listaItems = [];
let notasOriginales = "";
let nroPresupuestoGlobal = `PEM-${Math.floor(Math.random() * 9000) + 1000}`;

let conceptoEditado = null;
let precioEditado = null;
let tipoEdicionActual = null;
let totalMontoActual = 0; 
let nombreBorradorActual = null;
let telefonoClienteActual = "";
let timerAutoSyncNube = null;

let formaPago = {
    efectivo: false,
    credito: false,
    cuotas: '',
    transferencia: false,
    aliasCbu: '',
    aclaracion: ''
};

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let uidSeguro = null;

const selTema = document.getElementById('selTema');
const selConcepto = document.getElementById('selConcepto');
const btnSelectTema = document.getElementById('btnSelectTema');
const sumTema = document.getElementById('sumTema');
const btnSelectConcepto = document.getElementById('btnSelectConcepto');
const sumConcepto = document.getElementById('sumConcepto');
const inputCliNombre = document.getElementById('cliNombre');


// ==========================================
// UTILIDADES DE FORMATO Y NORMALIZACIÓN
// ==========================================
function redondearMoneda(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

function normalizarTextoBusqueda(txt) {
    return String(txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escapaAtributoJS(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escaparHTML(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function calcularFechaVencimientoStr(diasRaw) {
    const dias = Math.max(1, parseInt(diasRaw) || 15);
    const fechaVenc = new Date();
    fechaVenc.setDate(fechaVenc.getDate() + dias);
    return `${String(fechaVenc.getDate()).padStart(2, '0')}/${String(fechaVenc.getMonth() + 1).padStart(2, '0')}/${fechaVenc.getFullYear()}`;
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
function arrancarModulo() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => { if (user) uidSeguro = user.uid; });
            }
        }
    } catch (e) { console.warn("Firebase no inició, modo local.", e); }

    try { inicializarClienteMemoria(); } 
    catch (e) { localStorage.removeItem('presupuesto_estado_actual'); }

    fetchData();
    generarMenuInferior(); 
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', arrancarModulo); } 
else { arrancarModulo(); }

function obtenerUid() {
    if (uidSeguro) return uidSeguro;
    if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) { return firebase.auth().currentUser.uid; }
    if (typeof currentUserUid !== 'undefined' && currentUserUid) return currentUserUid;
    return null;
}

// ==========================================
// DESCARGA GOOGLE SHEETS CON RESPALDO OFFLINE
// ==========================================
async function fetchData() {
    try {
        const resPre = await fetch(URL_PRECIOS);
        const txtPre = await resPre.text();
        const jPre = JSON.parse(txtPre.substring(txtPre.indexOf("{"), txtPre.lastIndexOf("}") + 1));
        
        dbPrecios = jPre.table.rows.filter(r => r.c[1] && r.c[1].v !== "Concepto").map(r => {
            const valMinutos = r.c[4]?.v;
            const minutosParsed = (valMinutos !== undefined && valMinutos !== null && String(valMinutos).trim() !== '' && !isNaN(Number(valMinutos)))
                ? Number(valMinutos)
                : 30;
            return { 
                tema: r.c[0]?.v || 'Gral', 
                concepto: r.c[1]?.v || '', 
                precio: typeof r.c[2]?.v === 'number' ? r.c[2].v : 0, 
                notas: r.c[3]?.v || '',
                minutos: minutosParsed
            };
        });

        try {
            localStorage.setItem(CACHE_PRECIOS_KEY, JSON.stringify({
                fecha: Date.now(),
                datos: dbPrecios
            }));
        } catch (errCache) { console.warn("No se pudo cachear precios:", errCache); }
        
        finalizarCargaInicial();
    } catch (e) { 
        console.warn("Error de red al obtener Google Sheets, intentando caché local...", e);
        const cacheStr = localStorage.getItem(CACHE_PRECIOS_KEY);
        if (cacheStr) {
            try {
                const cache = JSON.parse(cacheStr);
                if (Array.isArray(cache.datos) && cache.datos.length > 0) {
                    dbPrecios = cache.datos;
                    finalizarCargaInicial();
                    const fechaCache = cache.fecha ? new Date(cache.fecha).toLocaleDateString('es-AR') : 'guardada';
                    mostrarToast("Modo Sin Conexión", `Usando lista de precios local (${fechaCache}).`);
                    return;
                }
            } catch (errParse) { /* continúa al mensaje de error */ }
        }

        document.getElementById('loading').innerHTML = `⚠️ Error de conexión a la base de datos y sin caché offline disponible.<br><br><button class="corp-btn" onclick="location.reload()">Reintentar</button>`;
    }
}

function finalizarCargaInicial() {
    poblarTemas();
    setupEventListeners();
    actualizarSubtotalItemActual();
    
    document.getElementById('loading').classList.add('oculto'); 
    document.getElementById('app').classList.remove('oculto');

    if (listaItems.length > 0) avanzarPasoTrabajo();
}

// ==========================================
// MODALES DE ALERTA Y CONFIRMACIÓN
// ==========================================
function mostrarAlertaCorp(titulo, mensaje) {
    document.getElementById('modalAlertaTitulo').innerText = titulo;
    document.getElementById('modalAlertaMensaje').innerText = mensaje;
    document.getElementById('modalAlertaCorp').classList.remove('oculto');
}

function cerrarModalAlertaCorp() {
    document.getElementById('modalAlertaCorp').classList.add('oculto');
}

function seleccionarContacto(nombre, dir, tel = "") {
    inputCliNombre.value = nombre; 
    document.getElementById('cliDireccion').value = dir;
    telefonoClienteActual = tel; 
    clienteDesdeAgenda = true; 
    permiteGuardarNube = true; 
    guardarClienteGlobal();
    cerrarModalAgendaGlobal(); 
    mostrarToast("Cliente Seleccionado", "Importado de agenda.");

    if (!document.getElementById('step-trabajo').classList.contains('oculto')) {
        renderTabla();
    }
}

function actualizarIndicadorEstadoNube(estadoTexto = null, sincronizando = false) {
    const badge = document.getElementById('badgeEstadoNube');
    if (!badge) return;

    if (!permiteGuardarNube) {
        badge.className = 'pres-cloud-pill local';
        badge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> Local`;
        return;
    }

    if (sincronizando) {
        badge.className = 'pres-cloud-pill syncing';
        badge.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sincronizando...`;
        return;
    }

    if (nombreBorradorActual) {
        badge.className = 'pres-cloud-pill synced';
        badge.innerHTML = `<i class="fa-solid fa-cloud-check"></i> ${estadoTexto || 'Nube activa'}`;
    } else {
        badge.className = 'pres-cloud-pill ready';
        badge.innerHTML = `<i class="fa-solid fa-cloud"></i> Listo nube`;
    }
}

function programarAutoguardadoNube() {
    if (!permiteGuardarNube || !nombreBorradorActual) return;
    actualizarIndicadorEstadoNube(null, true);
    clearTimeout(timerAutoSyncNube);
    timerAutoSyncNube = setTimeout(() => {
        guardarBorradorFirebase(false, true);
    }, 2200);
}

function guardarEstadoLocal(dispararSyncNube = true) {
    localStorage.setItem('presupuesto_estado_actual', JSON.stringify({ 
        cliNombre: inputCliNombre.value, 
        cliDireccion: document.getElementById('cliDireccion').value, 
        cliProyecto: document.getElementById('cliProyecto').value, 
        obsGenerales: document.getElementById('obsGenerales').value, 
        diasValidez: document.getElementById('diasValidez').value,
        formaPago: formaPago,
        items: listaItems, nro: nroPresupuestoGlobal, clienteDesdeAgenda: clienteDesdeAgenda, 
        permiteGuardarNube: permiteGuardarNube, nombreBorradorActual: nombreBorradorActual,
        telefonoClienteActual: telefonoClienteActual
    }));
    actualizarIndicadorEstadoNube();
    if (dispararSyncNube) programarAutoguardadoNube();
}

function cargarEstadoGuardado() {
    const str = localStorage.getItem('presupuesto_estado_actual');
    if (str) {
        const est = JSON.parse(str);
        if (est.cliNombre) inputCliNombre.value = est.cliNombre;
        if (est.cliDireccion) document.getElementById('cliDireccion').value = est.cliDireccion;
        if (est.cliProyecto) document.getElementById('cliProyecto').value = est.cliProyecto;
        if (est.obsGenerales) document.getElementById('obsGenerales').value = est.obsGenerales;
        if (est.diasValidez) document.getElementById('diasValidez').value = est.diasValidez;
        if (est.formaPago) {
            formaPago = {
                efectivo: !!est.formaPago.efectivo,
                credito: !!est.formaPago.credito,
                cuotas: est.formaPago.cuotas || '',
                transferencia: !!est.formaPago.transferencia,
                aliasCbu: est.formaPago.aliasCbu || '',
                aclaracion: est.formaPago.aclaracion || ''
            };
        }
        actualizarLabelResumenPago();
        listaItems = est.items || [];
        if (est.nro) nroPresupuestoGlobal = est.nro;
        if (est.clienteDesdeAgenda !== undefined) clienteDesdeAgenda = est.clienteDesdeAgenda;
        if (est.permiteGuardarNube !== undefined) permiteGuardarNube = est.permiteGuardarNube;
        if (est.nombreBorradorActual !== undefined) nombreBorradorActual = est.nombreBorradorActual;
        if (est.telefonoClienteActual !== undefined) telefonoClienteActual = est.telefonoClienteActual;
    }
    actualizarIndicadorEstadoNube();
}

// ==========================================
// DOCK FLOTANTE Y CAJÓN FULLSCREEN DE LISTA
// ==========================================
function abrirModalListaPresupuesto(irAExportar = false) {
    renderTabla();
    const modal = document.getElementById('modalListaPresupuesto');
    if (!modal) return;
    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    const bodyDrawer = document.getElementById('drawerPresupuestoBody');
    if (bodyDrawer) {
        requestAnimationFrame(() => {
            if (irAExportar) {
                bodyDrawer.scrollTo({ top: bodyDrawer.scrollHeight, behavior: 'smooth' });
            } else {
                bodyDrawer.scrollTop = 0;
            }
        });
    }
}

function cerrarModalListaPresupuesto() {
    const modal = document.getElementById('modalListaPresupuesto');
    if (modal) modal.classList.add('oculto');
    document.body.style.overflow = '';
}

function ajustarCantidadUltimoItem(delta) {
    if (listaItems.length === 0) return;
    const ultimo = listaItems[listaItems.length - 1];
    const nuevaQty = Math.max(1, (parseInt(ultimo.qty) || 1) + delta);
    if (nuevaQty === ultimo.qty) return;

    ultimo.qty = nuevaQty;
    ultimo.total = redondearMoneda((ultimo.unitario * ultimo.qty) * (1 - (ultimo.desc || 0) / 100));

    guardarEstadoLocal();
    renderTabla();
}

function filtrarItemsCargadosDrawer() {
    const q = normalizarTextoBusqueda(document.getElementById('filtroItemsDrawer')?.value);
    const filas = document.querySelectorAll('#cuerpoTabla tr.pres-item-row');
    filas.forEach(tr => {
        const texto = normalizarTextoBusqueda(tr.dataset.search || tr.innerText);
        tr.style.display = (!q || texto.includes(q)) ? '' : 'none';
    });
}

function actualizarCabeceraClientePaso2() {
    const nombreEl = document.getElementById('stepClienteHeaderNombre');
    const proyEl = document.getElementById('stepClienteHeaderProy');
    if (!nombreEl || !proyEl) return;

    const cli = inputCliNombre.value.trim() || 'Sin Nombre';
    const proy = document.getElementById('cliProyecto').value.trim();
    const dir = document.getElementById('cliDireccion').value.trim();

    nombreEl.innerText = cli;
    const subPartes = [];
    if (proy) subPartes.push(proy);
    if (dir) subPartes.push(dir);
    subPartes.push(nroPresupuestoGlobal);
    proyEl.innerText = subPartes.join(' • ');
}

function actualizarDockFlotante(total, tiempoFormateado, pulsar = false) {
    const dock = document.getElementById('dockPresupuestoFlotante');
    const stepTrabajo = document.getElementById('step-trabajo');
    if (!dock || !stepTrabajo) return;

    const enPasoTrabajo = !stepTrabajo.classList.contains('oculto');
    dock.classList.toggle('oculto', !enPasoTrabajo);
    if (!enPasoTrabajo) return;

    const badgeCant = document.getElementById('dockContadorBadge');
    const badgeTiempo = document.getElementById('dockTiempoBadge');
    const totalEl = document.getElementById('dockTotalMonto');
    const lastStrip = document.getElementById('dockUltimoItemStrip');
    const lastTxt = document.getElementById('dockUltimoItemTexto');
    const lastCant = document.getElementById('dockUltimoItemCant');

    if (badgeCant) badgeCant.innerText = listaItems.length;
    if (badgeTiempo) badgeTiempo.innerText = `${tiempoFormateado} est.`;
    if (totalEl) totalEl.innerText = `$ ${total.toLocaleString('es-AR')}`;

    if (lastStrip && lastTxt && lastCant) {
        if (listaItems.length > 0) {
            const ultimo = listaItems[listaItems.length - 1];
            lastTxt.innerText = `${ultimo.concepto} ($${ultimo.total.toLocaleString('es-AR')})`;
            lastCant.innerText = `x${ultimo.qty}`;
            lastStrip.classList.remove('oculto');
        } else {
            lastStrip.classList.add('oculto');
        }
    }

    if (pulsar) {
        const btnLista = document.getElementById('btnDockVerLista');
        if (btnLista) {
            btnLista.classList.remove('pres-dock-pulse');
            void btnLista.offsetWidth;
            btnLista.classList.add('pres-dock-pulse');
        }
    }
}

// ==========================================
// MODAL FORMA DE PAGO
// ==========================================
function abrirModalFormaPago() {
    document.getElementById('chkPagoEfectivo').checked = !!formaPago.efectivo;
    document.getElementById('chkPagoCredito').checked = !!formaPago.credito;
    document.getElementById('inputCuotasCredito').value = formaPago.cuotas || '';
    document.getElementById('chkPagoTransferencia').checked = !!formaPago.transferencia;
    document.getElementById('inputAliasCbu').value = formaPago.aliasCbu || '';
    document.getElementById('inputAclaracionPago').value = formaPago.aclaracion || '';

    toggleCamposFormaPago();
    document.getElementById('modalFormaPago').classList.remove('oculto');
}

function cerrarModalFormaPago() {
    document.getElementById('modalFormaPago').classList.add('oculto');
}

function toggleCamposFormaPago() {
    const esCredito = document.getElementById('chkPagoCredito').checked;
    const esTransf = document.getElementById('chkPagoTransferencia').checked;

    document.getElementById('boxCuotasCredito').classList.toggle('oculto', !esCredito);
    document.getElementById('boxAliasTransferencia').classList.toggle('oculto', !esTransf);
}

function guardarModalFormaPago() {
    formaPago = {
        efectivo: document.getElementById('chkPagoEfectivo').checked,
        credito: document.getElementById('chkPagoCredito').checked,
        cuotas: document.getElementById('chkPagoCredito').checked ? document.getElementById('inputCuotasCredito').value.trim() : '',
        transferencia: document.getElementById('chkPagoTransferencia').checked,
        aliasCbu: document.getElementById('chkPagoTransferencia').checked ? document.getElementById('inputAliasCbu').value.trim() : '',
        aclaracion: document.getElementById('inputAclaracionPago').value.trim()
    };

    actualizarLabelResumenPago();
    guardarEstadoLocal();
    sincronizarVistaPreviaPDF();
    cerrarModalFormaPago();
}

function actualizarLabelResumenPago() {
    const lbl = document.getElementById('labelResumenPago');
    if (!lbl) return;

    const seleccionados = [];
    if (formaPago.efectivo) seleccionados.push('Efectivo');
    if (formaPago.credito) seleccionados.push('Crédito');
    if (formaPago.transferencia) seleccionados.push('Transf.');

    if (seleccionados.length > 0) {
        lbl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--ngc-neon);"></i> ${seleccionados.join(', ')}`;
    } else if (formaPago.aclaracion) {
        lbl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--ngc-neon);"></i> Configurado`;
    } else {
        lbl.innerHTML = `<i class="fa-solid fa-credit-card"></i> Seleccionar`;
    }
}

// ==========================================
// INTEGRACIÓN AGENDA, FLUJO Y EDICIÓN CLIENTE PASO 2
// ==========================================
function iniciarPresupuesto() {
    const nombre = inputCliNombre.value.trim();
    if(!nombre) { 
        mostrarAlertaCorp("Datos incompletos", "Por favor, ingresá al menos el Nombre del Cliente."); 
        return; 
    }
    if (!clienteDesdeAgenda) { 
        document.getElementById('modalAgendarCliente').classList.remove('oculto'); 
        return; 
    }
    avanzarPasoTrabajo();
}

function accionAgendarCliente() {
    const nombre = encodeURIComponent(inputCliNombre.value.trim());
    const dir = encodeURIComponent(document.getElementById('cliDireccion').value.trim());
    window.location.href = `../agenda/index.html?nombre=${nombre}&dir=${dir}`;
}

function opcionBuscarAgenda() { 
    document.getElementById('modalAgendarCliente').classList.add('oculto'); 
    abrirModalAgendaGlobal(); 
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

function avanzarPasoTrabajo() {
    document.getElementById('step-cliente').classList.add('oculto');
    document.getElementById('step-trabajo').classList.remove('oculto');
    document.getElementById('step-trabajo').classList.add('flex-column', 'gap-15');
    guardarClienteGlobal(); 
    renderTabla();
}

function abrirModalEditarCliente() {
    document.getElementById('editCliNombre').value = inputCliNombre.value;
    document.getElementById('editCliDireccion').value = document.getElementById('cliDireccion').value;
    document.getElementById('editCliProyecto').value = document.getElementById('cliProyecto').value;

    const badge = document.getElementById('editCliEstadoAgendaBadge');
    if (clienteDesdeAgenda && permiteGuardarNube) {
        badge.className = 'pres-cloud-pill synced';
        badge.innerHTML = '<i class="fa-solid fa-address-book"></i> Cliente vinculado a Agenda (Nube activa)';
    } else {
        badge.className = 'pres-cloud-pill local';
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Cliente local no agendado';
    }

    document.getElementById('modalEditarClientePaso2').classList.remove('oculto');
}

function cerrarModalEditarCliente() {
    document.getElementById('modalEditarClientePaso2').classList.add('oculto');
}

function vincularDesdeAgendaEnPaso2() {
    cerrarModalEditarCliente();
    abrirModalAgendaGlobal();
}

function guardarEdicionClientePaso2() {
    const nuevoNombre = document.getElementById('editCliNombre').value.trim();
    if (!nuevoNombre) {
        mostrarAlertaCorp("Datos incompletos", "El nombre del cliente no puede quedar vacío.");
        return;
    }

    const nombreAnterior = inputCliNombre.value.trim();
    if (nombreAnterior !== nuevoNombre) {
        clienteDesdeAgenda = false;
        permiteGuardarNube = false;
        nombreBorradorActual = null;
        telefonoClienteActual = "";
    }

    inputCliNombre.value = nuevoNombre;
    document.getElementById('cliDireccion').value = document.getElementById('editCliDireccion').value.trim();
    document.getElementById('cliProyecto').value = document.getElementById('editCliProyecto').value.trim();

    guardarClienteGlobal();
    renderTabla();
    cerrarModalEditarCliente();
    mostrarToast("Datos Actualizados", "Se actualizó la cabecera del presupuesto.");
}

// ==========================================
// BORRADORES NUBE
// ==========================================
function guardarBorradorFirebase(mostrarAlerta = false, autoGuardado = false) {
    const uid = obtenerUid();
    if (!uid || !db) {
        if (mostrarAlerta) mostrarAlertaCorp("Error de Sesión", "No se detectó sesión activa para la nube.");
        return;
    }
    if (!permiteGuardarNube) {
        if (mostrarAlerta) mostrarAlertaCorp("Acción Bloqueada", "Este presupuesto pertenece a un cliente no agendado. Vinculalo desde 'Cliente' para habilitar la nube.");
        return;
    }
    if (listaItems.length === 0 && !inputCliNombre.value) return;

    const nombreCli = (inputCliNombre.value.trim() || 'Sin_Nombre').replace(/\s+/g, '_');
    const proyCli = (document.getElementById('cliProyecto').value.trim() || 'Presupuesto').replace(/\s+/g, '_');
    const fechaHoy = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    let nombreSugerido = `${nombreCli}_${proyCli}_${fechaHoy}`;

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
    if (!uid || !db) return;

    actualizarIndicadorEstadoNube(null, true);
    const estado = { 
        cliNombre: inputCliNombre.value, 
        cliDireccion: document.getElementById('cliDireccion').value, 
        cliProyecto: document.getElementById('cliProyecto').value, 
        obsGenerales: document.getElementById('obsGenerales').value, 
        diasValidez: document.getElementById('diasValidez').value,
        formaPago: formaPago,
        items: listaItems, 
        nro: nroPresupuestoGlobal, 
        totalMonto: totalMontoActual, 
        fechaGuardado: Date.now(), 
        nombreBorrador: nombreFinal,
        telefonoClienteActual: telefonoClienteActual 
    };
    
    let docId = nombreFinal.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    db.collection("perfiles").doc(uid).collection("presupuestos").doc(docId).set(estado)
      .then(() => { 
          guardarEstadoLocal(false);
          actualizarIndicadorEstadoNube('Nube OK', false);
          if (mostrarAlerta) mostrarToast("Borrador Guardado", "Sincronizado con tu cuenta."); 
      })
      .catch((e) => {
          console.error("Error guardando en la nube: ", e);
          actualizarIndicadorEstadoNube('Error nube', false);
      });
}

function abrirModalBorradores() {
    const uid = obtenerUid();
    if (!uid || !db) return;
    const nombre = inputCliNombre.value.trim();
    if (!nombre) { 
        mostrarAlertaCorp("Falta Cliente", "Ingresá el Nombre del Cliente primero para buscar sus borradores."); 
        return; 
    }

    document.getElementById('modalBorradores').classList.remove('oculto');
    const cont = document.getElementById('listaBorradores'); 
    cont.innerHTML = `<div style="text-align:center; padding: 15px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando...</div>`;
    
    db.collection("perfiles").doc(uid).collection("presupuestos").where("cliNombre", "==", nombre).get().then((snapshot) => {
          cont.innerHTML = '';
          if (snapshot.empty) { cont.innerHTML = `<p style="text-align:center; color: var(--ngc-text-faded);">No hay borradores en nube para este cliente.</p>`; return; }
          let borradores = []; snapshot.forEach((doc) => borradores.push({ id: doc.id, data: doc.data() }));
          borradores.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));
          
          borradores.forEach((b) => {
              const f = b.data.fechaGuardado ? new Date(b.data.fechaGuardado).toLocaleDateString('es-AR') : '';
              const nombreBor = escaparHTML(b.data.nombreBorrador || b.data.cliNombre);
              const div = document.createElement('div'); 
              div.className = "modal-list-item"; 
              div.style.borderLeft = "3px solid var(--ngc-neon)";
              
              div.innerHTML = `
                  <div style="flex: 1; min-width: 0; padding-right: 10px;">
                      <h4 style="word-break: break-word; line-height: 1.2; margin-bottom: 5px;">${nombreBor}</h4>
                      <small style="color: var(--ngc-text-faded);">$${(b.data.totalMonto || 0).toLocaleString('es-AR')} | ${f}</small>
                  </div>
                  <div style="display:flex; gap:5px; flex-shrink: 0;">
                      <button class="corp-btn-small" onclick="cargarBorradorNube('${escapaAtributoJS(b.id)}')">Abrir</button>
                      <button class="corp-btn-small danger" onclick="eliminarBorradorNube('${escapaAtributoJS(b.id)}', this)"><i class="fa-solid fa-trash"></i></button>
                  </div>`;
              cont.appendChild(div);
          });
      });
}

function cargarBorradorNube(docId) {
    const uid = obtenerUid(); if (!uid || !db) return;
    db.collection("perfiles").doc(uid).collection("presupuestos").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data(); 
            data.clienteDesdeAgenda = true; 
            data.permiteGuardarNube = true;
            nombreBorradorActual = data.nombreBorrador || docId; 
            
            if (data.telefonoClienteActual !== undefined) {
                telefonoClienteActual = data.telefonoClienteActual;
            }
            
            localStorage.setItem('presupuesto_estado_actual', JSON.stringify(data));
            cargarEstadoGuardado(); 
            guardarClienteGlobal(); 
            avanzarPasoTrabajo(); 
            cerrarModalBorradoresGlobal();
            mostrarToast("Borrador Cargado", "Presupuesto restaurado desde la nube.");
        }
    });
}

let idBorradorAEliminar = null;
let btnBorradorAEliminar = null;

function eliminarBorradorNube(docId, btn) {
    idBorradorAEliminar = docId;
    btnBorradorAEliminar = btn;
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

    const btnConfirmar = document.querySelector('#modalConfirmarEliminar .danger-btn');
    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    db.collection("perfiles").doc(uid).collection("presupuestos").doc(idBorradorAEliminar).delete()
        .then(() => { 
            if (btnBorradorAEliminar) {
                btnBorradorAEliminar.closest('div.modal-list-item').remove(); 
            }
            cerrarModalEliminarBorrador();
            mostrarToast("Eliminado", "El borrador fue eliminado de la nube.");
        })
        .catch(() => { 
            mostrarAlertaCorp("Error", "No se pudo eliminar el borrador.");
            cerrarModalEliminarBorrador();
        })
        .finally(() => {
            btnConfirmar.innerHTML = textoOriginal;
        });
}

function inicializarClienteMemoria() { cargarEstadoGuardado(); }

function guardarClienteGlobal() {
    const obj = { 
        nombre: inputCliNombre.value.trim(), 
        direccion: document.getElementById('cliDireccion').value.trim(), 
        proyecto: document.getElementById('cliProyecto').value.trim() 
    };
    localStorage.setItem('villaser_cliente_global', JSON.stringify(obj)); 
    guardarEstadoLocal(); 
}

function ejecutarNuevoPresupuesto() {
    cerrarModalConfirmarNuevoGlobal(); 
    cerrarModalListaPresupuesto();
    clearTimeout(timerAutoSyncNube);
    
    inputCliNombre.value = ''; 
    document.getElementById('cliDireccion').value = ''; 
    document.getElementById('cliProyecto').value = ''; 
    document.getElementById('obsGenerales').value = '';
    
    formaPago = {
        efectivo: false,
        credito: false,
        cuotas: '',
        transferencia: false,
        aliasCbu: '',
        aclaracion: ''
    };
    actualizarLabelResumenPago();
    
    listaItems = []; 
    nroPresupuestoGlobal = `PEM-${Math.floor(Math.random() * 9000) + 1000}`;
    clienteDesdeAgenda = false; 
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = "";
    
    guardarEstadoLocal(false); 
    document.getElementById('step-trabajo').classList.add('oculto'); 
    document.getElementById('step-cliente').classList.remove('oculto');
    
    renderTabla();
}

function mostrarToast(titulo, mensaje) {
    document.getElementById('toastTitle').innerText = titulo; 
    document.getElementById('toastMessage').innerText = mensaje;
    const toast = document.getElementById('toastCliente'); 
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 100); 
    setTimeout(() => { 
        toast.classList.remove('mostrar'); 
        setTimeout(() => toast.classList.add('oculto'), 400); 
    }, 4000); 
}

function onCambioNotasGlobales() {
    guardarEstadoLocal();
    renderTabla();
}

// ==========================================
// CÁLCULOS, DESPLEGABLES CON BUSCADOR E ÍTEMS
// ==========================================
function normalizarInputsItem() {
    const qtyEl = document.getElementById('cantidad');
    const descEl = document.getElementById('porcentajeDesc');
    const minEl = document.getElementById('minutosTrabajo');

    if (qtyEl && qtyEl.value !== '') {
        qtyEl.value = Math.max(1, parseInt(qtyEl.value) || 1);
    }
    if (descEl && descEl.value !== '') {
        descEl.value = Math.min(100, Math.max(0, parseInt(descEl.value) || 0));
    }
    if (minEl && minEl.value !== '') {
        minEl.value = Math.max(0, parseInt(minEl.value) || 0);
    }
    actualizarSubtotalItemActual();
}

function step(id, val) { 
    const el = document.getElementById(id); 
    if(!el) return;
    const minVal = el.min !== '' ? parseInt(el.min) : 0;
    const maxVal = el.max !== '' ? parseInt(el.max) : Infinity;
    const nuevo = Math.min(maxVal, Math.max(minVal, (parseInt(el.value) || 0) + val));
    el.value = nuevo;
    actualizarSubtotalItemActual();
}

function actualizarSubtotalItemActual() {
    const lblPreview = document.getElementById('subtotalItemPreview');
    if (!lblPreview) return;

    const itemOriginal = dbPrecios.find(i => i.tema === selTema.value && i.concepto === selConcepto.value);
    const precioUnit = precioEditado !== null ? precioEditado : (itemOriginal ? itemOriginal.precio : 0);
    const qty = Math.max(1, parseInt(document.getElementById('cantidad')?.value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('porcentajeDesc')?.value) || 0));
    const subtotal = redondearMoneda((precioUnit * qty) * (1 - desc / 100));

    lblPreview.innerText = `Subtotal ítem: $ ${subtotal.toLocaleString('es-AR')}`;
}

let selectorTipoActual = null;
let opcionesSelectorCache = [];

function ajustarAlturaSelectorConTeclado() {
    const modal = document.getElementById('modalSelectorPresupuesto');
    const card = document.getElementById('cardSelectorPresupuesto');
    if (!modal || modal.classList.contains('oculto') || !card) return;

    const vvHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    card.style.maxHeight = `${Math.max(220, vvHeight - 24)}px`;
}

function abrirSelectorPresupuesto(tipo) {
    if (tipo === 'concepto' && (!selTema.value || btnSelectConcepto?.disabled)) {
        mostrarAlertaCorp("Seleccioná un Rubro", "Primero elegí un rubro de la lista.");
        return;
    }

    selectorTipoActual = tipo;
    const modal = document.getElementById('modalSelectorPresupuesto');
    const titulo = document.getElementById('tituloSelectorPresupuesto');
    const inputBuscador = document.getElementById('inputBuscadorSelector');
    if (!modal || !titulo || !inputBuscador) return;

    if (tipo === 'tema') {
        titulo.innerHTML = `<i class="fa-solid fa-layer-group" style="color: var(--ngc-neon);"></i> Seleccionar Rubro`;
        inputBuscador.placeholder = 'Buscar rubro...';
        const temasUnicos = [...new Set(dbPrecios.map(i => i.tema))].sort();
        opcionesSelectorCache = temasUnicos.map(t => ({
            valor: t,
            titulo: t,
            subtitulo: ''
        }));
    } else {
        titulo.innerHTML = `<i class="fa-solid fa-wrench" style="color: var(--ngc-neon);"></i> Seleccionar Trabajo`;
        inputBuscador.placeholder = 'Filtrar trabajo...';
        const conceptosFiltro = dbPrecios.filter(i => i.tema === selTema.value);
        opcionesSelectorCache = conceptosFiltro.map(i => ({
            valor: i.concepto,
            titulo: i.concepto,
            subtitulo: `$ ${i.precio.toLocaleString('es-AR')} • ${i.minutos} min`
        }));
    }

    inputBuscador.value = '';
    renderOpcionesSelector(opcionesSelectorCache);

    modal.classList.remove('oculto');
    ajustarAlturaSelectorConTeclado();

    setTimeout(() => {
        inputBuscador.focus();
        ajustarAlturaSelectorConTeclado();
    }, 60);
}

function cerrarSelectorPresupuesto() {
    const modal = document.getElementById('modalSelectorPresupuesto');
    if (modal) modal.classList.add('oculto');
    selectorTipoActual = null;
}

function filtrarOpcionesSelector() {
    const q = normalizarTextoBusqueda(document.getElementById('inputBuscadorSelector')?.value);
    const filtradas = !q
        ? opcionesSelectorCache
        : opcionesSelectorCache.filter(op =>
            normalizarTextoBusqueda(`${op.titulo} ${op.subtitulo}`).includes(q)
        );
    renderOpcionesSelector(filtradas);
}

function renderOpcionesSelector(lista) {
    const cont = document.getElementById('listaOpcionesSelector');
    if (!cont) return;
    cont.innerHTML = '';

    if (!lista || lista.length === 0) {
        cont.innerHTML = `<div style="padding: 18px; text-align: center; color: var(--ngc-text-faded);">Sin coincidencias...</div>`;
        return;
    }

    const valorSeleccionado = selectorTipoActual === 'tema' ? selTema.value : selConcepto.value;

    lista.forEach(op => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const esActual = valorSeleccionado === op.valor;
        btn.className = `pres-picker-item${esActual ? ' active' : ''}`;
        btn.innerHTML = op.subtitulo
            ? `<div style="font-weight: 600; color: var(--ngc-text-main); line-height: 1.25;">${escaparHTML(op.titulo)}</div>
               <small style="color: var(--ngc-text-faded); font-size: 0.78rem; margin-top: 2px; display: block;">${escaparHTML(op.subtitulo)}</small>`
            : `<div style="font-weight: 600; color: var(--ngc-text-main);">${escaparHTML(op.titulo)}</div>`;

        btn.onclick = () => {
            if (selectorTipoActual === 'tema') {
                selTema.value = op.valor;
                sumTema.innerText = op.titulo;
                cerrarSelectorPresupuesto();
                cambioTema();
            } else {
                selConcepto.value = op.valor;
                sumConcepto.innerText = op.titulo;
                cerrarSelectorPresupuesto();
                cargarDetallePrecios();
            }
        };
        cont.appendChild(btn);
    });
}

function setupEventListeners() {
    if (inputCliNombre) {
        inputCliNombre.addEventListener('input', () => {
            clienteDesdeAgenda = false; 
            permiteGuardarNube = false; 
        });
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', ajustarAlturaSelectorConTeclado);
    }
}

function poblarTemas() {
    selTema.value = '';
    sumTema.innerText = '-- SELECCIONE RUBRO --';
    const temasUnicos = [...new Set(dbPrecios.map(i => i.tema))].sort();
    if (btnSelectTema) {
        btnSelectTema.disabled = temasUnicos.length === 0;
    }
}

function cambioTema() {
    const t = selTema.value;
    selConcepto.value = '';
    sumConcepto.innerText = '-- SELECCIONE TRABAJO --';

    limpiarEdicionesTemporales();
    document.getElementById('unitarioLabel').innerText = "Unit: $ 0,00";
    document.getElementById('obsManual').value = "";
    const minEl = document.getElementById('minutosTrabajo');
    if (minEl) minEl.value = 30;
    actualizarSubtotalItemActual();

    if (btnSelectConcepto) {
        btnSelectConcepto.disabled = !t;
    }
}

function limpiarEdicionesTemporales() {
    conceptoEditado = null; precioEditado = null;
    document.getElementById('badgeConcepto').classList.add('oculto'); 
    document.getElementById('badgePrecio').classList.add('oculto');
    document.getElementById('btnEditConcepto').classList.add('oculto'); 
    document.getElementById('btnEditPrecio').classList.add('oculto');
}

function cargarDetallePrecios() { 
    const item = dbPrecios.find(i => i.tema === selTema.value && i.concepto === selConcepto.value); 
    const obs = document.getElementById('obsManual'); limpiarEdicionesTemporales();
    const minEl = document.getElementById('minutosTrabajo');
    
    if(item) { 
        document.getElementById('unitarioLabel').innerText = `Unit: $ ${item.precio.toLocaleString('es-AR')}`; 
        obs.value = item.notas; 
        notasOriginales = item.notas; 
        obs.readOnly = true; 
        if (minEl) minEl.value = item.minutos !== undefined ? item.minutos : 30;
        document.getElementById('btnEditConcepto').classList.remove('oculto'); 
        document.getElementById('btnEditPrecio').classList.remove('oculto');
    } else { 
        document.getElementById('unitarioLabel').innerText = "Unit: $ 0,00"; obs.value = ""; 
        if (minEl) minEl.value = 30;
    }
    actualizarSubtotalItemActual();
}

function abrirModalEdicion(tipo, valorActual) { 
    tipoEdicionActual = tipo; 
    const titulo = tipo === 'concepto' ? 'Editar nombre:' : 'Editar precio:'; 
    document.getElementById('modalEdicionTitulo').innerText = titulo; 
    
    const inputNumber = document.getElementById('modalEdicionInput');
    const inputTextarea = document.getElementById('modalEdicionTextarea');

    if (tipo === 'precio') {
        inputNumber.style.display = 'block';
        inputTextarea.style.display = 'none';
        inputNumber.value = valorActual;
        document.getElementById('modalEdicionPersonalizada').classList.remove('oculto'); 
        setTimeout(() => inputNumber.focus(), 100);
    } else {
        inputNumber.style.display = 'none';
        inputTextarea.style.display = 'block';
        inputTextarea.value = valorActual;
        document.getElementById('modalEdicionPersonalizada').classList.remove('oculto'); 
        setTimeout(() => inputTextarea.focus(), 100);
    }
}

function guardarModalEdicion() { 
    const valor = tipoEdicionActual === 'precio' 
        ? document.getElementById('modalEdicionInput').value 
        : document.getElementById('modalEdicionTextarea').value;
    
    if (tipoEdicionActual === 'concepto') { 
        if (valor && valor.trim() !== "") { 
            conceptoEditado = valor.trim(); 
            sumConcepto.innerText = conceptoEditado;
            document.getElementById('badgeConcepto').classList.remove('oculto'); 
        } 
    } else if (tipoEdicionActual === 'precio') { 
        if (valor !== '') { 
            const num = parseFloat(valor.toString().replace(/[^0-9.,]/g, '').replace(',', '.')); 
            if (!isNaN(num) && num >= 0) { 
                precioEditado = redondearMoneda(num); 
                document.getElementById('unitarioLabel').innerText = `Unit: $ ${precioEditado.toLocaleString('es-AR')}`; 
                document.getElementById('badgePrecio').classList.remove('oculto'); 
                actualizarSubtotalItemActual();
            } 
        } 
    } 
    cerrarModalEdicion(); 
}

function cerrarModalEdicion() {
    document.getElementById('modalEdicionPersonalizada').classList.add('oculto');
}

function editarConceptoTemporal() {
    const item = dbPrecios.find(i => i.tema === selTema.value && i.concepto === selConcepto.value); 
    if (!item) return;
    abrirModalEdicion('concepto', conceptoEditado || item.concepto);
}

function editarPrecioTemporal() {
    const item = dbPrecios.find(i => i.tema === selTema.value && i.concepto === selConcepto.value); 
    if (!item) return;
    abrirModalEdicion('precio', precioEditado !== null ? precioEditado : item.precio);
}

function habilitarEdicionObs() { document.getElementById('obsManual').readOnly = false; document.getElementById('obsManual').focus(); }
function volverNotasOriginales() { document.getElementById('obsManual').value = notasOriginales; document.getElementById('obsManual').readOnly = true; }
function borrarTodasNotas() { document.getElementById('obsManual').value = ""; }

function agregarTrabajo() {
    const itemOriginal = dbPrecios.find(i => i.tema === selTema.value && i.concepto === selConcepto.value);
    
    if(!itemOriginal) { 
        mostrarAlertaCorp("Atención", "Seleccione un trabajo de la lista o cargue un 'Ítem Manual'."); 
        return; 
    }
    
    const qty = Math.max(1, parseInt(document.getElementById('cantidad').value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('porcentajeDesc').value) || 0));
    const minRaw = document.getElementById('minutosTrabajo').value;
    const minutos = (minRaw !== '' && !isNaN(parseInt(minRaw))) ? Math.max(0, parseInt(minRaw)) : 30;
    const fPrecio = redondearMoneda(precioEditado !== null ? precioEditado : itemOriginal.precio);
    const fTotal = redondearMoneda((fPrecio * qty) * (1 - desc / 100));
          
    listaItems.push({ 
        id: Date.now() + Math.floor(Math.random() * 1000), 
        concepto: conceptoEditado || itemOriginal.concepto, 
        obs: document.getElementById('obsManual').value.trim(), 
        qty, 
        total: fTotal, 
        unitario: fPrecio, 
        desc,
        minutos
    });
    
    guardarEstadoLocal(); 
    renderTabla(true); 
    
    document.getElementById('obsManual').value = ""; 
    document.getElementById('cantidad').value = 1; 
    document.getElementById('porcentajeDesc').value = 0; 
    document.getElementById('minutosTrabajo').value = 30;
    selConcepto.value = ""; 
    sumConcepto.innerText = '-- SELECCIONE TRABAJO --';
    limpiarEdicionesTemporales(); 
    document.getElementById('unitarioLabel').innerText = "Unit: $ 0,00";
    actualizarSubtotalItemActual();
}

// ==========================================
// ÍTEM MANUAL Y EDICIÓN / ORDEN DE ÍTEMS CARGADOS
// ==========================================
function abrirModalItemManual() {
    document.getElementById('manualItemConcepto').value = '';
    document.getElementById('manualItemPrecio').value = '';
    document.getElementById('manualItemQty').value = 1;
    document.getElementById('manualItemDesc').value = 0;
    document.getElementById('manualItemMinutos').value = 60;
    document.getElementById('manualItemObs').value = '';
    document.getElementById('manualItemPreviewTotal').innerText = '$ 0';
    document.getElementById('modalItemManual').classList.remove('oculto');
    setTimeout(() => document.getElementById('manualItemConcepto').focus(), 80);
}

function cerrarModalItemManual() {
    document.getElementById('modalItemManual').classList.add('oculto');
}

function recalcularPreviewModalManual() {
    const precio = Math.max(0, parseFloat(document.getElementById('manualItemPrecio').value) || 0);
    const qty = Math.max(1, parseInt(document.getElementById('manualItemQty').value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('manualItemDesc').value) || 0));
    const total = redondearMoneda((precio * qty) * (1 - desc / 100));
    document.getElementById('manualItemPreviewTotal').innerText = `$ ${total.toLocaleString('es-AR')}`;
}

function guardarItemManual() {
    const concepto = document.getElementById('manualItemConcepto').value.trim();
    const precio = redondearMoneda(Math.max(0, parseFloat(document.getElementById('manualItemPrecio').value) || 0));
    const qty = Math.max(1, parseInt(document.getElementById('manualItemQty').value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('manualItemDesc').value) || 0));
    const minutos = Math.max(0, parseInt(document.getElementById('manualItemMinutos').value) || 0);
    const obs = document.getElementById('manualItemObs').value.trim();

    if (!concepto) {
        mostrarAlertaCorp("Datos incompletos", "Ingresá el nombre o descripción del trabajo.");
        return;
    }

    const total = redondearMoneda((precio * qty) * (1 - desc / 100));

    listaItems.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        concepto,
        obs,
        qty,
        total,
        unitario: precio,
        desc,
        minutos
    });

    guardarEstadoLocal();
    renderTabla(true);
    cerrarModalItemManual();
    mostrarToast("Ítem Agregado", "Se añadió el trabajo personalizado.");
}

function abrirModalEditarItem(id) {
    const item = listaItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemConcepto').value = item.concepto;
    document.getElementById('editItemPrecio').value = item.unitario;
    document.getElementById('editItemQty').value = item.qty;
    document.getElementById('editItemDesc').value = item.desc || 0;
    document.getElementById('editItemMinutos').value = item.minutos !== undefined ? item.minutos : 30;
    document.getElementById('editItemObs').value = item.obs || '';

    recalcularPreviewModalEditar();
    document.getElementById('modalEditarItem').classList.remove('oculto');
}

function cerrarModalEditarItem() {
    document.getElementById('modalEditarItem').classList.add('oculto');
}

function recalcularPreviewModalEditar() {
    const precio = Math.max(0, parseFloat(document.getElementById('editItemPrecio').value) || 0);
    const qty = Math.max(1, parseInt(document.getElementById('editItemQty').value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('editItemDesc').value) || 0));
    const total = redondearMoneda((precio * qty) * (1 - desc / 100));
    document.getElementById('editItemPreviewTotal').innerText = `$ ${total.toLocaleString('es-AR')}`;
}

function guardarEdicionItem() {
    const id = Number(document.getElementById('editItemId').value);
    const idx = listaItems.findIndex(i => i.id === id);
    if (idx === -1) return;

    const concepto = document.getElementById('editItemConcepto').value.trim();
    if (!concepto) {
        mostrarAlertaCorp("Datos incompletos", "La descripción del trabajo no puede estar vacía.");
        return;
    }

    const precio = redondearMoneda(Math.max(0, parseFloat(document.getElementById('editItemPrecio').value) || 0));
    const qty = Math.max(1, parseInt(document.getElementById('editItemQty').value) || 1);
    const desc = Math.min(100, Math.max(0, parseInt(document.getElementById('editItemDesc').value) || 0));
    const minutos = Math.max(0, parseInt(document.getElementById('editItemMinutos').value) || 0);
    const obs = document.getElementById('editItemObs').value.trim();
    const total = redondearMoneda((precio * qty) * (1 - desc / 100));

    listaItems[idx] = {
        ...listaItems[idx],
        concepto,
        unitario: precio,
        qty,
        desc,
        minutos,
        obs,
        total
    };

    guardarEstadoLocal();
    renderTabla();
    cerrarModalEditarItem();
    mostrarToast("Ítem Actualizado", "Cambios guardados en el presupuesto.");
}

function moverItem(index, direccion) {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= listaItems.length) return;
    const temp = listaItems[index];
    listaItems[index] = listaItems[nuevoIndex];
    listaItems[nuevoIndex] = temp;
    guardarEstadoLocal();
    renderTabla();
}

function duplicarItem(id) {
    const idx = listaItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const copia = {
        ...listaItems[idx],
        id: Date.now() + Math.floor(Math.random() * 1000)
    };
    listaItems.splice(idx + 1, 0, copia);
    guardarEstadoLocal();
    renderTabla();
    mostrarToast("Ítem Duplicado", "Se creó una copia debajo.");
      }

// ==========================================
// RENDERIZADO DE TABLA, MÉTRICAS Y DOCK EN VIVO
// ==========================================
function renderTabla(pulsarDock = false) {
    const tbody = document.getElementById('cuerpoTabla'); 
    tbody.innerHTML = ''; 
    let total = 0;
    let subtotalBruto = 0;
    let totalMinutos = 0;
    const f = new Date().toLocaleDateString('es-AR');

    listaItems.forEach(i => {
        total = redondearMoneda(total + i.total);
        subtotalBruto = redondearMoneda(subtotalBruto + (i.unitario * i.qty));
        const minItem = (i.minutos !== undefined && i.minutos !== null) ? Number(i.minutos) : 30;
        totalMinutos += minItem * i.qty;
    });

    const descuentoTotal = redondearMoneda(subtotalBruto - total);
    const horas = Math.floor(totalMinutos / 60);
    const mins = totalMinutos % 60;
    const tiempoFormateado = `${horas}h ${mins < 10 ? '0' + mins : mins}m`;
    const promedioHora = totalMinutos > 0 ? Math.round(total / (totalMinutos / 60)) : 0;

    actualizarCabeceraClientePaso2();

    const filtroWrap = document.getElementById('filtroItemsDrawerWrap');
    const filtroInput = document.getElementById('filtroItemsDrawer');
    if (filtroWrap) {
        filtroWrap.classList.toggle('oculto', listaItems.length < 4);
        if (listaItems.length < 4 && filtroInput) filtroInput.value = '';
    }

    const cliNombreSeguro = escaparHTML(inputCliNombre.value.trim() || 'Sin Nombre');
    const cliDirSeguro = escaparHTML(document.getElementById('cliDireccion').value.trim());
    const cliProySeguro = escaparHTML(document.getElementById('cliProyecto').value.trim() || 'General');
    
    tbody.innerHTML = `<tr>
        <td colspan="4" style="padding-bottom:14px; border-bottom: 1px solid var(--ngc-privacy-border);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div style="color:var(--ngc-neon); font-size:0.84rem; line-height: 1.45; flex: 1; min-width: 170px;">
                    <div><b>CLIENTE:</b> ${cliNombreSeguro}</div>
                    ${cliDirSeguro ? `<div style="color: var(--ngc-text-faded); font-size: 0.78rem;"><b>DIR:</b> ${cliDirSeguro}</div>` : ''}
                    <div><b>PROYECTO:</b> ${cliProySeguro}</div>
                    <div style="color: var(--ngc-text-faded); font-size: 0.78rem;"><b>FECHA:</b> ${f} • <b>N°:</b> ${escaparHTML(nroPresupuestoGlobal)}</div>
                    <button type="button" class="corp-btn-small pres-btn-edit-client" onclick="abrirModalEditarCliente()">
                        <i class="fa-solid fa-user-pen"></i> Editar Cliente / Vincular
                    </button>
                </div>
                <div class="pres-metrics-box">
                    <div><span style="color: var(--ngc-text-faded);">Tiempo Est.:</span> <b style="color: var(--ngc-warning);">${tiempoFormateado}</b></div>
                    <div><span style="color: var(--ngc-text-faded);">Prom./Hora:</span> <b style="color: var(--ngc-neon);">$ ${promedioHora.toLocaleString('es-AR')}</b></div>
                </div>
            </div>
        </td>
    </tr>`; 

    if (listaItems.length === 0) {
        tbody.innerHTML += `<tr>
            <td colspan="4" style="text-align: center; padding: 26px 10px; color: var(--ngc-text-faded); border: none;">
                <i class="fa-solid fa-clipboard-list" style="font-size: 1.6rem; margin-bottom: 8px; display: block; opacity: 0.6;"></i>
                Todavía no agregaste trabajos.<br><small>Cerrá esta vista y seleccioná un rubro o tocá <b>+ Ítem Manual</b>.</small>
            </td>
        </tr>`;
    }
    
    listaItems.forEach((i, idx) => { 
        const obsHtml = i.obs 
            ? `<small style="display:block; opacity:0.85; white-space: pre-wrap; margin-top:4px; color: var(--ngc-text-faded);">${escaparHTML(i.obs)}</small>` 
            : '';
        const badgeDesc = i.desc > 0 
            ? ` <strong style="color:var(--ngc-warning)">(-${i.desc}%)</strong>` 
            : '';
        const searchData = escaparHTML(`${i.concepto} ${i.obs || ''}`);

        tbody.innerHTML += `<tr class="pres-item-row" data-search="${searchData}">
            <td style="padding-right: 6px;">
                <div style="display: flex; align-items: baseline; gap: 6px;">
                    <span style="font-size: 0.72rem; font-weight: 700; color: var(--ngc-text-faded);">${String(idx + 1).padStart(2, '0')}</span>
                    <b>${escaparHTML(i.concepto)}</b>
                </div>
                <span style="display:block; font-size:0.78rem; color:var(--ngc-text-faded); margin-top: 2px;">
                    Unit: $${i.unitario.toLocaleString('es-AR')}${badgeDesc} • ${i.minutos || 30}m
                </span>
                ${obsHtml}
                <div class="pres-item-actions-bar">
                    <button type="button" class="pres-mini-act" onclick="abrirModalEditarItem(${i.id})" title="Editar ítem"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button type="button" class="pres-mini-act" onclick="duplicarItem(${i.id})" title="Duplicar ítem"><i class="fa-solid fa-copy"></i></button>
                    ${idx > 0 ? `<button type="button" class="pres-mini-act" onclick="moverItem(${idx}, -1)" title="Subir"><i class="fa-solid fa-arrow-up"></i></button>` : ''}
                    ${idx < listaItems.length - 1 ? `<button type="button" class="pres-mini-act" onclick="moverItem(${idx}, 1)" title="Bajar"><i class="fa-solid fa-arrow-down"></i></button>` : ''}
                </div>
            </td>
            <td align="center" style="font-weight: 600; white-space: nowrap;">x${i.qty}</td>
            <td align="right" style="color:var(--ngc-neon); font-weight:bold; white-space: nowrap;">$${i.total.toLocaleString('es-AR')}</td>
            <td align="right" style="width:36px;">
                <button type="button" class="corp-btn-icon danger" style="width:32px; height:32px;" onclick="borrarItem(${i.id})" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`; 
    });

    const og = document.getElementById('obsGenerales').value.trim(); 
    if(og) {
        tbody.innerHTML += `<tr><td colspan="4" style="font-size:0.85rem; color:var(--ngc-text-faded); padding-top:12px; font-style:italic; border: none;">Nota: ${escaparHTML(og)}</td></tr>`; 
    }

    const desgloseEl = document.getElementById('desgloseTotalesLive');
    if (desgloseEl) {
        if (descuentoTotal > 0) {
            desgloseEl.innerHTML = `
                <div class="pres-subtotals-strip">
                    <span>Subtotal: $ ${subtotalBruto.toLocaleString('es-AR')}</span>
                    <span style="color: var(--ngc-warning);">Bonificación: -$ ${descuentoTotal.toLocaleString('es-AR')}</span>
                </div>`;
        } else {
            desgloseEl.innerHTML = '';
        }
    }

    const badgeCant = document.getElementById('badgeCantidadItems');
    if (badgeCant) {
        badgeCant.innerText = `${listaItems.length} ${listaItems.length === 1 ? 'ítem' : 'ítems'}`;
    }
    
    totalMontoActual = total; 
    document.getElementById('totalDisplay').innerText = `TOTAL: $ ${total.toLocaleString('es-AR')}`;

    if (filtroInput && filtroInput.value.trim() !== '') {
        filtrarItemsCargadosDrawer();
    }

    actualizarDockFlotante(total, tiempoFormateado, pulsarDock);
    sincronizarVistaPreviaPDF();
}

function borrarItem(id) { 
    listaItems = listaItems.filter(i => i.id !== id); 
    guardarEstadoLocal(); 
    renderTabla(); 
}

// ==========================================
// SINCRONIZACIÓN DE PLANTILLA PDF A4
// ==========================================
function actualizarPDFHeaders() {
    const nombre = (localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL').toUpperCase();
    const slogan = localStorage.getItem('villaser_conf_slogan') || '';
    const tel = localStorage.getItem('villaser_conf_telefono') || '';
    const email = localStorage.getItem('villaser_conf_email') || '';
    const cuit = localStorage.getItem('villaser_conf_cuit') || '';
    const matricula = localStorage.getItem('villaser_conf_matricula') || '';
    const logo = localStorage.getItem('villaser_conf_logo') || '';

    document.getElementById('headerMembrete').innerText = nombre;
    const footerBrand = document.getElementById('pdf-footer-brand');
    if (footerBrand) footerBrand.innerText = nombre;

    const sloganEl = document.getElementById('pdf-slogan');
    sloganEl.innerText = slogan;
    sloganEl.style.display = slogan ? 'block' : 'none';

    const iconPhone = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px; margin-right:4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
    const iconMail = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px; margin-right:4px;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;

    const telEl = document.getElementById('pdf-tel');
    telEl.innerHTML = tel ? `${iconPhone}${escaparHTML(tel)}` : '';
    telEl.style.display = tel ? 'inline-flex' : 'none';

    const emailEl = document.getElementById('pdf-email');
    emailEl.innerHTML = email ? `${iconMail}${escaparHTML(email)}` : '';
    emailEl.style.display = email ? 'inline-flex' : 'none';

    const fiscalParts = [];
    if (cuit) fiscalParts.push(`CUIT: ${escaparHTML(cuit)}`);
    if (matricula) fiscalParts.push(`Mat.: ${escaparHTML(matricula)}`);
    const fiscalEl = document.getElementById('pdf-fiscal');
    if (fiscalEl) {
        fiscalEl.innerText = fiscalParts.join(' | ');
        fiscalEl.style.display = fiscalParts.length > 0 ? 'inline-flex' : 'none';
    }

    const imgLogo = document.getElementById('pdf-img-logo');
    const txtLogo = document.getElementById('pdf-text-logo');
    const membreteEl = document.getElementById('headerMembrete');

    if (logo && logo.startsWith('data:image')) {
        imgLogo.src = logo;
        imgLogo.style.display = 'block';
        txtLogo.style.display = 'none';
        membreteEl.style.display = 'block';
    } else {
        imgLogo.style.display = 'none';
        txtLogo.innerText = nombre;
        txtLogo.style.display = 'block';
        membreteEl.style.display = 'none';
    }
}

function sincronizarVistaPreviaPDF() {
    actualizarPDFHeaders();

    const hoyStr = new Date().toLocaleDateString('es-AR');
    document.getElementById('pdf-nro').innerText = nroPresupuestoGlobal;
    document.getElementById('pdf-fecha').innerText = hoyStr;

    const fechaVencStr = calcularFechaVencimientoStr(document.getElementById('diasValidez').value);
    document.getElementById('pdf-validez-fecha').innerText = fechaVencStr;
    const validezTop = document.getElementById('pdf-validez-top');
    if (validezTop) validezTop.innerText = fechaVencStr;

    document.getElementById('pdf-cliente').innerText = inputCliNombre.value.trim() || 'Consumidor Final';

    const dirVal = document.getElementById('cliDireccion').value.trim();
    const rowDir = document.getElementById('pdf-row-direccion');
    if (dirVal) {
        document.getElementById('pdf-direccion').innerText = dirVal;
        if (rowDir) rowDir.style.display = 'flex';
    } else if (rowDir) {
        rowDir.style.display = 'none';
    }

    const proyVal = document.getElementById('cliProyecto').value.trim();
    const rowProy = document.getElementById('pdf-row-proyecto');
    if (proyVal) {
        document.getElementById('pdf-proyecto').innerText = proyVal;
        if (rowProy) rowProy.style.display = 'flex';
    } else if (rowProy) {
        rowProy.style.display = 'none';
    }

    const tbody = document.getElementById('pdf-tbody');
    tbody.innerHTML = '';
    let sub = 0;
    let desc = 0;

    listaItems.forEach((i, idx) => {
        const cod = String(idx + 1).padStart(2, '0');
        const fSub = redondearMoneda(i.unitario * i.qty);
        sub = redondearMoneda(sub + fSub);
        desc = redondearMoneda(desc + (fSub - i.total));

        const badgeDesc = i.desc > 0
            ? `<span class="pdf-badge-desc">-${i.desc}% OFF</span>`
            : '';

        const obsHtml = i.obs && i.obs.trim() !== ''
            ? `<div class="pdf-item-obs">${escaparHTML(i.obs.trim()).replace(/\n/g, '<br>')}</div>`
            : '';

        const importeHtml = i.desc > 0
            ? `<strong>$&nbsp;${i.total.toLocaleString('es-AR')}</strong><span class="pdf-price-old">$&nbsp;${fSub.toLocaleString('es-AR')}</span>`
            : `<strong>$&nbsp;${fSub.toLocaleString('es-AR')}</strong>`;

        tbody.innerHTML += `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #64748b;">${cod}</td>
                <td>
                    <div class="pdf-item-title">${escaparHTML(i.concepto)} ${badgeDesc}</div>
                    ${obsHtml}
                </td>
                <td style="text-align: center; font-weight: 600;">${i.qty}</td>
                <td style="text-align: right; white-space: nowrap;">$&nbsp;${i.unitario.toLocaleString('es-AR')}</td>
                <td style="text-align: right; white-space: nowrap;">${importeHtml}</td>
            </tr>`;
    });

    document.getElementById('pdf-subtotal').innerText = `$ ${sub.toLocaleString('es-AR')}`;
    const rowDesc = document.getElementById('pdf-row-descuentos');
    if (desc > 0) {
        document.getElementById('pdf-descuentos').innerText = `-$ ${desc.toLocaleString('es-AR')}`;
        if (rowDesc) rowDesc.style.display = 'flex';
    } else if (rowDesc) {
        rowDesc.style.display = 'none';
    }
    document.getElementById('pdf-total').innerText = `$ ${redondearMoneda(sub - desc).toLocaleString('es-AR')}`;

    const og = document.getElementById('obsGenerales').value.trim();
    const notasBox = document.getElementById('pdf-notas-box');
    if (og) {
        document.getElementById('pdf-notas').innerHTML = escaparHTML(og).replace(/\n/g, '<br>');
        if (notasBox) notasBox.style.display = 'block';
    } else if (notasBox) {
        notasBox.style.display = 'none';
    }

    const pdfPagoEl = document.getElementById('pdf-forma-pago');
    if (pdfPagoEl) {
        const metodos = [];
        if (formaPago.efectivo) metodos.push('Efectivo');
        if (formaPago.credito) {
            metodos.push(formaPago.cuotas ? `Tarjeta de Crédito (${escaparHTML(formaPago.cuotas)} cuotas)` : 'Tarjeta de Crédito');
        }
        if (formaPago.transferencia) {
            metodos.push('Transferencia Bancaria');
        }

        let htmlPago = '';
        if (metodos.length > 0 || formaPago.aclaracion) {
            htmlPago += `<div class="pdf-payment-title">FORMA DE PAGO ACEPTADA</div>`;
            if (metodos.length > 0) {
                htmlPago += `<div class="pdf-payment-methods">${metodos.join('  •  ')}</div>`;
            }
            if (formaPago.transferencia && formaPago.aliasCbu) {
                htmlPago += `<div class="pdf-bank-box"><span>Alias / CBU:</span> <code>${escaparHTML(formaPago.aliasCbu)}</code></div>`;
            }
            if (formaPago.aclaracion) {
                htmlPago += `<div class="pdf-payment-note">${escaparHTML(formaPago.aclaracion).replace(/\n/g, '<br>')}</div>`;
            }
        }

        if (htmlPago) {
            pdfPagoEl.innerHTML = htmlPago;
            pdfPagoEl.style.display = 'block';
        } else {
            pdfPagoEl.innerHTML = '';
            pdfPagoEl.style.display = 'none';
        }
    }
}

// ==========================================
// VISTA PREVIA MÓVIL Y DESCARGA DE PDF
// ==========================================
let vpScale = 1;
let vpPanX = 0;
let vpPanY = 0;
let vpGestosIniciados = false;

function actualizarTransformVistaPrevia() {
    const area = document.getElementById('areaScrollVistaPrevia');
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');
    if (!area || !contenedor) return;

    const maxPanX = Math.max(0, (area.clientWidth * (vpScale - 1)) / 2 + 30);
    vpPanX = Math.min(maxPanX, Math.max(-maxPanX, vpPanX));

    const altoContenido = contenedor.offsetHeight * vpScale;
    const altoVisible = area.clientHeight - 40;
    if (altoContenido <= altoVisible) {
        vpPanY = Math.min(30, Math.max(-30, vpPanY));
    } else {
        const minPanY = -(altoContenido - altoVisible) - 20;
        vpPanY = Math.min(20, Math.max(minPanY, vpPanY));
    }

    contenedor.style.transform = `translate3d(${vpPanX}px, ${vpPanY}px, 0) scale(${vpScale})`;
}

function inicializarGestosVistaPrevia() {
    if (vpGestosIniciados) return;
    const area = document.getElementById('areaScrollVistaPrevia');
    if (!area) return;
    vpGestosIniciados = true;

    let distInicial = 0;
    let scaleInicial = 1;
    let lastX = 0;
    let lastY = 0;
    let arrastrando = false;
    let ultimoTap = 0;

    const distanciaToques = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    area.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            arrastrando = false;
            distInicial = distanciaToques(e.touches);
            scaleInicial = vpScale;
        } else if (e.touches.length === 1) {
            arrastrando = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;

            const ahora = Date.now();
            if (ahora - ultimoTap < 280) {
                if (vpScale > 1.1) {
                    vpScale = 1;
                    vpPanX = 0;
                    vpPanY = 0;
                } else {
                    const rect = area.getBoundingClientRect();
                    const dx = e.touches[0].clientX - rect.left - rect.width / 2;
                    const dy = e.touches[0].clientY - rect.top - 20;
                    vpScale = 2.2;
                    vpPanX = dx - dx * vpScale;
                    vpPanY = dy - dy * vpScale;
                }
                actualizarTransformVistaPrevia();
            }
            ultimoTap = ahora;
        }
    }, { passive: true });

    area.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && distInicial > 0) {
            e.preventDefault();
            const distActual = distanciaToques(e.touches);
            const nuevoScale = Math.min(3.5, Math.max(1, scaleInicial * (distActual / distInicial)));

            const rect = area.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const dx = midX - rect.left - rect.width / 2;
            const dy = midY - rect.top - 20;

            const factor = nuevoScale / vpScale;
            vpPanX = dx - (dx - vpPanX) * factor;
            vpPanY = dy - (dy - vpPanY) * factor;
            vpScale = nuevoScale;

            if (vpScale === 1) vpPanX = 0;
            actualizarTransformVistaPrevia();
        } else if (e.touches.length === 1 && arrastrando) {
            e.preventDefault();
            const cx = e.touches[0].clientX;
            const cy = e.touches[0].clientY;
            if (vpScale > 1) vpPanX += cx - lastX;
            vpPanY += cy - lastY;
            lastX = cx;
            lastY = cy;
            actualizarTransformVistaPrevia();
        }
    }, { passive: false });

    area.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) distInicial = 0;
        if (e.touches.length === 1) {
            arrastrando = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        } else if (e.touches.length === 0) {
            arrastrando = false;
        }
    }, { passive: true });
}

function abrirVistaPreviaMobile() {
    if (listaItems.length === 0) {
        mostrarAlertaCorp("Faltan Trabajos", "Agregá trabajos para ver la vista previa.");
        return;
    }
    sincronizarVistaPreviaPDF();
    inicializarGestosVistaPrevia();

    const plantilla = document.getElementById('plantilla-pdf');
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');

    vpScale = 1;
    vpPanX = 0;
    vpPanY = 0;
    contenedor.style.transform = 'translate3d(0px, 0px, 0) scale(1)';

    contenedor.appendChild(plantilla);
    plantilla.style.display = 'block';

    const scale = (window.innerWidth - 20) / 800;
    plantilla.style.zoom = scale < 1 ? scale : 1;

    document.getElementById('modalVistaPrevia').classList.remove('oculto');
    document.body.style.overflow = 'hidden';
}

function cerrarVistaPrevia() {
    const plantilla = document.getElementById('plantilla-pdf');
    const contenedor = document.getElementById('contenedorVistaPreviaMobile');
    const aside = document.querySelector('.preview-panel');

    vpScale = 1;
    vpPanX = 0;
    vpPanY = 0;
    if (contenedor) contenedor.style.transform = '';

    plantilla.style.zoom = '';
    plantilla.style.display = '';

    aside.appendChild(plantilla);

    document.getElementById('modalVistaPrevia').classList.add('oculto');

    const drawerAbierto = !document.getElementById('modalListaPresupuesto')?.classList.contains('oculto');
    document.body.style.overflow = drawerAbierto ? 'hidden' : '';
}

function generarPDF() {
    if (listaItems.length === 0) {
        mostrarAlertaCorp("Faltan Trabajos", "Agregá trabajos para generar el PDF.");
        return;
    }
    sincronizarVistaPreviaPDF();
    
    const sugerido = inputCliNombre.value.trim().replace(/\s+/g, '_') || 'Cliente';
    const uniqueSuffix = Math.floor(Math.random() * 9000) + 1000;
    document.getElementById('nombreArchivoPDF').value = `Presupuesto_${sugerido}_${uniqueSuffix}`;
    
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
    
    if(permiteGuardarNube) { guardarBorradorFirebase(false, true); }
    
    const element = document.getElementById('plantilla-pdf'); 
    const selloAgua = document.getElementById('selloAguaPDF');
    if (selloAgua) selloAgua.style.display = 'none';

    element.style.display = 'block'; 
    window.scrollTo(0, 0);
    
    const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Presupuesto';

    const opt = { 
        margin: 0, 
        filename: `${nombreFinal}.pdf`, 
        image: { type: 'png' }, 
        html2canvas: { scale: 3, useCORS: true, letterRendering: true, scrollY: 0 }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true } 
    };
    
    try { 
        await html2pdf().set(opt).from(element).save(); 
        mostrarToast("Generado con Éxito", permiteGuardarNube ? "PDF guardado y respaldado en la nube." : "PDF guardado (Local temporal)"); 
        cerrarModalPDF(); 
    } 
    catch (e) { 
        mostrarAlertaCorp("Error", "Error al generar el PDF."); 
        btn.innerHTML = "Descargar";
    } 
    finally { 
        if (window.innerWidth < 992) {
            element.style.display = 'none'; 
        } else {
            element.style.display = ''; 
        }
        if (selloAgua) selloAgua.style.display = 'flex';
    }
}

// ==========================================
// WHATSAPP EJECUTIVO
// ==========================================
function prepararEnvioWhatsApp() {
    if (listaItems.length === 0) {
        mostrarAlertaCorp("Faltan Datos", "Agregá trabajos primero.");
        return;
    }
    const msg = armarMensajeWsp();
    abrirModalWspGlobal(telefonoClienteActual, msg);
}

function armarMensajeWsp() {
    const empresa = (localStorage.getItem('villaser_conf_nombre') || 'PRESUPUESTO').toUpperCase();
    const cliente = inputCliNombre.value.trim();
    const dir = document.getElementById('cliDireccion').value.trim();
    const proy = document.getElementById('cliProyecto').value.trim();
    const fechaVencStr = calcularFechaVencimientoStr(document.getElementById('diasValidez').value);
    const og = document.getElementById('obsGenerales').value.trim();

    let m = `*${empresa}*\n`;
    m += `*Presupuesto N°:* ${nroPresupuestoGlobal}\n`;
    if (cliente) m += `*Cliente:* ${cliente}\n`;
    if (dir) m += `*Dirección:* ${dir}\n`;
    if (proy) m += `*Proyecto:* ${proy}\n`;
    m += `\n*DETALLE DE TRABAJOS:*\n`;

    let sub = 0;
    let descTotal = 0;

    listaItems.forEach((i, idx) => {
        const fSub = redondearMoneda(i.unitario * i.qty);
        sub = redondearMoneda(sub + fSub);
        descTotal = redondearMoneda(descTotal + (fSub - i.total));

        const tagDesc = i.desc > 0 ? ` (-${i.desc}%)` : '';
        m += `${idx + 1}. ${i.concepto} (x${i.qty})${tagDesc} ➔ *$${i.total.toLocaleString('es-AR')}*\n`;
    });

    m += `\n`;
    if (descTotal > 0) {
        m += `Subtotal: $${sub.toLocaleString('es-AR')}\n`;
        m += `Bonificación: -$${descTotal.toLocaleString('es-AR')}\n`;
    }
    m += `*TOTAL FINAL: $${totalMontoActual.toLocaleString('es-AR')}*\n`;

    const metodos = [];
    if (formaPago.efectivo) metodos.push('Efectivo');
    if (formaPago.credito) metodos.push(formaPago.cuotas ? `Crédito (${formaPago.cuotas} cuotas)` : 'Tarjeta de Crédito');
    if (formaPago.transferencia) metodos.push('Transferencia');

    if (metodos.length > 0 || formaPago.aclaracion) {
        m += `\n*Forma de pago:* ${metodos.join(' / ')}`;
        if (formaPago.transferencia && formaPago.aliasCbu) {
            m += `\n*Alias/CBU:* ${formaPago.aliasCbu}`;
        }
        if (formaPago.aclaracion) {
            m += `\n_${formaPago.aclaracion}_`;
        }
        m += `\n`;
    }

    if (og) {
        m += `\n*Notas:* ${og}\n`;
    }

    m += `\n_Presupuesto válido hasta el ${fechaVencStr}._`;
    return m;
}

// ==========================================
// MENÚ INFERIOR APP
// ==========================================
function generarMenuInferior() {
    const footer = document.getElementById('corpFooterMenu'); if (!footer) return;
    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '#', active: true },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-compass-drafting', url: '../croquis/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
    ];
    modulos.forEach(mod => {
        const btn = document.createElement('button'); btn.className = `corp-nav-item ${mod.active ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid ${mod.icon}"></i><span>${mod.nombre}</span>`;
        btn.onclick = () => { if(!mod.active) window.location.replace(mod.url); };
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
