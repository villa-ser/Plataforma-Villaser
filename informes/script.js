// ==========================================
// INICIALIZACIÓN Y VARIABLES GLOBALES
// ==========================================
let db = null;
let uidSeguro = null;

const STORAGE_KEY_INFORME_LOCAL = 'villaser_informe_borrador_local_v1';

let informeParrafos = [];
let bloquesExpandidos = new Set();
let nombreBorradorActual = null; 
let telefonoClienteActual = "";

// Controles de Nube (Flujo Cliente Agendado)
let clienteDesdeAgenda = false;
let permiteGuardarNube = true;
let timerAutoGuardado = null;
let borradoresNubeCache = [];

// Estado de Edición In-Place
let indiceBloqueEditando = null;

// Estado del Editor de Tablas
let modoEditorTabla = false;
let filasTablaActual = 4;
let columnasTablaActual = 3;

function escaparHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function arrancarModulo() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            db = firebase.firestore();
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (user) {
                        uidSeguro = user.uid;
                        actualizarPillEstadoNube();
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Aviso: Firebase no pudo iniciar.", e);
    }

    generarMenuInferior();
    restaurarEstadoLocalSiExiste();
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
// PERSISTENCIA LOCAL OFFLINE-FIRST & NUBE
// ==========================================
function actualizarPillEstadoNube(estadoForzado = null) {
    const pill = document.getElementById('estadoNubePill');
    if (!pill) return;

    pill.className = 'pres-cloud-pill';

    if (estadoForzado === 'syncing') {
        pill.classList.add('syncing');
        pill.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
        return;
    }

    if (estadoForzado === 'synced') {
        pill.classList.add('synced');
        pill.innerHTML = '<i class="fa-solid fa-cloud-check"></i> Sincronizado';
        return;
    }

    if (!permiteGuardarNube) {
        pill.classList.add('local');
        pill.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Solo Local';
        return;
    }

    if (obtenerUid() && db) {
        pill.classList.add('ready');
        pill.innerHTML = '<i class="fa-solid fa-cloud"></i> Nube Activa';
    } else {
        pill.classList.add('local');
        pill.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Offline (Local)';
    }
}

function guardarEstadoLocal() {
    try {
        const stepTrabajo = document.getElementById('step-trabajo');
        const enTrabajo = stepTrabajo && !stepTrabajo.classList.contains('oculto');
        const payload = {
            cliNombre: document.getElementById('cliNombre')?.value || '',
            cliDireccion: document.getElementById('cliDireccion')?.value || '',
            cliProyecto: document.getElementById('cliProyecto')?.value || '',
            obsGenerales: document.getElementById('obsGenerales')?.value || '',
            parrafos: informeParrafos,
            clienteDesdeAgenda,
            permiteGuardarNube,
            nombreBorradorActual,
            telefonoClienteActual,
            enTrabajo,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY_INFORME_LOCAL, JSON.stringify(payload));
    } catch (e) {
        console.warn("No se pudo guardar copia local:", e);
    }
}

function restaurarEstadoLocalSiExiste() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_INFORME_LOCAL);
        if (!raw) return;

        const data = JSON.parse(raw);
        if (!data) return;

        const tieneContenido = (data.cliNombre && data.cliNombre.trim() !== '') ||
                               (Array.isArray(data.parrafos) && data.parrafos.length > 0);
        if (!tieneContenido) return;

        document.getElementById('cliNombre').value = data.cliNombre || '';
        document.getElementById('cliDireccion').value = data.cliDireccion || '';
        document.getElementById('cliProyecto').value = data.cliProyecto || '';
        document.getElementById('obsGenerales').value = data.obsGenerales || '';

        informeParrafos = Array.isArray(data.parrafos) ? data.parrafos : [];
        clienteDesdeAgenda = Boolean(data.clienteDesdeAgenda);
        permiteGuardarNube = data.permiteGuardarNube !== undefined ? Boolean(data.permiteGuardarNube) : true;
        nombreBorradorActual = data.nombreBorradorActual || null;
        telefonoClienteActual = data.telefonoClienteActual || '';

        if (data.enTrabajo) {
            avanzarPasoTrabajo(true);
            renderizarParrafos();
        }
    } catch (e) {
        console.warn("No se pudo restaurar copia local:", e);
    }
}

function programarGuardadoAutomatico() {
    guardarEstadoLocal();

    if (!permiteGuardarNube || informeParrafos.length === 0) {
        actualizarPillEstadoNube();
        return;
    }

    if (timerAutoGuardado) clearTimeout(timerAutoGuardado);
    timerAutoGuardado = setTimeout(() => {
        guardarBorradorFirebase(false, true);
    }, 1800);
}

// ==========================================
// INTEGRACIÓN AGENDA, CABECERA OBRA Y FLUJO
// ==========================================
function seleccionarContacto(nombre, dir, tel = "") {
    document.getElementById('cliNombre').value = nombre; 
    document.getElementById('cliDireccion').value = dir;
    telefonoClienteActual = tel; 
    
    clienteDesdeAgenda = true; 
    permiteGuardarNube = true; 

    // Si estaba abierto el modal de edición de cliente, actualizarlo también
    const editNombre = document.getElementById('editCliNombre');
    const editDir = document.getElementById('editCliDireccion');
    if (editNombre) editNombre.value = nombre;
    if (editDir) editDir.value = dir;
    
    if (typeof cerrarModalAgendaGlobal === 'function') cerrarModalAgendaGlobal(); 
    actualizarCabeceraObraActiva();
    actualizarVistaPreviews();
    programarGuardadoAutomatico();
    mostrarToast("Cliente Seleccionado", "Importado de agenda.");
}

function marcarClienteManual() {
    clienteDesdeAgenda = false;
    permiteGuardarNube = false;
    guardarEstadoLocal();
}

function iniciarInforme() {
    const nombre = document.getElementById('cliNombre').value.trim();
    if(!nombre) { 
        if(typeof mostrarAlertaCorp === 'function') {
            mostrarAlertaCorp("Datos incompletos", "Por favor, ingresá al menos el Nombre del Cliente.");
        } else {
            alert("Por favor, ingresá el nombre.");
        }
        return; 
    }
    
    if (!clienteDesdeAgenda) { 
        document.getElementById('modalAgendarCliente').classList.remove('oculto'); 
        return; 
    }
    
    avanzarPasoTrabajo();
}

function avanzarPasoTrabajo(silencioso = false) {
    document.getElementById('step-cliente').classList.add('oculto');
    const stepTrabajo = document.getElementById('step-trabajo');
    stepTrabajo.classList.remove('oculto');
    stepTrabajo.classList.add('flex-column', 'gap-15');
    actualizarCabeceraObraActiva();
    actualizarPillEstadoNube();
    actualizarVistaPreviews();
    if (!silencioso) guardarEstadoLocal();
}

function actualizarCabeceraObraActiva() {
    const elCliente = document.getElementById('obraActivaCliente');
    const elSub = document.getElementById('obraActivaSub');
    const elMetricas = document.getElementById('obraActivaMetricas');
    if (!elCliente || !elSub || !elMetricas) return;

    const nombre = document.getElementById('cliNombre').value.trim() || 'Sin Nombre';
    const dir = document.getElementById('cliDireccion').value.trim();
    const proyecto = document.getElementById('cliProyecto').value.trim();

    elCliente.textContent = nombre;

    const detalles = [
        dir ? `Dir: ${dir}` : '',
        proyecto ? `Proy: ${proyecto}` : ''
    ].filter(Boolean);
    elSub.textContent = detalles.length > 0 ? detalles.join(' · ') : 'Sin dirección ni proyecto especificado';

    // Calcular bloques y palabras totales
    let totalPalabras = 0;
    informeParrafos.forEach(item => {
        const b = normalizarBloqueInforme(item);
        if (b.tipo === 'tabla') {
            if (b.titulo) totalPalabras += b.titulo.trim().split(/\s+/).filter(Boolean).length;
            b.filas.forEach(f => f.forEach(c => {
                if (c) totalPalabras += c.trim().split(/\s+/).filter(Boolean).length;
            }));
        } else if (b.texto) {
            totalPalabras += b.texto.trim().split(/\s+/).filter(Boolean).length;
        }
    });

    const cantBloques = informeParrafos.length;
    elMetricas.innerHTML = `
        <div><strong>${cantBloques}</strong> ${cantBloques === 1 ? 'bloque' : 'bloques'}</div>
        <div style="color: var(--ngc-text-faded); font-size: 0.72rem;">${totalPalabras} palabras</div>
    `;
}

function abrirModalEditarCliente() {
    document.getElementById('editCliNombre').value = document.getElementById('cliNombre').value;
    document.getElementById('editCliDireccion').value = document.getElementById('cliDireccion').value;
    document.getElementById('editCliProyecto').value = document.getElementById('cliProyecto').value;
    document.getElementById('modalEditarCliente').classList.remove('oculto');
}

function cerrarModalEditarCliente() {
    document.getElementById('modalEditarCliente').classList.add('oculto');
}

function buscarAgendaDesdeEdicion() {
    if (typeof abrirModalAgendaGlobal === 'function') {
        abrirModalAgendaGlobal();
    }
}

