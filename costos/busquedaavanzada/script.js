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

// =========================================================
// CONEXIÓN GOOGLE SHEETS + CACHÉ COMPARTIDA CON MÓDULO COSTOS
// =========================================================
const SHEET_ID = '1tZbCYSBxx3suGLKmE_bXi_hEm0iH0yqQedqR7kdShEU';
const URL_SHEET = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1`;
const CACHE_KEY_DB = 'villaser_costos_db_v1';

let allData = [];
let fuenteFiltroActiva = 'ALL';
let diccionarioSugerencias = [];
let seleccionPendiente = false;

// ==========================================
// 1. PALABRAS VACÍAS Y SINÓNIMOS (NORMALIZADOS)
// ==========================================
const palabrasVacias = new Set([
    "electrico", "electrica", "el", "la", "los", "las", "un", "una", "unos", "unas",
    "a", "ante", "bajo", "cabe", "con", "contra", "de", "desde", "durante", "en", "entre",
    "hacia", "hasta", "mediante", "para", "por", "x", "segun", "sin", "so", "sobre", "tras",
    "y", "e", "ni", "o", "u", "pero", "mas", "sino", "aunque", "porque", "pues", "como", "si", "que"
]);

const gruposSinonimos = [
    ["termomagnetica", "termica", "fusible", "breaker", "pia"],
    ["interruptor", "llave", "perilla", "apagador", "punto"],
    ["timbre", "campanilla", "zumbador", "bocina", "pitido", "soneria", "portero", "llamador"],
    ["diferencial", "disyuntor", "salvavita", "salva", "id"],
    ["tomacorriente", "toma", "enchufe", "modulo", "enchufes", "tug", "tue"],
    ["conductor", "cable", "alambre", "linea", "recableado", "cableado"],
    ["jabalina", "electrodo", "tierra", "pat", "puestaatierra"],
    ["luminaria", "lampara", "foco", "artefacto", "luz", "lus", "luces", "lamparita", "aplique", "reflector", "iug"],
    ["instalacion", "instalar", "colocar", "instala", "montaje", "colocacion", "implementacion", "conexion", "cambio", "armado"],
    ["pilar", "acometida", "monofasico", "trifasico", "medidor"],
    ["fexible", "flexible", "corrugado", "manguera"],
    ["cano", "caneria", "tubo"],
    ["motor", "motores", "bomba", "centrifuga"],
    ["nuevo", "nueva"],
    ["exterior", "externo", "interperie", "intemperie", "afuera"],
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

document.addEventListener("DOMContentLoaded", () => {
    inicializarMenuInferior();
    inicializarEventosBuscador();
    iniciarCargaOfflineFirst();
});

function inicializarEventosBuscador() {
    const searchInput = document.getElementById("searchInput");
    const btnBuscar = document.getElementById("btnBuscar");
    const suggestionsList = document.getElementById("suggestionsList");

    document.addEventListener("click", (e) => {
        if (searchInput && suggestionsList && e.target !== searchInput && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.add("oculto");
        }
    });

    if (searchInput && btnBuscar) {
        searchInput.addEventListener("focus", function() {
            if (seleccionPendiente) { this.select(); seleccionPendiente = false; }
        });

        searchInput.addEventListener("click", function() {
            if (seleccionPendiente) { this.select(); seleccionPendiente = false; }
        });

        searchInput.addEventListener("input", () => {
            seleccionPendiente = false;
            btnBuscar.disabled = searchInput.value.trim().length === 0;
            const text = searchInput.value;
            const words = text.split(/\s+/);
            const lastWord = words[words.length - 1];

            if (lastWord.length >= 3) mostrarSugerencias(lastWord, words);
            else suggestionsList.classList.add("oculto");
        });

        btnBuscar.addEventListener("click", () => {
            const textoOriginal = btnBuscar.innerHTML;
            btnBuscar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Buscando...';
            suggestionsList.classList.add("oculto");
            seleccionPendiente = true;

            setTimeout(() => {
                ejecutarBusqueda();
                btnBuscar.innerHTML = textoOriginal;
            }, 120);
        });

        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !btnBuscar.disabled) btnBuscar.click();
        });
    }
}

function verificarParametroURL() {
    const parametrosURL = new URLSearchParams(window.location.search);
    const servicioSolicitado = parametrosURL.get('servicio');
    if (!servicioSolicitado) return;

    const searchInput = document.getElementById("searchInput");
    const btnBuscar = document.getElementById("btnBuscar");
    const suggestionsList = document.getElementById("suggestionsList");

    if (searchInput && btnBuscar) {
        searchInput.value = servicioSolicitado.replace(/_/g, ' ');
        btnBuscar.disabled = false;
        if (suggestionsList) suggestionsList.classList.add("oculto");
        ejecutarBusqueda();
    }
}

// ==========================================
// 2. CARGA OFFLINE-FIRST + GOOGLE SHEETS
// ==========================================
function iniciarCargaOfflineFirst() {
    let tieneCache = false;
    try {
        const raw = localStorage.getItem(CACHE_KEY_DB);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
                allData = parsed.items.map(i => ({
                    ...i,
                    observaciones: i.observaciones || i.notas || "",
                    organizacion: i.organizacion || i.fuente || "General"
                }));
                tieneCache = true;
                activarInterfazBuscador();
                verificarParametroURL();
            }
        }
    } catch (e) {
        console.warn("Error leyendo caché local", e);
    }

    cargarDatosGoogleSheet(!tieneCache);
}

async function cargarDatosGoogleSheet(esPrimeraCargaSinCache = false) {
    const loadingCard = document.getElementById("loading");

    try {
        const response = await fetch(URL_SHEET, { cache: 'no-store' });
        if (!response.ok) throw new Error("No se pudo conectar con Google Sheets");

        const txt = await response.text();
        const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
        const rows = json.table?.rows || [];

        const nuevos = [];
        rows.forEach((r, idx) => {
            if (!r.c) return;
            const tema = String(r.c[0]?.v ?? "").trim();
            const concepto = String(r.c[1]?.v ?? "").trim();
            const precio = r.c[2]?.v;
            const notas = String(r.c[3]?.v ?? "").trim();
            const codigo = String(r.c[5]?.v ?? "").trim();
            const fuente = String(r.c[9]?.v ?? "").trim();

            if (!concepto) return;
            if (concepto.toLowerCase() === "concepto" || concepto.toLowerCase() === "trabajo") return;

            nuevos.push({
                id: `${idx}_${codigo || 'SC'}`,
                tema: tema || "General",
                concepto: concepto,
                precio: precio !== null && precio !== undefined ? precio : 0,
                notas: notas,
                observaciones: notas,
                codigo: codigo || "S/C",
                fuente: fuente || "General",
                org: fuente || "General",
                organizacion: fuente || "General"
            });
        });

        if (nuevos.length > 0) {
            allData = nuevos;
            const ahora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            localStorage.setItem(CACHE_KEY_DB, JSON.stringify({ updatedAt: ahora, items: allData }));
            activarInterfazBuscador();
            if (esPrimeraCargaSinCache) verificarParametroURL();
        }
    } catch (error) {
        console.error(error);
        if (esPrimeraCargaSinCache && loadingCard) {
            loadingCard.innerHTML = `
                <div class="corp-card" style="text-align: center; padding: 30px 20px; max-width: 320px;">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--error-red); font-size: 2.6rem; margin-bottom: 12px;"></i>
                    <h3 style="color: var(--ngc-text-main); font-size: 1rem; margin-bottom: 6px;">Error de conexión</h3>
                    <p style="font-size: 0.82rem; color: var(--ngc-text-faded); margin-bottom: 16px;">Verificá tu conexión a internet e intentá nuevamente.</p>
                    <button type="button" class="corp-btn primary-action" onclick="location.reload()">Reintentar</button>
                </div>
            `;
        }
    }
}

function activarInterfazBuscador() {
    const loadingCard = document.getElementById("loading");
    const appContainer = document.getElementById("app");
    const searchInput = document.getElementById("searchInput");

    construirDiccionarioSugerencias();
    renderizarChipsFuentes();

    if (loadingCard) loadingCard.classList.add("oculto");
    if (appContainer) appContainer.classList.remove("oculto");
    if (searchInput) {
        searchInput.disabled = false;
        if (!searchInput.value) searchInput.focus();
    }
}

function renderizarChipsFuentes() {
    const bar = document.getElementById('fuentesChipsBar');
    if (!bar) return;

    const fuentes = [...new Set(allData.map(d => d.organizacion))].filter(f => f).sort();
    bar.innerHTML = '';

    const crearChip = (label, val) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ap-chip ${fuenteFiltroActiva === val ? 'active' : ''}`;
        btn.innerText = label;
        btn.onclick = () => {
            fuenteFiltroActiva = val;
            renderizarChipsFuentes();
            const q = document.getElementById('searchInput').value.trim();
            if (q) ejecutarBusqueda();
        };
        return btn;
    };

    bar.appendChild(crearChip('Todas', 'ALL'));
    fuentes.forEach(f => bar.appendChild(crearChip(f, f)));
}

