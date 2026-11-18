// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN (GOOGLE SHEET + APPS SCRIPT)
// ============================================================================
const SHEET_ID = '1risNRvrxFiawgawi2XhENDqijZiNeW-jWzt8XE07aio';
const URL_LECTURA = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

// URL DE TU GOOGLE APPS SCRIPT YA CONFIGURADA:
const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbxzv9WJgbiL3kLaWG583ejcSxpQi6F9C1hY_huY80VHFn1fOABD7ObFic7B_vf98OOPqg/exec';
const API_SECRET_TOKEN = 'VILLASER_ADMIN_2026_X99';

// Definición de columnas editables (excluyendo Tema y Concepto que identifican la fila)
const COLUMNAS_EDITABLES = [
    { key: 'importeNeto', label: 'Importe Neto', sheetCol: 'Importe Neto', tipo: 'number' },
    { key: 'horas', label: 'Horas', sheetCol: 'Horas', tipo: 'text' },
    { key: 'notasAclaratorias', label: 'Notas Aclaratorias', sheetCol: 'Notas Aclaratorias', tipo: 'text' },
    { key: 'notasPresupuesto', label: 'Notas en Presupuesto', sheetCol: 'Notas Aclaratorias en presupuesto', tipo: 'text' },
    { key: 'fuentes', label: 'Fuentes', sheetCol: 'Fuentes', tipo: 'text' },
    { key: 'codigo', label: 'Codigo', sheetCol: 'Codigo', tipo: 'text' },
    { key: 'codigo2', label: 'Codigo 2', sheetCol: 'Codigo 2', tipo: 'text' },
    { key: 'portabilidad', label: 'Portabilidad', sheetCol: 'Portabilidad', tipo: 'text' },
    { key: 'ampliacionPortabilidad', label: 'Ampliacion Portab.', sheetCol: 'Ampliacion Portabilidad', tipo: 'text' },
    { key: 'organizacion', label: 'Organizacion', sheetCol: 'Organizacion', tipo: 'text' },
    { key: 'mostrar', label: 'Mostrar', sheetCol: 'Mostrar', tipo: 'text' }
];

let dbDatos = [];
let columnaSeleccionada = COLUMNAS_EDITABLES[0]; // Por defecto: Importe Neto
let modoEdicion = false;
let esTemaExistente = true;

// ============================================================================
// INICIALIZACIÓN Y TEMA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarTemaGlobal();
    renderizarCheckboxesColumnas();
    cargarDatosSheet();

    // Cerrar acordeones al tocar afuera
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.corp-custom-select').forEach(det => {
            if (!det.contains(e.target)) det.removeAttribute('open');
        });
    });
});

