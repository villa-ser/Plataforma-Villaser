// --- LÓGICA DE TEMA AUTOMÁTICO EN TIEMPO REAL ---
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
    if (temaGuardado === 'system') {
        const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (prefiereClaro) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
});

// =======================================================
// CONFIGURACIÓN Y ESTADO GLOBAL (MÓDULO COSTOS)
// =======================================================
const SHEET_ID = '1tZbCYSBxx3suGLKmE_bXi_hEm0iH0yqQedqR7kdShEU';
const URL_SHEET = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;
const CACHE_KEY_DB = 'villaser_costos_db_v1';
const CACHE_KEY_RECENTS = 'villaser_costos_recientes_v1';

let allData = [];
let selectedFuentes = [];
let itemActual = null;
let cantidadActual = 1;
let diccionarioSugerencias = [];

// Referencias DOM
const selTema = document.getElementById('selTema');
const selConcepto = document.getElementById('selConcepto');
const detTema = document.getElementById('detTema');
const sumTema = document.getElementById('sumTema');
const detConcepto = document.getElementById('detConcepto');
const sumConcepto = document.getElementById('sumConcepto');
const resCard = document.getElementById('result-card');

// =======================================================
// MOTOR DE BÚSQUEDA INTELIGENTE (SINÓNIMOS + FONÉTICA)
// =======================================================
const palabrasVacias = new Set([
    "electrico", "electrica", "el", "la", "los", "las", "un", "una", "unos", "unas",
    "a", "ante", "bajo", "cabe", "con", "contra", "de", "desde", "durante", "en", "entre",
    "hacia", "hasta", "mediante", "para", "por", "x", "segun", "sin", "so", "sobre", "tras",
    "y", "e", "ni", "o", "u", "pero", "mas", "sino", "aunque", "porque", "pues", "como", "si", "que"
]);

const gruposSinonimos = [
    ["termomagnetica", "termica", "fusible", "breaker", "pia"],
    ["interruptor", "llave", "perilla", "apagador", "punto"],
    ["timbre", "campanilla", "zumbador", "bocina", "soneria", "portero", "llamador"],
    ["diferencial", "disyuntor", "salvavita", "id"],
    ["tomacorriente", "toma", "enchufe", "modulo", "enchufes", "tug", "tue"],
    ["conductor", "cable", "alambre", "linea", "recableado", "cableado"],
    ["jabalina", "electrodo", "tierra", "pat", "puestaatierra"],
    ["luminaria", "lampara", "foco", "artefacto", "luz", "luces", "aplique", "reflector", "iug"],
    ["instalacion", "instalar", "colocar", "montaje", "colocacion", "conexion", "cambio", "armado"],
    ["pilar", "acometida", "monofasico", "trifasico", "medidor"],
    ["flexible", "corrugado", "manguera"],
    ["cano", "caneria", "tubo"],
    ["motor", "motores", "bomba", "centrifuga"],
    ["exterior", "externo", "intemperie", "afuera"],
    ["interior", "interno", "dentro", "adentro"],
    ["mono", "monofasico", "monofasica"],
    ["trifa", "trifasico", "trifasica"],
    ["cablecanal", "canaleta", "cableducto", "canal", "moldura"],
    ["apto", "certificado", "epec", "alta", "ersep", "relevamiento"],
    ["tablero", "gabinete", "caja", "seccionador"],
    ["aire", "split", "acondicionado", "climatizador"]
];

function normalizarTexto(txt) {
    return String(txt || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizarFoneticaYPlural(texto) {
    return texto.split(/\s+/).map(p => {
        p = p.replace(/ll/g, "y").replace(/y/g, "i").replace(/v/g, "b").replace(/z/g, "s")
             .replace(/ce/g, "se").replace(/ci/g, "si").replace(/ch/g, "x").replace(/h/g, "").replace(/x/g, "ch");
        if (p.length > 4 && p.endsWith("es")) p = p.slice(0, -2);
        else if (p.length > 3 && p.endsWith("s")) p = p.slice(0, -1);
        return p;
    }).join(" ");
}

function obtenerPalabrasClave(texto) {
    let txt = normalizarTexto(texto).replace(/[^a-z0-9\s]/g, " ");
    let palabras = txt.split(/\s+/).filter(p => p.length > 0);
    for (let i = 0; i < palabras.length; i++) {
        if (palabras[i] === "cable" && palabras[i + 1] === "canal") {
            palabras[i] = "cablecanal";
            palabras.splice(i + 1, 1);
            i--;
        } else if (palabras[i] === "puesta" && palabras[i + 1] === "a" && palabras[i + 2] === "tierra") {
            palabras[i] = "puestaatierra";
            palabras.splice(i + 1, 2);
            i--;
        }
    }
    return palabras;
}

function obtenerSinonimos(palabra) {
    let opciones = [palabra];
    for (const grupo of gruposSinonimos) {
        if (grupo.includes(palabra)) {
            opciones = [...new Set([...opciones, ...grupo])];
        }
    }
    return opciones;
}

function distanciaLevenshtein(a, b) {
    const matriz = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matriz[i][0] = i;
    for (let j = 0; j <= b.length; j++) matriz[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const costo = a[i - 1] === b[j - 1] ? 0 : 1;
            matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + costo);
        }
    }
    return matriz[a.length][b.length];
}