// ==========================================
// 3. FUNCIONES DEL MOTOR DE BÚSQUEDA
// ==========================================
function mostrarSugerencias(lastWord, allWords) {
    const suggestionsList = document.getElementById('suggestionsList');
    const searchInput = document.getElementById("searchInput");

    const lastWordNorm = normalizarTexto(lastWord);
    const lastWordFonetica = normalizarFoneticaYPlural(lastWordNorm);
    const matches = new Set();

    const checkMatchSugerencia = (palabraCorrecta) => {
        const pNorm = normalizarTexto(palabraCorrecta);
        const pFon = normalizarFoneticaYPlural(pNorm);

        if (pNorm.includes(lastWordNorm) || pFon.includes(lastWordFonetica)) return true;

        const prefijo = pNorm.substring(0, lastWordNorm.length);
        const maxErrores = Math.floor(lastWordNorm.length / 3) + 1;
        return distanciaLevenshtein(lastWordNorm, prefijo) <= maxErrores;
    };

    diccionarioSugerencias.forEach(palabra => {
        if (checkMatchSugerencia(palabra)) {
            matches.add(palabra);
            obtenerSinonimos(palabra).forEach(s => matches.add(s));
        }
    });

    gruposSinonimos.forEach(grupo => {
        grupo.forEach(sinonimo => {
            if (checkMatchSugerencia(sinonimo)) {
                matches.add(sinonimo);
                grupo.forEach(s => matches.add(s));
            }
        });
    });

    let matchesArray = Array.from(matches).sort((a, b) => {
        const aNorm = normalizarTexto(a);
        const bNorm = normalizarTexto(b);
        const aStarts = aNorm.startsWith(lastWordNorm) ? -1 : 1;
        const bStarts = bNorm.startsWith(lastWordNorm) ? -1 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        if (a.length !== b.length) return a.length - b.length;
        return a.localeCompare(b);
    }).slice(0, 6);

    if (matchesArray.length === 0) {
        suggestionsList.classList.add("oculto");
        return;
    }

    suggestionsList.innerHTML = '';
    matchesArray.forEach((match, idx) => {
        const li = document.createElement('li');
        li.textContent = match;
        li.style.padding = '11px 14px';
        li.style.cursor = 'pointer';
        li.style.color = 'var(--ngc-text-main)';
        li.style.fontSize = '0.9rem';
        if (idx < matchesArray.length - 1) {
            li.style.borderBottom = '1px solid var(--ngc-privacy-border)';
        }

        li.addEventListener('click', () => {
            allWords[allWords.length - 1] = match;
            searchInput.value = allWords.join(' ') + ' ';
            suggestionsList.classList.add("oculto");
            document.getElementById("btnBuscar").disabled = false;
            searchInput.focus();
            const len = searchInput.value.length;
            searchInput.setSelectionRange(len, len);
        });
        suggestionsList.appendChild(li);
    });
    suggestionsList.classList.remove('oculto');
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
    const txt = normalizarTexto(texto).replace(/[^a-z0-9\s]/g, " ");
    const palabras = txt.split(/\s+/).filter(p => p.length > 0);
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
        if (grupo.includes(palabra)) opciones = [...new Set([...opciones, ...grupo])];
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

function ejecutarBusqueda() {
    const rawQuery = document.getElementById("searchInput").value;
    const resultsContainer = document.getElementById("resultsContainer");
    const countBadge = document.getElementById("resultsCountBadge");
    resultsContainer.innerHTML = "";

    if (rawQuery.trim() === "") {
        if (countBadge) countBadge.classList.add("oculto");
        return;
    }

    const palabrasBusqueda = obtenerPalabrasClave(rawQuery).filter(p => !palabrasVacias.has(p)).slice(0, 5);
    const busquedaCompleta = normalizarTexto(rawQuery);
    const busquedaCompletaNorm = normalizarFoneticaYPlural(busquedaCompleta);

    const universo = fuenteFiltroActiva === 'ALL'
        ? allData
        : allData.filter(d => d.organizacion === fuenteFiltroActiva);

    const coincidencias = [];

    for (const item of universo) {
        let score = 0;
        const conceptoNormalizado = normalizarTexto(item.concepto);
        const conceptoNormalizadoFonetico = normalizarFoneticaYPlural(conceptoNormalizado);
        const temaNormalizado = normalizarTexto(item.tema);
        const codigoNormalizado = normalizarTexto(item.codigo);
        const palabrasDelConcepto = obtenerPalabrasClave(`${item.concepto} ${item.tema}`);

        if (codigoNormalizado === busquedaCompleta) score += 140;
        if (conceptoNormalizado.includes(busquedaCompleta)) {
            score += 100;
            if (conceptoNormalizado === busquedaCompleta) score += 50;
        } else if (conceptoNormalizadoFonetico.includes(busquedaCompletaNorm)) {
            score += 80;
            if (conceptoNormalizadoFonetico === busquedaCompletaNorm) score += 40;
        } else if (temaNormalizado.includes(busquedaCompleta)) {
            score += 40;
        }

        if (palabrasBusqueda.length === 0) {
            if (score > 0) coincidencias.push({ item, score });
            continue;
        }

        let cumpleTodas = true;
        for (const palabraBuscada of palabrasBusqueda) {
            const opcionesBuscadas = obtenerSinonimos(palabraBuscada);
            let mejorPuntajePalabra = 0;
            let palabraEncontrada = false;

            for (const opcion of opcionesBuscadas) {
                const opcionFonetica = normalizarFoneticaYPlural(opcion);
                for (const palabraConcepto of palabrasDelConcepto) {
                    const conceptoFonetico = normalizarFoneticaYPlural(palabraConcepto);

                    if (opcion === palabraConcepto) {
                        palabraEncontrada = true;
                        mejorPuntajePalabra = Math.max(mejorPuntajePalabra, opcion === palabraBuscada ? 10 : 7);
                    } else if (opcionFonetica === conceptoFonetico) {
                        palabraEncontrada = true;
                        mejorPuntajePalabra = Math.max(mejorPuntajePalabra, opcion === palabraBuscada ? 9 : 6);
                    } else if (sonSimilares(opcion, palabraConcepto)) {
                        palabraEncontrada = true;
                        mejorPuntajePalabra = Math.max(mejorPuntajePalabra, 4);
                    } else if (sonSimilares(opcionFonetica, conceptoFonetico)) {
                        palabraEncontrada = true;
                        mejorPuntajePalabra = Math.max(mejorPuntajePalabra, 3);
                    }
                }
            }
            if (!palabraEncontrada) { cumpleTodas = false; break; }
            score += mejorPuntajePalabra;
        }
        if (cumpleTodas) coincidencias.push({ item, score });
    }

    coincidencias.sort((a, b) => b.score - a.score);
    const mejoresResultados = coincidencias.slice(0, 15).map(c => c.item);

    if (countBadge) {
        countBadge.innerText = `${coincidencias.length} ${coincidencias.length === 1 ? 'resultado' : 'resultados'}`;
        countBadge.classList.remove("oculto");
    }

    if (mejoresResultados.length === 0) {
        resultsContainer.innerHTML = `
            <div class="corp-card" style="text-align: center; padding: 25px 15px;">
                <span style="color: var(--error-red); font-weight: 600;">No se encontraron precios referenciales.</span>
                <span style="font-size: 0.8rem; color: var(--ngc-text-faded); display: block; margin-top: 8px;">Intentá usar palabras más cortas o cambiá el filtro de fuente.</span>
            </div>`;
        return;
    }

    mejoresResultados.forEach((item, idx) => {
        const precioUnitario = parsePrecioNumero(item.precio);
        const precioFormat = formatearMoneda(item.precio);
        const obsTexto = item.observaciones || item.notas || "Sin notas aclaratorias adicionales para este concepto.";

        const card = document.createElement("div");
        card.className = "corp-card";
        card.style.cursor = "pointer";
        card.style.padding = "16px 14px";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 6px;">
                        <span style="font-size: 0.68rem; background: var(--ngc-neon); color: #fff; padding: 2px 7px; border-radius: 5px; font-weight: 700;">${item.codigo}</span>
                        <span style="font-size: 0.7rem; color: var(--ngc-text-faded); font-weight: 600;">${item.organizacion}</span>
                    </div>
                    <span style="display: block; font-size: 0.92rem; font-weight: 700; color: var(--ngc-text-main); line-height: 1.38;">${item.concepto}</span>
                </div>
                <div style="text-align: right; min-width: 95px; flex-shrink: 0;">
                    <span class="card-price-display" style="font-size: 1.15rem; font-weight: 800; color: var(--success-green); display: block;">${precioFormat}</span>
                    <span class="card-price-sub" style="font-size: 0.65rem; color: var(--ngc-text-faded); text-transform: uppercase; font-weight: 600;">Unit. Mano de Obra</span>
                </div>
            </div>
            
            <div class="result-obs-preview" style="font-size: 0.8rem; color: var(--ngc-neon); display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
                <span><i class="fa-solid fa-chevron-down acc-icon-indicator" style="transition: transform 0.25s; margin-right: 5px;"></i><span class="txt-ver-mas">Ver detalles y calcular</span></span>
                <span style="font-size: 0.72rem; color: var(--ngc-text-faded);">${item.tema}</span>
            </div>
            
            <div class="result-details" style="margin-top: 12px; border-top: 1px solid var(--ngc-privacy-border); padding-top: 12px; display: none;">
                <!-- Multiplicador rápido por cantidad -->
                <div class="qty-box" style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--ngc-bg-input); border: 1px solid var(--ngc-privacy-border); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px;">
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--ngc-text-faded); text-transform: uppercase;">Cantidad:</span>
                    <div class="corp-stepper pot-stepper-compact" style="width: 120px;">
                        <button type="button" class="btn-step btn-minus">-</button>
                        <input type="number" class="corp-input-step input-qty" value="1" min="1" readonly>
                        <button type="button" class="btn-step btn-plus">+</button>
                    </div>
                </div>

                <div style="margin-bottom: 12px; font-size: 0.84rem;">
                    <span style="color: var(--ngc-text-faded); font-weight: 700; font-size: 0.72rem; text-transform: uppercase;">Notas Aclaratorias / Condiciones</span>
                    <div style="background: rgba(245, 195, 59, 0.1); padding: 10px 12px; border-radius: 8px; border-left: 3px solid var(--ngc-warning); color: var(--ngc-text-main); margin-top: 5px; line-height: 1.5; white-space: pre-wrap;">${obsTexto}</div>
                </div>

                <div class="action-grid-main">
                    <button type="button" class="corp-btn primary-action btn-copy-card" style="padding: 10px 8px; font-size: 0.82rem;">
                        <i class="fa-regular fa-copy"></i> Copiar
                    </button>
                    <button type="button" class="corp-btn success-btn btn-wts-card" style="padding: 10px 8px; font-size: 0.82rem;">
                        <i class="fa-brands fa-whatsapp"></i> Enviar WTS
                    </button>
                </div>
            </div>
        `;

        const details = card.querySelector('.result-details');
        const icon = card.querySelector('.acc-icon-indicator');
        const txt = card.querySelector('.txt-ver-mas');
        const inputQty = card.querySelector('.input-qty');
        const priceDisplay = card.querySelector('.card-price-display');
        const priceSub = card.querySelector('.card-price-sub');

        const actualizarSubtotalTarjeta = (nuevaCant) => {
            const cant = Math.max(1, nuevaCant);
            inputQty.value = cant;
            if (precioUnitario > 0) {
                priceDisplay.textContent = `$ ${(precioUnitario * cant).toLocaleString('es-AR')}`;
                priceSub.textContent = cant > 1 ? `Total x${cant} ($ ${precioUnitario.toLocaleString('es-AR')} c/u)` : 'Unit. Mano de Obra';
            }
        };

        card.querySelector('.btn-minus').addEventListener('click', (e) => {
            e.stopPropagation();
            actualizarSubtotalTarjeta(parseInt(inputQty.value, 10) - 1);
        });

        card.querySelector('.btn-plus').addEventListener('click', (e) => {
            e.stopPropagation();
            actualizarSubtotalTarjeta(parseInt(inputQty.value, 10) + 1);
        });

        const armarTextoTarjeta = () => {
            const cant = parseInt(inputQty.value, 10) || 1;
            const totalStr = precioUnitario > 0 ? `$ ${(precioUnitario * cant).toLocaleString('es-AR')}` : precioFormat;
            let msg = `*COTIZACIÓN REFERENCIAL DE MANO DE OBRA*\n`;
            msg += `• *Trabajo:* ${item.concepto}\n`;
            msg += `• *Rubro:* ${item.tema} (${item.codigo})\n`;
            if (cant > 1) {
                msg += `• *Cantidad:* ${cant} unid. (${precioFormat} c/u)\n`;
                msg += `• *Total Estimado:* ${totalStr}\n`;
            } else {
                msg += `• *Monto Sugerido:* ${totalStr}\n`;
            }
            msg += `• *Referencia:* ${item.organizacion}\n`;
            if (item.observaciones) msg += `• *Condiciones:* ${item.observaciones}\n`;
            return msg;
        };

        card.querySelector('.btn-copy-card').addEventListener('click', (e) => {
            e.stopPropagation();
            const texto = armarTextoTarjeta();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(texto).then(() => mostrarToast("Copiado", "Cotización lista para pegar."));
            }
        });

        card.querySelector('.btn-wts-card').addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://wa.me/?text=${encodeURIComponent(armarTextoTarjeta())}`, '_blank');
        });

        card.addEventListener("click", (e) => {
            if (e.target.closest('.result-details')) return;
            card.classList.toggle("active");

            if (card.classList.contains("active")) {
                details.style.display = "block";
                icon.style.transform = "rotate(180deg)";
                txt.textContent = "Ocultar detalles";
            } else {
                details.style.display = "none";
                icon.style.transform = "rotate(0deg)";
                txt.textContent = "Ver detalles y calcular";
            }
        });

        resultsContainer.appendChild(card);
    });
}

