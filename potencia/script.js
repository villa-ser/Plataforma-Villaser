// ==========================================
// INICIALIZACIÓN Y VARIABLES GLOBALES
// ==========================================
let db = null;
let uidSeguro = null;

let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let nombreBorradorActual = null;
let telefonoClienteActual = "";

// ==========================================
// CONTROLADOR DE STEPPERS Y FILAS ESP
// ==========================================
function stepBocas(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    let newValue = parseInt(el.value || 0) + val;
    el.value = Math.max(0, newValue);
}

function stepBocasDinamico(btn, val) {
    const input = btn.parentElement.querySelector('input');
    if (!input) return;
    let newValue = parseInt(input.value || 0) + val;
    input.value = Math.max(0, newValue);
}

function crearFilaEspHTML(bocas = 0, circ = '', desc = '', conEliminar = false) {
    const btnEliminar = conEliminar
        ? `<button type="button" class="pot-esp-del" onclick="this.parentElement.remove()" title="Quitar carga"><i class="fa-solid fa-xmark"></i></button>`
        : '';
    return `
        <div class="esp-item pot-esp-row ${conEliminar ? 'has-delete' : ''}">
            <div class="corp-stepper pot-stepper-compact">
                <button type="button" class="btn-step" style="width:28px !important;" onclick="stepBocasDinamico(this, -1)">-</button>
                <input type="number" class="corp-input-step bocas-esp-input" value="${bocas}" min="0" readonly>
                <button type="button" class="btn-step" style="width:28px !important;" onclick="stepBocasDinamico(this, 1)">+</button>
            </div>
            <details class="corp-custom-select det-circuito-esp">
                <summary class="corp-input sum-circuito-esp" style="font-size:0.75rem; padding: 7px 6px;">-- Circ --</summary>
                <div class="corp-select-list list-circuito-esp"></div>
            </details>
            <input type="hidden" class="circuito-esp-input" value="${circ}">
            <input type="text" class="corp-input desc-esp-input" value="${desc}" placeholder="Ej: AA" style="font-size:0.75rem; padding: 7px 6px; text-align: center;">
            ${btnEliminar}
        </div>
    `;
}

function agregarBocaESP() {
    const container = document.getElementById('contenedor-esps');
    if (!container) return;
    const temp = document.createElement('div');
    temp.innerHTML = crearFilaEspHTML(0, '', '', true).trim();
    const newItem = temp.firstElementChild;
    container.appendChild(newItem);
    poblarAcordeonCircuitoElement(newItem);
}

function poblarAcordeonCircuitoElement(parentItem) {
    const hiddenInput = parentItem.querySelector('.circuito-esp-input');
    const summary = parentItem.querySelector('.sum-circuito-esp');
    const list = parentItem.querySelector('.list-circuito-esp');
    const details = parentItem.querySelector('.det-circuito-esp');
    if (!list || !hiddenInput) return;

    let valActual = hiddenInput.value;
    list.innerHTML = '';

    const optVacia = document.createElement('div');
    optVacia.className = 'corp-select-option';
    optVacia.innerText = '-- Circ --';
    optVacia.onclick = () => {
        hiddenInput.value = '';
        summary.innerText = '-- Circ --';
        details.removeAttribute('open');
    };
    list.appendChild(optVacia);

    let encontrado = null;
    circuitos.forEach(c => {
        if (c.id === valActual) encontrado = c;
        const opt = document.createElement('div');
        opt.className = 'corp-select-option';
        opt.innerText = `${c.id} (${c.tipo})`;
        opt.onclick = () => {
            hiddenInput.value = c.id;
            summary.innerText = `${c.id} (${c.tipo})`;
            details.removeAttribute('open');
        };
        list.appendChild(opt);
    });

    if (encontrado) {
        summary.innerText = `${encontrado.id} (${encontrado.tipo})`;
    } else {
        hiddenInput.value = '';
        summary.innerText = '-- Circ --';
    }
}

// MAPA DE CÁLCULO AEA (Conductores Cu en cañería embutida)
const MAPA_IZ = { "1.5": 15, "2.5": 21, "4": 28, "6": 36, "10": 50, "16": 66 };