function sonSimilares(buscada, objetivo) {
    if (buscada === objetivo) return true;
    if (buscada.length >= 3 && objetivo.includes(buscada)) return true;
    const maxErrores = Math.floor(buscada.length / 4);
    if (maxErrores === 0) return false;
    if (Math.abs(buscada.length - objetivo.length) > maxErrores + 1) return false;
    return distanciaLevenshtein(buscada, objetivo) <= maxErrores;
}

function parsePrecioNumero(valor) {
    if (typeof valor === 'number' && !isNaN(valor)) return valor;
    if (valor === null || valor === undefined || valor === '') return 0;
    const limpio = String(valor).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:,|$))/g, '').replace(',', '.');
    const num = parseFloat(limpio);
    return isNaN(num) ? 0 : num;
}

function formatearMoneda(valor) {
    if (typeof valor === 'string' && valor.trim() !== '' && isNaN(parsePrecioNumero(valor))) {
        return `$ ${valor.trim()}`;
    }
    const num = parsePrecioNumero(valor);
    return `$ ${num.toLocaleString('es-AR')}`;
}

// =======================================================
// ARRANQUE OFFLINE-FIRST Y SINCRONIZACIÓN CON GOOGLE SHEETS
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
    inicializarMenuInferior();
    inicializarEventosUI();
    iniciarCargaOfflineFirst();
});

function iniciarCargaOfflineFirst() {
    const cacheRaw = localStorage.getItem(CACHE_KEY_DB);
    let tieneCacheValida = false;

    if (cacheRaw) {
        try {
            const parsed = JSON.parse(cacheRaw);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                allData = parsed.items;
                tieneCacheValida = true;
                procesarBaseDatos(true, parsed.updatedAt);
            }
        } catch (e) {
            console.warn("Caché local corrupta, se descargará de nuevo.", e);
        }
    }

    // Siempre intenta actualizar en segundo plano (o en primer plano si no había caché)
    sincronizarDatos(false, !tieneCacheValida);
}