function busquedaRapida(termino) {
    const searchInput = document.getElementById("searchInput");
    const btnBuscar = document.getElementById("btnBuscar");
    if (searchInput && btnBuscar) {
        searchInput.value = termino;
        btnBuscar.disabled = false;
        seleccionPendiente = true;
        btnBuscar.click();
    }
}

function limpiarBusqueda() {
    const searchInput = document.getElementById("searchInput");
    const btnBuscar = document.getElementById("btnBuscar");
    const suggestionsList = document.getElementById("suggestionsList");
    const resultsContainer = document.getElementById("resultsContainer");
    const countBadge = document.getElementById("resultsCountBadge");

    fuenteFiltroActiva = 'ALL';
    renderizarChipsFuentes();

    if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
    }
    if (btnBuscar) btnBuscar.disabled = true;
    if (suggestionsList) suggestionsList.classList.add("oculto");
    if (resultsContainer) resultsContainer.innerHTML = "";
    if (countBadge) countBadge.classList.add("oculto");
    seleccionPendiente = false;
}

function mostrarToast(titulo, mensaje) {
    const toast = document.getElementById('corpToast');
    if (!toast) return;
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMsg').innerText = mensaje;
    toast.classList.add('mostrar');
    setTimeout(() => toast.classList.remove('mostrar'), 2600);
}

// ==========================================
// MENÚ INFERIOR SCROLL (MATCH GLOBAL)
// ==========================================
function inicializarMenuInferior() {
    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;

    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Croquis', icon: 'fa-compass-drafting', url: '../croquis/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '#', active: true },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../../catalogos/index.html' }
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