// VARIABLES DE POTENCIA
let listaAmbientes = [];
let editandoId = null;
let circuitos = [
    { id: 'C1', tipo: 'IUG', dpms: 0, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' },
    { id: 'C2', tipo: 'TUG', dpms: 2200, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' }
];
let circuitoCS = { id: 'CS', tipo: 'T.P.', dpms: 0, tension: '220', seccionLN: '', seccionPE: '', iz: '', in: '' };

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

// ==========================================
// INTEGRACIÓN AGENDA Y FLUJO DE CLIENTE
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

function iniciarCalculo() {
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
    elDetalle.innerText = partes.length > 0 ? partes.join(' • ') : 'Proyecto de cálculo eléctrico';

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
    document.getElementById('step-trabajo').classList.remove('oculto');
    document.getElementById('step-trabajo').classList.add('flex-column', 'gap-15');
    actualizarResumenProyectoUI();
    actualizarGestorCircuitos();
    calcularGradoYRenderizar();
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

function ejecutarNuevoCalculo() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal();

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';

    listaAmbientes = [];
    circuitos = [
        { id: 'C1', tipo: 'IUG', dpms: 0, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' },
        { id: 'C2', tipo: 'TUG', dpms: 2200, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' }
    ];
    circuitoCS = { id: 'CS', tipo: 'T.P.', dpms: 0, tension: '220', seccionLN: '', seccionPE: '', iz: '', in: '' };

    document.getElementById('selSuministro').value = 'MONOFÁSICO';
    document.getElementById('sumSuministro').innerText = 'MONO';

    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = "";
    cancelarEdicion();
    limpiarFormularioAmbiente();

    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');

    actualizarGestorCircuitos();
    calcularGradoYRenderizar();
}

// ==========================================
// MODALES DE ALERTA COMPARTIDOS
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
    }, 4000);
}

// ==========================================
// LÓGICA DE POTENCIA, AMBIENTES Y AEA
// ==========================================
function obtenerGradoElectrificacion(areaTotal) {
    if (areaTotal <= 60) return "MÍNIMO";
    if (areaTotal <= 130) return "MEDIO";
    if (areaTotal <= 200) return "ELEVADO";
    return "SUPERIOR";
}

function autoAjustarCircuitos(grado) {
    let requeridos = 2;
    if (grado === "MEDIO") requeridos = 3;
    if (grado === "ELEVADO") requeridos = 5;
    if (grado === "SUPERIOR") requeridos = 6;
    while (circuitos.length < requeridos) {
        let num = circuitos.length + 1;
        let tipo = (num % 2 === 0) ? 'TUG' : 'IUG';
        circuitos.push({
            id: `C${num}`,
            tipo: tipo,
            dpms: tipo === 'TUG' ? 2200 : 0,
            userEditedDpms: false,
            tension: '',
            seccionLN: '',
            seccionPE: '',
            iz: '',
            in: ''
        });
    }
    actualizarGestorCircuitos();
}

function abrirModalCircuitos() {
    actualizarGestorCircuitos();
    const modal = document.getElementById('modalGestionCircuitos');
    if (modal) modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';
}

function cerrarModalCircuitos() {
    const modal = document.getElementById('modalGestionCircuitos');
    if (modal) modal.classList.add('oculto');
    const modalAmb = document.getElementById('modalCargaAmbiente');
    if (!modalAmb || modalAmb.classList.contains('oculto')) {
        document.body.style.overflow = '';
    }
}

function actualizarGestorCircuitos(totalesBocas = null) {
    const container = document.getElementById('listaConfigCircuitos');
    const countLbl = document.getElementById('ui-circuitos-count');
    const modalCountLbl = document.getElementById('ui-modal-circuitos-count');
    if (countLbl) countLbl.innerText = circuitos.length;
    if (modalCountLbl) modalCountLbl.innerText = `${circuitos.length} activos`;
    if (!container) return;

    container.innerHTML = '';

    circuitos.forEach((c, index) => {
        const opciones = ['IUG', 'TUG', 'TUE', 'ACU', 'MBTF'].map(t =>
            `<div class="corp-select-option" onclick="document.getElementById('detGestor_${index}').removeAttribute('open'); cambiarTipoCircuito(${index}, '${t}')">${t}</div>`
        ).join('');

        const bocasTxt = totalesBocas && totalesBocas[c.id] !== undefined ? `${totalesBocas[c.id]} bocas • ` : '';
        const metaTxt = `${bocasTxt}${Math.round(c.dpms)} VA`;

        container.innerHTML += `
            <div class="pot-circ-row">
                <span class="pot-circ-id">${c.id}</span>
                <details id="detGestor_${index}" class="corp-custom-select" style="flex:1; min-width:85px;">
                    <summary class="corp-input" style="padding: 6px 10px; font-size: 0.8rem; min-height: 34px;">${c.tipo}</summary>
                    <div class="corp-select-list">${opciones}</div>
                </details>
                <span class="pot-circ-meta">${metaTxt}</span>
                ${index >= 2
                    ? `<button type="button" onclick="eliminarCircuito(${index})" style="background:transparent; border:none; color:var(--error-red); cursor:pointer; padding:4px;" title="Eliminar circuito"><i class="fa-solid fa-trash"></i></button>`
                    : '<div style="width:22px;"></div>'}
            </div>`;
    });
    actualizarSelectoresEnFormulario();
}

function cambiarTipoCircuito(index, nuevoTipo) {
    circuitos[index].tipo = nuevoTipo;
    if (!circuitos[index].userEditedDpms) {
        if (nuevoTipo === 'TUG') circuitos[index].dpms = 2200;
        else if (nuevoTipo === 'TUE') circuitos[index].dpms = 3300;
        else circuitos[index].dpms = 0;
    }
    calcularGradoYRenderizar();
}

function agregarCircuitoManual() {
    let num = circuitos.length + 1;
    circuitos.push({
        id: `C${num}`,
        tipo: 'ACU',
        dpms: 0,
        userEditedDpms: false,
        tension: '',
        seccionLN: '',
        seccionPE: '',
        iz: '',
        in: ''
    });
    calcularGradoYRenderizar();
    const container = document.getElementById('listaConfigCircuitos');
    if (container) container.scrollTop = container.scrollHeight;
    mostrarToast("Circuito Añadido", `Se creó C${num} (ACU).`);
}


function cambiarTipoCircuito(index, nuevoTipo) {
    circuitos[index].tipo = nuevoTipo;
    if (!circuitos[index].userEditedDpms) {
        if (nuevoTipo === 'TUG') circuitos[index].dpms = 2200;
        else if (nuevoTipo === 'TUE') circuitos[index].dpms = 3300;
        else circuitos[index].dpms = 0;
    }
    calcularGradoYRenderizar();
}

function eliminarCircuito(index) {
    if (index < 2) return;
    const circAEliminar = circuitos[index].id;

    // Limpiar referencias en ambientes (incluyendo múltiples ESP)
    listaAmbientes.forEach(amb => {
        if (amb.circIUG === circAEliminar) amb.circIUG = "";
        if (amb.circTUG === circAEliminar) amb.circTUG = "";
        if (amb.circESP === circAEliminar) amb.circESP = "";
        if (Array.isArray(amb.esps)) {
            amb.esps = amb.esps.filter(esp => esp.circ !== circAEliminar);
        }
    });

    circuitos.splice(index, 1);

    // Renumerar correlativamente y actualizar todas las referencias
    circuitos.forEach((c, i) => {
        let viejoId = c.id;
        let nuevoId = `C${i + 1}`;
        if (viejoId !== nuevoId) {
            c.id = nuevoId;
            listaAmbientes.forEach(amb => {
                if (amb.circIUG === viejoId) amb.circIUG = nuevoId;
                if (amb.circTUG === viejoId) amb.circTUG = nuevoId;
                if (amb.circESP === viejoId) amb.circESP = nuevoId;
                if (Array.isArray(amb.esps)) {
                    amb.esps.forEach(esp => {
                        if (esp.circ === viejoId) esp.circ = nuevoId;
                    });
                }
            });
        }
    });

    calcularGradoYRenderizar();
}

function actualizarSelectoresEnFormulario() {
    const ids = ['IUG', 'TUG'];
    ids.forEach(sufijo => {
        const hiddenInput = document.getElementById('circuito' + sufijo);
        const summary = document.getElementById('sumCircuito' + sufijo);
        const list = document.getElementById('listCircuito' + sufijo);
        const details = document.getElementById('detCircuito' + sufijo);

        if (!list || !hiddenInput) return;
        let valActual = hiddenInput.value;
        list.innerHTML = '';

        const optVacia = document.createElement('div');
        optVacia.className = 'corp-select-option';
        optVacia.innerText = '-- Circ --';
        optVacia.onclick = () => {
            hiddenInput.value = '';
            summary.innerText = '-- Circ --';
            details.removeAttribute('open');
        };
        list.appendChild(optVacia);

        let encontrado = null;
        circuitos.forEach(c => {
            if (c.id === valActual) encontrado = c;
            const opt = document.createElement('div');
            opt.className = 'corp-select-option';
            opt.innerText = `${c.id} (${c.tipo})`;
            opt.onclick = () => {
                hiddenInput.value = c.id;
                summary.innerText = `${c.id} (${c.tipo})`;
                details.removeAttribute('open');
            };
            list.appendChild(opt);
        });

        if (encontrado) {
            summary.innerText = `${encontrado.id} (${encontrado.tipo})`;
        } else {
            hiddenInput.value = '';
            summary.innerText = '-- Circ --';
        }
    });

    document.querySelectorAll('.esp-item').forEach(item => poblarAcordeonCircuitoElement(item));
}

function esCargaPuntual(tipo) {
    return tipo.includes("Acondicionado") || tipo.includes("Motor");
}

function actualizarEstadoDimensionesUI(tipo) {
    const grupoDim = document.getElementById('grupoDimensiones');
    const avisoPuntual = document.getElementById('avisoCargaPuntual');
    if (!grupoDim || !avisoPuntual) return;

    if (tipo && esCargaPuntual(tipo)) {
        grupoDim.classList.add('oculto');
        avisoPuntual.classList.remove('oculto');
    } else {
        grupoDim.classList.remove('oculto');
        avisoPuntual.classList.add('oculto');
    }
}

function limpiarFormularioAmbiente() {
    document.getElementById('selAmbiente').value = "";
    document.getElementById('sumAmbiente').innerText = "-- Seleccione --";
    document.getElementById('inputIdentificador').value = "";
    document.getElementById('inputAncho').value = "";
    document.getElementById('inputLargo').value = "";
    actualizarEstadoDimensionesUI("");

    document.getElementById('bocasIUG').value = "0";
    document.getElementById('circuitoIUG').value = "";
    document.getElementById('sumCircuitoIUG').innerText = "-- Circ --";

    document.getElementById('bocasTUG').value = "0";
    document.getElementById('circuitoTUG').value = "";
    document.getElementById('sumCircuitoTUG').innerText = "-- Circ --";

    document.getElementById('contenedor-esps').innerHTML = crearFilaEspHTML(0, '', '', false);
    actualizarSelectoresEnFormulario();
}

function abrirModalCargaAmbiente(modoEdicion = false) {
    if (!modoEdicion) {
        cancelarEdicion();
        limpiarFormularioAmbiente();
    }
    const modal = document.getElementById('modalCargaAmbiente');
    const body = document.getElementById('bodyModalAmbiente');
    if (modal) modal.classList.remove('oculto');
    if (body) body.scrollTop = 0;
    document.body.style.overflow = 'hidden';
}

function cerrarModalCargaAmbiente() {
    const modal = document.getElementById('modalCargaAmbiente');
    if (modal) modal.classList.add('oculto');
    document.body.style.overflow = '';
    cancelarEdicion();
    limpiarFormularioAmbiente();
}

function guardarAmbiente() {
    const tipoBase = document.getElementById('selAmbiente').value;
    const identificador = document.getElementById('inputIdentificador').value.trim();
    const ancho = parseFloat(document.getElementById('inputAncho').value.replace(',', '.')) || 0;
    const largo = parseFloat(document.getElementById('inputLargo').value.replace(',', '.')) || 0;
    const bIUG = parseInt(document.getElementById('bocasIUG').value) || 0;
    const circIUG = document.getElementById('circuitoIUG').value;
    const bTUG = parseInt(document.getElementById('bocasTUG').value) || 0;
    const circTUG = document.getElementById('circuitoTUG').value;

    let esps = [];
    document.querySelectorAll('.esp-item').forEach(item => {
        const b = parseInt(item.querySelector('.bocas-esp-input').value) || 0;
        const c = item.querySelector('.circuito-esp-input').value;
        const d = item.querySelector('.desc-esp-input').value.trim();
        if (b > 0 && c) esps.push({ bocas: b, circ: c, desc: d });
    });

    if (!tipoBase) {
        mostrarAlertaCorp("Falta Ambiente", "Seleccioná el tipo de ambiente o carga eléctrica.");
        return;
    }

    const puntual = esCargaPuntual(tipoBase);
    if (!puntual && (ancho <= 0 || largo <= 0)) {
        mostrarAlertaCorp("Medidas Inválidas", "Ingresá el ancho y largo en metros para calcular la superficie.");
        return;
    }

    if ((bIUG > 0 && !circIUG) || (bTUG > 0 && !circTUG)) {
        mostrarAlertaCorp("Circuito sin Asignar", "Seleccioná a qué circuito (C1, C2...) pertenecen las bocas cargadas.");
        return;
    }

    let espSinCirc = false;
    document.querySelectorAll('.esp-item').forEach(item => {
        const b = parseInt(item.querySelector('.bocas-esp-input').value) || 0;
        const c = item.querySelector('.circuito-esp-input').value;
        if (b > 0 && !c) espSinCirc = true;
    });
    if (espSinCirc) {
        mostrarAlertaCorp("Circuito ESP sin Asignar", "Asigná un circuito a las bocas especiales cargadas.");
        return;
    }

    let bESP = 0, circESP = "", descESP = "";
    if (esps.length > 0) {
        bESP = esps[0].bocas;
        circESP = esps[0].circ;
        descESP = esps[0].desc;
    }

    let areaCalculada = puntual ? 0 : (ancho * largo);
    if (!puntual && (tipoBase.includes("Semi") || tipoBase.includes("Balcón") || tipoBase.includes("Exterior"))) {
        areaCalculada = areaCalculada / 2;
    }

    const etiquetaFinal = identificador ? `${tipoBase} (${identificador})` : tipoBase;

    const obj = {
        id: editandoId ? parseInt(editandoId) : Date.now(),
        tipo: etiquetaFinal,
        tipoBase: tipoBase,
        identificador: identificador,
        ancho: puntual ? 0 : ancho,
        largo: puntual ? 0 : largo,
        area: areaCalculada,
        bIUG,
        circIUG,
        bTUG,
        circTUG,
        bESP,
        circESP,
        descESP,
        esps
    };

    if (editandoId) {
        const idx = listaAmbientes.findIndex(a => a.id === obj.id);
        if (idx !== -1) listaAmbientes[idx] = obj;
        mostrarToast("Actualizado", `${etiquetaFinal} modificado.`);
    } else {
        listaAmbientes.push(obj);
        mostrarToast("Agregado", `${etiquetaFinal} sumado a la planilla.`);
    }

    cerrarModalCargaAmbiente();
    calcularGradoYRenderizar();
}

function editarAmbiente(id) {
    const amb = listaAmbientes.find(a => a.id === id);
    if (!amb) return;
    editandoId = id;
    document.getElementById('editandoId').value = id;

    document.getElementById('titulo-form-ambiente').innerHTML = "<i class='fa-solid fa-pen corp-accent-color'></i> Editando Ambiente";
    document.getElementById('btnGuardarAmbiente').innerHTML = "<i class='fa-solid fa-check'></i> Actualizar Ambiente";

    let tipoBase = amb.tipoBase || amb.tipo;
    let identificador = amb.identificador || "";
    if (!amb.tipoBase && amb.tipo && amb.tipo.includes(" (") && !amb.tipo.endsWith("(Semi)")) {
        const match = amb.tipo.match(/^(.*?)\s\(([^)]+)\)$/);
        if (match) {
            tipoBase = match[1];
            identificador = match[2];
        }
    }

    document.getElementById('selAmbiente').value = tipoBase;
    document.getElementById('sumAmbiente').innerText = tipoBase || "-- Seleccione --";
    document.getElementById('inputIdentificador').value = identificador;
    document.getElementById('inputAncho').value = amb.ancho || "";
    document.getElementById('inputLargo').value = amb.largo || "";
    actualizarEstadoDimensionesUI(tipoBase);

    document.getElementById('bocasIUG').value = amb.bIUG;
    document.getElementById('circuitoIUG').value = amb.circIUG;
    const cIUG = circuitos.find(c => c.id === amb.circIUG);
    document.getElementById('sumCircuitoIUG').innerText = cIUG ? `${cIUG.id} (${cIUG.tipo})` : "-- Circ --";

    document.getElementById('bocasTUG').value = amb.bTUG;
    document.getElementById('circuitoTUG').value = amb.circTUG;
    const cTUG = circuitos.find(c => c.id === amb.circTUG);
    document.getElementById('sumCircuitoTUG').innerText = cTUG ? `${cTUG.id} (${cTUG.tipo})` : "-- Circ --";

    const contenedorEsps = document.getElementById('contenedor-esps');
    contenedorEsps.innerHTML = '';

    let espsToLoad = (amb.esps && amb.esps.length > 0)
        ? amb.esps
        : [{ bocas: amb.bESP || 0, circ: amb.circESP || '', desc: amb.descESP || '' }];

    espsToLoad.forEach((esp, idx) => {
        const temp = document.createElement('div');
        temp.innerHTML = crearFilaEspHTML(esp.bocas, esp.circ, esp.desc, idx > 0).trim();
        contenedorEsps.appendChild(temp.firstElementChild);
    });

    actualizarSelectoresEnFormulario();
    abrirModalCargaAmbiente(true);
}