function guardarEdicionCliente() {
    const nuevoNombre = document.getElementById('editCliNombre').value.trim();
    if (!nuevoNombre) {
        mostrarAlertaCorp("Datos incompletos", "El Nombre del Cliente no puede quedar vacío.");
        return;
    }

    const nombreAnterior = document.getElementById('cliNombre').value.trim();
    if (nuevoNombre !== nombreAnterior && !clienteDesdeAgenda) {
        permiteGuardarNube = false;
    }

    document.getElementById('cliNombre').value = nuevoNombre;
    document.getElementById('cliDireccion').value = document.getElementById('editCliDireccion').value.trim();
    document.getElementById('cliProyecto').value = document.getElementById('editCliProyecto').value.trim();

    cerrarModalEditarCliente();
    actualizarCabeceraObraActiva();
    actualizarPillEstadoNube();
    actualizarVistaPreviews();
    programarGuardadoAutomatico();
    mostrarToast("Datos Actualizados", "Se actualizó la cabecera del informe.");
}

function opcionBuscarAgenda() { 
    document.getElementById('modalAgendarCliente').classList.add('oculto'); 
    if(typeof abrirModalAgendaGlobal === 'function') abrirModalAgendaGlobal(); 
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

function ejecutarNuevoInforme() {
    if (typeof cerrarModalConfirmarNuevoGlobal === 'function') cerrarModalConfirmarNuevoGlobal(); 
    
    localStorage.removeItem(STORAGE_KEY_INFORME_LOCAL);

    document.getElementById('cliNombre').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliProyecto').value = '';
    document.getElementById('obsGenerales').value = '';
    document.getElementById('textoInforme').value = '';
    
    cancelarEdicionBloque();
    informeParrafos = [];
    bloquesExpandidos.clear();
    clienteDesdeAgenda = false;
    permiteGuardarNube = true;
    nombreBorradorActual = null;
    telefonoClienteActual = "";
    cursorCalcStart = null;
    cursorCalcEnd = null;

    const modalCalc = document.getElementById('modalCalculadora');
    if (modalCalc) modalCalc.classList.add('oculto');
    document.body.style.overflow = '';

    const iframeCalc = document.getElementById('iframeCalculadoraModal');
    if (iframeCalc) {
        iframeCalc.removeAttribute('src');
        iframeCalc.style.opacity = '0';
    }

    const loaderCalc = document.getElementById('loaderCalculadoraModal');
    if (loaderCalc) loaderCalc.style.display = 'block';

    const contenedorAcciones = document.getElementById('contenedorAcciones');
    if (contenedorAcciones) contenedorAcciones.classList.add('oculto');
    
    document.getElementById('step-trabajo').classList.add('oculto');
    document.getElementById('step-cliente').classList.remove('oculto');
    actualizarContadorRedaccion();
    renderizarParrafos();
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
    }, 3500);
}

// ==========================================
// FLUJO INFORME, PÁRRAFOS Y TABLAS
// ==========================================
function actualizarContadorRedaccion() {
    const textarea = document.getElementById('textoInforme');
    const contador = document.getElementById('contadorTextoRedaccion');
    if (!textarea || !contador) return;
    const len = textarea.value.length;
    const palabras = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
    contador.textContent = `${palabras} pal. · ${len} car.`;
}

function normalizarBloqueInforme(item) {
    if (typeof item === 'string') {
        return { tipo: 'parrafo', texto: item };
    }
    if (item && item.tipo === 'tabla') {
        const filasNorm = Array.isArray(item.filas)
            ? item.filas.map(f => Array.isArray(f) ? f : (f && Array.isArray(f.celdas) ? f.celdas : []))
            : [];
        return {
            tipo: 'tabla',
            titulo: item.titulo || '',
            filas: filasNorm
        };
    }
    return {
        tipo: item && item.tipo ? item.tipo : 'parrafo',
        texto: item && item.texto ? item.texto : ''
    };
}

function formatearTextoHTML(texto) {
    const escapado = String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escapado
        .replace(/\*\*\*([^\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function renderizarBloqueHTML(item, esPDF = false) {
    const bloque = normalizarBloqueInforme(item);

    if (bloque.tipo === 'tabla') {
        const borderColor = esPDF ? '#94a3b8' : 'var(--ngc-text-faded)';
        const textColor = esPDF ? '#1e293b' : 'inherit';
        const tituloColor = esPDF ? '#0f172a' : 'var(--ngc-text-main)';
        const fontSizeTabla = esPDF ? '11.5px' : '0.82rem';
        const paddingCelda = esPDF ? '7px 10px' : '5px 8px';
        const marginWrapper = esPDF ? '16px auto' : '12px auto';

        const tituloHTML = bloque.titulo.trim()
            ? `<div style="text-align: center; font-weight: 700; font-size: ${esPDF ? '13px' : '0.9rem'}; margin-bottom: 6px; color: ${tituloColor}; text-transform: ${esPDF ? 'uppercase' : 'none'}; letter-spacing: ${esPDF ? '0.3px' : 'normal'};">${formatearTextoHTML(bloque.titulo)}</div>`
            : '';

        let filasHTML = '';
        bloque.filas.forEach((fila, idxFila) => {
            let celdasHTML = '';
            const esFilaEncabezado = esPDF && idxFila === 0 && bloque.filas.length > 1;
            const bgFila = esFilaEncabezado ? 'background-color: #f1f5f9; font-weight: 700; color: #0f172a;' : '';

            fila.forEach(celda => {
                const val = celda && celda.trim() !== '' ? formatearTextoHTML(celda) : '&nbsp;';
                celdasHTML += `<td style="border: 1px solid ${borderColor}; padding: ${paddingCelda}; text-align: center; color: ${textColor}; ${bgFila} word-break: break-word;">${val}</td>`;
            });
            filasHTML += `<tr>${celdasHTML}</tr>`;
        });

        return `
            <div style="margin: ${marginWrapper}; width: 100%; overflow-x: auto; text-align: center; text-indent: 0; break-inside: avoid;">
                ${tituloHTML}
                <table style="margin: 0 auto; border-collapse: collapse; font-size: ${fontSizeTabla}; min-width: 70%; max-width: 100%;">
                    <tbody>${filasHTML}</tbody>
                </table>
            </div>
        `;
    }

    const contenido = formatearTextoHTML(bloque.texto);

    if (bloque.tipo === 'titulo') {
        const estilo = esPDF
            ? 'text-align: center; font-size: 16px; font-weight: 800; margin: 6px 0 16px 0; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; text-indent: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px;'
            : 'text-align: center; font-size: 1.15rem; font-weight: 700; margin: 4px 0 12px 0; text-indent: 0;';
        return `<div style="${estilo}">${contenido}</div>`;
    }

    if (bloque.tipo === 'subtitulo') {
        const estilo = esPDF
            ? 'text-align: left; font-size: 13.5px; font-weight: 700; margin: 16px 0 7px 0; padding-left: 8px; border-left: 3px solid #1e293b; text-indent: 0; color: #0f172a;'
            : 'text-align: left; font-size: 1rem; font-weight: 700; margin: 10px 0 6px 0; text-indent: 0;';
        return `<div style="${estilo}">${contenido}</div>`;
    }

    const tieneVinetas = bloque.texto.split('\n').some(linea => linea.trim().startsWith('•'));
    if (tieneVinetas) {
        const padding = esPDF ? '16px' : '10px';
        const colorTexto = esPDF ? 'color: #1e293b; font-size: 12px;' : '';
        return `<div style="margin-bottom: 11px; text-indent: 0; padding-left: ${padding}; line-height: 1.6; ${colorTexto}">${contenido}</div>`;
    }

    const indent = esPDF ? '18px' : '15px';
    const estiloParrafo = esPDF
        ? `margin-bottom: 11px; text-indent: ${indent}; text-align: justify; line-height: 1.6; color: #1e293b; font-size: 12px;`
        : `margin-bottom: 10px; text-indent: ${indent};`;
    return `<p style="${estiloParrafo}">${contenido}</p>`;
}

// ==========================================
// CONTROLADOR DEL MODAL Y EDITOR DE TABLAS
// ==========================================
function accionBotonTabla() {
    if (modoEditorTabla) {
        insertarTablaDesdeEditor();
    } else {
        document.getElementById('inputFilasTabla').value = 4;
        document.getElementById('inputColumnasTabla').value = 3;
        document.getElementById('modalConfigurarTabla').classList.remove('oculto');
    }
}

function cerrarModalConfigurarTabla() {
    document.getElementById('modalConfigurarTabla').classList.add('oculto');
}

function ajustarDimTabla(tipo, delta) {
    const idInput = tipo === 'filas' ? 'inputFilasTabla' : 'inputColumnasTabla';
    const input = document.getElementById(idInput);
    if (!input) return;

    const min = parseInt(input.min, 10) || 1;
    const max = parseInt(input.max, 10) || 15;
    const actual = parseInt(input.value, 10) || min;
    const nuevo = Math.max(min, Math.min(max, actual + delta));
    input.value = nuevo;
}

function confirmarCrearEditorTabla() {
    const filas = parseInt(document.getElementById('inputFilasTabla').value, 10) || 4;
    const cols = parseInt(document.getElementById('inputColumnasTabla').value, 10) || 3;
    cerrarModalConfigurarTabla();
    mostrarEditorTabla(filas, cols);
}

function mostrarEditorTabla(filas, cols, tituloExistente = '', datosExistentes = null) {
    modoEditorTabla = true;
    filasTablaActual = filas;
    columnasTablaActual = cols;

    document.getElementById('contenedorTextoInforme').classList.add('oculto');
    document.getElementById('barraFormatoTexto').classList.add('oculto');
    document.getElementById('editorTablaContainer').classList.remove('oculto');

    const tituloInput = document.getElementById('tituloTablaInput');
    tituloInput.value = tituloExistente || '';

    const grilla = document.getElementById('grillaEditorTabla');
    grilla.innerHTML = '';

    for (let r = 0; r < filas; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tabla-editor-cell';
            input.placeholder = `F${r + 1}-C${c + 1}`;
            if (datosExistentes && datosExistentes[r] && datosExistentes[r][c] !== undefined) {
                input.value = datosExistentes[r][c];
            }
            td.appendChild(input);
            tr.appendChild(td);
        }
        grilla.appendChild(tr);
    }

    ['btnBloqueTitulo', 'btnBloqueSubtitulo', 'btnBloqueParrafo'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.4';
        }
    });

    const btnTabla = document.getElementById('btnBloqueTabla');
    if (btnTabla) {
        btnTabla.classList.add('success-btn');
        btnTabla.style.color = '';
        btnTabla.style.background = '';
        btnTabla.innerHTML = indiceBloqueEditando !== null
            ? '<i class="fa-solid fa-check"></i> Guardar Tabla'
            : '<i class="fa-solid fa-check"></i> Insertar Tabla';
    }

    tituloInput.focus();
}

function modificarFilasEditorTabla(delta) {
    if (!modoEditorTabla) return;
    const grilla = document.getElementById('grillaEditorTabla');
    if (!grilla) return;

    const trs = grilla.querySelectorAll('tr');
    const filasActuales = trs.length;

    if (delta > 0) {
        if (filasActuales >= 15) {
            mostrarToast("Límite alcanzado", "Máximo 15 filas por tabla.");
            return;
        }
        const nuevaIdx = filasActuales;
        const tr = document.createElement('tr');
        for (let c = 0; c < columnasTablaActual; c++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tabla-editor-cell';
            input.placeholder = `F${nuevaIdx + 1}-C${c + 1}`;
            td.appendChild(input);
            tr.appendChild(td);
        }
        grilla.appendChild(tr);
        filasTablaActual = filasActuales + 1;
    } else if (delta < 0) {
        if (filasActuales <= 1) {
            mostrarToast("Mínimo requerido", "La tabla debe tener al menos 1 fila.");
            return;
        }
        grilla.removeChild(trs[filasActuales - 1]);
        filasTablaActual = filasActuales - 1;
    }
}

function cancelarEdicionTabla() {
    modoEditorTabla = false;

    document.getElementById('editorTablaContainer').classList.add('oculto');
    document.getElementById('contenedorTextoInforme').classList.remove('oculto');
    document.getElementById('barraFormatoTexto').classList.remove('oculto');
    document.getElementById('tituloTablaInput').value = '';
    document.getElementById('grillaEditorTabla').innerHTML = '';

    ['btnBloqueTitulo', 'btnBloqueSubtitulo', 'btnBloqueParrafo'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });

    const btnTabla = document.getElementById('btnBloqueTabla');
    if (btnTabla) {
        btnTabla.classList.remove('success-btn');
        btnTabla.style.color = 'var(--ngc-neon)';
        btnTabla.style.background = 'rgba(35, 116, 225, 0.12)';
        btnTabla.innerHTML = '<i class="fa-solid fa-table"></i> Tabla';
    }

    if (indiceBloqueEditando !== null) {
        limpiarEstadoEdicionInPlace();
        renderizarParrafos();
    }
}