async function sincronizarDatos(manual = false, esPrimeraCargaSinCache = false) {
    const syncPill = document.getElementById('syncPill');
    const btnSync = document.getElementById('btnSyncForce');

    if (syncPill) {
        syncPill.className = 'pres-cloud-pill syncing';
        syncPill.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sincronizando...`;
    }
    if (btnSync && manual) {
        btnSync.querySelector('i').classList.add('fa-spin');
    }

    try {
        const response = await fetch(URL_SHEET, { cache: 'no-store' });
        if (!response.ok) throw new Error("Error HTTP al consultar Google Sheets");

        const txt = await response.text();
        const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
        const rows = json.table?.rows || [];

        const nuevosItems = [];
        rows.forEach((r, idx) => {
            if (!r.c) return;
            const tema = String(r.c[0]?.v ?? "").trim();
            const concepto = String(r.c[1]?.v ?? "").trim();
            const precioRaw = r.c[2]?.v;
            const notas = String(r.c[3]?.v ?? "").trim();
            const codigo = String(r.c[5]?.v ?? "").trim();
            const fuente = String(r.c[9]?.v ?? "").trim();

            if (!concepto) return;
            if (concepto.toLowerCase() === "concepto" || concepto.toLowerCase() === "trabajo") return;

            nuevosItems.push({
                id: `${idx}_${codigo || 'SC'}`,
                tema: tema || "General",
                concepto: concepto,
                precio: precioRaw !== null && precioRaw !== undefined ? precioRaw : 0,
                notas: notas,
                codigo: codigo || "S/C",
                fuente: fuente || "General",
                org: fuente || "General"
            });
        });

        if (nuevosItems.length === 0) throw new Error("La planilla devolvió 0 registros.");

        allData = nuevosItems;
        const ahora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem(CACHE_KEY_DB, JSON.stringify({
            updatedAt: ahora,
            items: allData
        }));

        procesarBaseDatos(false, ahora);

        if (manual) {
            mostrarToast("Base Actualizada", `${allData.length} conceptos sincronizados.`);
        }
    } catch (error) {
        console.error(error);
        if (esPrimeraCargaSinCache) {
            document.getElementById('loading').innerHTML = `
                <div class="corp-card" style="text-align: center; padding: 30px 20px; max-width: 320px;">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--error-red); font-size: 2.6rem; margin-bottom: 12px;"></i>
                    <h3 style="color: var(--ngc-text-main); font-size: 1rem; margin-bottom: 6px;">Sin conexión a la nube</h3>
                    <p style="font-size: 0.82rem; color: var(--ngc-text-faded); margin-bottom: 16px;">No hay datos en caché local y no se pudo conectar con Google Sheets.</p>
                    <button type="button" class="corp-btn primary-action" onclick="location.reload()">Reintentar</button>
                </div>
            `;
        } else if (syncPill) {
            syncPill.className = 'pres-cloud-pill local';
            syncPill.innerHTML = `<i class="fa-solid fa-wifi"></i> Modo Offline (${allData.length} ítems)`;
            if (manual) {
                mostrarToast("Sin conexión", "Trabajando con la copia local guardada.", true);
            }
        }
    } finally {
        if (btnSync) {
            btnSync.querySelector('i').classList.remove('fa-spin');
        }
    }
}

function procesarBaseDatos(desdeCache, horaSync) {
    construirDiccionarioSugerencias();

    // Conservar fuentes previamente elegidas si ya existían en pantalla
    const fuentesUnicas = [...new Set(allData.map(d => d.fuente))].filter(f => f).sort();
    const previaSeleccion = [...selectedFuentes];
    const habiaFiltrosPrevios = document.querySelectorAll('.toggle-fuente-item').length > 0;

    renderizarFuentes(fuentesUnicas, habiaFiltrosPrevios ? previaSeleccion : fuentesUnicas);
    updateTemas(true);
    renderRecientes();

    // Si había una búsqueda rápida escrita, actualizarla sin borrar lo que escribe el usuario
    const qInput = document.getElementById('quickSearchInput');
    if (qInput && qInput.value.trim().length > 0) {
        ejecutarBusquedaRapidaInline(qInput.value);
    }

    const syncPill = document.getElementById('syncPill');
    if (syncPill) {
        if (desdeCache) {
            syncPill.className = 'pres-cloud-pill ready';
            syncPill.innerHTML = `<i class="fa-solid fa-bolt"></i> Caché (${allData.length}) • Actualizando...`;
        } else {
            syncPill.className = 'pres-cloud-pill synced';
            syncPill.innerHTML = `<i class="fa-solid fa-circle-check"></i> Sincronizado ${horaSync ? `(${horaSync})` : ''} • ${allData.length} ítems`;
        }
    }

    document.getElementById('loading').classList.add('oculto');
    document.getElementById('app').classList.remove('oculto');
}

function construirDiccionarioSugerencias() {
    const palabras = new Set();
    allData.forEach(item => {
        const textoLimpio = item.concepto.replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ]/g, ' ');
        textoLimpio.split(/\s+/).forEach(word => {
            const w = normalizarTexto(word);
            if (w.length >= 3 && !palabrasVacias.has(w)) palabras.add(w);
        });
    });
    diccionarioSugerencias = Array.from(palabras);
}

// =======================================================
// SELECTOR DE FUENTES (SWITCHES DINÁMICOS)
// =======================================================
function renderizarFuentes(fuentesUnicas, fuentesActivas) {
    const container = document.getElementById('fuente-container');
    if (!container) return;
    container.innerHTML = '';

    selectedFuentes = fuentesUnicas.filter(f => fuentesActivas.includes(f));
    const todasActivas = selectedFuentes.length === fuentesUnicas.length && fuentesUnicas.length > 0;

    function createToggleRow(labelText, value, isAll = false, checkedState = true) {
        const row = document.createElement('div');
        row.className = 'fuente-row';

        const label = document.createElement('span');
        label.className = 'fuente-label';
        label.innerText = labelText;

        const toggle = document.createElement('label');
        toggle.className = 'corp-toggle';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checkedState;

        if (isAll) {
            input.id = 'toggle-fuente-all';
            input.onchange = () => selectFuente('ALL', input);
        } else {
            input.className = 'toggle-fuente-item';
            input.dataset.fuente = value;
            input.onchange = () => selectFuente(value, input);
        }

        const slider = document.createElement('span');
        slider.className = 'corp-toggle-slider';

        toggle.appendChild(input);
        toggle.appendChild(slider);
        row.appendChild(label);
        row.appendChild(toggle);

        return row;
    }

    container.appendChild(createToggleRow('TODOS', 'ALL', true, todasActivas));
    fuentesUnicas.forEach(f => {
        container.appendChild(createToggleRow(f, f, false, selectedFuentes.includes(f)));
    });

    actualizarBadgeFuentes(fuentesUnicas.length);
}

function actualizarBadgeFuentes(totalFuentes) {
    const badge = document.getElementById('badgeFuentesActivas');
    if (!badge) return;
    if (selectedFuentes.length === totalFuentes && totalFuentes > 0) {
        badge.innerText = `Todas (${totalFuentes})`;
    } else if (selectedFuentes.length === 0) {
        badge.innerText = 'Ninguna';
    } else {
        badge.innerText = `${selectedFuentes.length} de ${totalFuentes}`;
    }
}

function selectFuente(fuente, checkbox) {
    const checkAll = document.getElementById('toggle-fuente-all');
    const allChecks = document.querySelectorAll('.toggle-fuente-item');
    const fuentesTotales = [...new Set(allData.map(d => d.fuente))].filter(f => f);

    if (fuente === 'ALL') {
        if (checkbox.checked) {
            allChecks.forEach(c => c.checked = true);
            selectedFuentes = [...fuentesTotales];
        } else {
            allChecks.forEach(c => c.checked = false);
            selectedFuentes = [];
        }
    } else {
        if (checkbox.checked) {
            if (!selectedFuentes.includes(fuente)) selectedFuentes.push(fuente);
        } else {
            selectedFuentes = selectedFuentes.filter(f => f !== fuente);
        }
        checkAll.checked = (selectedFuentes.length === fuentesTotales.length && fuentesTotales.length > 0);
    }

    actualizarBadgeFuentes(fuentesTotales.length);
    resetDropdownsCascade();
    updateTemas(false);

    const qInput = document.getElementById('quickSearchInput');
    if (qInput && qInput.value.trim().length > 0) {
        ejecutarBusquedaRapidaInline(qInput.value);
    }
}

// =======================================================
// BÚSQUEDA RÁPIDA INTEGRADA EN PANTALLA PRINCIPAL
// =======================================================
function aplicarChipRapido(termino) {
    const qInput = document.getElementById('quickSearchInput');
    if (!qInput) return;
    qInput.value = termino;
    document.getElementById('btnClearQuickSearch').classList.remove('oculto');
    document.getElementById('quickSuggestionsList').classList.add('oculto');
    ejecutarBusquedaRapidaInline(termino);
}

function limpiarBusquedaRapida() {
    const qInput = document.getElementById('quickSearchInput');
    if (qInput) {
        qInput.value = '';
        qInput.focus();
    }
    document.getElementById('btnClearQuickSearch').classList.add('oculto');
    document.getElementById('quickSuggestionsList').classList.add('oculto');
    document.getElementById('quickResultsBox').classList.add('oculto');
    document.getElementById('quickResultsCount').classList.add('oculto');
    document.getElementById('quickResultsList').innerHTML = '';
}

function mostrarSugerenciasRapidas(lastWord, allWords) {
    const suggestionsList = document.getElementById('quickSuggestionsList');
    const qInput = document.getElementById('quickSearchInput');

    const lastWordNorm = normalizarTexto(lastWord);
    const lastWordFonetica = normalizarFoneticaYPlural(lastWordNorm);
    const matches = new Set();

    const checkMatch = (palabra) => {
        const pNorm = normalizarTexto(palabra);
        const pFon = normalizarFoneticaYPlural(pNorm);
        if (pNorm.includes(lastWordNorm) || pFon.includes(lastWordFonetica)) return true;
        const prefijo = pNorm.substring(0, lastWordNorm.length);
        const maxErrores = Math.floor(lastWordNorm.length / 3) + 1;
        return distanciaLevenshtein(lastWordNorm, prefijo) <= maxErrores;
    };

    diccionarioSugerencias.forEach(p => {
        if (checkMatch(p)) {
            matches.add(p);
            obtenerSinonimos(p).forEach(s => matches.add(s));
        }
    });

    gruposSinonimos.forEach(grupo => {
        grupo.forEach(sin => {
            if (checkMatch(sin)) {
                matches.add(sin);
                grupo.forEach(s => matches.add(s));
            }
        });
    });

    let arr = Array.from(matches).sort((a, b) => {
        const aNorm = normalizarTexto(a);
        const bNorm = normalizarTexto(b);
        const aStarts = aNorm.startsWith(lastWordNorm) ? -1 : 1;
        const bStarts = bNorm.startsWith(lastWordNorm) ? -1 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.length - b.length;
    }).slice(0, 5);

    if (arr.length === 0) {
        suggestionsList.classList.add('oculto');
        return;
    }

    suggestionsList.innerHTML = '';
    arr.forEach((match, idx) => {
        const li = document.createElement('li');
        li.textContent = match;
        li.style.padding = '10px 14px';
        li.style.cursor = 'pointer';
        li.style.color = 'var(--ngc-text-main)';
        li.style.fontSize = '0.88rem';
        if (idx < arr.length - 1) li.style.borderBottom = '1px solid var(--ngc-privacy-border)';

        li.addEventListener('click', () => {
            allWords[allWords.length - 1] = match;
            const nuevoTexto = allWords.join(' ') + ' ';
            qInput.value = nuevoTexto;
            suggestionsList.classList.add('oculto');
            ejecutarBusquedaRapidaInline(nuevoTexto);
            qInput.focus();
        });
        suggestionsList.appendChild(li);
    });
    suggestionsList.classList.remove('oculto');
}

function ejecutarBusquedaRapidaInline(rawQuery) {
    const resultsBox = document.getElementById('quickResultsBox');
    const resultsList = document.getElementById('quickResultsList');
    const countBadge = document.getElementById('quickResultsCount');

    const queryLimpia = rawQuery.trim();
    if (!queryLimpia) {
        resultsBox.classList.add('oculto');
        countBadge.classList.add('oculto');
        return;
    }

    if (selectedFuentes.length === 0) {
        resultsList.innerHTML = `<div class="pres-select-empty">Activá al menos una fuente en "Explorar por Rubro y Fuente".</div>`;
        resultsBox.classList.remove('oculto');
        countBadge.classList.add('oculto');
        return;
    }

    const palabrasBusqueda = obtenerPalabrasClave(queryLimpia).filter(p => !palabrasVacias.has(p)).slice(0, 5);
    const busquedaCompleta = normalizarTexto(queryLimpia);
    const busquedaCompletaNorm = normalizarFoneticaYPlural(busquedaCompleta);

    const coincidencias = [];
    const universo = allData.filter(d => selectedFuentes.includes(d.fuente));

    for (const item of universo) {
        let score = 0;
        const conceptoNorm = normalizarTexto(item.concepto);
        const conceptoFonetico = normalizarFoneticaYPlural(conceptoNorm);
        const temaNorm = normalizarTexto(item.tema);
        const codigoNorm = normalizarTexto(item.codigo);
        const palabrasConcepto = obtenerPalabrasClave(`${item.concepto} ${item.tema}`);

        if (codigoNorm === busquedaCompleta) score += 140;
        if (conceptoNorm.includes(busquedaCompleta)) {
            score += 100;
            if (conceptoNorm === busquedaCompleta) score += 50;
        } else if (conceptoFonetico.includes(busquedaCompletaNorm)) {
            score += 80;
        } else if (temaNorm.includes(busquedaCompleta)) {
            score += 45;
        }

        if (palabrasBusqueda.length === 0) {
            if (score > 0) coincidencias.push({ item, score });
            continue;
        }

        let cumpleTodas = true;
        for (const pBuscada of palabrasBusqueda) {
            const opciones = obtenerSinonimos(pBuscada);
            let mejorPuntaje = 0;
            let encontrada = false;

            for (const op of opciones) {
                const opFon = normalizarFoneticaYPlural(op);
                for (const pConc of palabrasConcepto) {
                    const concFon = normalizarFoneticaYPlural(pConc);
                    if (op === pConc) {
                        encontrada = true;
                        mejorPuntaje = Math.max(mejorPuntaje, op === pBuscada ? 10 : 7);
                    } else if (opFon === concFon) {
                        encontrada = true;
                        mejorPuntaje = Math.max(mejorPuntaje, op === pBuscada ? 9 : 6);
                    } else if (sonSimilares(op, pConc)) {
                        encontrada = true;
                        mejorPuntaje = Math.max(mejorPuntaje, 4);
                    } else if (sonSimilares(opFon, concFon)) {
                        encontrada = true;
                        mejorPuntaje = Math.max(mejorPuntaje, 3);
                    }
                }
            }
            if (!encontrada) {
                cumpleTodas = false;
                break;
            }
            score += mejorPuntaje;
        }

        if (cumpleTodas) coincidencias.push({ item, score });
    }

    coincidencias.sort((a, b) => b.score - a.score);
    const topResultados = coincidencias.slice(0, 8).map(c => c.item);

    countBadge.innerText = `${coincidencias.length} ${coincidencias.length === 1 ? 'resultado' : 'resultados'}`;
    countBadge.classList.remove('oculto');
    resultsList.innerHTML = '';

    if (topResultados.length === 0) {
        resultsList.innerHTML = `<div class="pres-select-empty">Sin coincidencias para "${queryLimpia}". Probá con términos más generales.</div>`;
        resultsBox.classList.remove('oculto');
        return;
    }

    topResultados.forEach(item => {
        const card = document.createElement('div');
        card.className = 'costos-quick-match';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                        <span style="font-size: 0.68rem; background: var(--ngc-neon); color: #fff; padding: 1px 6px; border-radius: 4px; font-weight: 700;">${item.codigo}</span>
                        <span style="font-size: 0.7rem; color: var(--ngc-text-faded); font-weight: 600;">${item.fuente} • ${item.tema}</span>
                    </div>
                    <div style="font-size: 0.86rem; font-weight: 700; color: var(--ngc-text-main); line-height: 1.35;">${item.concepto}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                    <span style="font-size: 1rem; font-weight: 800; color: var(--success-green); display: block;">${formatearMoneda(item.precio)}</span>
                    <span style="font-size: 0.65rem; color: var(--ngc-neon); font-weight: 700;">Cotizar <i class="fa-solid fa-chevron-right"></i></span>
                </div>
            </div>
        `;
        card.onclick = () => {
            seleccionarItemCompleto(item, true);
        };
        resultsList.appendChild(card);
    });

    resultsBox.classList.remove('oculto');
      }