function cancelarEdicion() {
    editandoId = null;
    const elEdit = document.getElementById('editandoId');
    if (elEdit) elEdit.value = "";
    const elTitulo = document.getElementById('titulo-form-ambiente');
    if (elTitulo) elTitulo.innerHTML = "<i class='fa-solid fa-house-signal corp-accent-color'></i> Carga de Ambientes";
    const elBtn = document.getElementById('btnGuardarAmbiente');
    if (elBtn) elBtn.innerHTML = "<i class='fa-solid fa-plus'></i> Agregar Ambiente";
}


function borrarItem(id) {
    if (editandoId === id) {
        cancelarEdicion();
        limpiarFormularioAmbiente();
    }
    listaAmbientes = listaAmbientes.filter(i => i.id !== id);
    calcularGradoYRenderizar();
}

// Actualizador Principal de Celdas de Circuitos
window.updC = function(id, field, value) {
    let c = (id === 'CS') ? circuitoCS : circuitos.find(x => x.id === id);
    if (c) {
        c[field] = value === "" ? "" : (parseFloat(value) || value);
        if (id !== 'CS' && field === 'dpms') c.userEditedDpms = true;
        if (field === 'seccionLN') {
            if (MAPA_IZ[value]) c['iz'] = MAPA_IZ[value];
            // Autocompletar PE igual a L;N si aún no fue elegido (regla general <= 16 mm²)
            if (value !== "" && c.seccionPE === "") {
                c['seccionPE'] = parseFloat(value) || value;
            }
        }
        renderTabla();
    }
};

