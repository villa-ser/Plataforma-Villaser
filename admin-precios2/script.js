// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN (GOOGLE SHEET + APPS SCRIPT)
// ============================================================================
const SHEET_ID = '1risNRvrxFiawgawi2XhENDqijZiNeW-jWzt8XE07aio';
const URL_LECTURA = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;

const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbxzv9WJgbiL3kLaWG583ejcSxpQi6F9C1hY_huY80VHFn1fOABD7ObFic7B_vf98OOPqg/exec';
const API_SECRET_TOKEN = 'VILLASER_ADMIN_2026_X99';

const COLUMNAS_EDITABLES = [
    { key: 'importeNeto', label: 'Importe Neto', sheetCol: 'Importe Neto', tipo: 'number', esMoneda: true },
    { key: 'horas', label: 'Horas / Min', sheetCol: 'Horas', tipo: 'number', esMoneda: false },
    { key: 'notasPresupuesto', label: 'Notas internas', sheetCol: 'Notas Aclaratorias en presupuesto', tipo: 'text', esMoneda: false },
    { key: 'notasAclaratorias', label: 'Notas Aclaratorias', sheetCol: 'Notas Aclaratorias', tipo: 'text', esMoneda: false },
    { key: 'mostrar', label: 'Mostrar', sheetCol: 'Mostrar', tipo: 'text', esMoneda: false },
    { key: 'fuentes', label: 'Fuentes', sheetCol: 'Fuentes', tipo: 'text', esMoneda: false },
    { key: 'codigo', label: 'Código', sheetCol: 'Codigo', tipo: 'text', esMoneda: false },
    { key: 'codigo2', label: 'Código 2', sheetCol: 'Codigo 2', tipo: 'text', esMoneda: false },
    { key: 'portabilidad', label: 'Portabilidad', sheetCol: 'Portabilidad', tipo: 'text', esMoneda: false },
    { key: 'ampliacionPortabilidad', label: 'Amp. Portab.', sheetCol: 'Ampliacion Portabilidad', tipo: 'text', esMoneda: false },
    { key: 'organizacion', label: 'Organización', sheetCol: 'Organizacion', tipo: 'text', esMoneda: false }
];

let dbDatos = [];
let columnaSeleccionada = COLUMNAS_EDITABLES[0];
let modoEdicion = false;
let esTemaExistente = true;
let contextoSelectorTema = 'filtro'; // 'filtro' | 'nuevo'

// ============================================================================
// INICIALIZACIÓN Y TEMA
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarTemaGlobal();
    renderizarChipsColumnas();
    cargarDatosSheet();
});