function aplicarTemaGlobal() {
    const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
    if (temaGuardado === 'light' || (temaGuardado === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// ============================================================================
// 1. SELECTOR DE COLUMNA (CASILLA DE VERIFICACIÓN EXCLUSIVA - 1 POR VEZ)
// ============================================================================
function renderizarCheckboxesColumnas() {
    const cont = document.getElementById('contenedorColumnas');
    cont.innerHTML = '';

    COLUMNAS_EDITABLES.forEach((col, index) => {
        const label = document.createElement('label');
        label.className = 'col-check-item' + (index === 0 ? ' active' : '');
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = (index === 0);
        chk.dataset.key = col.key;

        chk.addEventListener('change', () => {
            if (!chk.checked) {
                chk.checked = true;
                return;
            }
            cont.querySelectorAll('input[type="checkbox"]').forEach(otro => {
                if (otro !== chk) {
                    otro.checked = false;
                    otro.parentElement.classList.remove('active');
                }
            });
            label.classList.add('active');
            columnaSeleccionada = col;
            
            if (document.getElementById('selTema').value) {
                renderizarConceptosPorTema();
            }
        });

        const span = document.createElement('span');
        span.innerText = col.label;

        label.appendChild(chk);
        label.appendChild(span);
        cont.appendChild(label);
    });
}

// ============================================================================
// 2. LECTURA DE GOOGLE SHEETS (COLUMNAS A -> M)
// ============================================================================
async function cargarDatosSheet() {
    document.getElementById('loading').classList.remove('oculto');
    document.getElementById('app').classList.add('oculto');

    try {
        const res = await fetch(`${URL_LECTURA}&t=${Date.now()}`);
        const txt = await res.text();
        const json = JSON.parse(txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
        const rows = json.table?.rows || [];

        dbDatos = [];
        rows.forEach((r, idx) => {
            if (!r.c) return;
            const val = (colIdx) => (r.c[colIdx] && r.c[colIdx].v !== null && r.c[colIdx].v !== undefined) ? String(r.c[colIdx].v).trim() : '';

            const tema = val(2);     // Col C
            const concepto = val(3); // Col D

            if (!tema && !concepto) return;
            if (tema.toLowerCase() === 'tema' || concepto.toLowerCase() === 'concepto') return;

            dbDatos.push({
                rowNumber: idx + 2,
                codigo: val(0),                  // A
                fuentes: val(1),                 // B
                tema: tema,                      // C
                concepto: concepto,              // D
                importeNeto: val(4),             // E
                notasAclaratorias: val(5),       // F
                horas: val(6),                   // G
                codigo2: val(7),                 // H
                portabilidad: val(8),            // I
                ampliacionPortabilidad: val(9),  // J
                notasPresupuesto: val(10),       // K
                organizacion: val(11),           // L
                mostrar: val(12)                 // M
            });
        });

        poblarAcordeonTemas();
        document.getElementById('loading').classList.add('oculto');
        document.getElementById('app').classList.remove('oculto');

        if (document.getElementById('selTema').value) {
            renderizarConceptosPorTema();
        }
    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color: var(--error-red); font-size: 2.5rem; margin-bottom: 10px;"></i>
            <p style="color: var(--ngc-text-main);">Error al leer la planilla de Google Sheets.</p>
            <button class="corp-btn" onclick="location.reload()">Reintentar</button>
        `;
    }
}

function poblarAcordeonTemas() {
    const temasUnicos = [...new Set(dbDatos.map(i => i.tema))].filter(Boolean).sort();
    const listTema = document.getElementById('listTema');
    listTema.innerHTML = '';

    temasUnicos.forEach(t => {
        const opt = document.createElement('div');
        opt.className = 'corp-select-option';
        opt.innerText = t;
        opt.onclick = () => {
            document.getElementById('selTema').value = t;
            document.getElementById('sumTema').innerText = t;
            document.getElementById('detTema').removeAttribute('open');
            renderizarConceptosPorTema();
        };
        listTema.appendChild(opt);
    });
}

// ============================================================================
// 3. RENDERIZADO DE CONCEPTOS COINCIDENTES Y MODO EDICIÓN
// ============================================================================
function renderizarConceptosPorTema() {
    const temaElegido = document.getElementById('selTema').value;
    const cardRes = document.getElementById('cardResultados');
    const lista = document.getElementById('listaConceptos');

    if (!temaElegido) {
        cardRes.classList.add('oculto');
        return;
    }

    modoEdicion = false;
    actualizarVisualBotonEditarGuardar();

    const filtrados = dbDatos.filter(item => item.tema === temaElegido);
    document.getElementById('contadorConceptos').innerText = filtrados.length;
    document.getElementById('badgeColumnaActiva').innerText = `Campo: ${columnaSeleccionada.label}`;
    
    lista.innerHTML = '';

    filtrados.forEach(item => {
        const valorActual = item[columnaSeleccionada.key] ?? '';
        
        const rowDiv = document.createElement('div');
        rowDiv.className = 'concepto-edit-card';
        rowDiv.innerHTML = `
            <div class="concepto-edit-header">
                <span style="font-size: 0.88rem; font-weight: 600; color: var(--ngc-text-main); line-height: 1.3;">${item.concepto}</span>
                <span class="badge-codigo">${item.codigo || 'S/C'}</span>
            </div>
            <div>
                <label style="font-size: 0.7rem; color: var(--ngc-text-faded); display: block; margin-bottom: 3px;">${columnaSeleccionada.label}:</label>
                <input 
                    type="${columnaSeleccionada.tipo}" 
                    class="corp-input input-editable" 
                    data-row="${item.rowNumber}" 
                    data-original="${valorActual.replace(/"/g, '&quot;')}"
                    value="${valorActual.replace(/"/g, '&quot;')}" 
                    disabled
                >
            </div>
        `;
        lista.appendChild(rowDiv);
    });

    cardRes.classList.remove('oculto');
}

function actualizarVisualBotonEditarGuardar() {
    const btn = document.getElementById('btnEditarGuardar');
    if (!modoEdicion) {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar';
        btn.style.background = 'var(--ngc-neon)';
        btn.style.color = '#000';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios';
        btn.style.background = 'var(--success-green)';
        btn.style.color = '#fff';
    }
}

async function manejarBotonEditarGuardar() {
    const inputs = document.querySelectorAll('#listaConceptos .input-editable');
    if (inputs.length === 0) return;

    // ESTADO 1: HABILITAR EDICIÓN
    if (!modoEdicion) {
        modoEdicion = true;
        inputs.forEach(inp => inp.disabled = false);
        inputs[0].focus();
        actualizarVisualBotonEditarGuardar();
        return;
    }

    // ESTADO 2: GUARDAR CAMBIOS EN GOOGLE SHEET
    const cambios = [];
    inputs.forEach(inp => {
        const valorNuevo = inp.value.trim();
        const valorOriginal = inp.dataset.original;
        if (valorNuevo !== valorOriginal) {
            cambios.push({
                rowNumber: parseInt(inp.dataset.row, 10),
                valor: columnaSeleccionada.tipo === 'number' && valorNuevo !== '' ? Number(valorNuevo) : valorNuevo
            });
        }
    });

    if (cambios.length === 0) {
        modoEdicion = false;
        inputs.forEach(inp => inp.disabled = true);
        actualizarVisualBotonEditarGuardar();
        mostrarToast('Sin modificaciones', 'No se detectaron cambios en los valores.');
        return;
    }

    const btn = document.getElementById('btnEditarGuardar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando en Google Sheet...';

    try {
        const user = firebase.auth().currentUser;
        const emailActual = user ? user.email : 'contacto@villaser.com.ar';

        const respuesta = await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                token: API_SECRET_TOKEN,
                userEmail: emailActual,
                action: 'updateColumn',
                columna: columnaSeleccionada.sheetCol,
                cambios: cambios
            })
        });

        const resultado = await respuesta.json();
        if (resultado.status !== 'success') {
            alert('Error desde Google Sheets: ' + resultado.message);
            actualizarVisualBotonEditarGuardar();
            return;
        }

        // Actualizamos la memoria local inmediatamente
        cambios.forEach(c => {
            const reg = dbDatos.find(d => d.rowNumber === c.rowNumber);
            if (reg) reg[columnaSeleccionada.key] = String(c.valor);
        });

        inputs.forEach(inp => {
            inp.dataset.original = inp.value.trim();
            inp.disabled = true;
        });

        modoEdicion = false;
        actualizarVisualBotonEditarGuardar();
        
        mostrarToast('Lista de precios actualizada', `Se actualizaron ${cambios.length} registro(s) en Google Sheets.`);
        alert('Lista de precios actualizada');

    } catch (e) {
        console.error(e);
        alert('Error al conectar con Google Sheets para guardar: ' + e.message);
        actualizarVisualBotonEditarGuardar();
    } finally {
        btn.disabled = false;
    }
}

// ============================================================================
// 4. MODAL "NUEVO" Y GENERACIÓN AUTOMÁTICA DE CÓDIGO CORRELATIVO
// ============================================================================
function abrirModalNuevo() {
    const temasUnicos = [...new Set(dbDatos.map(i => i.tema))].filter(Boolean).sort();
    const listNuevoTema = document.getElementById('listNuevoTema');
    listNuevoTema.innerHTML = '';

    temasUnicos.forEach(t => {
        const opt = document.createElement('div');
        opt.className = 'corp-select-option';
        opt.innerText = t;
        opt.onclick = () => {
            document.getElementById('inputNuevoTemaSelect').value = t;
            document.getElementById('sumNuevoTema').innerText = t;
            document.getElementById('detNuevoTema').removeAttribute('open');
            calcularCodigoCorrelativo();
        };
        listNuevoTema.appendChild(opt);
    });

    seleccionarTipoTema(true);
    document.getElementById('inputNuevoTemaSelect').value = '';
    document.getElementById('sumNuevoTema').innerText = '-- SELECCIONE TEMA --';
    document.getElementById('inputNuevoTemaTexto').value = '';
    document.getElementById('newCodigo').value = '';
    document.getElementById('ayudaCodigo').innerText = '';
    document.getElementById('newConcepto').value = '';
    document.getElementById('newImporte').value = '';
    document.getElementById('newHoras').value = '';
    document.getElementById('newFuentes').value = '';
    document.getElementById('newCodigo2').value = '';
    document.getElementById('newNotas').value = '';
    document.getElementById('newNotasPresupuesto').value = '';
    document.getElementById('newPortabilidad').value = '';
    document.getElementById('newAmpPortabilidad').value = '';
    document.getElementById('newOrganizacion').value = '';
    document.getElementById('newMostrar').value = 'SI';

    document.getElementById('modalNuevo').classList.remove('oculto');
}

function cerrarModalNuevo() {
    document.getElementById('modalNuevo').classList.add('oculto');
}

function seleccionarTipoTema(existe) {
    esTemaExistente = existe;
    const btnSi = document.getElementById('btnTemaExistente');
    const btnNo = document.getElementById('btnTemaNuevo');
    const bloqueSi = document.getElementById('bloqueTemaExistente');
    const bloqueNo = document.getElementById('bloqueTemaNuevo');

    if (existe) {
        btnSi.style.border = '1px solid var(--ngc-neon)';
        btnSi.style.background = 'rgba(var(--ngc-neon-rgb), 0.15)';
        btnNo.style.border = '1px solid var(--ngc-privacy-border)';
        btnNo.style.background = '';
        bloqueSi.classList.remove('oculto');
        bloqueNo.classList.add('oculto');
    } else {
        btnNo.style.border = '1px solid var(--ngc-neon)';
        btnNo.style.background = 'rgba(var(--ngc-neon-rgb), 0.15)';
        btnSi.style.border = '1px solid var(--ngc-privacy-border)';
        btnSi.style.background = '';
        bloqueNo.classList.remove('oculto');
        bloqueSi.classList.add('oculto');
    }
    calcularCodigoCorrelativo();
}

function calcularCodigoCorrelativo() {
    const inputCod = document.getElementById('newCodigo');
    const ayuda = document.getElementById('ayudaCodigo');

    if (esTemaExistente) {
        const temaSel = document.getElementById('inputNuevoTemaSelect').value;
        if (!temaSel) {
            inputCod.value = '';
            ayuda.innerText = '';
            return;
        }

        const itemsTema = dbDatos.filter(i => i.tema === temaSel && i.codigo);
        if (itemsTema.length === 0) {
            inputCod.value = temaSel.substring(0, 3).toUpperCase() + '-001';
            ayuda.innerText = 'Primer código sugerido para este tema.';
            return;
        }

        const ultimoCodigo = itemsTema[itemsTema.length - 1].codigo;
        const match = ultimoCodigo.match(/^(.*?)(\d+)$/);

        if (match) {
            const prefijo = match[1];
            const numStr = match[2];
            const siguienteNum = String(parseInt(numStr, 10) + 1).padStart(numStr.length, '0');
            inputCod.value = prefijo + siguienteNum;
            ayuda.innerText = `Último código en este tema: ${ultimoCodigo}`;
        } else {
            inputCod.value = ultimoCodigo + '-1';
            ayuda.innerText = `Basado en último código: ${ultimoCodigo}`;
        }
    } else {
        const nuevoTemaTxt = document.getElementById('inputNuevoTemaTexto').value.trim();
        const todosCodigos = dbDatos.map(i => i.codigo).filter(Boolean);
        const sonNumericosPuros = todosCodigos.length > 0 && todosCodigos.every(c => /^\d+$/.test(c));

        if (sonNumericosPuros) {
            const maxNum = Math.max(...todosCodigos.map(c => parseInt(c, 10)));
            const largo = todosCodigos[0].length;
            inputCod.value = String(maxNum + 1).padStart(largo, '0');
            ayuda.innerText = `Correlativo numérico global siguiente al ${maxNum}.`;
        } else if (nuevoTemaTxt.length >= 2) {
            const prefijo = nuevoTemaTxt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
            const usaGuion = todosCodigos.some(c => c.includes('-'));
            inputCod.value = usaGuion ? `${prefijo}-001` : `${prefijo}001`;
            ayuda.innerText = 'Código inicial sugerido para tema nuevo (editable si deseas).';
        } else {
            inputCod.value = '';
        }
    }
}

async function guardarNuevoRegistro() {
    const temaFinal = esTemaExistente 
        ? document.getElementById('inputNuevoTemaSelect').value.trim()
        : document.getElementById('inputNuevoTemaTexto').value.trim();

    const conceptoFinal = document.getElementById('newConcepto').value.trim();

    if (!temaFinal) return alert('Debes seleccionar o escribir un Tema.');
    if (!conceptoFinal) return alert('Debes ingresar el Concepto.');

    const datosNuevos = {
        codigo: document.getElementById('newCodigo').value.trim(),
        fuentes: document.getElementById('newFuentes').value.trim(),
        tema: temaFinal,
        concepto: conceptoFinal,
        importeNeto: document.getElementById('newImporte').value.trim() !== '' ? Number(document.getElementById('newImporte').value) : '',
        notasAclaratorias: document.getElementById('newNotas').value.trim(),
        horas: document.getElementById('newHoras').value.trim(),
        codigo2: document.getElementById('newCodigo2').value.trim(),
        portabilidad: document.getElementById('newPortabilidad').value.trim(),
        ampliacionPortabilidad: document.getElementById('newAmpPortabilidad').value.trim(),
        notasPresupuesto: document.getElementById('newNotasPresupuesto').value.trim(),
        organizacion: document.getElementById('newOrganizacion').value.trim(),
        mostrar: document.getElementById('newMostrar').value.trim() || 'SI'
    };

    const btn = document.getElementById('btnGuardarNuevo');
    const htmlOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

    try {
        const user = firebase.auth().currentUser;
        const emailActual = user ? user.email : 'contacto@villaser.com.ar';

        const respuesta = await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                token: API_SECRET_TOKEN,
                userEmail: emailActual,
                action: 'addNewRow',
                datos: datosNuevos
            })
        });

        const resultado = await respuesta.json();
        if (resultado.status !== 'success') {
            alert('Error desde Google Sheets: ' + resultado.message);
            return;
        }

        cerrarModalNuevo();
        mostrarToast('Lista de precios actualizada', 'Nuevo concepto guardado en Google Sheets.');
        alert('Lista de precios actualizada');

        setTimeout(() => cargarDatosSheet(), 1000);

    } catch (e) {
        console.error(e);
        alert('Error al guardar el nuevo registro: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = htmlOriginal;
    }
}

// ============================================================================
// UTILIDAD: NOTIFICACIÓN TOAST
// ============================================================================
function mostrarToast(titulo, mensaje) {
    const toast = document.getElementById('toastNotificacion');
    if (!toast) return;
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMessage').innerText = mensaje;
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 400);
    }, 3500);
}