// =======================================================
// DESPLEGABLES EN CASCADA CON BUSCADOR INTERNO
// =======================================================
function updateTemas(preservarSeleccion = false) {
    const filteredByFuente = allData.filter(d => selectedFuentes.includes(d.fuente));
    const temas = [...new Set(filteredByFuente.map(d => d.tema))].filter(t => t).sort();

    const optionsTema = document.getElementById('optionsTema');
    const searchTema = document.getElementById('searchTema');
    if (searchTema) searchTema.value = '';
    optionsTema.innerHTML = '';

    const prevTema = preservarSeleccion ? selTema.value : '';
    if (!preservarSeleccion || !temas.includes(prevTema)) {
        selTema.value = '';
    }

    if (temas.length > 0) {
        detTema.removeAttribute('disabled');
        sumTema.innerText = selTema.value || '-- Seleccionar Categoría --';

        temas.forEach(t => {
            const opt = document.createElement('div');
            opt.className = 'corp-select-option';
            opt.dataset.search = normalizarTexto(t);
            opt.innerText = t;
            opt.onclick = () => {
                selTema.value = t;
                sumTema.innerText = t;
                detTema.removeAttribute('open');
                updateSubtema();
            };
            optionsTema.appendChild(opt);
        });
    } else {
        detTema.setAttribute('disabled', 'true');
        sumTema.innerText = 'Activá al menos una fuente';
    }
}