function insertarTablaDesdeEditor() {
    const titulo = document.getElementById('tituloTablaInput').value.trim();
    const trs = document.querySelectorAll('#grillaEditorTabla tr');
    const filasDatos = [];
    let tieneContenido = titulo !== '';

    trs.forEach(tr => {
        const fila = [];
        tr.querySelectorAll('input.tabla-editor-cell').forEach(inp => {
            const val = inp.value.trim();
            if (val !== '') tieneContenido = true;
            fila.push(val);
        });
        filasDatos.push({ celdas: fila });
    });

    if (!tieneContenido) {
        mostrarAlertaCorp("Tabla Vacía", "Completá al menos el título o una celda antes de insertar la tabla.");
        return;
    }

    const nuevoBloqueTabla = {
        tipo: 'tabla',
        titulo: titulo,
        filas: filasDatos
    };

    const idxDestino = indiceBloqueEditando;
    limpiarEstadoEdicionInPlace();
    cancelarEdicionTabla();

    if (idxDestino !== null && informeParrafos[idxDestino]) {
        informeParrafos[idxDestino] = nuevoBloqueTabla;
        mostrarToast("Tabla Actualizada", `Se guardaron los cambios en el bloque #${idxDestino + 1}.`);
    } else {
        informeParrafos.push(nuevoBloqueTabla);
    }

    renderizarParrafos();
    programarGuardadoAutomatico();
}

function aplicarFormatoSeleccion(marcador) {
    const textarea = document.getElementById('textoInforme');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textoCompleto = textarea.value;
    const len = marcador.length;

    if (start === end) {
        const nombreFormato = marcador === '**' ? 'negrita' : 'cursiva';
        mostrarToast("Seleccioná texto", `Marcá primero las palabras para poner o quitar ${nombreFormato}.`);
        textarea.focus();
        return;
    }

    const seleccion = textoCompleto.slice(start, end);
    const antes = textoCompleto.slice(0, start);
    const despues = textoCompleto.slice(end);

    const tieneInterno = marcador === '**'
        ? (seleccion.startsWith('**') && seleccion.endsWith('**') && seleccion.length > 4)
        : ((seleccion.startsWith('***') && seleccion.endsWith('***') && seleccion.length > 6) ||
           (seleccion.startsWith('*') && !seleccion.startsWith('**') && seleccion.endsWith('*') && !seleccion.endsWith('**') && seleccion.length > 2));

    if (tieneInterno) {
        const sinFormato = seleccion.slice(len, -len);
        textarea.value = antes + sinFormato + despues;
        textarea.focus();
        textarea.setSelectionRange(start, start + sinFormato.length);
        actualizarContadorRedaccion();
        return;
    }

    const tieneExterno = marcador === '**'
        ? (antes.endsWith('**') && despues.startsWith('**'))
        : ((antes.endsWith('***') && despues.startsWith('***')) ||
           (antes.endsWith('*') && !antes.endsWith('**') && despues.startsWith('*') && !despues.endsWith('**')));

    if (tieneExterno) {
        textarea.value = antes.slice(0, -len) + seleccion + despues.slice(len);
        textarea.focus();
        textarea.setSelectionRange(start - len, end - len);
        actualizarContadorRedaccion();
        return;
    }

    textarea.value = `${antes}${marcador}${seleccion}${marcador}${despues}`;
    textarea.focus();
    textarea.setSelectionRange(start + len, end + len);
    actualizarContadorRedaccion();
}

function aplicarNegritaSeleccion() {
    aplicarFormatoSeleccion('**');
}

function aplicarVinetasSeleccion() {
    const textarea = document.getElementById('textoInforme');
    if (!textarea) return;

    const texto = textarea.value;
    if (!texto.trim()) {
        textarea.value = '• ';
        textarea.focus();
        textarea.setSelectionRange(2, 2);
        actualizarContadorRedaccion();
        return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const lineStart = texto.lastIndexOf('\n', start - 1) + 1;
    const rawLineEnd = texto.indexOf('\n', end);
    const lineEnd = rawLineEnd === -1 ? texto.length : rawLineEnd;

    const bloqueLineas = texto.slice(lineStart, lineEnd);
    const lineas = bloqueLineas.split('\n');
    const todasConVineta = lineas.filter(l => l.trim() !== '').every(l => /^\s*•\s*/.test(l));

    const nuevasLineas = lineas.map(linea => {
        if (linea.trim() === '') return linea;
        if (todasConVineta) {
            return linea.replace(/^(\s*)•\s*/, '$1');
        }
        return /^\s*•\s*/.test(linea) ? linea : `• ${linea.trimStart()}`;
    });

    const reemplazo = nuevasLineas.join('\n');
    textarea.value = texto.slice(0, lineStart) + reemplazo + texto.slice(lineEnd);
    textarea.focus();
    textarea.setSelectionRange(lineStart, lineStart + reemplazo.length);
    actualizarContadorRedaccion();
      }

function agregarBloque(tipo = 'parrafo') {
    if (modoEditorTabla) return;

    const textarea = document.getElementById('textoInforme');
    const texto = textarea.value.trim();
    if (!texto) {
        mostrarAlertaCorp("Campo Vacío", "Escriba un texto antes de agregar.");
        return;
    }

    if (indiceBloqueEditando !== null && informeParrafos[indiceBloqueEditando]) {
        const idxEditado = indiceBloqueEditando;
        informeParrafos[idxEditado] = { tipo, texto };
        limpiarEstadoEdicionInPlace();
        textarea.value = "";
        actualizarContadorRedaccion();
        renderizarParrafos();
        programarGuardadoAutomatico();
        mostrarToast("Bloque Actualizado", `Se guardaron los cambios en la posición #${idxEditado + 1}.`);
        return;
    }

    informeParrafos.push({ tipo, texto });
    textarea.value = "";
    actualizarContadorRedaccion();
    renderizarParrafos();
    programarGuardadoAutomatico();
}

function agregarParrafo() {
    agregarBloque('parrafo');
}

function actualizarIndicesExpandidosAlEliminar(indexEliminado) {
    const nuevos = new Set();
    bloquesExpandidos.forEach(idx => {
        if (idx < indexEliminado) nuevos.add(idx);
        else if (idx > indexEliminado) nuevos.add(idx - 1);
    });
    bloquesExpandidos = nuevos;
}

function moverBloque(index, direccion) {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= informeParrafos.length) return;

    if (indiceBloqueEditando !== null) {
        cancelarEdicionBloque();
    }

    const temp = informeParrafos[index];
    informeParrafos[index] = informeParrafos[nuevoIndex];
    informeParrafos[nuevoIndex] = temp;

    const actualAbierto = bloquesExpandidos.has(index);
    const destinoAbierto = bloquesExpandidos.has(nuevoIndex);
    if (actualAbierto) bloquesExpandidos.add(nuevoIndex);
    else bloquesExpandidos.delete(nuevoIndex);

    if (destinoAbierto) bloquesExpandidos.add(index);
    else bloquesExpandidos.delete(index);

    renderizarParrafos();
    programarGuardadoAutomatico();
}