// ==========================================
// MOTOR MODAL PARA TABLAS (TENSIÓN, SECCIONES, IN)
// ==========================================
let contextoSeleccionActual = null;

function abrirModalTabla(idCircuito, campo, valorActual) {
    contextoSeleccionActual = { id: idCircuito, campo: campo };
    let titulo = 'Seleccionar';
    let opciones = [];
    let sufijo = '';

    if (campo === 'tension') {
        titulo = `Tensión (${idCircuito})`;
        opciones = [220, 380];
        sufijo = ' V';
    } else if (campo === 'seccionLN') {
        titulo = `Sección L;N (${idCircuito})`;
        opciones = [1.5, 2.5, 4, 6, 10, 16];
        sufijo = ' mm²';
    } else if (campo === 'seccionPE') {
        titulo = `Sección PE (${idCircuito})`;
        opciones = [1.5, 2.5, 4, 6, 10, 16];
        sufijo = ' mm²';
    } else if (campo === 'in') {
        titulo = `Protección In (${idCircuito})`;
        opciones = [2, 4, 6, 10, 15, 16, 20, 25, 32, 40, 50, 63];
        sufijo = ' A';
    }

    document.getElementById('tituloModalSeleccion').innerText = titulo;
    dibujarOpcionesEnModal(opciones, valorActual, sufijo);
    document.getElementById('modalSeleccionTabla').classList.remove('oculto');
}

function dibujarOpcionesEnModal(arrayOpciones, valorActual, sufijo) {
    const contenedor = document.getElementById('listaOpcionesModal');
    contenedor.innerHTML = '';

    arrayOpciones.forEach(opcion => {
        const esSeleccionado = (opcion.toString() === valorActual.toString());
        const div = document.createElement('div');
        div.className = 'corp-select-option';
        div.style.borderBottom = '1px solid rgba(150, 150, 150, 0.1)';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.cursor = 'pointer';
        div.style.padding = '12px 15px';

        if (esSeleccionado) {
            div.style.color = 'var(--ngc-neon)';
            div.style.fontWeight = 'bold';
        }

        div.innerHTML = `<span>${opcion}${sufijo}</span> ${esSeleccionado ? '<i class="fa-solid fa-check"></i>' : ''}`;
        div.onclick = () => aplicarSeleccionDesdeModal(opcion);
        contenedor.appendChild(div);
    });

    const divVacio = document.createElement('div');
    divVacio.className = 'corp-select-option';
    divVacio.style.padding = '12px 15px';
    divVacio.style.cursor = 'pointer';
    divVacio.style.color = 'var(--error-red)';
    divVacio.innerHTML = `<span><i class="fa-solid fa-eraser"></i> Vaciar Selección</span>`;
    divVacio.onclick = () => aplicarSeleccionDesdeModal('');
    contenedor.appendChild(divVacio);
}

function aplicarSeleccionDesdeModal(valorSeleccionado) {
    if (!contextoSeleccionActual) return;
    const { id, campo } = contextoSeleccionActual;
    window.updC(id, campo, valorSeleccionado);
    cerrarModalSeleccionTabla();
}

function cerrarModalSeleccionTabla() {
    document.getElementById('modalSeleccionTabla').classList.add('oculto');
    contextoSeleccionActual = null;
}

function buildButtonHtml(id, field, currentVal, validationColor) {
    let colorStyle = (currentVal !== "") ? `color: ${validationColor}; font-weight:bold;` : `color: inherit;`;
    let displayVal = currentVal !== "" ? currentVal : '-';
    return `<button type="button" class="circ-input" style="${colorStyle} min-height: 28px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="abrirModalTabla('${id}', '${field}', '${currentVal}')">
        <span style="flex:1; text-align:center;">${displayVal}</span> <i class="fa-solid fa-chevron-down" style="font-size: 0.55rem; opacity:0.7;"></i>
    </button>`;
}

// ==========================================
// AUDITORÍA NORMATIVA Y RENDERIZADO DE TABLA
// ==========================================
function evaluarCumplimientoAEA(gradoActual, totalesBocas, todosLosCircuitos) {
    const banner = document.getElementById('ui-aea-status');
    if (!banner) return;

    if (listaAmbientes.length === 0) {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Cargá ambientes para validar circuitos AEA 90364.';
        return;
    }

    const alertas = [];
    const reqCircuitos = (gradoActual === 'SUPERIOR') ? 6 : (gradoActual === 'ELEVADO' ? 5 : (gradoActual === 'MEDIO' ? 3 : 2));
    if (circuitos.length < reqCircuitos) {
        alertas.push(`Grado ${gradoActual} exige mín. ${reqCircuitos} circuitos`);
    }

    circuitos.forEach(c => {
        if ((c.tipo === 'IUG' || c.tipo === 'TUG') && totalesBocas[c.id] > 15) {
            alertas.push(`${c.id} excede 15 bocas máx. (${totalesBocas[c.id]})`);
        }
    });

    todosLosCircuitos.forEach(c => {
        if (c.tension !== "" && c.in !== "" && c.iz !== "") {
            const ib = c._ibCalc || 0;
            const pIn = parseFloat(c.in) || 0;
            const iz = parseFloat(c.iz) || 0;
            if (pIn < ib || pIn > iz) {
                alertas.push(`${c.id}: revisar Ib ≤ In ≤ Iz`);
            }
        }
    });

    if (alertas.length === 0) {
        banner.className = 'pot-aea-banner ok';
        banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> Verificación AEA 90364 OK • Grado ${gradoActual} (${circuitos.length} circuitos activos).`;
    } else {
        banner.className = 'pot-aea-banner warn';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${alertas.join(' • ')}`;
    }
}

function calcularGradoYRenderizar() {
    let areaTotal = 0;
    listaAmbientes.forEach(i => {
        if (!esCargaPuntual(i.tipoBase || i.tipo)) areaTotal += i.area;
    });
    const gradoActual = obtenerGradoElectrificacion(areaTotal);
    autoAjustarCircuitos(gradoActual);
    document.getElementById('ui-sla').innerText = `${areaTotal.toFixed(2)} m²`;
    document.getElementById('ui-grado').innerText = gradoActual;
    renderTabla(areaTotal, gradoActual);
}