function updateSubtema() {
    const temaSelected = selTema.value;
    const optionsConcepto = document.getElementById('optionsConcepto');
    const searchConcepto = document.getElementById('searchConcepto');

    if (searchConcepto) searchConcepto.value = '';
    optionsConcepto.innerHTML = '';
    selConcepto.value = '';
    resCard.classList.add('oculto');

    if (!temaSelected) {
        detConcepto.setAttribute('disabled', 'true');
        sumConcepto.innerText = 'Seleccione categoría primero...';
        return;
    }

    detConcepto.removeAttribute('disabled');
    sumConcepto.innerText = '-- Seleccionar Concepto --';

    const subtemas = allData.filter(d => selectedFuentes.includes(d.fuente) && d.tema === temaSelected && d.concepto);

    subtemas.forEach(item => {
        const opt = document.createElement('div');
        opt.className = 'corp-select-option';
        opt.dataset.search = normalizarTexto(`${item.concepto} ${item.fuente} ${item.codigo}`);
        opt.innerHTML = `
            <div style="line-height: 1.35;">${item.concepto}</div>
            <div class="costos-option-meta">
                <span>${item.fuente} • ${item.codigo}</span>
                <strong style="color: var(--success-green);">${formatearMoneda(item.precio)}</strong>
            </div>
        `;
        opt.onclick = () => {
            selConcepto.value = item.concepto;
            sumConcepto.innerText = item.concepto;
            detConcepto.removeAttribute('open');
            seleccionarItemCompleto(item, false);
        };
        optionsConcepto.appendChild(opt);
    });
}