function duplicarBloque(index) {
    const original = informeParrafos[index];
    if (!original) return;

    if (indiceBloqueEditando !== null) {
        cancelarEdicionBloque();
    }

    const copia = JSON.parse(JSON.stringify(original));
    informeParrafos.splice(index + 1, 0, copia);

    // Desplazar índices expandidos posteriores
    const nuevosExpandidos = new Set();
    bloquesExpandidos.forEach(idx => {
        if (idx <= index) nuevosExpandidos.add(idx);
        else nuevosExpandidos.add(idx + 1);
    });
    nuevosExpandidos.add(index + 1);
    bloquesExpandidos = nuevosExpandidos;

    renderizarParrafos();
    programarGuardadoAutomatico();
    mostrarToast("Bloque Duplicado", `Se creó una copia debajo del elemento #${index + 1}.`);
}

let indiceParrafoAEliminar = null;

function eliminarParrafo(index) {
    indiceParrafoAEliminar = index;
    document.getElementById('modalConfirmarEliminarParrafo').classList.remove('oculto');
}

function cerrarModalEliminarParrafo() {
    document.getElementById('modalConfirmarEliminarParrafo').classList.add('oculto');
    indiceParrafoAEliminar = null;
}

function ejecutarEliminarParrafo() {
    if (indiceParrafoAEliminar !== null) {
        if (indiceBloqueEditando === indiceParrafoAEliminar) {
            limpiarEstadoEdicionInPlace();
            if (modoEditorTabla) cancelarEdicionTabla();
            document.getElementById('textoInforme').value = '';
            actualizarContadorRedaccion();
        } else if (indiceBloqueEditando !== null && indiceBloqueEditando > indiceParrafoAEliminar) {
            indiceBloqueEditando -= 1;
        }

        informeParrafos.splice(indiceParrafoAEliminar, 1);
        actualizarIndicesExpandidosAlEliminar(indiceParrafoAEliminar);
        renderizarParrafos();
        programarGuardadoAutomatico();
    }
    cerrarModalEliminarParrafo();
}

function limpiarEstadoEdicionInPlace() {
    indiceBloqueEditando = null;
    const banner = document.getElementById('bannerEdicionBloque');
    if (banner) banner.classList.add('oculto');
}

function cancelarEdicionBloque() {
    limpiarEstadoEdicionInPlace();
    if (modoEditorTabla) {
        cancelarEdicionTabla();
    }
    const textarea = document.getElementById('textoInforme');
    if (textarea) textarea.value = '';
    actualizarContadorRedaccion();
    renderizarParrafos();
}