function aplicarTemaGlobal() {
    const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
    if (temaGuardado === 'light' || (temaGuardado === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// ============================================================================
// 1. PÍLDORAS HORIZONTALES DE COLUMNA (1 SELECCIONADA POR VEZ)
// ============================================================================
function renderizarChipsColumnas() {
    const cont = document.getElementById('contenedorColumnas');
    cont.innerHTML = '';

    COLUMNAS_EDITABLES.forEach((col, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-chip' + (index === 0 ? ' active' : '');
        btn.innerHTML = `<i class="fa-solid ${index === 0 ? 'fa-check' : 'fa-tag'}" style="font-size:0.72rem;"></i> ${col.label}`;

        btn.addEventListener('click', () => {
            if (columnaSeleccionada.key === col.key) return;

            cont.querySelectorAll('.ap-chip').forEach((c, idx) => {
                c.classList.remove('active');
                const icon = c.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-tag';
            });

            btn.classList.add('active');
            const activeIcon = btn.querySelector('i');
            if (activeIcon) activeIcon.className = 'fa-solid fa-check';

            columnaSeleccionada = col;
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

            if (document.getElementById('selTema').value) {
                renderizarConceptosPorTema();
            }
        });

        cont.appendChild(btn);
    });
}

// ============================================================================
// 2. LECTURA DE GOOGLE SHEETS (COLUMNAS A -> M)
// ============================================================================
async function cargarDatosSheet() {
    document.getElementById('loading').classList.remove('oculto');
    document.getElementById('app').classList.add('oculto');
    document.getElementById('stickyActionBar').classList.add('oculto');

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

        const temasUnicos = [...new Set(dbDatos.map(i => i.tema))].filter(Boolean);
        document.getElementById('totalTemasLabel').innerText = `${temasUnicos.length} rubros`;

        document.getElementById('loading').classList.add('oculto');
        document.getElementById('app').classList.remove('oculto');
        document.getElementById('stickyActionBar').classList.remove('oculto');

        if (document.getElementById('selTema').value) {
            renderizarConceptosPorTema();
        }
    } catch (error) {
        console.error(error);
        document.getElementById('loading').innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color: var(--error-red); font-size: 2.5rem; margin-bottom: 10px;"></i>
            <p style="color: var(--ngc-text-main); font-weight:600;">Error al conectar con Google Sheets.</p>
            <button class="corp-btn" onclick="location.reload()">Reintentar</button>
        `;
    }
}

// ============================================================================
// 3. SELECTOR DE TEMA / RUBRO CON BUSCADOR (MODAL BOTTOM-SHEET)
// ============================================================================
function abrirModalTemas(contexto) {
    contextoSelectorTema = contexto;
    const inputBusq = document.getElementById('buscadorTemaModal');
    inputBusq.value = '';
    renderizarListaTemasModal();
    document.getElementById('modalSelectorTema').classList.remove('oculto');
    setTimeout(() => inputBusq.focus(), 100);
}

function cerrarModalTemas() {
    document.getElementById('modalSelectorTema').classList.add('oculto');
}

function renderizarListaTemasModal() {
    const filtro = document.getElementById('buscadorTemaModal').value.trim().toLowerCase();
    const cont = document.getElementById('contenedorListaTemasModal');
    cont.innerHTML = '';

    const conteoPorTema = {};
    dbDatos.forEach(item => {
        if (!item.tema) return;
        conteoPorTema[item.tema] = (conteoPorTema[item.tema] || 0) + 1;
    });

    const temasOrdenados = Object.keys(conteoPorTema)
        .filter(t => t.toLowerCase().includes(filtro))
        .sort((a, b) => a.localeCompare(b, 'es'));

    const temaActual = contextoSelectorTema === 'filtro'
        ? document.getElementById('selTema').value
        : document.getElementById('inputNuevoTemaSelect').value;

    if (temasOrdenados.length === 0) {
        cont.innerHTML = `<p style="text-align:center; color: var(--ngc-text-faded); padding: 20px;">No se encontraron rubros con "${filtro}".</p>`;
        return;
    }

    temasOrdenados.forEach(tema => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ap-tema-option' + (tema === temaActual ? ' selected' : '');

        const spanNombre = document.createElement('span');
        spanNombre.textContent = tema;

        const spanCount = document.createElement('span');
        spanCount.className = 'ap-tema-count';
        spanCount.textContent = `${conteoPorTema[tema]} ítems`;

        btn.appendChild(spanNombre);
        btn.appendChild(spanCount);

        btn.addEventListener('click', () => {
            if (contextoSelectorTema === 'filtro') {
                document.getElementById('selTema').value = tema;
                const trigger = document.getElementById('btnAbrirSelectorTema');
                trigger.classList.remove('placeholder');
                document.getElementById('textoTemaSeleccionado').textContent = tema;
                document.getElementById('filtroConceptoInput').value = '';
                cerrarModalTemas();
                renderizarConceptosPorTema();
            } else {
                document.getElementById('inputNuevoTemaSelect').value = tema;
                const trigger = document.getElementById('btnSelectTemaNuevoModal');
                trigger.classList.remove('placeholder');
                document.getElementById('textoTemaNuevoModal').textContent = tema;
                cerrarModalTemas();
                calcularCodigoCorrelativo();
            }
        });

        cont.appendChild(btn);
    });
}

// ============================================================================
// 4. RENDERIZADO DE CONCEPTOS, MODO EDICIÓN Y TRAZABILIDAD DE CAMBIOS
// ============================================================================
function formatearValorLectura(valor) {
    if (valor === '' || valor === null || valor === undefined) return 'Sin valor cargado';
    if (columnaSeleccionada.esMoneda && !isNaN(Number(valor))) {
        return `$ ${Number(valor).toLocaleString('es-AR')}`;
    }
    return String(valor);
}

function renderizarConceptosPorTema() {
    const temaElegido = document.getElementById('selTema').value;
    const cardRes = document.getElementById('cardResultados');
    const lista = document.getElementById('listaConceptos');
    const btnEditarGuardar = document.getElementById('btnEditarGuardar');

    if (!temaElegido) {
        cardRes.classList.add('oculto');
        btnEditarGuardar.classList.add('oculto');
        return;
    }

    modoEdicion = false;
    document.getElementById('boxAjusteMasivo').classList.add('oculto');
    document.getElementById('inputPorcentajeCustom').value = '';

    const filtrados = dbDatos.filter(item => item.tema === temaElegido);
    document.getElementById('contadorConceptos').textContent = filtrados.length;
    document.getElementById('badgeColumnaActiva').textContent = columnaSeleccionada.label;

    lista.innerHTML = '';

    filtrados.forEach(item => {
        const valorActual = item[columnaSeleccionada.key] ?? '';

        const card = document.createElement('div');
        card.className = 'concepto-edit-card';
        card.dataset.searchText = `${item.concepto} ${item.codigo}`.toLowerCase();

        // Header de tarjeta
        const header = document.createElement('div');
        header.className = 'concepto-edit-header';

        const spanTitulo = document.createElement('span');
        spanTitulo.className = 'concepto-titulo';
        spanTitulo.textContent = item.concepto;

        const spanCod = document.createElement('span');
        spanCod.className = 'badge-codigo';
        spanCod.textContent = item.codigo || 'S/C';

        header.appendChild(spanTitulo);
        header.appendChild(spanCod);

        // Caja de lectura formateada
        const lecturaDiv = document.createElement('div');
        lecturaDiv.className = 'ap-valor-lectura' + (valorActual === '' ? ' vacio' : '');
        lecturaDiv.textContent = formatearValorLectura(valorActual);

        // Contenedor de edición (oculto hasta tocar Editar)
        const editWrap = document.createElement('div');
        editWrap.className = 'ap-edit-wrap oculto';

        const input = document.createElement('input');
        input.type = columnaSeleccionada.tipo;
        if (columnaSeleccionada.tipo === 'number') {
            input.setAttribute('inputmode', columnaSeleccionada.esMoneda ? 'decimal' : 'numeric');
            input.setAttribute('step', 'any');
        }
        input.className = 'corp-input input-editable';
        input.dataset.row = item.rowNumber;
        input.dataset.original = String(valorActual);
        input.value = String(valorActual);

        const diffHint = document.createElement('div');
        diffHint.className = 'ap-diff-hint oculto';
        diffHint.innerHTML = `<span><i class="fa-solid fa-pen"></i> Modificado</span><span>Antes: ${formatearValorLectura(valorActual)}</span>`;

        input.addEventListener('input', () => {
            evaluarCambioInput(input, card, diffHint);
            actualizarBarraInferior();
        });

        editWrap.appendChild(input);
        editWrap.appendChild(diffHint);

        card.appendChild(header);
        card.appendChild(lecturaDiv);
        card.appendChild(editWrap);
        lista.appendChild(card);
    });

    cardRes.classList.remove('oculto');
    btnEditarGuardar.classList.remove('oculto');
    actualizarBarraInferior();
}

function evaluarCambioInput(input, card, diffHint) {
    const nuevo = input.value.trim();
    const original = input.dataset.original.trim();
    const cambio = nuevo !== original;

    card.classList.toggle('is-dirty', cambio);
    diffHint.classList.toggle('oculto', !cambio);
}

function contarCambiosPendientes() {
    let total = 0;
    document.querySelectorAll('#listaConceptos .input-editable').forEach(inp => {
        if (inp.value.trim() !== inp.dataset.original.trim()) total++;
    });
    return total;
}

function actualizarBarraInferior() {
    const btnMain = document.getElementById('btnEditarGuardar');
    const btnCancel = document.getElementById('btnCancelarEdicion');

    if (!modoEdicion) {
        btnCancel.classList.add('oculto');
        btnMain.classList.remove('saving-state');
        btnMain.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar valores';
    } else {
        const pendientes = contarCambiosPendientes();
        btnCancel.classList.remove('oculto');
        btnMain.classList.add('saving-state');
        btnMain.innerHTML = pendientes > 0
            ? `<i class="fa-solid fa-floppy-disk"></i> Guardar (${pendientes})`
            : `<i class="fa-solid fa-check"></i> Listo (0 cambios)`;
    }
}

function filtrarConceptosVisibles() {
    const q = document.getElementById('filtroConceptoInput').value.trim().toLowerCase();
    document.querySelectorAll('#listaConceptos .concepto-edit-card').forEach(card => {
        const match = card.dataset.searchText.includes(q);
        card.style.display = match ? 'flex' : 'none';
    });
}

function cancelarModoEdicion() {
    document.querySelectorAll('#listaConceptos .concepto-edit-card').forEach(card => {
        const inp = card.querySelector('.input-editable');
        const diffHint = card.querySelector('.ap-diff-hint');
        inp.value = inp.dataset.original;
        card.classList.remove('is-dirty');
        diffHint.classList.add('oculto');
        card.querySelector('.ap-valor-lectura').classList.remove('oculto');
        card.querySelector('.ap-edit-wrap').classList.add('oculto');
    });

    modoEdicion = false;
    document.getElementById('boxAjusteMasivo').classList.add('oculto');
    actualizarBarraInferior();
    mostrarToast('Edición cancelada', 'Se restauraron los valores originales.');
}

// ============================================================================
// 5. AJUSTE MASIVO POR PORCENTAJE (PARA RUBROS COMPLETOS)
// ============================================================================
function aplicarPorcentajeMasivo(porcentaje) {
    if (!modoEdicion || columnaSeleccionada.tipo !== 'number') return;
    const factor = 1 + (porcentaje / 100);
    let afectados = 0;

    document.querySelectorAll('#listaConceptos .concepto-edit-card').forEach(card => {
        if (card.style.display === 'none') return; // Respeta el filtro si está activo
        const inp = card.querySelector('.input-editable');
        const diffHint = card.querySelector('.ap-diff-hint');
        const valActual = parseFloat(inp.value);

        if (!isNaN(valActual) && valActual > 0) {
            const nuevoVal = columnaSeleccionada.esMoneda
                ? Math.round(valActual * factor)
                : Number((valActual * factor).toFixed(2));
            inp.value = nuevoVal;
            evaluarCambioInput(inp, card, diffHint);
            afectados++;
        }
    });

    actualizarBarraInferior();
    const signo = porcentaje > 0 ? '+' : '';
    mostrarToast(`Ajuste ${signo}${porcentaje}% aplicado`, `Revisá los ${afectados} valores y tocá Guardar.`);
}

function aplicarPorcentajeCustom() {
    const raw = document.getElementById('inputPorcentajeCustom').value.trim();
    const pct = parseFloat(raw);
    if (isNaN(pct) || pct === 0) {
        mostrarToast('Porcentaje inválido', 'Ingresá un número distinto de 0 (ej: 12 o -5).');
        return;
    }
    aplicarPorcentajeMasivo(pct);
    document.getElementById('inputPorcentajeCustom').value = '';
}

// ============================================================================
// 6. GUARDADO EN GOOGLE SHEETS (SIN ALERTAS NATIVAS)
// ============================================================================
async function manejarBotonEditarGuardar() {
    const cards = document.querySelectorAll('#listaConceptos .concepto-edit-card');
    if (cards.length === 0) return;

    // PASO 1: ACTIVAR MODO EDICIÓN
    if (!modoEdicion) {
        modoEdicion = true;
        cards.forEach(card => {
            card.querySelector('.ap-valor-lectura').classList.add('oculto');
            card.querySelector('.ap-edit-wrap').classList.remove('oculto');
        });

        if (columnaSeleccionada.tipo === 'number') {
            document.getElementById('boxAjusteMasivo').classList.remove('oculto');
        }

        actualizarBarraInferior();
        const primerInputVisible = Array.from(cards).find(c => c.style.display !== 'none')?.querySelector('.input-editable');
        if (primerInputVisible) primerInputVisible.focus();
        return;
    }

    // PASO 2: RECOPILAR Y GUARDAR CAMBIOS
    const cambios = [];
    cards.forEach(card => {
        const inp = card.querySelector('.input-editable');
        const valorNuevo = inp.value.trim();
        const valorOriginal = inp.dataset.original.trim();
        if (valorNuevo !== valorOriginal) {
            cambios.push({
                rowNumber: parseInt(inp.dataset.row, 10),
                valor: columnaSeleccionada.tipo === 'number' && valorNuevo !== '' ? Number(valorNuevo) : valorNuevo
            });
        }
    });

    if (cambios.length === 0) {
        cancelarModoEdicion();
        return;
    }

    const btn = document.getElementById('btnEditarGuardar');
    const btnCancel = document.getElementById('btnCancelarEdicion');
    btn.disabled = true;
    btnCancel.disabled = true;
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
                action: 'updateColumn',
                columna: columnaSeleccionada.sheetCol,
                cambios: cambios
            })
        });

        const resultado = await respuesta.json();
        if (resultado.status !== 'success') {
            mostrarToast('Error en Google Sheets', resultado.message || 'No se pudo actualizar.');
            actualizarBarraInferior();
            return;
        }

        // Actualizar memoria local y volver a vista de lectura limpia
        cambios.forEach(c => {
            const reg = dbDatos.find(d => d.rowNumber === c.rowNumber);
            if (reg) reg[columnaSeleccionada.key] = String(c.valor);
        });

        renderizarConceptosPorTema();
        mostrarToast('Lista de precios actualizada', `Se guardaron ${cambios.length} registro(s) en Google Sheets.`);

    } catch (e) {
        console.error(e);
        mostrarToast('Error de conexión', 'Verificá tu señal e intentá nuevamente.');
        actualizarBarraInferior();
    } finally {
        btn.disabled = false;
        btnCancel.disabled = false;
    }
}

// ============================================================================
// 7. MODAL "NUEVO" Y GENERACIÓN AUTOMÁTICA DE CÓDIGO CORRELATIVO
// ============================================================================
function abrirModalNuevo() {
    seleccionarTipoTema(true);

    const temaFiltroActual = document.getElementById('selTema').value;
    const triggerTemaNuevo = document.getElementById('btnSelectTemaNuevoModal');

    if (temaFiltroActual) {
        document.getElementById('inputNuevoTemaSelect').value = temaFiltroActual;
        triggerTemaNuevo.classList.remove('placeholder');
        document.getElementById('textoTemaNuevoModal').textContent = temaFiltroActual;
    } else {
        document.getElementById('inputNuevoTemaSelect').value = '';
        triggerTemaNuevo.classList.add('placeholder');
        document.getElementById('textoTemaNuevoModal').textContent = 'Seleccionar tema existente...';
    }

    document.getElementById('inputNuevoTemaTexto').value = '';
    document.getElementById('newCodigo').value = '';
    document.getElementById('ayudaCodigo').textContent = '';
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

    if (temaFiltroActual) calcularCodigoCorrelativo();

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
        btnSi.style.background = 'rgba(35, 116, 225, 0.16)';
        btnNo.style.border = '1px solid var(--ngc-privacy-border)';
        btnNo.style.background = '';
        bloqueSi.classList.remove('oculto');
        bloqueNo.classList.add('oculto');
    } else {
        btnNo.style.border = '1px solid var(--ngc-neon)';
        btnNo.style.background = 'rgba(35, 116, 225, 0.16)';
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
            ayuda.textContent = '';
            return;
        }

        const itemsTema = dbDatos.filter(i => i.tema === temaSel && i.codigo);
        if (itemsTema.length === 0) {
            inputCod.value = temaSel.substring(0, 3).toUpperCase() + '-001';
            ayuda.textContent = 'Primer código sugerido para este tema.';
            return;
        }

        const ultimoCodigo = itemsTema[itemsTema.length - 1].codigo;
        const match = ultimoCodigo.match(/^(.*?)(\d+)$/);

        if (match) {
            const prefijo = match[1];
            const numStr = match[2];
            const siguienteNum = String(parseInt(numStr, 10) + 1).padStart(numStr.length, '0');
            inputCod.value = prefijo + siguienteNum;
            ayuda.textContent = `Último código en este rubro: ${ultimoCodigo}`;
        } else {
            inputCod.value = ultimoCodigo + '-1';
            ayuda.textContent = `Basado en último código: ${ultimoCodigo}`;
        }
    } else {
        const nuevoTemaTxt = document.getElementById('inputNuevoTemaTexto').value.trim();
        const todosCodigos = dbDatos.map(i => i.codigo).filter(Boolean);
        const sonNumericosPuros = todosCodigos.length > 0 && todosCodigos.every(c => /^\d+$/.test(c));

        if (sonNumericosPuros) {
            const maxNum = Math.max(...todosCodigos.map(c => parseInt(c, 10)));
            const largo = todosCodigos[0].length;
            inputCod.value = String(maxNum + 1).padStart(largo, '0');
            ayuda.textContent = `Correlativo numérico global siguiente al ${maxNum}.`;
        } else if (nuevoTemaTxt.length >= 2) {
            const prefijo = nuevoTemaTxt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
            const usaGuion = todosCodigos.some(c => c.includes('-'));
            inputCod.value = usaGuion ? `${prefijo}-001` : `${prefijo}001`;
            ayuda.textContent = 'Código inicial sugerido para tema nuevo (podés editarlo).';
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

    if (!temaFinal) {
        mostrarToast('Falta el Tema', 'Seleccioná o escribí el nombre del rubro.');
        return;
    }
    if (!conceptoFinal) {
        mostrarToast('Falta el Concepto', 'Ingresá la descripción del trabajo.');
        document.getElementById('newConcepto').focus();
        return;
    }

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
            mostrarToast('Error en Google Sheets', resultado.message || 'No se pudo guardar.');
            return;
        }

        cerrarModalNuevo();
        document.getElementById('selTema').value = temaFinal;
        const trigger = document.getElementById('btnAbrirSelectorTema');
        trigger.classList.remove('placeholder');
        document.getElementById('textoTemaSeleccionado').textContent = temaFinal;

        mostrarToast('Lista de precios actualizada', 'Nuevo concepto guardado en Google Sheets.');
        setTimeout(() => cargarDatosSheet(), 900);

    } catch (e) {
        console.error(e);
        mostrarToast('Error de conexión', 'No se pudo guardar el nuevo registro.');
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
    document.getElementById('toastTitle').textContent = titulo;
    document.getElementById('toastMessage').textContent = mensaje;
    toast.classList.remove('oculto');
    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.classList.add('oculto'), 400);
    }, 3500);
}