// =======================================================
// VISUALIZACIÓN DE RESULTADO, CANTIDAD Y COMPARATIVA
// =======================================================
function seleccionarItemCompleto(item, sincronizarDropdowns = false) {
    if (!item) return;

    if (sincronizarDropdowns) {
        selTema.value = item.tema;
        sumTema.innerText = item.tema;
        updateSubtema();
        selConcepto.value = item.concepto;
        sumConcepto.innerText = item.concepto;
    }

    itemActual = item;
    cantidadActual = 1;
    document.getElementById('res-cantidad').value = 1;

    document.getElementById('res-codigo').innerText = item.codigo || 'S/C';
    document.getElementById('res-concepto-full').innerText = item.concepto;
    document.getElementById('res-tema').innerText = item.tema;
    document.getElementById('res-org').innerText = item.fuente || item.org || 'General';
    document.getElementById('res-notes-content').innerText = item.notas || 'Sin notas aclaratorias adicionales para este concepto.';

    actualizarMontosCotizacion();
    renderComparativaFuentes(item);
    guardarEnRecientes(item);

    // Mostrar tarjeta con animación limpia
    resCard.style.opacity = '0';
    resCard.style.transform = 'translateY(8px)';
    resCard.classList.remove('oculto');

    requestAnimationFrame(() => {
        resCard.style.opacity = '1';
        resCard.style.transform = 'translateY(0)';
    });

    // Cerrar acordeón de filtros para dar prioridad visual al resultado
    const acordeon = document.getElementById('acordeonFiltros');
    if (acordeon && acordeon.open) {
        acordeon.removeAttribute('open');
    }

    setTimeout(() => {
        resCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function cambiarCantidadCotizacion(delta) {
    setCantidadCotizacion(cantidadActual + delta);
}

function setCantidadCotizacion(nuevaCantidad) {
    cantidadActual = Math.max(1, parseInt(nuevaCantidad, 10) || 1);
    document.getElementById('res-cantidad').value = cantidadActual;
    actualizarMontosCotizacion();
}

function actualizarMontosCotizacion() {
    if (!itemActual) return;
    const unitarioNum = parsePrecioNumero(itemActual.precio);
    const badgeCant = document.getElementById('res-cant-badge');
    const elUnit = document.getElementById('res-precio-unit');
    const elTotal = document.getElementById('res-precio-total');

    if (badgeCant) badgeCant.innerText = `x${cantidadActual}`;

    if (unitarioNum === 0 && typeof itemActual.precio === 'string' && itemActual.precio.trim() !== '') {
        elUnit.innerText = formatearMoneda(itemActual.precio);
        elTotal.innerText = formatearMoneda(itemActual.precio);
        return;
    }

    const total = unitarioNum * cantidadActual;
    elUnit.innerText = `$ ${unitarioNum.toLocaleString('es-AR')}`;
    elTotal.innerText = `$ ${total.toLocaleString('es-AR')}`;
}

function renderComparativaFuentes(item) {
    const wrapper = document.getElementById('res-compare-wrapper');
    const box = document.getElementById('res-compare-box');
    if (!wrapper || !box) return;

    const normConcepto = normalizarTexto(item.concepto);
    const equivalentes = allData.filter(d =>
        d.fuente !== item.fuente &&
        normalizarTexto(d.concepto) === normConcepto
    );

    if (equivalentes.length === 0) {
        wrapper.classList.add('oculto');
        box.innerHTML = '';
        return;
    }

    box.innerHTML = '';
    equivalentes.forEach(eq => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'costos-compare-pill';
        btn.innerHTML = `
            <span><i class="fa-solid fa-scale-balanced corp-accent-color"></i> ${eq.fuente}</span>
            <strong style="color: var(--success-green);">${formatearMoneda(eq.precio)}</strong>
        `;
        btn.onclick = () => {
            // Si la fuente estaba apagada, encenderla automáticamente para mantener coherencia
            if (!selectedFuentes.includes(eq.fuente)) {
                selectedFuentes.push(eq.fuente);
                const fuentesTotales = [...new Set(allData.map(d => d.fuente))].filter(f => f);
                renderizarFuentes(fuentesTotales, selectedFuentes);
            }
            seleccionarItemCompleto(eq, true);
        };
        box.appendChild(btn);
    });

    wrapper.classList.remove('oculto');
}

// =======================================================
// HISTORIAL DE CONSULTADOS RECIENTEMENTE
// =======================================================
function guardarEnRecientes(item) {
    try {
        const raw = localStorage.getItem(CACHE_KEY_RECENTS);
        let lista = raw ? JSON.parse(raw) : [];
        lista = lista.filter(x => !(x.concepto === item.concepto && x.fuente === item.fuente));
        lista.unshift({
            tema: item.tema,
            concepto: item.concepto,
            precio: item.precio,
            notas: item.notas,
            codigo: item.codigo,
            fuente: item.fuente,
            org: item.org
        });
        lista = lista.slice(0, 6);
        localStorage.setItem(CACHE_KEY_RECENTS, JSON.stringify(lista));
        renderRecientes();
    } catch (e) {
        console.warn("No se pudo guardar en recientes", e);
    }
}

function renderRecientes() {
    const section = document.getElementById('recentsSection');
    const list = document.getElementById('recentsList');
    if (!section || !list) return;

    let lista = [];
    try {
        lista = JSON.parse(localStorage.getItem(CACHE_KEY_RECENTS) || '[]');
    } catch (e) {
        lista = [];
    }

    if (!Array.isArray(lista) || lista.length === 0) {
        section.classList.add('oculto');
        return;
    }

    list.innerHTML = '';
    lista.forEach(rec => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'cat-recent-pill';
        const corto = rec.concepto.length > 28 ? rec.concepto.substring(0, 28) + '...' : rec.concepto;
        pill.innerHTML = `
            <i class="fa-solid fa-bolt corp-accent-color"></i>
            <span>${corto}</span>
            <strong style="color: var(--success-green);">${formatearMoneda(rec.precio)}</strong>
        `;
        pill.onclick = () => {
            const actual = allData.find(d => d.concepto === rec.concepto && d.fuente === rec.fuente) || rec;
            seleccionarItemCompleto(actual, true);
        };
        list.appendChild(pill);
    });

    section.classList.remove('oculto');
}

function limpiarRecientes() {
    localStorage.removeItem(CACHE_KEY_RECENTS);
    renderRecientes();
      }

// =======================================================
// ACCIONES RÁPIDAS: COPIAR, WHATSAPP Y RESET
// =======================================================
function construirTextoCotizacion() {
    if (!itemActual) return '';
    const unitarioNum = parsePrecioNumero(itemActual.precio);
    const unitStr = unitarioNum > 0 ? `$ ${unitarioNum.toLocaleString('es-AR')}` : formatearMoneda(itemActual.precio);
    const totalStr = unitarioNum > 0 ? `$ ${(unitarioNum * cantidadActual).toLocaleString('es-AR')}` : unitStr;

    let texto = `*COTIZACIÓN REFERENCIAL DE MANO DE OBRA*\n`;
    texto += `• *Trabajo:* ${itemActual.concepto}\n`;
    texto += `• *Rubro:* ${itemActual.tema} (${itemActual.codigo})\n`;
    if (cantidadActual > 1) {
        texto += `• *Cantidad:* ${cantidadActual} unid.\n`;
        texto += `• *Valor Unitario:* ${unitStr}\n`;
        texto += `• *Total Estimado:* ${totalStr}\n`;
    } else {
        texto += `• *Monto Sugerido:* ${totalStr}\n`;
    }
    texto += `• *Referencia:* ${itemActual.fuente}\n`;
    if (itemActual.notas) {
        texto += `• *Condiciones:* ${itemActual.notas}\n`;
    }
    texto += `_Valores referenciales sujetos a relevamiento en obra._`;
    return texto;
}

function copiarCotizacionActual() {
    if (!itemActual) return;
    const texto = construirTextoCotizacion();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto)
            .then(() => mostrarToast("Cotización Copiada", "Lista para pegar en WhatsApp o mensajes."))
            .catch(() => copiarFallback(texto));
    } else {
        copiarFallback(texto);
    }
}