function editarParrafo(index) {
    const bloque = normalizarBloqueInforme(informeParrafos[index]);
    indiceBloqueEditando = index;

    const banner = document.getElementById('bannerEdicionBloque');
    const txtBanner = document.getElementById('textoBannerEdicion');
    if (banner && txtBanner) {
        txtBanner.innerHTML = `<i class="fa-solid fa-pen"></i> Editando bloque #${index + 1}`;
        banner.classList.remove('oculto');
    }

    renderizarParrafos();

    if (bloque.tipo === 'tabla') {
        const cantFilas = Math.max(1, bloque.filas.length);
        const cantCols = Math.max(2, (bloque.filas[0] && bloque.filas[0].length) || 3);
        mostrarEditorTabla(cantFilas, cantCols, bloque.titulo, bloque.filas);
        document.getElementById('editorTablaContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (modoEditorTabla) {
        modoEditorTabla = false;
        document.getElementById('editorTablaContainer').classList.add('oculto');
        document.getElementById('contenedorTextoInforme').classList.remove('oculto');
        document.getElementById('barraFormatoTexto').classList.remove('oculto');
        ['btnBloqueTitulo', 'btnBloqueSubtitulo', 'btnBloqueParrafo'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
        const btnTabla = document.getElementById('btnBloqueTabla');
        if (btnTabla) {
            btnTabla.classList.remove('success-btn');
            btnTabla.style.color = 'var(--ngc-neon)';
            btnTabla.style.background = 'rgba(35, 116, 225, 0.12)';
            btnTabla.innerHTML = '<i class="fa-solid fa-table"></i> Tabla';
        }
    }

    const textarea = document.getElementById('textoInforme');
    textarea.value = bloque.texto;
    actualizarContadorRedaccion();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textarea.focus();
}

function recortarPrimerasPalabras(texto, maxPalabras = 6) {
    const limpio = String(texto || '')
        .replace(/\*\*\*|\*\*|\*/g, '')
        .replace(/•/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!limpio) return '';
    const palabras = limpio.split(' ');
    if (palabras.length <= maxPalabras) return limpio;
    return palabras.slice(0, maxPalabras).join(' ') + '...';
}

function obtenerResumenBloque(bloque) {
    if (bloque.tipo === 'tabla') {
        if (bloque.titulo && bloque.titulo.trim()) {
            return recortarPrimerasPalabras(bloque.titulo, 6);
        }
        const celdas = [];
        bloque.filas.forEach(fila => {
            fila.forEach(celda => {
                if (celda && celda.trim() && celdas.length < 6) {
                    celdas.push(celda.trim());
                }
            });
        });
        if (celdas.length > 0) {
            return recortarPrimerasPalabras(celdas.join(' · '), 6);
        }
        const cols = (bloque.filas[0] && bloque.filas[0].length) || 0;
        return `Tabla (${bloque.filas.length}×${cols})`;
    }
    return recortarPrimerasPalabras(bloque.texto, 6);
}

function toggleExpandirBloque(index) {
    if (bloquesExpandidos.has(index)) {
        bloquesExpandidos.delete(index);
    } else {
        bloquesExpandidos.add(index);
    }
    renderizarParrafos();
      }

function renderizarParrafos() {
    const contenedor = document.getElementById('lista-parrafos');
    contenedor.innerHTML = '';

    const etiquetas = {
        titulo: 'TÍTULO',
        subtitulo: 'SUBTÍTULO',
        parrafo: 'PÁRRAFO',
        tabla: 'TABLA'
    };

    informeParrafos.forEach((item, index) => {
        const bloque = normalizarBloqueInforme(item);
        const esPrimero = index === 0;
        const esUltimo = index === informeParrafos.length - 1;
        const estaExpandido = bloquesExpandidos.has(index);
        const estaSiendoEditado = indiceBloqueEditando === index;

        const resumenEscapado = escaparHTML(obtenerResumenBloque(bloque));

        const div = document.createElement('div');
        div.className = `bloque-item-card ${estaExpandido ? 'expandido' : ''}`;
        if (estaSiendoEditado) {
            div.style.borderColor = 'var(--ngc-warning)';
            div.style.boxShadow = '0 0 0 1px var(--ngc-warning)';
        }

        const badgeEditando = estaSiendoEditado
            ? `<span style="color: var(--ngc-warning); margin-left: 6px;">· EDITANDO</span>`
            : '';

        const detalleHTML = estaExpandido ? `
            <div class="bloque-item-detalle">
                ${renderizarBloqueHTML(bloque, false)}
                <div class="bloque-item-acciones" style="flex-wrap: wrap; gap: 6px;">
                    <button type="button" class="pres-mini-act" onclick="moverBloque(${index}, -1)" ${esPrimero ? 'disabled' : ''} title="Subir" style="color: var(--ngc-neon); opacity: ${esPrimero ? '0.35' : '1'};">
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>
                    <button type="button" class="pres-mini-act" onclick="moverBloque(${index}, 1)" ${esUltimo ? 'disabled' : ''} title="Bajar" style="color: var(--ngc-neon); opacity: ${esUltimo ? '0.35' : '1'};">
                        <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    <button type="button" class="pres-mini-act" onclick="duplicarBloque(${index})" title="Duplicar bloque" style="color: var(--success-green);">
                        <i class="fa-solid fa-copy"></i> Copiar
                    </button>
                    <button type="button" class="pres-mini-act" onclick="editarParrafo(${index})" title="Editar" style="color: var(--ngc-warning);">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button type="button" class="pres-mini-act" onclick="eliminarParrafo(${index})" title="Eliminar" style="color: var(--error-red);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        ` : '';

        div.innerHTML = `
            <div class="bloque-item-header">
                <div class="bloque-item-info">
                    <div class="bloque-item-tipo">#${index + 1} · ${etiquetas[bloque.tipo] || 'PÁRRAFO'}${badgeEditando}</div>
                    ${!estaExpandido ? `<div class="bloque-item-preview">${resumenEscapado}</div>` : ''}
                </div>
                <button type="button" class="btn-ver-mas-bloque" onclick="toggleExpandirBloque(${index})">
                    ${estaExpandido ? 'Ver menos <i class="fa-solid fa-chevron-up"></i>' : 'Ver más <i class="fa-solid fa-chevron-down"></i>'}
                </button>
            </div>
            ${detalleHTML}
        `;
        contenedor.appendChild(div);
    });

    actualizarCabeceraObraActiva();
    actualizarVistaPreviews();
}

// ==========================================
// PLANTILLAS TÉCNICAS PREARMADAS
// ==========================================
const PLANTILLAS_TECNICAS = [
    {
        titulo: 'Relevamiento de Tablero Eléctrico (AEA 90364)',
        desc: 'Estructura completa con verificación de envolvente, protecciones PIA/ID y tabla de circuitos.',
        bloques: [
            { tipo: 'titulo', texto: 'INFORME DE RELEVAMIENTO DE TABLERO ELÉCTRICO' },
            { tipo: 'subtitulo', texto: '1. Objeto y Normativa Aplicable' },
            { tipo: 'parrafo', texto: 'Se realiza la inspección visual, verificación funcional y relevamiento técnico de las instalaciones eléctricas del tablero bajo lineamientos de la reglamentación **AEA 90364-7-770 / 771**.' },
            { tipo: 'subtitulo', texto: '2. Detalle de Circuitos y Protecciones' },
            {
                tipo: 'tabla',
                titulo: 'Cuadro de Circuitos Relevados',
                filas: [
                    { celdas: ['Circuito', 'Protección (PIA)', 'Conductor', 'Estado'] },
                    { celdas: ['General / ID', 'ID 2x40A 30mA', '6 mm²', 'Conforme'] },
                    { celdas: ['C1 - Iluminación', 'PIA 2x10A Curva C', '1,5 mm²', 'Conforme'] },
                    { celdas: ['C2 - Tomas (TUG)', 'PIA 2x16A Curva C', '2,5 mm²', 'Adecuar'] }
                ]
            },
            { tipo: 'subtitulo', texto: '3. Observaciones y Recomendaciones' },
            { tipo: 'parrafo', texto: '• Verificar ajuste mecánico de bornes y peines de distribución.\n• Incorporar señalización de riesgo eléctrico en frente muerto del tablero.' }
        ]
    },
    {
        titulo: 'Medición de Puesta a Tierra (IRAM 2281)',
        desc: 'Protocolo de medición telurométrica con tabla de valores obtenidos y continuidad de masas.',
        bloques: [
            { tipo: 'titulo', texto: 'INFORME DE MEDICIÓN DE PUESTA A TIERRA (PAT)' },
            { tipo: 'subtitulo', texto: '1. Metodología e Instrumental' },
            { tipo: 'parrafo', texto: 'Se efectúa la medición de resistencia de puesta a tierra de protección conforme a norma **IRAM 2281** y **AEA 90364-5-54**, verificando además la continuidad eléctrica de las masas metálicas y conductores **PE**.' },
            {
                tipo: 'tabla',
                titulo: 'Registro de Mediciones',
                filas: [
                    { celdas: ['Punto Medido', 'Valor Obtenido', 'Límite Admisible', 'Resultado'] },
                    { celdas: ['Jabalina PAT Principal', '--- Ω', '≤ 40 Ω', 'Apto'] },
                    { celdas: ['Continuidad PE Tablero', '--- Ω', '≤ 1 Ω', 'Apto'] }
                ]
            },
            { tipo: 'subtitulo', texto: '2. Dictamen Técnico' },
            { tipo: 'parrafo', texto: 'Los valores registrados cumplen con las condiciones de seguridad requeridas para el correcto disparo de los interruptores diferenciales de **IΔn = 30 mA**.' }
        ]
    },
    {
        titulo: 'Diagnóstico de Falla y Reparación',
        desc: 'Formato claro para documentar síntoma detectado, causa raíz, trabajos ejecutados y pruebas.',
        bloques: [
            { tipo: 'titulo', texto: 'INFORME TÉCNICO DE DIAGNÓSTICO Y REPARACIÓN' },
            { tipo: 'subtitulo', texto: '1. Síntoma Reportado y Diagnóstico' },
            { tipo: 'parrafo', texto: 'Ante la falla reportada en la instalación, se procedió a realizar pruebas de aislamiento, continuidad y medición de tensión bajo carga, detectando el origen del inconveniente en...' },
            { tipo: 'subtitulo', texto: '2. Trabajos Ejecutados' },
            { tipo: 'parrafo', texto: '• Aislación segura del circuito afectado y bloqueo.\n• Reemplazo de componentes dañados y normalización de conexiones.\n• Pruebas de funcionamiento y verificación térmica bajo régimen normal.' }
        ]
    },
    {
        titulo: 'Verificación de Seguridad Eléctrica (Ley 10.281)',
        desc: 'Checklist técnico para adecuación de instalaciones existentes según normativa ERSeP.',
        bloques: [
            { tipo: 'titulo', texto: 'INFORME DE VERIFICACIÓN DE SEGURIDAD ELÉCTRICA' },
            { tipo: 'subtitulo', texto: '1. Estado General de la Instalación' },
            { tipo: 'parrafo', texto: 'Se evalúan las condiciones mínimas de seguridad eléctrica exigidas por la **Ley Provincial N° 10.281** y reglamentación vigente para instalaciones existentes.' },
            {
                tipo: 'tabla',
                titulo: 'Verificación de Puntos Críticos',
                filas: [
                    { celdas: ['Ítem Evaluado', 'Cumple', 'Observación'] },
                    { celdas: ['Interruptor Diferencial 30 mA', 'SÍ / NO', '-'] },
                    { celdas: ['Puesta a Tierra y Conductor PE', 'SÍ / NO', '-'] },
                    { celdas: ['Grado de Protección Envolvente (IP)', 'SÍ / NO', '-'] },
                    { celdas: ['Estado de Aislación de Conductores', 'SÍ / NO', '-'] }
                ]
            }
        ]
    }
];

function abrirModalPlantillas() {
    if (modoEditorTabla) {
        mostrarToast("Editor activo", "Finalizá o cancelá la tabla actual antes de insertar una plantilla.");
        return;
    }

    const contenedor = document.getElementById('listaPlantillasInforme');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    PLANTILLAS_TECNICAS.forEach((plt, idx) => {
        const card = document.createElement('div');
        card.className = 'lib-item-card';
        card.style.borderLeftColor = 'var(--success-green)';
        card.innerHTML = `
            <div class="lib-item-header">
                <span class="lib-item-valor" style="color: var(--ngc-text-main);">${escaparHTML(plt.titulo)}</span>
                <span class="lib-item-badge" style="background: rgba(49, 162, 76, 0.16); color: var(--success-green);">${plt.bloques.length} bloques</span>
            </div>
            <div class="lib-item-desc">${escaparHTML(plt.desc)}</div>
        `;
        card.onclick = () => insertarPlantillaInforme(idx);
        contenedor.appendChild(card);
    });

    document.getElementById('modalPlantillasInforme').classList.remove('oculto');
}

function cerrarModalPlantillas() {
    document.getElementById('modalPlantillasInforme').classList.add('oculto');
}

function insertarPlantillaInforme(idx) {
    const plantilla = PLANTILLAS_TECNICAS[idx];
    cerrarModalPlantillas();
    if (!plantilla) return;

    if (indiceBloqueEditando !== null) {
        cancelarEdicionBloque();
    }

    const bloquesClonados = JSON.parse(JSON.stringify(plantilla.bloques));
    informeParrafos.push(...bloquesClonados);

    renderizarParrafos();
    programarGuardadoAutomatico();
    mostrarToast("Plantilla Insertada", `Se agregaron ${bloquesClonados.length} bloques al informe.`);
                  }

// ==========================================
// NUEVO MENÚ ACCIONES AGRUPADAS
// ==========================================
function toggleAccionesMenu() {
    document.getElementById('contenedorAcciones').classList.toggle('oculto');
}

// ==========================================
// RENDERIZADO, VISTA PREVIA, PDF Y MEMBRETE
// ==========================================
function actualizarVistaPreviews() {
    const cliNombreRaw = document.getElementById('cliNombre').value.trim();
    const cliDirRaw = document.getElementById('cliDireccion').value.trim();
    const cliProyectoRaw = document.getElementById('cliProyecto').value.trim();

    const cliNombre = cliNombreRaw || 'Sin Nombre';
    const cliDir = cliDirRaw || '-';
    const cliProyecto = cliProyectoRaw || '-';
    
    const infoClientArea = document.getElementById('previewClientInfo');
    infoClientArea.innerHTML = `<strong>Cliente:</strong> ${escaparHTML(cliNombre)}<br><strong>Dirección:</strong> ${escaparHTML(cliDir)}<br><strong>Proyecto:</strong> ${escaparHTML(cliProyecto)}`;
    
    const previewArea = document.getElementById('previewInforme');
    previewArea.innerHTML = informeParrafos.map(p => renderizarBloqueHTML(p, false)).join('');

    const og = document.getElementById('obsGenerales').value;
    const previewGlobales = document.getElementById('previewNotasGlobales');
    if (og) {
        previewGlobales.innerText = `Nota: ${og}`;
        previewGlobales.style.display = 'block';
    } else {
        previewGlobales.style.display = 'none';
    }

    const pdfFecha = document.getElementById('pdf-fecha');
    const pdfCliente = document.getElementById('pdf-cliente');
    const pdfDir = document.getElementById('pdf-dir');
    const pdfRowDir = document.getElementById('pdf-row-dir');
    const pdfProyecto = document.getElementById('pdf-proyecto');
    const pdfRowProyecto = document.getElementById('pdf-row-proyecto');
    const pdfTexto = document.getElementById('pdf-texto-contenido');
    const pdfNotasBox = document.getElementById('pdf-notas-box');
    const pdfNotas = document.getElementById('pdf-notas');

    if (pdfFecha) pdfFecha.innerText = new Date().toLocaleDateString('es-AR');
    if (pdfCliente) pdfCliente.innerText = cliNombre;

    if (pdfRowDir && pdfDir) {
        if (cliDirRaw) {
            pdfDir.innerText = cliDirRaw;
            pdfRowDir.style.display = 'flex';
        } else {
            pdfRowDir.style.display = 'none';
        }
    }

    if (pdfRowProyecto && pdfProyecto) {
        if (cliProyectoRaw) {
            pdfProyecto.innerText = cliProyectoRaw;
            pdfRowProyecto.style.display = 'flex';
        } else {
            pdfRowProyecto.style.display = 'none';
        }
    }

    if (pdfTexto) pdfTexto.innerHTML = informeParrafos.map(p => renderizarBloqueHTML(p, true)).join('');

    if (og && pdfNotasBox && pdfNotas) {
        pdfNotas.innerText = og;
        pdfNotasBox.style.display = 'block';
    } else if (pdfNotasBox) {
        pdfNotasBox.style.display = 'none';
    }
    
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

    const lineaRegistro = [
        profMatricula ? `Mat.: ${escaparHTML(profMatricula)}` : '',
        profCuit ? `CUIT: ${escaparHTML(profCuit)}` : ''
    ].filter(Boolean).join(' | ');

    const lineaContacto = [
        profTel ? `Tel: ${escaparHTML(profTel)}` : '',
        profEmail ? `Email: ${escaparHTML(profEmail)}` : ''
    ].filter(Boolean).join('  |  ');

    const elHeaderContacto = document.getElementById('pdf-header-contacto');
    if (elHeaderContacto) {
        elHeaderContacto.innerHTML = [lineaRegistro, lineaContacto].filter(Boolean).join('<br>');
    }

    const elFirmaProfNombre = document.getElementById('pdf-firma-prof-nombre');
    if (elFirmaProfNombre) elFirmaProfNombre.innerText = profNombre.toUpperCase();

    const elFirmaProfMat = document.getElementById('pdf-firma-prof-mat');
    if (elFirmaProfMat) {
        elFirmaProfMat.innerText = profMatricula ? `Mat.: ${profMatricula}` : 'Firma y Sello Profesional';
    }

    const elSlogan = document.getElementById('pdf-slogan');
    if (elSlogan) elSlogan.innerText = profSlogan || '¡Electricidad Segura, Hogar Tranquilo!';

    const elTelFooter = document.getElementById('pdf-tel-footer');
    if (elTelFooter) elTelFooter.innerText = 'villaser.com.ar';
}

let escalaBasePreview = 1;
let escalaActualPreview = 1;
let anchoRealA4 = 794;
let altoRealA4 = 1123;
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
    if (informeParrafos.length === 0) {
        mostrarAlertaCorp("Sin Contenido", "Agregue al menos un bloque al informe para ver la vista previa.");
        return;
    }
    actualizarVistaPreviews();

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
        anchoRealA4 = pdfContainer.offsetWidth || 794;
        altoRealA4 = pdfContainer.offsetHeight || 1123;
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
// GENERACIÓN DE PDF CON MODAL CORPORATIVO
// ==========================================
function generarPDF() {
    if (informeParrafos.length === 0) {
        mostrarAlertaCorp("Informe Vacío", "Agregá al menos un bloque de texto o tabla antes de generar el PDF.");
        return;
    }

    // Corrección: sincroniza siempre los últimos cambios (incluidas Notas Globales) antes de exportar
    actualizarVistaPreviews();

    const inputNombre = document.getElementById('cliNombre');
    const sugerido = (inputNombre && inputNombre.value.trim())
        ? inputNombre.value.trim().replace(/\s+/g, '_')
        : 'Cliente';
    const uniqueSuffix = Math.floor(Math.random() * 9000) + 1000;

    document.getElementById('nombreArchivoPDF').value = `${sugerido}_Informe_Tecnico_${uniqueSuffix}`;
    document.getElementById('modalDescargarPDF').classList.remove('oculto');
}

function cerrarModalPDF() {
    document.getElementById('modalDescargarPDF').classList.add('oculto');
    document.getElementById('btnConfirmarDescargaPDF').innerHTML = "Descargar";
}

async function ejecutarDescargaPDF() {
    const btn = document.getElementById('btnConfirmarDescargaPDF');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';

    actualizarVistaPreviews();

    if (permiteGuardarNube) {
        guardarBorradorFirebase(false, true);
    }

    const panelPreview = document.querySelector('.preview-panel');
    const element = document.getElementById('plantilla-pdf');
    const sello = document.getElementById('selloAguaPDF');

    const prevPanelDisplay = panelPreview ? panelPreview.style.display : '';
    const prevElementDisplay = element.style.display;

    if (panelPreview && window.innerWidth < 992) {
        panelPreview.style.display = 'block';
    }
    element.style.display = 'block';
    if (sello) sello.style.display = 'none';

    window.scrollTo(0, 0);

    const nombreFinal = document.getElementById('nombreArchivoPDF').value.trim() || 'Informe_Tecnico';

    const opt = {
        margin: 0,
        filename: `${nombreFinal}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    try {
        await html2pdf().set(opt).from(element).save();
        mostrarToast("PDF Descargado", "El informe se generó correctamente.");
    } catch (e) {
        console.error("Error al generar PDF:", e);
        mostrarAlertaCorp("Error", "No se pudo generar el archivo PDF.");
    } finally {
        if (sello) sello.style.display = 'flex';
        element.style.display = prevElementDisplay;
        if (panelPreview && window.innerWidth < 992) {
            panelPreview.style.display = prevPanelDisplay;
        }
        cerrarModalPDF();
    }
}

// ==========================================
// WHATSAPP (INTEGRACIÓN GLOBAL)
// ==========================================
function prepararEnvioWhatsApp() {
    if (informeParrafos.length === 0) {
        if(typeof mostrarAlertaCorp === 'function') mostrarAlertaCorp("Faltan Datos", "Agregá al menos un bloque al informe primero.");
        else alert("Agregá al menos un párrafo.");
        return;
    }
    
    const profNombre = localStorage.getItem('villaser_conf_nombre') || 'PROFESIONAL';
    let msg = `*${profNombre.toUpperCase()} - INFORME TÉCNICO*\n`;
    msg += `*Cliente:* ${document.getElementById('cliNombre').value || 'Sin Nombre'}\n`;
    msg += `*Proyecto:* ${document.getElementById('cliProyecto').value || '-'}\n\n`;
    
    informeParrafos.forEach(item => {
        const bloque = normalizarBloqueInforme(item);

        if (bloque.tipo === 'tabla') {
            if (bloque.titulo.trim()) {
                msg += `*${bloque.titulo.trim().toUpperCase()}*\n`;
            }
            bloque.filas.forEach(fila => {
                const lineaFila = fila.map(c => c.trim() || '-').join(' | ');
                msg += `• ${lineaFila}\n`;
            });
            msg += `\n`;
            return;
        }

        const textoWsp = bloque.texto
            .replace(/\*\*\*([^\n]+?)\*\*\*/g, '*_$1_*')
            .replace(/\*\*([^\n]+?)\*\*/g, '*$1*')
            .replace(/\*([^*\n]+?)\*/g, '_$1_');

        if (bloque.tipo === 'titulo') {
            msg += `*${textoWsp.toUpperCase()}*\n\n`;
        } else if (bloque.tipo === 'subtitulo') {
            msg += `*${textoWsp}*\n`;
        } else {
            msg += `${textoWsp}\n\n`;
        }
    });
    
    const og = document.getElementById('obsGenerales').value;
    if (og) msg += `*NOTAS GLOBALES:*\n${og}\n`;

    if (typeof abrirModalWspGlobal === 'function') {
        abrirModalWspGlobal(telefonoClienteActual, msg);
    } else {
        console.error("No se encontró abrirModalWspGlobal. Verifica que global.js esté enlazado.");
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
        if (mostrarAlerta) mostrarAlertaCorp("Bloqueado", "Cliente no agendado. Vinculalo desde 'Editar Datos' para guardar en la nube.");
        return;
    }
    if (informeParrafos.length === 0) return;
    
    const nombreCli = (document.getElementById('cliNombre').value.trim() || 'Sin_Nombre').replace(/\s+/g, '_');
    const proyCli = (document.getElementById('cliProyecto').value.trim() || 'Informe').replace(/\s+/g, '_');
    const fechaHoy = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
    let nombreSugerido = `${nombreCli}_${proyCli}_${fechaHoy}`;

    if (!autoGuardado) {
        document.getElementById('inputNombreBorrador').value = nombreBorradorActual || nombreSugerido;
        document.getElementById('modalGuardarBorrador').classList.remove('oculto');
    } else {
        const nombreAuto = nombreBorradorActual || nombreSugerido;
        if (!nombreBorradorActual) nombreBorradorActual = nombreAuto;
        ejecutarGuardarNube(nombreAuto, false);
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

    actualizarPillEstadoNube('syncing');

    const estado = {
        cliNombre: document.getElementById('cliNombre').value,
        cliDireccion: document.getElementById('cliDireccion').value,
        cliProyecto: document.getElementById('cliProyecto').value,
        obsGenerales: document.getElementById('obsGenerales').value,
        parrafos: informeParrafos,
        fechaGuardado: Date.now(),
        nombreBorrador: nombreFinal,
        telefonoClienteActual: telefonoClienteActual 
    };
    
    let docId = nombreFinal.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    
    db.collection("perfiles").doc(uid).collection("borradores_informe").doc(docId).set(estado)
      .then(() => {
          actualizarPillEstadoNube('synced');
          guardarEstadoLocal();
          if (mostrarAlerta) mostrarToast("Guardado", "Sincronizado con la nube.");
      })
      .catch((e) => {
          console.error("Error Firebase:", e);
          actualizarPillEstadoNube();
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

    db.collection("perfiles").doc(uid).collection("borradores_informe").doc(idBorradorAEliminar).delete()
        .then(() => {
            borradoresNubeCache = borradoresNubeCache.filter(b => b.id !== idBorradorAEliminar);
            if (btnBorradorAEliminar) {
                btnBorradorAEliminar.closest('div.modal-list-item')?.remove();
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
    document.getElementById('modalBorradores').classList.remove('oculto');
    const lista = document.getElementById('listaBorradores');
    const buscador = document.getElementById('buscadorBorradores');
    const nombrePreseleccionado = document.getElementById('cliNombre').value.trim();

    if (buscador) {
        buscador.value = nombrePreseleccionado;
    }

    lista.innerHTML = '<div style="text-align: center; color: var(--ngc-neon); padding: 15px 0;"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando en la nube...</div>';

    const uid = obtenerUid();
    if (!uid || !db) {
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Sin conexión a la nube.</div>';
        return;
    }

    try {
        const snapshot = await db.collection("perfiles").doc(uid).collection("borradores_informe").get();
        let docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));
        docs.sort((a, b) => (b.data.fechaGuardado || 0) - (a.data.fechaGuardado || 0));

        borradoresNubeCache = docs;
        filtrarListaBorradoresUI();
    } catch (e) {
        console.error("Error cargando borradores:", e);
        lista.innerHTML = '<div style="color:var(--error-red); text-align:center;">Error al cargar borradores.</div>';
    }
}

function filtrarListaBorradoresUI() {
    const lista = document.getElementById('listaBorradores');
    if (!lista) return;

    const termino = normalizarTextoBusqueda(document.getElementById('buscadorBorradores')?.value.trim());

    const filtrados = borradoresNubeCache.filter(b => {
        if (!termino) return true;
        const p = b.data || {};
        const fechaStr = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : '';
        const blob = normalizarTextoBusqueda(`${p.nombreBorrador || ''} ${p.cliNombre || ''} ${p.cliProyecto || ''} ${fechaStr}`);
        return blob.includes(termino);
    });

    lista.innerHTML = '';

    if (borradoresNubeCache.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded); padding: 15px 0;">No tenés borradores guardados en la nube.</p>';
        return;
    }

    if (filtrados.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded); padding: 15px 0;">Sin coincidencias para ese filtro.</p>';
        return;
    }

    filtrados.forEach(b => {
        const p = b.data || {};
        const fechaStr = p.fechaGuardado ? new Date(p.fechaGuardado).toLocaleDateString('es-AR') : 'Sin fecha';
        const subtitulo = [p.cliNombre, p.cliProyecto, fechaStr].filter(Boolean).join(' · ');

        const itemDiv = document.createElement('div');
        itemDiv.className = 'modal-list-item';
        itemDiv.style.borderLeft = '3px solid var(--ngc-neon)';
        itemDiv.innerHTML = `
            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                <h4 style="word-break: break-word; line-height: 1.2; margin-bottom: 4px;">${escaparHTML(p.nombreBorrador || p.cliNombre || 'Sin título')}</h4>
                <small style="color: var(--ngc-text-faded); display: block;">${escaparHTML(subtitulo)}</small>
            </div>
            <div style="display: flex; gap: 5px; flex-shrink: 0;">
                <button type="button" class="corp-btn-small" onclick="cargarBorradorNube('${escaparHTML(b.id)}')">Abrir</button>
                <button type="button" class="corp-btn-small danger" onclick="eliminarBorradorNube('${escaparHTML(b.id)}', this)"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        lista.appendChild(itemDiv);
    });
}

async function cargarBorradorNube(docId) {
    const uid = obtenerUid();
    if (!uid || !db) return;
    try {
        const doc = await db.collection("perfiles").doc(uid).collection("borradores_informe").doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            
            document.getElementById('cliNombre').value = data.cliNombre || '';
            document.getElementById('cliDireccion').value = data.cliDireccion || data.cliDir || '';
            document.getElementById('cliProyecto').value = data.cliProyecto || '';
            document.getElementById('obsGenerales').value = data.obsGenerales || '';
            
            cancelarEdicionBloque();
            informeParrafos = data.parrafos || [];
            bloquesExpandidos.clear();
            if (data.telefonoClienteActual !== undefined) telefonoClienteActual = data.telefonoClienteActual;
            
            clienteDesdeAgenda = true;
            permiteGuardarNube = true;
            nombreBorradorActual = data.nombreBorrador || null;
            
            if(typeof cerrarModalBorradoresGlobal === 'function') cerrarModalBorradoresGlobal();
            
            avanzarPasoTrabajo(true);
            actualizarPillEstadoNube('synced');
            renderizarParrafos();
            guardarEstadoLocal();
            mostrarToast("Borrador Abierto", "Los datos han sido cargados.");
        }
    } catch(e) {
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
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '#', active: true },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
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

// ==========================================
// LIBRERÍA TÉCNICA (FÓRMULAS, SIMBOLOGÍA Y NORMAS)
// ==========================================
const LIBRERIA_TECNICA = [
    // --- FÓRMULAS ELÉCTRICAS FUNDAMENTALES ---
    { cat: 'formulas', etq: 'Fórmula', valor: 'V = I · R', desc: 'Ley de Ohm: Tensión (V) en función de Corriente y Resistencia' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'I = V / R', desc: 'Ley de Ohm: Intensidad de corriente (A)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'R = V / I', desc: 'Ley de Ohm: Resistencia eléctrica (Ω)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'P = U · I · cos φ', desc: 'Potencia Activa Monofásica (W)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'S = U · I', desc: 'Potencia Aparente Monofásica (VA)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'Q = U · I · sen φ', desc: 'Potencia Reactiva Monofásica (VAr)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'P = √3 · U · I · cos φ', desc: 'Potencia Activa Trifásica (W)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'S = √3 · U · I', desc: 'Potencia Aparente Trifásica (VA)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'Q = √3 · U · I · sen φ', desc: 'Potencia Reactiva Trifásica (VAr)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'ΔU = k · I · L · (R · cos φ + X · sen φ)', desc: 'Caída de tensión en línea (k=2 mono, k=√3 trif)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'ΔU% = (ΔU / U) · 100', desc: 'Porcentaje de caída de tensión respecto a tensión nominal' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'I = P / (U · η · cos φ)', desc: 'Corriente nominal de motor monofásico (A)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'I = P / (√3 · U · η · cos φ)', desc: 'Corriente nominal de motor trifásico (A)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'C = [P · (tg φ₁ - tg φ₂) · 10⁶] / (ω · U²)', desc: 'Capacitor requerido para corrección de factor de potencia (µF)' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'R = ρ · (L / S)', desc: 'Resistencia de un conductor según resistividad, longitud y sección' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'Ib ≤ In ≤ Iz', desc: 'Condición de coordinación entre corriente de proyecto, calibre y cable' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'I₂ ≤ 1,45 · Iz', desc: 'Condición de disparo convencional de protección contra sobrecargas' },
    { cat: 'formulas', etq: 'Fórmula', valor: 'E = P · t', desc: 'Energía eléctrica consumida (kWh)' },

    // --- SIMBOLOGÍA ELÉCTRICA Y UNIDADES DE PLANOS ---
    { cat: 'simbologia', etq: 'Símbolo', valor: '⏚', desc: 'Puesta a tierra general (PAT)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'PE', desc: 'Conductor de protección / Tierra de seguridad' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '3N~ 380/220 V - 50 Hz', desc: 'Sistema trifásico con neutro y frecuencia' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '1N~ 220 V - 50 Hz', desc: 'Sistema monofásico con neutro y frecuencia' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '∿', desc: 'Corriente Alterna (CA / AC)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '⎓', desc: 'Corriente Continua (CC / DC)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'PIA (MCB)', desc: 'Pequeño Interruptor Automático / Llave Termomagnética' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'ID (RCD)', desc: 'Interruptor Diferencial / Disyuntor (IΔn)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'IΔn = 30 mA', desc: 'Sensibilidad nominal de disparo diferencial' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'DPS (SPD)', desc: 'Dispositivo de Protección contra Sobretensiones Transitorias' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'TP / TS', desc: 'Tablero Principal / Tablero Seccional' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'IUG / TUG / TUE / ACU', desc: 'Circuitos: Iluminación, Tomas Uso General, Especial y Carga Única' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'KM / FR', desc: 'Contactor electromagnético / Relé térmico de sobrecarga' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'M 3~', desc: 'Motor eléctrico trifásico' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'Ω', desc: 'Ohm (Unidad de resistencia / impedancia)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'mm²', desc: 'Milímetros cuadrados (Sección nominal de conductores)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'µF', desc: 'Microfaradios (Capacidad de capacitores)' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'cos φ', desc: 'Factor de potencia' },
    { cat: 'simbologia', etq: 'Símbolo', valor: 'ΔU', desc: 'Caída de tensión' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '⌀', desc: 'Diámetro nominal de cañería / conducto' },
    { cat: 'simbologia', etq: 'Símbolo', valor: '≤ / ≥ / ± / ≈', desc: 'Operadores técnicos: menor o igual, mayor o igual, tolerancia, aprox.' },

    // --- NORMAS AEA (ARGENTINA) ---
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-7-770', desc: 'Instalaciones eléctricas en inmuebles destinados a viviendas (hasta 63 A)' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-7-771', desc: 'Viviendas, oficinas y locales (unitarios)' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-5-52', desc: 'Elección e instalación de canalizaciones y caída de tensión admisible' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-5-54', desc: 'Puesta a tierra, conductores de protección (PE) y equipotencialidad' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-4-41', desc: 'Protección para la seguridad: Protección contra los choques eléctricos' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-4-43', desc: 'Protección contra las sobreintensidades (sobrecargas y cortocircuitos)' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-6', desc: 'Verificación inicial y periódica de las instalaciones eléctricas' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-7-701', desc: 'Cuartos de baño y locales que contienen una bañera o ducha' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-7-710', desc: 'Locales para usos médicos y salas externas' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 90364-7-718', desc: 'Locales y lugares de pública concurrencia' },
    { cat: 'aea', etq: 'AEA', valor: 'AEA 95150', desc: 'Ejecución de instalaciones de suministro y medición en baja tensión' },
    { cat: 'aea', etq: 'AEA', valor: 'Ley 10.281 (ERSeP)', desc: 'Ley de Seguridad Eléctrica de la Provincia de Córdoba' },

    // --- NORMAS IRAM ---
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM NM 247-3', desc: 'Cables unipolares aislados en PVC sin envoltura para instalaciones fijas' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2178-1', desc: 'Cables de energía aislados con dieléctricos sólidos extruidos (subterráneos)' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2281', desc: 'Puesta a tierra de sistemas eléctricos - Código de práctica y medición' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2071', desc: 'Tomacorrientes bipolares con toma de tierra para uso doméstico y similar' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2007', desc: 'Interruptores manuales para instalaciones eléctricas fijas' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2301', desc: 'Interruptores automáticos de corriente diferencial de fuga (ID)' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2169', desc: 'Interruptores automáticos para protección contra sobrecorrientes (PIA)' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2184', desc: 'Protección de estructuras contra las descargas eléctricas atmosféricas' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 62386', desc: 'Sistemas de caños y accesorios para instalaciones eléctricas' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 2004', desc: 'Conductores eléctricos de cobre desnudo para líneas aéreas y PAT' },
    { cat: 'iram', etq: 'IRAM', valor: 'IRAM 10005', desc: 'Colores y señales de seguridad en instalaciones y tableros' },

    // --- NORMAS INTERNACIONALES ---
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 60364', desc: 'Instalaciones eléctricas de baja tensión (norma base internacional)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 60617', desc: 'Símbolos gráficos para esquemas y planos eléctricos' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 60898-1', desc: 'Interruptores automáticos para instalaciones domésticas y análogas (MCB)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 60947-2', desc: 'Aparamenta de baja tensión: Interruptores automáticos industriales' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 61008-1', desc: 'Interruptores diferenciales sin protección contra sobrecorrientes (RCCB)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 61009-1', desc: 'Interruptores diferenciales con protección contra sobrecorrientes (RCBO)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 60529', desc: 'Grados de protección proporcionados por las envolventes (Código IP)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 62262', desc: 'Grados de protección contra impactos mecánicos externos (Código IK)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 61643-11', desc: 'Dispositivos de protección contra sobretensiones en baja tensión (SPD)' },
    { cat: 'internacionales', etq: 'IEC', valor: 'IEC 62305', desc: 'Protección contra el rayo y evaluación de riesgo' },
    { cat: 'internacionales', etq: 'ISO', valor: 'ISO 45001', desc: 'Sistemas de gestión de la seguridad y salud en el trabajo' }
];