function renderTabla(areaTotal, gradoActual) {
    areaTotal = (typeof areaTotal === 'number') ? areaTotal : (parseFloat(document.getElementById('ui-sla').innerText) || 0);
    gradoActual = gradoActual || document.getElementById('ui-grado').innerText;

    const thead = document.getElementById('cabeceraTabla');
    const tbody = document.getElementById('cuerpoTabla');
    const tfoot = document.getElementById('pieTabla');

    let todosLosCircuitos = [...circuitos, circuitoCS];
    let stickyBg = "var(--bg-body)";

    let ths = `<tr style="border-bottom: 1px solid var(--ngc-neon); color: var(--ngc-neon);">
                <th style="text-align:left; padding:6px 5px; position: sticky; left:0; background:${stickyBg}; z-index:2; min-width: 90px;">Ambiente</th>
                <th style="min-width: 42px;">m²</th>`;
    todosLosCircuitos.forEach(c => {
        let name = c.id === 'CS' ? "C.S.<br><small>Tablero</small>" : `${c.id}<br><small>${c.tipo}</small>`;
        ths += `<th style="min-width: 56px;">${name}</th>`;
    });
    ths += `<th style="min-width: 26px;"></th><th style="min-width: 26px;"></th></tr>`;
    thead.innerHTML = ths;
    tbody.innerHTML = '';

    let totalesBocas = {};
    circuitos.forEach(c => totalesBocas[c.id] = 0);

    if (listaAmbientes.length === 0) {
        const colSpanTotal = todosLosCircuitos.length + 4;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colSpanTotal}" style="padding: 18px 10px; color: var(--ngc-text-faded); font-size: 0.78rem; text-align: center;">
                    <i class="fa-solid fa-arrow-up" style="color: var(--ngc-neon);"></i> Cargá el primer ambiente arriba para iniciar el dimensionamiento AEA.
                </td>
            </tr>`;
    } else {
        listaAmbientes.forEach(i => {
            let celdasCircuitos = "";
            circuitos.forEach(c => {
                let cant = 0;
                let descArr = [];
                if (i.circIUG === c.id) cant += i.bIUG;
                if (i.circTUG === c.id) cant += i.bTUG;

                if (i.esps && i.esps.length > 0) {
                    i.esps.forEach(esp => {
                        if (esp.circ === c.id) {
                            cant += esp.bocas;
                            if (esp.desc) descArr.push(esp.desc);
                        }
                    });
                } else if (i.circESP === c.id) {
                    cant += i.bESP;
                    if (i.descESP) descArr.push(i.descESP);
                }

                let desc = descArr.join(', ');
                totalesBocas[c.id] += cant;
                let texto = cant > 0 ? `<b>${cant}</b>` : "-";
                if (desc && cant > 0) texto += `<br><small style="color:var(--ngc-text-faded); font-size:0.65rem;">${desc}</small>`;
                celdasCircuitos += `<td>${texto}</td>`;
            });

            celdasCircuitos += `<td>-</td>`;
            const esPuntual = esCargaPuntual(i.tipoBase || i.tipo);

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--ngc-privacy-border);">
                    <td style="text-align:left; padding:8px 5px; position: sticky; left:0; background:${stickyBg}; z-index:1; font-weight:500;">${i.tipo}</td>
                    <td>${(i.area > 0 && !esPuntual) ? i.area.toFixed(2) : '-'}</td>
                    ${celdasCircuitos}
                    <td><button type="button" onclick="editarAmbiente(${i.id})" style="background:transparent; border:none; color:var(--ngc-neon); cursor:pointer; padding:4px;" title="Editar"><i class="fa-solid fa-pen"></i></button></td>
                    <td><button type="button" onclick="borrarItem(${i.id})" style="background:transparent; border:none; color:var(--error-red); cursor:pointer; padding:4px;" title="Eliminar"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`;
        });
    }

    let dpmsTotal = 0;
    circuitos.forEach(c => {
        if (!c.userEditedDpms && c.tipo === 'IUG') c.dpms = Math.ceil(totalesBocas[c.id] * 150 * 0.66);
        dpmsTotal += parseFloat(c.dpms) || 0;
    });

    let coef = (gradoActual === 'SUPERIOR') ? 0.7 : (gradoActual === 'ELEVADO' ? 0.8 : (gradoActual === 'MEDIO' ? 0.9 : 1));
    circuitoCS.dpms = dpmsTotal * coef;
    document.getElementById('ui-dpms').innerText = circuitoCS.dpms.toFixed(2) + ' VA';

    const sumElegido = document.getElementById('selSuministro').value;
    const faseAlerta = document.getElementById('ui-fase-alerta');
    if (circuitoCS.dpms > 7000 && sumElegido === 'MONOFÁSICO') {
        faseAlerta.innerText = "⚠️ RECOM. TRIFÁSICO";
        faseAlerta.style.color = "var(--error-red)";
    } else if (circuitoCS.dpms <= 7000 && sumElegido === 'TRIFÁSICO') {
        faseAlerta.innerText = "✓ EXCEDE REQ.";
        faseAlerta.style.color = "var(--success-green)";
    } else {
        faseAlerta.innerText = "✓ CUMPLE AEA";
        faseAlerta.style.color = "var(--success-green)";
    }

    let tfootStr = ``;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;"><b>BOCAS T.</b></td>`;
    circuitos.forEach(c => {
        let b = totalesBocas[c.id];
        let color = b > 15 ? 'var(--error-red)' : 'var(--ngc-warning)';
        tfootStr += `<td style="color:${color}; font-weight:bold;">${b}</td>`;
    });
    tfootStr += `<td>-</td><td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;"><b>DPMS (VA)</b></td>`;
    circuitos.forEach(c => {
        tfootStr += `<td><input type="number" class="circ-input" style="color:var(--success-green); font-weight:bold;" value="${c.dpms}" onchange="updC('${c.id}','dpms',this.value)"></td>`;
    });
    tfootStr += `<td style="color:var(--ngc-warning); font-weight:bold; font-size:0.75rem;">${circuitoCS.dpms.toFixed(0)}</td><td colspan="2"></td></tr>`;

    const evalVerdeRojo = (condicion) => condicion ? 'var(--success-green)' : 'var(--error-red)';

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">Tensión (V)</td>`;
    todosLosCircuitos.forEach(c => {
        let col = c.tension !== "" ? 'var(--success-green)' : 'inherit';
        tfootStr += `<td>${buildButtonHtml(c.id, 'tension', c.tension, col)}</td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">Ib (A)</td>`;
    todosLosCircuitos.forEach(c => {
        let ib = "-";
        c._ibCalc = 0;
        if (c.tension !== "") {
            let p = parseFloat(c.dpms) || 0;
            let ibNum = (c.tension == 380) ? (p / (1.732 * 380)) : (p / c.tension);
            c._ibCalc = ibNum;
            ib = ibNum.toFixed(2);
        }
        tfootStr += `<td style="color:var(--ngc-text-faded); font-size:0.72rem; font-weight:600;">${ib}</td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">Sección L;N</td>`;
    todosLosCircuitos.forEach(c => {
        let minL = (c.tipo === 'IUG' || c.tipo === 'MBTF') ? 1.5 : (c.id === 'CS' ? 4.0 : 2.5);
        let col = evalVerdeRojo(parseFloat(c.seccionLN) >= minL);
        tfootStr += `<td>${buildButtonHtml(c.id, 'seccionLN', c.seccionLN, col)}</td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">Sección PE</td>`;
    todosLosCircuitos.forEach(c => {
        let col = evalVerdeRojo(c.seccionLN !== "" && parseFloat(c.seccionPE) >= parseFloat(c.seccionLN));
        tfootStr += `<td>${buildButtonHtml(c.id, 'seccionPE', c.seccionPE, col)}</td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">Iz (A)</td>`;
    todosLosCircuitos.forEach(c => {
        let col = evalVerdeRojo(c._ibCalc > 0 && parseFloat(c.iz) >= c._ibCalc);
        let valStr = c.iz === "" ? "" : c.iz;
        let style = c.iz !== "" ? `color: ${col}; font-weight:bold;` : 'color: inherit;';
        tfootStr += `<td><input type="number" class="circ-input" style="${style}" placeholder="-" value="${valStr}" onchange="updC('${c.id}','iz',this.value)"></td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align:right; padding:5px; position: sticky; left:0; background:${stickyBg}; z-index:1;">In (A)</td>`;
    todosLosCircuitos.forEach(c => {
        let ib = c._ibCalc || 0;
        let iz = parseFloat(c.iz) || 0;
        let pIn = parseFloat(c.in);
        let cumpleIn = (pIn >= ib && pIn <= iz && pIn > 0);
        let col = evalVerdeRojo(cumpleIn);
        tfootStr += `<td>${buildButtonHtml(c.id, 'in', c.in, col)}</td>`;
    });
    tfootStr += `<td colspan="2"></td></tr>`;

    tfoot.innerHTML = tfootStr;

    actualizarGestorCircuitos(totalesBocas);
    evaluarCumplimientoAEA(gradoActual, totalesBocas, todosLosCircuitos);
    sincronizarVistaPreviaPDF(areaTotal, gradoActual, circuitoCS.dpms, sumElegido, totalesBocas, todosLosCircuitos);
                                }

// ==========================================
// VISTA PREVIA Y PDF
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

function sincronizarVistaPreviaPDF(areaTotal, grado, dpmsPonderado, suministro, totalesBocas, todosArr) {
    actualizarPDFHeaders();

    const cliNombre = document.getElementById('cliNombre').value.trim() || 'Sin Nombre';
    const cliDir = document.getElementById('cliDireccion').value.trim();
    const cliProy = document.getElementById('cliProyecto').value.trim();

    document.getElementById('pdf-cliente').innerText = cliNombre;
    document.getElementById('pdf-fecha').innerText = new Date().toLocaleDateString('es-AR');

    const lblDir = document.getElementById('lbl-pdf-dir');
    const valDir = document.getElementById('pdf-dir');
    if (cliDir) {
        lblDir.style.display = 'block';
        valDir.style.display = 'block';
        valDir.innerText = cliDir;
    } else {
        lblDir.style.display = 'none';
        valDir.style.display = 'none';
    }

    const lblProy = document.getElementById('lbl-pdf-proyecto');
    const valProy = document.getElementById('pdf-proyecto');
    if (cliProy) {
        lblProy.style.display = 'block';
        valProy.style.display = 'block';
        valProy.innerText = cliProy;
    } else {
        lblProy.style.display = 'none';
        valProy.style.display = 'none';
    }

    const thead = document.getElementById('pdf-thead');
    const tbody = document.getElementById('pdf-tbody');
    const tfoot = document.getElementById('pdf-tfoot');

    let ths = `<tr><th style="text-align: left; padding-left: 8px;">Ambiente / Carga</th><th>Sup. (m²)</th>`;
    todosArr.forEach(c => {
        const esCS = c.id === 'CS';
        ths += `<th class="${esCS ? 'col-cs' : ''}">
            <div style="font-size: 10px; font-weight: 800;">${esCS ? 'C.S.' : c.id}</div>
            <div style="font-size: 7.5px; font-weight: 600; color: #cbd5e1; margin-top: 1px;">${c.tipo}</div>
        </th>`;
    });
    ths += `</tr>`;
    thead.innerHTML = ths;
    tbody.innerHTML = '';

    listaAmbientes.forEach(i => {
        let celdas = "";
        circuitos.forEach(c => {
            let cant = 0;
            let descArr = [];
            if (i.circIUG === c.id) cant += i.bIUG;
            if (i.circTUG === c.id) cant += i.bTUG;

            if (i.esps && i.esps.length > 0) {
                i.esps.forEach(esp => {
                    if (esp.circ === c.id) {
                        cant += esp.bocas;
                        if (esp.desc) descArr.push(esp.desc);
                    }
                });
            } else if (i.circESP === c.id) {
                cant += i.bESP;
                if (i.descESP) descArr.push(i.descESP);
            }

            let desc = descArr.join(', ');
            let txt = cant > 0 ? `<strong>${cant}</strong>` : `<span style="color:#94a3b8;">-</span>`;
            if (desc && cant > 0) txt += `<br><span style="font-size: 7.5px; color: #475569;">${desc}</span>`;
            celdas += `<td>${txt}</td>`;
        });
        celdas += `<td class="col-cs" style="color:#94a3b8;">-</td>`;
        const esPuntual = esCargaPuntual(i.tipoBase || i.tipo);
        const supTxt = (i.area > 0 && !esPuntual) ? i.area.toFixed(2) : '-';
        tbody.innerHTML += `<tr>
            <td style="text-align: left; padding-left: 8px; font-weight: 500;">${i.tipo}</td>
            <td>${supTxt}</td>
            ${celdas}
        </tr>`;
    });

    let tfootStr = ``;
    tfootStr += `<tr class="row-destacada"><td colspan="2" style="text-align: right; padding-right: 8px;">TOTAL BOCAS</td>`;
    circuitos.forEach(c => {
        const b = totalesBocas[c.id];
        const alertaBocas = b > 15 ? 'color: #b91c1c;' : '';
        tfootStr += `<td style="${alertaBocas}">${b}</td>`;
    });
    tfootStr += `<td class="col-cs">-</td></tr>`;

    tfootStr += `<tr class="row-destacada"><td colspan="2" style="text-align: right; padding-right: 8px;">DPMS (VA)</td>`;
    todosArr.forEach(c => {
        const esCS = c.id === 'CS';
        tfootStr += `<td class="${esCS ? 'col-cs' : ''}">${esCS ? Number(c.dpms).toFixed(0) : c.dpms}</td>`;
    });
    tfootStr += `</tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align: right; padding-right: 8px; color: #475569;">Tensión (V)</td>`;
    todosArr.forEach(c => tfootStr += `<td class="${c.id === 'CS' ? 'col-cs' : ''}">${c.tension || '-'}</td>`);
    tfootStr += `</tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align: right; padding-right: 8px; color: #475569;">Corriente Ib (A)</td>`;
    todosArr.forEach(c => {
        let ib = "-";
        if (c.tension) {
            ib = (c.tension == 380) ? (c.dpms / (1.732 * 380)) : (c.dpms / c.tension);
            ib = ib.toFixed(2);
        }
        tfootStr += `<td class="${c.id === 'CS' ? 'col-cs' : ''}">${ib}</td>`;
    });
    tfootStr += `</tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align: right; padding-right: 8px; color: #475569;">Sección L;N / PE (mm²)</td>`;
    todosArr.forEach(c => {
        const sec = (c.seccionLN || c.seccionPE) ? `${c.seccionLN || '-'} / ${c.seccionPE || '-'}` : '-';
        tfootStr += `<td class="${c.id === 'CS' ? 'col-cs' : ''}">${sec}</td>`;
    });
    tfootStr += `</tr>`;

    tfootStr += `<tr><td colspan="2" style="text-align: right; padding-right: 8px; color: #475569;">Iz / In (A)</td>`;
    todosArr.forEach(c => {
        const prot = (c.iz || c.in) ? `${c.iz || '-'} / ${c.in || '-'}` : '-';
        tfootStr += `<td class="${c.id === 'CS' ? 'col-cs' : ''}">${prot}</td>`;
    });
    tfootStr += `</tr>`;

    tfoot.innerHTML = tfootStr;

    const coef = (grado === 'SUPERIOR') ? '0.70' : (grado === 'ELEVADO' ? '0.80' : (grado === 'MEDIO' ? '0.90' : '1.00'));
    document.getElementById('pdf-sla-val').innerText = `${areaTotal.toFixed(2)} m²`;
    document.getElementById('pdf-grado-val').innerText = grado;
    const elCoef = document.getElementById('pdf-coef-val');
    if (elCoef) elCoef.innerText = `Coef. simult.: ${coef}`;
    document.getElementById('pdf-dpms-val').innerText = `${dpmsPonderado.toFixed(2)} VA`;
    document.getElementById('pdf-sum-val').innerText = suministro;
}

// ==========================================
// CONTROL DEL MENÚ AGRUPADOR "ACCIONES"
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

// ==========================================
// VISTA PREVIA Y ZOOM INTELIGENTE (AISLADO)
// ==========================================
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
    if (listaAmbientes.length === 0) {
        mostrarAlertaCorp("Sin Contenido", "Cargá ambientes antes de ver la vista previa.");
        return;
    }

    calcularGradoYRenderizar();

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

// ==========================================
// GENERADOR DE PDF CON MODAL CORPORATIVO Y CONTROL DE SELLO
// ==========================================
function generarPDF() {
    if (listaAmbientes.length === 0) {
        mostrarAlertaCorp("Sin Contenido", "Debe cargar ambientes para generar el PDF.");
        return;
    }

    calcularGradoYRenderizar();

    const shortName = (document.getElementById('cliNombre').value || "Proyecto").trim().split(' ')[0].replace(/[^a-zA-Z0-9_-]/g, '') || "Proyecto";
    const uniqueSuffix = Math.floor(Math.random() * 9000) + 1000;

    document.getElementById('nombreArchivoPDF').value = `Carga_Circuitos_${shortName}_${uniqueSuffix}`;
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    if (typeof permiteGuardarNube !== 'undefined' && permiteGuardarNube && typeof guardarBorradorFirebase === 'function') {
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
        element.style.width = '';
        element.style.height = '';
    }

    const marcaAgua = document.getElementById('marcaAguaPDF');
    if (marcaAgua) marcaAgua.style.display = 'none';

    const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Carga_Circuitos';

    const opt = {
        margin: 0,
        filename: `${nombreFinal}.pdf`,
        image: { type: 'png' },
        html2canvas: { scale: 3, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    try {
        await html2pdf().set(opt).from(element).save();
        cerrarModalPDF();
        mostrarToast("Éxito", "PDF generado correctamente.");
    } catch (error) {
        mostrarAlertaCorp("Error", "Ocurrió un error al generar el PDF.");
        btn.innerHTML = "Descargar";
    } finally {
        if (marcaAgua) marcaAgua.style.display = 'flex';

        if (modalAbierto) {
            aplicarEscalaVistaPrevia(escalaActualPreview);
        } else if (window.innerWidth < 992) {
            element.style.display = 'none';
        }
    }
}

// ==========================================
// WHATSAPP (INTEGRACIÓN GLOBAL CON DESGLOSE TÉCNICO)
// ==========================================
function prepararEnvioWhatsApp() {
    if (listaAmbientes.length === 0) {
        mostrarAlertaCorp("Faltan Datos", "Cargá al menos un ambiente.");
        return;
    }

    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL';
    const dpms = document.getElementById('ui-dpms').innerText;
    const grado = document.getElementById('ui-grado').innerText;
    const area = document.getElementById('ui-sla').innerText;
    const suministro = document.getElementById('selSuministro').value;

    let m = `*${profNombre.toUpperCase()} - CÁLCULO DE CARGAS*\n`;
    m += `*Cliente:* ${document.getElementById('cliNombre').value || 'Sin Nombre'}\n`;
    if (document.getElementById('cliProyecto').value.trim()) {
        m += `*Proyecto:* ${document.getElementById('cliProyecto').value.trim()}\n`;
    }
    m += `\n*Síntesis AEA 90364:*\n`;
    m += `• Superficie Límite (SLA): ${area}\n`;
    m += `• Grado Electrificación: ${grado}\n`;
    m += `• Suministro: ${suministro}\n`;
    m += `• DPMS Total: ${dpms}\n\n`;

    m += `*Detalle de Circuitos (${circuitos.length}):*\n`;
    circuitos.forEach(c => {
        const prot = c.in ? ` • PIA ${c.in}A` : '';
        const sec = c.seccionLN ? ` • ${c.seccionLN}mm²` : '';
        m += `• *${c.id} (${c.tipo}):* ${Math.round(c.dpms)} VA${sec}${prot}\n`;
    });

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, m);
    } else {
        console.error("No se encontró abrirModalWspGlobal.");
    }
}

// ==========================================
// BORRADORES EN LA NUBE (FIREBASE)
// ==========================================
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
    if (listaAmbientes.length === 0) {
        if (mostrarAlerta) mostrarAlertaCorp("Sin Datos", "Cargá al menos un ambiente antes de guardar.");
        return;
    }

    const nombreCli = (document.getElementById('cliNombre').value.trim() || 'Sin_Nombre').replace(/\s+/g, '_');
    const proyCli = (document.getElementById('cliProyecto').value.trim() || 'Calculo').replace(/\s+/g, '_');
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
    actualizarResumenProyectoUI('syncing');

    const estado = {
        cliNombre: document.getElementById('cliNombre').value,
        cliDireccion: document.getElementById('cliDireccion').value,
        cliProyecto: document.getElementById('cliProyecto').value,
        suministro: document.getElementById('selSuministro').value,
        listaAmbientes: listaAmbientes,
        circuitos: circuitos,
        circuitoCS: circuitoCS,
        fechaGuardado: Date.now(),
        nombreBorrador: nombreFinal,
        telefonoClienteActual: telefonoClienteActual
    };

    let docId = nombreFinal.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    db.collection("perfiles").doc(uid).collection("borradores_potencia").doc(docId).set(estado)
        .then(() => {
            actualizarResumenProyectoUI('synced');
            if (mostrarAlerta) mostrarToast("Guardado", "Sincronizado con la nube.");
        })
        .catch((e) => {
            console.error("Error Firebase:", e);
            actualizarResumenProyectoUI();
            if (mostrarAlerta) mostrarAlertaCorp("Error", "Error al guardar el borrador.");
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

    db.collection("perfiles").doc(uid).collection("borradores_potencia").doc(idBorradorAEliminar).delete()
        .then(() => {
            if (btnBorradorAEliminar) {
                btnBorradorAEliminar.closest('div.modal-list-item').remove();
            }
            cerrarModalEliminarBorrador();
            mostrarToast("Eliminado", "Borrador eliminado de la nube.");
        })
        .catch((e) => {
            console.error("Error eliminando: ", e);
            mostrarAlertaCorp("Error", "No se pudo eliminar el borrador.");
            cerrarModalEliminarBorrador();
        });
}

async function abrirModalBorradores() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if (!nombre) {
        mostrarAlertaCorp("Falta Cliente", "Ingresá el Nombre del Cliente primero para buscar sus borradores.");
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
        const snapshot = await db.collection("perfiles").doc(uid).collection("borradores_potencia")
            .where('cliNombre', '==', nombre)
            .get();

        let docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
        docs.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        lista.innerHTML = '';
        if (docs.length === 0) {
            lista.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded);">No hay borradores en nube.</p>';
            return;
        }

        docs.forEach(b => {
            const p = b.data;
            const fechaStr = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : 'Sin fecha';
            lista.innerHTML += `
                <div class="modal-list-item" style="border-left: 3px solid var(--ngc-neon);">
                    <div style="flex: 1; min-width: 0; padding-right: 10px;">
                        <h4 style="word-break: break-word; line-height: 1.2; margin-bottom: 5px;">${p.nombreBorrador || p.cliNombre}</h4>
                        <small style="color: var(--ngc-text-faded);">${fechaStr} • ${(p.listaAmbientes || []).length} amb.</small>
                    </div>
                    <div style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button class="corp-btn-small" onclick="cargarBorradorNube('${b.id}')">Abrir</button>
                        <button class="corp-btn-small danger" onclick="eliminarBorradorNube('${b.id}', this)"><i class="fa-solid fa-trash"></i></button>
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
        const doc = await db.collection("perfiles").doc(uid).collection("borradores_potencia").doc(docId).get();
        if (doc.exists) {
            const data = doc.data();

            document.getElementById('cliNombre').value = data.cliNombre || '';
            document.getElementById('cliDireccion').value = data.cliDireccion || data.cliDir || '';
            document.getElementById('cliProyecto').value = data.cliProyecto || '';

            listaAmbientes = data.listaAmbientes || [];
            circuitos = data.circuitos || [
                { id: 'C1', tipo: 'IUG', dpms: 0, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' },
                { id: 'C2', tipo: 'TUG', dpms: 2200, userEditedDpms: false, tension: '', seccionLN: '', seccionPE: '', iz: '', in: '' }
            ];
            circuitoCS = data.circuitoCS || { id: 'CS', tipo: 'T.P.', dpms: 0, tension: '220', seccionLN: '', seccionPE: '', iz: '', in: '' };

            if (data.suministro) {
                document.getElementById('selSuministro').value = data.suministro;
                document.getElementById('sumSuministro').innerText = data.suministro === 'TRIFÁSICO' ? 'TRIFA' : 'MONO';
            }

            if (data.telefonoClienteActual !== undefined) telefonoClienteActual = data.telefonoClienteActual;

            clienteDesdeAgenda = true;
            permiteGuardarNube = true;
            nombreBorradorActual = data.nombreBorrador || null;

            if (typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();

            document.getElementById('step-cliente').classList.add('oculto');
            document.getElementById('step-trabajo').classList.remove('oculto');
            document.getElementById('step-trabajo').classList.add('flex-column', 'gap-15');

            actualizarResumenProyectoUI('synced');
            actualizarGestorCircuitos();
            calcularGradoYRenderizar();
            mostrarToast("Borrador Abierto", "Los datos han sido cargados.");
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
        { nombre: 'Potencia', icon: 'fa-bolt', url: '#', active: true },
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

// ==========================================
// MOTOR DE ACORDEONES (FORMULARIOS Y DELEGACIÓN DINÁMICA)
// ==========================================
const ambientesOptions = [
    "Sala de Estar", "Comedor", "Living", "Dormitorio", "Cocina",
    "Baño", "Toilette", "Pasillo", "Lavadero", "Balcón (Semi)",
    "Galería (Semi)", "Porche (Semi)", "Cochera (Semi)", "Exterior",
    "Aire Acondicionado", "Motor / Bomba"
];

function inicializarAcordeonAmbiente() {
    const listAmb = document.getElementById('listAmbiente');
    if (!listAmb) return;
    listAmb.innerHTML = '';

    ambientesOptions.forEach(amb => {
        const opt = document.createElement('div');
        opt.className = 'corp-select-option';
        opt.innerText = amb;
        opt.onclick = () => {
            document.getElementById('selAmbiente').value = amb;
            document.getElementById('sumAmbiente').innerText = amb;
            document.getElementById('detAmbiente').removeAttribute('open');
            actualizarEstadoDimensionesUI(amb);
        };
        listAmb.appendChild(opt);
    });
}
document.addEventListener('DOMContentLoaded', inicializarAcordeonAmbiente);

function cambiarSuministro(valor, texto) {
    document.getElementById('selSuministro').value = valor;
    document.getElementById('sumSuministro').innerText = texto;
    document.getElementById('detSuministro').removeAttribute('open');

    // Sugerir tensión en C.S. si está vacía o coincide con estándar anterior
    if (circuitoCS.tension === '' || circuitoCS.tension == 220 || circuitoCS.tension == 380) {
        circuitoCS.tension = (valor === 'TRIFÁSICO') ? 380 : 220;
    }

    if (typeof renderTabla === 'function') renderTabla();
}

// ==========================================
// GESTIÓN FLOTANTE Y CIERRE DE ACORDEONES (ANTI-CLIPPING)
// ==========================================
function limpiarPosicionSelect(det) {
    const list = det.querySelector('.corp-select-list');
    if (!list) return;
    list.classList.remove('is-floating');
    list.style.top = '';
    list.style.bottom = '';
    list.style.left = '';
    list.style.width = '';
    list.style.maxHeight = '';
}

function posicionarSelectFlotante(det) {
    const summary = det.querySelector('summary');
    const list = det.querySelector('.corp-select-list');
    if (!summary || !list) return;

    const rect = summary.getBoundingClientRect();
    const margen = 12;
    const espacioAbajo = window.innerHeight - rect.bottom - margen;
    const espacioArriba = rect.top - margen;

    list.classList.add('is-floating');
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;

    if (espacioAbajo >= 170 || espacioAbajo >= espacioArriba) {
        list.style.top = `${rect.bottom + 4}px`;
        list.style.bottom = 'auto';
        list.style.maxHeight = `${Math.min(250, Math.max(110, espacioAbajo))}px`;
    } else {
        list.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        list.style.top = 'auto';
        list.style.maxHeight = `${Math.min(250, Math.max(110, espacioArriba))}px`;
    }
}

// Cerrar acordeones al tocar fuera
document.addEventListener('click', (event) => {
    document.querySelectorAll('details.corp-custom-select').forEach(det => {
        if (det.open && !det.contains(event.target)) {
            det.removeAttribute('open');
        }
    });
});

// Posicionar como capa fija al abrir y limpiar al cerrar
document.addEventListener('toggle', (event) => {
    const target = event.target;
    if (!target || !target.matches || !target.matches('details.corp-custom-select')) return;

    if (target.open) {
        document.querySelectorAll('details.corp-custom-select').forEach(other => {
            if (other !== target && other.open) {
                other.removeAttribute('open');
            }
        });
        posicionarSelectFlotante(target);
    } else {
        limpiarPosicionSelect(target);
    }
}, true);

// Cerrar el desplegable si se hace scroll en el modal de fondo
document.addEventListener('scroll', (event) => {
    const abierto = document.querySelector('details.corp-custom-select[open]');
    if (!abierto) return;
    const list = abierto.querySelector('.corp-select-list');
    if (list && (event.target === list || list.contains(event.target))) return;
    abierto.removeAttribute('open');
}, true);