function copiarFallback(texto) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    mostrarToast("Cotización Copiada", "Lista para pegar en tus mensajes.");
}

function compartirCotizacionWhatsApp() {
    if (!itemActual) return;
    const texto = construirTextoCotizacion();
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function resetDropdownsCascade() {
    selTema.value = '';
    sumTema.innerText = '-- Seleccionar Categoría --';
    detTema.removeAttribute('open');

    selConcepto.value = '';
    sumConcepto.innerText = 'Seleccione categoría primero...';
    detConcepto.setAttribute('disabled', 'true');
    detConcepto.removeAttribute('open');

    itemActual = null;
    cantidadActual = 1;
    resCard.classList.add('oculto');
}

function resetForm() {
    const checkAll = document.getElementById('toggle-fuente-all');
    if (checkAll) checkAll.checked = true;

    const allChecks = document.querySelectorAll('.toggle-fuente-item');
    allChecks.forEach(c => c.checked = true);

    const fuentesTotales = [...new Set(allData.map(d => d.fuente))].filter(f => f);
    selectedFuentes = [...fuentesTotales];
    actualizarBadgeFuentes(fuentesTotales.length);

    limpiarBusquedaRapida();
    resetDropdownsCascade();
    updateTemas(false);

    const acordeon = document.getElementById('acordeonFiltros');
    if (acordeon) acordeon.setAttribute('open', 'true');

    mostrarToast("Consulta Reiniciada", "Filtros y fuentes restablecidos.");
}

function mostrarToast(titulo, mensaje, esAdvertencia = false) {
    const toast = document.getElementById('corpToast');
    if (!toast) return;
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMsg').innerText = mensaje;

    const icon = toast.querySelector('.toast-icon');
    if (esAdvertencia) {
        toast.style.borderColor = 'var(--ngc-warning)';
        icon.style.color = 'var(--ngc-warning)';
        icon.className = 'fa-solid fa-triangle-exclamation toast-icon';
    } else {
        toast.style.borderColor = 'var(--success-green)';
        icon.style.color = 'var(--success-green)';
        icon.className = 'fa-solid fa-circle-check toast-icon';
    }

    toast.classList.add('mostrar');
    setTimeout(() => toast.classList.remove('mostrar'), 2800);
}

// =======================================================
// EVENTOS DE INTERFAZ Y ACORDEONES INTELIGENTES
// =======================================================
function inicializarEventosUI() {
    const qInput = document.getElementById('quickSearchInput');
    const suggestionsList = document.getElementById('quickSuggestionsList');

    if (qInput) {
        qInput.addEventListener('input', () => {
            const val = qInput.value;
            const btnClear = document.getElementById('btnClearQuickSearch');
            if (val.trim().length > 0) {
                btnClear.classList.remove('oculto');
                ejecutarBusquedaRapidaInline(val);
            } else {
                btnClear.classList.add('oculto');
                document.getElementById('quickResultsBox').classList.add('oculto');
                document.getElementById('quickResultsCount').classList.add('oculto');
            }

            const words = val.split(/\s+/);
            const lastWord = words[words.length - 1];
            if (lastWord && lastWord.length >= 3) {
                mostrarSugerenciasRapidas(lastWord, words);
            } else {
                suggestionsList.classList.add('oculto');
            }
        });

        qInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                suggestionsList.classList.add('oculto');
                ejecutarBusquedaRapidaInline(qInput.value);
            }
        });
    }

    // Buscadores internos dentro de los acordeones
    const searchTema = document.getElementById('searchTema');
    if (searchTema) {
        searchTema.addEventListener('click', e => e.stopPropagation());
        searchTema.addEventListener('input', () => {
            const q = normalizarTexto(searchTema.value);
            document.querySelectorAll('#optionsTema .corp-select-option').forEach(opt => {
                opt.style.display = opt.dataset.search.includes(q) ? 'block' : 'none';
            });
        });
    }

    const searchConcepto = document.getElementById('searchConcepto');
    if (searchConcepto) {
        searchConcepto.addEventListener('click', e => e.stopPropagation());
        searchConcepto.addEventListener('input', () => {
            const q = normalizarTexto(searchConcepto.value);
            document.querySelectorAll('#optionsConcepto .corp-select-option').forEach(opt => {
                opt.style.display = opt.dataset.search.includes(q) ? 'block' : 'none';
            });
        });
    }

    // Bloquear apertura cuando <details> tiene [disabled] y cerrar el otro acordeón al abrir uno
    document.querySelectorAll('details.corp-custom-select').forEach(det => {
        const summary = det.querySelector('summary');
        if (summary) {
            summary.addEventListener('click', (e) => {
                if (det.hasAttribute('disabled')) {
                    e.preventDefault();
                }
            });
        }

        det.addEventListener('toggle', () => {
            if (det.open) {
                document.querySelectorAll('details.corp-custom-select').forEach(other => {
                    if (other !== det) other.removeAttribute('open');
                });
                const innerInput = det.querySelector('.pres-select-search');
                if (innerInput) setTimeout(() => innerInput.focus(), 50);
            }
        });
    });

    // Cerrar desplegables y sugerencias al tocar afuera
    document.addEventListener('click', (event) => {
        document.querySelectorAll('details.corp-custom-select').forEach(det => {
            if (det.open && !det.contains(event.target)) {
                det.removeAttribute('open');
            }
        });

        if (qInput && suggestionsList && event.target !== qInput && !suggestionsList.contains(event.target)) {
            suggestionsList.classList.add('oculto');
        }
    });
}

// =======================================================
// MENÚ INFERIOR SCROLL (MATCH GLOBAL)
// =======================================================
function inicializarMenuInferior() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;

    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-compass-drafting', url: '../croquis/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '#', active: true },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
    ];

    modulos.forEach(mod => {
        const btn = document.createElement('button');
        btn.type = 'button';
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