let categoriaLibreriaActual = 'todas';
let cursorLibreriaStart = 0;
let cursorLibreriaEnd = 0;

function abrirModalLibreria() {
    if (modoEditorTabla) return;

    const textarea = document.getElementById('textoInforme');
    if (textarea) {
        cursorLibreriaStart = textarea.selectionStart ?? textarea.value.length;
        cursorLibreriaEnd = textarea.selectionEnd ?? textarea.value.length;
    }

    categoriaLibreriaActual = 'todas';
    const buscador = document.getElementById('buscadorLibreria');
    if (buscador) buscador.value = '';

    document.querySelectorAll('#tabsLibreria .lib-tab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === 0);
    });

    filtrarLibreria();
    document.getElementById('modalLibreriaTecnica').classList.remove('oculto');
}

function cerrarModalLibreria() {
    document.getElementById('modalLibreriaTecnica').classList.add('oculto');
}

function seleccionarCategoriaLibreria(categoria, btnElement) {
    categoriaLibreriaActual = categoria;
    document.querySelectorAll('#tabsLibreria .lib-tab-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    filtrarLibreria();
}

function normalizarTextoBusqueda(txt) {
    return String(txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function filtrarLibreria() {
    const contenedor = document.getElementById('listaLibreriaTecnica');
    if (!contenedor) return;

    const termino = normalizarTextoBusqueda(document.getElementById('buscadorLibreria')?.value.trim());

    const resultados = LIBRERIA_TECNICA.filter(item => {
        const coincideCat = categoriaLibreriaActual === 'todas' || item.cat === categoriaLibreriaActual;
        if (!coincideCat) return false;
        if (!termino) return true;

        const textoItem = normalizarTextoBusqueda(`${item.valor} ${item.desc} ${item.etq}`);
        return textoItem.includes(termino);
    });

    contenedor.innerHTML = '';

    if (resultados.length === 0) {
        contenedor.innerHTML = '<p style="text-align:center; color: var(--ngc-text-faded); padding: 15px 0;">No se encontraron coincidencias.</p>';
        return;
    }

    resultados.forEach(item => {
        const card = document.createElement('div');
        card.className = 'lib-item-card';
        card.innerHTML = `
            <div class="lib-item-header">
                <span class="lib-item-valor">${escaparHTML(item.valor)}</span>
                <span class="lib-item-badge">${escaparHTML(item.etq)}</span>
            </div>
            <div class="lib-item-desc">${escaparHTML(item.desc)}</div>
        `;
        card.onclick = () => insertarDesdeLibreria(item.valor);
        contenedor.appendChild(card);
    });
}

function insertarDesdeLibreria(textoAInsertar) {
    const textarea = document.getElementById('textoInforme');
    cerrarModalLibreria();
    if (!textarea) return;

    const textoActual = textarea.value;
    const inicio = Math.min(cursorLibreriaStart, textoActual.length);
    const fin = Math.min(cursorLibreriaEnd, textoActual.length);

    const antes = textoActual.slice(0, inicio);
    const despues = textoActual.slice(fin);

    const necesitaEspacioAntes = antes.length > 0 && !/[\s(\[¿¡]$/.test(antes);
    const insercion = (necesitaEspacioAntes ? ' ' : '') + textoAInsertar;

    textarea.value = antes + insercion + despues;

    const nuevaPosicion = antes.length + insercion.length;
    textarea.focus();
    textarea.setSelectionRange(nuevaPosicion, nuevaPosicion);
    actualizarContadorRedaccion();
}

// ==========================================
// MODAL CALCULADORA TÉCNICA (PANTALLA COMPLETA)
// ==========================================
let cursorCalcStart = null;
let cursorCalcEnd = null;

function abrirModalCalculadora() {
    const textarea = document.getElementById('textoInforme');
    if (textarea && !modoEditorTabla) {
        cursorCalcStart = textarea.selectionStart ?? textarea.value.length;
        cursorCalcEnd = textarea.selectionEnd ?? textarea.value.length;
    }

    const modal = document.getElementById('modalCalculadora');
    const iframe = document.getElementById('iframeCalculadoraModal');
    const loader = document.getElementById('loaderCalculadoraModal');

    if (!modal || !iframe) return;

    modal.classList.remove('oculto');
    document.body.style.overflow = 'hidden';

    if (!iframe.getAttribute('src')) {
        if (loader) loader.style.display = 'block';
        iframe.style.opacity = '0';
        iframe.src = '../leyescalc/index.html?modal=1';
    }
}

function ocultarLoaderCalculadoraModal() {
    const iframe = document.getElementById('iframeCalculadoraModal');
    const loader = document.getElementById('loaderCalculadoraModal');
    if (iframe && iframe.getAttribute('src')) {
        if (loader) loader.style.display = 'none';
        iframe.style.opacity = '1';
    }
}

function cerrarModalCalculadora() {
    const modal = document.getElementById('modalCalculadora');
    if (modal) modal.classList.add('oculto');
    document.body.style.overflow = '';

    const textarea = document.getElementById('textoInforme');
    if (textarea && !modoEditorTabla && cursorCalcStart !== null) {
        textarea.focus();
        textarea.setSelectionRange(cursorCalcStart, cursorCalcEnd ?? cursorCalcStart);
    }
      }
