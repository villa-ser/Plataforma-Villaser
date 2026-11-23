const SHEET_ID_CASAS = '1jFvMWkTBPlqpIWJ_kjVy1vSw3gA_q9Jxvar0LajaDnM';
const URL_CASAS = `https://docs.google.com/spreadsheets/d/${SHEET_ID_CASAS}/gviz/tq?tqx=out:json&sheet=Hoja1`;

const CACHE_KEY_CASAS = 'villaser_proveedores_db_v1';
const CACHE_KEY_FAVS = 'villaser_proveedores_favs_v1';
const CACHE_KEY_RECENTS = 'villaser_proveedores_recents_v1';

let dbCasas = [];
let modoListadoCompleto = false;
let filtroActivo = 'ALL'; // 'ALL' | 'FAV' | nombre de barrio
let acordeonesExpandidos = true;
let toastTimer = null;

// ==========================================
// MOTOR DE ARRANQUE ULTRA BLINDADO
// ==========================================
function arrancarModulo() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            if (typeof firebase.auth === 'function') {
                firebase.auth().onAuthStateChanged(user => {
                    if (!user || !user.emailVerified) {
                        window.location.replace('../index.html'); 
                    }
                });
            }
        }
    } catch (e) { 
        console.warn("Aviso: Guardián de seguridad omitido.", e); 
    }
    fetchCasas(false);
}

if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', arrancarModulo); 
} else { 
    arrancarModulo(); 
}

// ==========================================
// UTILIDADES DE NORMALIZACIÓN Y PERSISTENCIA
// ==========================================
function normalizarTexto(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escapeHtml(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generarClaveProveedor(casa) {
    return normalizarTexto(`${casa.nombre}|${casa.direccion}`);
}

function obtenerFavoritos() {
    try {
        const raw = localStorage.getItem(CACHE_KEY_FAVS);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function guardarFavoritos(lista) {
    try {
        localStorage.setItem(CACHE_KEY_FAVS, JSON.stringify(lista));
    } catch (e) {}
}

function esFavorito(casa) {
    return obtenerFavoritos().includes(generarClaveProveedor(casa));
}

function toggleFavorito(idx, event) {
    if (event) event.stopPropagation();
    const casa = dbCasas[idx];
    if (!casa) return;

    const clave = generarClaveProveedor(casa);
    let favs = obtenerFavoritos();
    const existe = favs.includes(clave);

    if (existe) {
        favs = favs.filter(k => k !== clave);
        mostrarToast('Quitado de favoritos', casa.nombre, 'info');
    } else {
        favs.unshift(clave);
        mostrarToast('Agregado a favoritos', casa.nombre, 'success');
    }
    guardarFavoritos(favs);

    renderBarrioChips();
    if (filtroActivo === 'FAV') {
        aplicarFiltroRapido('FAV');
    } else if (modoListadoCompleto) {
        renderizarDirectorioAgrupado();
    } else if (document.getElementById('searchInput').value.trim() !== '') {
        filtrarCasas();
    } else {
        renderHomeQuickPanel();
    }
}

function registrarReciente(casa) {
    if (!casa) return;
    try {
        const clave = generarClaveProveedor(casa);
        let recents = JSON.parse(localStorage.getItem(CACHE_KEY_RECENTS) || '[]');
        recents = [clave, ...recents.filter(k => k !== clave)].slice(0, 6);
        localStorage.setItem(CACHE_KEY_RECENTS, JSON.stringify(recents));
    } catch (e) {}
}

function mostrarToast(titulo, mensaje, tipo = 'success') {
    const toast = document.getElementById('toastCorp');
    const icon = document.getElementById('toastIcon');
    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMsg');
    if (!toast) return;

    titleEl.textContent = titulo;
    msgEl.textContent = mensaje;

    if (tipo === 'info') {
        toast.style.borderColor = 'var(--ngc-neon)';
        toast.style.borderLeftColor = 'var(--ngc-neon)';
        icon.className = 'fa-solid fa-circle-info toast-icon';
        icon.style.color = 'var(--ngc-neon)';
    } else {
        toast.style.borderColor = 'var(--success-green)';
        toast.style.borderLeftColor = 'var(--success-green)';
        icon.className = 'fa-solid fa-circle-check toast-icon';
        icon.style.color = 'var(--success-green)';
    }

    toast.classList.add('mostrar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('mostrar'), 2800);
}

// ==========================================
// FORMATEO INTELIGENTE DE TELÉFONOS (AR)
// ==========================================
function analizarTelefonos(rawTel) {
    const texto = String(rawTel || '').trim();
    if (!texto) return { telLlamada: '', telWsp: '' };

    // Si hay varios teléfonos separados por /, ; o "y", los evaluamos por separado
    const partes = texto.split(/[\/;|]+|\sy\s/i).map(p => p.trim()).filter(Boolean);
    let telLlamada = '';
    let telWsp = '';

    partes.forEach(parte => {
        let digitos = parte.replace(/\D/g, '');
        if (digitos.length < 7) return;

        // Teléfono para llamada directa
        if (!telLlamada) {
            if (digitos.startsWith('549')) {
                telLlamada = '0' + digitos.slice(3);
            } else if (digitos.startsWith('54')) {
                telLlamada = '0' + digitos.slice(2);
            } else if (!digitos.startsWith('0') && digitos.length === 10) {
                telLlamada = '0' + digitos;
            } else {
                telLlamada = digitos;
            }
        }

        // Normalización para WhatsApp Argentina (549 + característica + número sin 15)
        let wspCand = digitos;
        if (wspCand.startsWith('549') && wspCand.length >= 12) {
            // Ya tiene formato internacional móvil AR
        } else if (wspCand.startsWith('54') && !wspCand.startsWith('549')) {
            wspCand = '549' + wspCand.slice(2);
        } else {
            if (wspCand.startsWith('0')) wspCand = wspCand.slice(1);
            // Quitar prefijo 15 luego de código de área (ej. 351 15 5XXXXXX -> 351 5XXXXXX)
            if (wspCand.length === 12 && wspCand.slice(3, 5) === '15') {
                wspCand = wspCand.slice(0, 3) + wspCand.slice(5);
            } else if (wspCand.length === 12 && wspCand.slice(2, 4) === '15') {
                wspCand = wspCand.slice(0, 2) + wspCand.slice(4);
            } else if (wspCand.length === 12 && wspCand.slice(4, 6) === '15') {
                wspCand = wspCand.slice(0, 4) + wspCand.slice(6);
            }
            if (wspCand.length >= 10) {
                wspCand = '549' + wspCand;
            } else {
                wspCand = '';
            }
        }

        if (!telWsp && wspCand.length >= 12) {
            telWsp = wspCand;
        }
    });

    return { telLlamada, telWsp };
}

// ==========================================
// CARGA OFFLINE-FIRST Y SINCRONIZACIÓN
// ==========================================
function inicializarInterfazConDatos(esDesdeCache = false) {
    document.getElementById('loading').style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex';

    actualizarBadgeEstado(esDesdeCache ? 'offline' : 'online');
    renderBarrioChips();

    if (modoListadoCompleto) {
        renderizarDirectorioAgrupado();
    } else if (document.getElementById('searchInput').value.trim() !== '') {
        filtrarCasas();
    } else if (filtroActivo !== 'ALL') {
        aplicarFiltroRapido(filtroActivo);
    } else {
        renderHomeQuickPanel();
    }
}

function actualizarBadgeEstado(estado) {
    const pill = document.getElementById('syncStatusPill');
    if (!pill) return;
    const total = dbCasas.length;
    if (estado === 'offline') {
        pill.innerHTML = `<i class="fa-solid fa-database"></i> ${total} locales (Caché)`;
    } else {
        pill.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--success-green);"></i> ${total} locales`;
    }
}

async function sincronizarManual() {
    const btn = document.getElementById('btnSyncProv');
    if (btn) btn.querySelector('i').classList.add('fa-spin');
    await fetchCasas(true);
    if (btn) btn.querySelector('i').classList.remove('fa-spin');
}

async function fetchCasas(notificarUsuario = false) {
    // 1. Carga instantánea desde caché local (0 ms, funciona sin señal en obra)
    try {
        const cacheRaw = localStorage.getItem(CACHE_KEY_CASAS);
        if (cacheRaw) {
            const parsed = JSON.parse(cacheRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                dbCasas = parsed.map((c, idx) => ({ ...c, _idx: idx }));
                inicializarInterfazConDatos(true);
            }
        }
    } catch (e) {
        console.warn("No se pudo leer caché local de proveedores:", e);
    }

    // 2. Sincronización en segundo plano con Google Sheets
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const res = await fetch(URL_CASAS, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const txt = await res.text();
        const jsonStr = txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
        const data = JSON.parse(jsonStr);

        const listaActualizada = data.table.rows.map(r => ({
            nombre: String(r.c[0]?.v || '').trim(),
            direccion: String(r.c[1]?.v || '').trim(),
            telefono: String(r.c[2]?.v || '').trim(),
            horario: String(r.c[3]?.v || '').trim(),
            comentarios: String(r.c[4]?.v || '').trim(),
            latitud: r.c[5]?.v ?? '',
            longitud: r.c[6]?.v ?? '',
            barrio: String(r.c[7]?.v || '').trim() || 'Sin Barrio Especificado'
        })).filter(c => c.nombre && c.nombre.toLowerCase() !== "nombre");

        dbCasas = listaActualizada.map((c, idx) => ({ ...c, _idx: idx }));
        try {
            localStorage.setItem(CACHE_KEY_CASAS, JSON.stringify(listaActualizada));
        } catch (e) {}

        inicializarInterfazConDatos(false);
        if (notificarUsuario) {
            mostrarToast('Base actualizada', `${dbCasas.length} proveedores sincronizados.`, 'success');
        }

    } catch (e) {
        clearTimeout(timeoutId);
        console.error("Error fetching casas:", e);

        if (dbCasas.length > 0) {
            actualizarBadgeEstado('offline');
            if (notificarUsuario) {
                mostrarToast('Sin conexión', 'Mostrando datos guardados en el dispositivo.', 'info');
            }
        } else {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.innerHTML = `
                <i class="fa-solid fa-wifi" style="color: var(--error-red); font-size: 2rem; margin-bottom: 12px;"></i>
                <p style="color: var(--ngc-text-main); font-weight: 700; margin-bottom: 6px;">Sin conexión con la base de proveedores</p>
                <p style="color: var(--ngc-text-faded); font-size: 0.82rem; margin-bottom: 16px;">Verificá tu señal de datos o Wi-Fi para descargar el listado por primera vez.</p>
                <button class="corp-btn primary-action" style="width: auto; margin: 0 auto;" onclick="fetchCasas(true)">
                    <i class="fa-solid fa-rotate-right"></i> Reintentar
                </button>`;
        }
    }
}

// ==========================================
// RENDERIZADO DE TARJETAS Y ACCIONES
// ==========================================
function generarHtmlTarjeta(casa) {
    const idx = typeof casa._idx === 'number' ? casa._idx : dbCasas.indexOf(casa);
    const fav = esFavorito(casa);
    const { telLlamada, telWsp } = analizarTelefonos(casa.telefono);

    const btnLlamar = telLlamada
        ? `<a class="corp-btn" href="tel:${escapeHtml(telLlamada)}" onclick="registrarRecientePorIndice(${idx})" style="text-decoration: none; padding: 11px 8px; font-size: 0.82rem;">
                <i class="fa-solid fa-phone"></i> Llamar
           </a>`
        : '';

    const btnWsp = telWsp
        ? `<button type="button" class="corp-btn success-btn" onclick="abrirWhatsappProveedor(${idx})" style="padding: 11px 8px; font-size: 0.82rem;">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
           </button>`
        : '';

    return `
        <article class="corp-card" style="padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
                <h4 style="margin: 0; color: var(--ngc-text-main); font-size: 1.05rem; line-height: 1.3; text-transform: none;">
                    ${escapeHtml(casa.nombre)}
                </h4>
                <button type="button" class="cat-star-btn ${fav ? 'active' : ''}" onclick="toggleFavorito(${idx}, event)" title="${fav ? 'Quitar de favoritos' : 'Marcar como favorito'}" aria-label="Favorito">
                    <i class="fa-${fav ? 'solid' : 'regular'} fa-star"></i>
                </button>
            </div>

            ${casa.direccion ? `
                <p style="margin: 0 0 4px 0; font-size: 0.88rem; color: var(--ngc-neon);">
                    <i class="fa-solid fa-location-dot"></i> ${escapeHtml(casa.direccion)}
                </p>` : ''}

            <p style="margin: 0 0 10px 0; font-size: 0.82rem; color: var(--ngc-text-faded); font-weight: 700;">
                <i class="fa-solid fa-city" style="color: var(--ngc-neon);"></i> Barrio: ${escapeHtml(casa.barrio)}
            </p>
            
            ${(casa.horario || casa.telefono || casa.comentarios) ? `
                <div style="font-size: 0.84rem; color: var(--ngc-text-faded); margin-bottom: 12px; line-height: 1.5; background: var(--ngc-bg-input); border: 1px solid var(--ngc-privacy-border); padding: 10px 12px; border-radius: 8px;">
                    ${casa.horario ? `<div style="margin-bottom:4px;"><b><i class="fa-regular fa-clock"></i> Horario:</b> ${escapeHtml(casa.horario)}</div>` : ''}
                    ${casa.telefono ? `<div style="margin-bottom:4px;"><b><i class="fa-solid fa-phone"></i> Tel:</b> ${escapeHtml(casa.telefono)}</div>` : ''}
                    ${casa.comentarios ? `<div style="margin-top: 6px; border-top: 1px dashed var(--ngc-privacy-border); padding-top: 6px; color: var(--ngc-warning);"><b><i class="fa-solid fa-comment-dots"></i> Info:</b> ${escapeHtml(casa.comentarios)}</div>` : ''}
                </div>` : ''}

            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch;">
                <button type="button" class="corp-btn primary-action" style="flex: 1 1 105px; padding: 11px 8px; font-size: 0.82rem;" onclick="abrirMapsPorIndice(${idx})">
                    <i class="fa-solid fa-map-location-dot"></i> Mapa
                </button>
                ${btnLlamar ? `<div style="flex: 1 1 95px; display: flex;">${btnLlamar}</div>` : ''}
                ${btnWsp ? `<div style="flex: 1 1 105px; display: flex;">${btnWsp}</div>` : ''}
                <button type="button" class="corp-btn cat-share-btn" onclick="compartirProveedor(${idx})" title="Compartir o copiar datos" aria-label="Compartir proveedor">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
            </div>
        </article>
    `;
}

function registrarRecientePorIndice(idx) {
    const casa = dbCasas[idx];
    if (casa) registrarReciente(casa);
}

function abrirWhatsappProveedor(idx) {
    const casa = dbCasas[idx];
    if (!casa) return;
    const { telWsp } = analizarTelefonos(casa.telefono);
    if (!telWsp) return;
    registrarReciente(casa);
    window.open(`https://wa.me/${telWsp}`, '_blank', 'noopener,noreferrer');
}

async function compartirProveedor(idx) {
    const casa = dbCasas[idx];
    if (!casa) return;
    registrarReciente(casa);

    const urlMaps = construirUrlMapsExterna(casa);
    const texto = [
        `📍 *${casa.nombre}*`,
        casa.direccion ? `Dirección: ${casa.direccion} (${casa.barrio})` : `Barrio: ${casa.barrio}`,
        casa.horario ? `Horario: ${casa.horario}` : '',
        casa.telefono ? `Tel: ${casa.telefono}` : '',
        `Mapa: ${urlMaps}`
    ].filter(Boolean).join('\n');

    if (navigator.share) {
        try {
            await navigator.share({ title: casa.nombre, text: texto });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }

    try {
        await navigator.clipboard.writeText(texto);
        mostrarToast('Ficha copiada', 'Datos listos para pegar en WhatsApp.', 'success');
    } catch (e) {
        mostrarToast('No se pudo copiar', 'Copiá los datos manualmente desde la tarjeta.', 'info');
    }
}

function renderCasas(lista) {
    const contenedor = document.getElementById('resultadosContainer');
    contenedor.innerHTML = '';
    
    if (lista.length === 0) {
        contenedor.innerHTML = `
            <div class="corp-card" style="text-align: center; color: var(--ngc-text-faded); padding: 28px 16px;">
                <i class="fa-solid fa-store-slash" style="font-size: 1.8rem; margin-bottom: 10px; opacity: 0.6;"></i>
                <div style="font-weight: 600; color: var(--ngc-text-main); margin-bottom: 4px;">No se encontraron proveedores</div>
                <div style="font-size: 0.82rem;">Probá con otro barrio, calle o palabra clave.</div>
            </div>`;
        return;
    }

    contenedor.innerHTML = lista.map(casa => generarHtmlTarjeta(casa)).join('');
}

// ==========================================
// PÍLDORAS DE FILTRO Y PANEL INICIAL RÁPIDO
// ==========================================
function renderBarrioChips() {
    const container = document.getElementById('barrioChipsContainer');
    if (!container) return;

    const favCount = dbCasas.filter(c => esFavorito(c)).length;
    const barriosUnicos = [...new Set(dbCasas.map(c => c.barrio.trim() || 'Sin Barrio Especificado'))].sort((a, b) => a.localeCompare(b));

    let html = `
        <button type="button" class="ap-chip ${filtroActivo === 'ALL' && !modoListadoCompleto ? 'active' : ''}" onclick="aplicarFiltroRapido('ALL')">
            Todos (${dbCasas.length})
        </button>
        <button type="button" class="ap-chip ${filtroActivo === 'FAV' ? 'active' : ''}" onclick="aplicarFiltroRapido('FAV')">
            <i class="fa-solid fa-star" style="color: ${filtroActivo === 'FAV' ? '#ffffff' : 'var(--ngc-warning)'};"></i> Favoritos (${favCount})
        </button>
    `;

    barriosUnicos.forEach(barrio => {
        const activo = filtroActivo === barrio;
        html += `
            <button type="button" class="ap-chip ${activo ? 'active' : ''}" onclick="aplicarFiltroRapido('${escapeHtml(barrio)}')">
                ${escapeHtml(barrio)}
            </button>
        `;
    });

    container.innerHTML = html;
}

function aplicarFiltroRapido(valor) {
    const input = document.getElementById('searchInput');
    const contenedor = document.getElementById('resultadosContainer');
    const homePanel = document.getElementById('homeQuickPanel');

    if (modoListadoCompleto) {
        resetearBotonListadoCompleto();
    }

    // Si vuelve a tocar la misma píldora activa, vuelve a "ALL"
    if (valor !== 'ALL' && filtroActivo === valor) {
        filtroActivo = 'ALL';
    } else {
        filtroActivo = valor;
    }

    renderBarrioChips();

    // Si hay texto escrito en el buscador, respetamos también ese texto
    if (input && input.value.trim() !== '') {
        filtrarCasas();
        return;
    }

    if (filtroActivo === 'ALL') {
        contenedor.style.display = 'none';
        if (homePanel) {
            homePanel.classList.remove('oculto');
            renderHomeQuickPanel();
        }
        return;
    }

    if (homePanel) homePanel.classList.add('oculto');
    contenedor.style.display = 'flex';

    if (filtroActivo === 'FAV') {
        const favs = dbCasas.filter(c => esFavorito(c));
        renderCasas(favs);
    } else {
        const porBarrio = dbCasas
            .filter(c => (c.barrio.trim() || 'Sin Barrio Especificado') === filtroActivo)
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
        renderCasas(porBarrio);
    }
}

function renderHomeQuickPanel() {
    const panel = document.getElementById('homeQuickPanel');
    if (!panel) return;

    const favs = dbCasas.filter(c => esFavorito(c));
    let recentsKeys = [];
    try {
        recentsKeys = JSON.parse(localStorage.getItem(CACHE_KEY_RECENTS) || '[]');
    } catch (e) {}

    const recientes = recentsKeys
        .map(k => dbCasas.find(c => generarClaveProveedor(c) === k))
        .filter(Boolean);

    let html = '';

    // 1. Tira de consultados recientemente
    if (recientes.length > 0) {
        html += `
            <div class="corp-card" style="padding: 12px;">
                <label style="margin-bottom: 8px;"><i class="fa-solid fa-clock-rotate-left corp-accent-color"></i> Consultados recientemente</label>
                <div class="cat-recents-strip">
                    ${recientes.map(c => `
                        <button type="button" class="cat-recent-pill" onclick="seleccionarDesdeRapido(${c._idx})">
                            <i class="fa-solid fa-store corp-accent-color"></i>
                            <span>${escapeHtml(c.nombre)}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 2. Tarjetas de Favoritos si existen
    if (favs.length > 0) {
        html += `
            <div class="flex-column gap-15">
                <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ngc-warning); padding: 0 4px;">
                    <i class="fa-solid fa-star"></i> Tus Proveedores Favoritos (${favs.length})
                </div>
                ${favs.map(c => generarHtmlTarjeta(c)).join('')}
            </div>
        `;
    }

    // 3. Explorador rápido por Barrios (evita pantalla vacía cuando aún no hay favoritos)
    const conteoBarrios = dbCasas.reduce((acc, c) => {
        const b = c.barrio.trim() || 'Sin Barrio Especificado';
        acc[b] = (acc[b] || 0) + 1;
        return acc;
    }, {});
    const barriosOrdenados = Object.keys(conteoBarrios).sort((a, b) => a.localeCompare(b));

    if (barriosOrdenados.length > 0) {
        html += `
            <div class="corp-card">
                <h4 class="corp-card-title" style="margin-bottom: 10px;">
                    <i class="fa-solid fa-city corp-accent-color"></i> Explorar por Barrio
                </h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${barriosOrdenados.map(b => `
                        <button type="button" class="modal-list-item" style="width: 100%; cursor: pointer; text-align: left;" onclick="aplicarFiltroRapido('${escapeHtml(b)}')">
                            <span style="font-weight: 600; font-size: 0.9rem; color: var(--ngc-text-main);">${escapeHtml(b)}</span>
                            <span class="cat-group-count">${conteoBarrios[b]} ${conteoBarrios[b] === 1 ? 'local' : 'locales'}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    panel.innerHTML = html;
}

function seleccionarDesdeRapido(idx) {
    const casa = dbCasas[idx];
    if (!casa) return;
    const input = document.getElementById('searchInput');
    input.value = casa.nombre;
    filtrarCasas();
}

// ==========================================
// BÚSQUEDA Y LISTADO AGRUPADO POR BARRIOS
// ==========================================
function limpiarBusqueda() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    filtrarCasas();
}

function resetearBotonListadoCompleto() {
    const btnVerTodos = document.getElementById('btnVerTodos');
    const btnToggleAcc = document.getElementById('btnToggleAcordeones');
    if (btnVerTodos) {
        btnVerTodos.innerHTML = '<i class="fa-solid fa-list"></i> Ver Listado Completo por Barrios';
        btnVerTodos.className = "corp-btn";
        btnVerTodos.style.color = "var(--ngc-warning)";
        btnVerTodos.style.background = "rgba(245, 195, 59, 0.1)";
    }
    if (btnToggleAcc) btnToggleAcc.classList.add('oculto');
    modoListadoCompleto = false;
}

function filtrarCasas() {
    const input = document.getElementById('searchInput');
    const rawQuery = input.value;
    const queryNorm = normalizarTexto(rawQuery);
    const contenedor = document.getElementById('resultadosContainer');
    const homePanel = document.getElementById('homeQuickPanel');
    const btnClear = document.getElementById('btnClearSearch');

    if (btnClear) {
        btnClear.classList.toggle('oculto', rawQuery.trim() === '');
    }

    if (modoListadoCompleto) {
        resetearBotonListadoCompleto();
        renderBarrioChips();
    }

    if (queryNorm === '') {
        if (filtroActivo !== 'ALL') {
            aplicarFiltroRapido(filtroActivo);
            return;
        }
        contenedor.style.display = 'none';
        if (homePanel) {
            homePanel.classList.remove('oculto');
            renderHomeQuickPanel();
        }
        return;
    }

    if (homePanel) homePanel.classList.add('oculto');
    contenedor.style.display = 'flex';

    const terminos = queryNorm.split(/\s+/).filter(Boolean);

    const filtradas = dbCasas.filter(c => {
        if (filtroActivo === 'FAV' && !esFavorito(c)) return false;
        if (filtroActivo !== 'ALL' && filtroActivo !== 'FAV') {
            const b = c.barrio.trim() || 'Sin Barrio Especificado';
            if (b !== filtroActivo) return false;
        }

        const haystack = normalizarTexto(`${c.nombre} ${c.direccion} ${c.comentarios} ${c.barrio} ${c.telefono}`);
        return terminos.every(t => haystack.includes(t));
    });
    
    renderCasas(filtradas);
}

function mostrarListadoAgrupado() {
    const contenedor = document.getElementById('resultadosContainer');
    const inputSearch = document.getElementById('searchInput');
    const btnVerTodos = document.getElementById('btnVerTodos');
    const btnToggleAcc = document.getElementById('btnToggleAcordeones');
    const homePanel = document.getElementById('homeQuickPanel');
    const btnClear = document.getElementById('btnClearSearch');

    if (modoListadoCompleto) {
        contenedor.style.display = 'none';
        resetearBotonListadoCompleto();
        renderBarrioChips();
        if (filtroActivo !== 'ALL') {
            aplicarFiltroRapido(filtroActivo);
        } else if (homePanel) {
            homePanel.classList.remove('oculto');
            renderHomeQuickPanel();
        }
        return;
    }

    inputSearch.value = '';
    if (btnClear) btnClear.classList.add('oculto');
    filtroActivo = 'ALL';
    modoListadoCompleto = true;
    acordeonesExpandidos = true;

    btnVerTodos.innerHTML = '<i class="fa-solid fa-xmark"></i> Cerrar Listado Completo';
    btnVerTodos.className = "corp-btn danger-btn"; 
    btnVerTodos.style.color = "";
    btnVerTodos.style.background = "";

    if (btnToggleAcc) {
        btnToggleAcc.classList.remove('oculto');
        btnToggleAcc.innerHTML = '<i class="fa-solid fa-angles-up"></i>';
    }

    renderBarrioChips();
    if (homePanel) homePanel.classList.add('oculto');
    contenedor.style.display = 'flex';

    renderizarDirectorioAgrupado();
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarDirectorioAgrupado() {
    const contenedor = document.getElementById('resultadosContainer');
    if (!contenedor) return;

    const casasPorBarrio = dbCasas.reduce((acc, casa) => {
        const barrioKey = casa.barrio.trim() || 'Sin Barrio Especificado';
        if (!acc[barrioKey]) acc[barrioKey] = [];
        acc[barrioKey].push(casa);
        return acc;
    }, {});

    const barriosOrdenados = Object.keys(casasPorBarrio).sort((a, b) => a.localeCompare(b));

    contenedor.innerHTML = barriosOrdenados.map(barrio => {
        const localesDelBarrio = casasPorBarrio[barrio].sort((a, b) => a.nombre.localeCompare(b.nombre));
        return `
            <details class="corp-card cat-group-card prov-barrio-acc" ${acordeonesExpandidos ? 'open' : ''}>
                <summary class="cat-group-summary">
                    <span style="color: var(--ngc-warning); font-weight: 700; text-transform: uppercase; font-size: 0.92rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-city"></i> ${escapeHtml(barrio)}
                    </span>
                    <div class="cat-group-meta">
                        <span class="cat-group-count">${localesDelBarrio.length}</span>
                        <i class="fa-solid fa-chevron-down acc-icon-indicator"></i>
                    </div>
                </summary>
                <div class="cat-items-stack">
                    ${localesDelBarrio.map(casa => generarHtmlTarjeta(casa)).join('')}
                </div>
            </details>
        `;
    }).join('');
}

function alternarTodosLosBarrios() {
    const detalles = document.querySelectorAll('.prov-barrio-acc');
    const btnToggleAcc = document.getElementById('btnToggleAcordeones');
    if (!detalles.length) return;

    acordeonesExpandidos = !acordeonesExpandidos;
    detalles.forEach(det => {
        if (acordeonesExpandidos) det.setAttribute('open', '');
        else det.removeAttribute('open');
    });

    if (btnToggleAcc) {
        btnToggleAcc.innerHTML = acordeonesExpandidos
            ? '<i class="fa-solid fa-angles-up"></i>'
            : '<i class="fa-solid fa-angles-down"></i>';
    }
}

// ==========================================
// VISOR DE MAPA PANTALLA COMPLETA
// ==========================================
function construirQueryMapa(nombre, direccion, lat, lng) {
    if (lat !== null && lat !== undefined && lng !== null && lng !== undefined &&
        String(lat).trim() !== '' && String(lng).trim() !== '') {
        const cleanLat = String(lat).replace(',', '.').trim();
        const cleanLng = String(lng).replace(',', '.').trim();
        return `${cleanLat},${cleanLng}`;
    }
    return encodeURIComponent(`${nombre}, ${direccion}, Córdoba, Argentina`);
}

function construirUrlMapsExterna(casa) {
    const query = construirQueryMapa(casa.nombre, casa.direccion, casa.latitud, casa.longitud);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function abrirMapsPorIndice(idx) {
    const casa = dbCasas[idx];
    if (!casa) return;
    registrarReciente(casa);
    abrirMaps(casa.nombre, casa.direccion, casa.latitud, casa.longitud);
}

function abrirMaps(nombre, direccion, lat, lng) {
    const query = construirQueryMapa(nombre, direccion, lat, lng);
    const urlEmbed = `https://www.google.com/maps?q=${query}&output=embed`;
    const urlExterna = `https://www.google.com/maps/search/?api=1&query=${query}`;
    
    const iframe = document.getElementById('iframeMapa');
    const modal = document.getElementById('modalVisorMapa');
    const loader = document.getElementById('visorLoaderMapa');
    const titleEl = document.getElementById('mapaTitle');
    const btnExterno = document.getElementById('btnAbrirMapsExterno');

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-map-location-dot corp-accent-color"></i> ${escapeHtml(nombre || 'Ubicación')}`;
    }
    if (btnExterno) {
        btnExterno.href = urlExterna;
    }

    iframe.style.opacity = '0';
    loader.style.display = 'block';
    iframe.src = urlEmbed;

    modal.classList.remove('oculto');
    modal.style.display = 'flex';
}

function ocultarLoaderMapa() {
    const iframe = document.getElementById('iframeMapa');
    const loader = document.getElementById('visorLoaderMapa');
    
    if (iframe.src && iframe.src !== window.location.href && iframe.src !== 'about:blank') {
        loader.style.display = 'none';
        iframe.style.opacity = '1';
    }
}

function cerrarMapaInterno() {
    const modal = document.getElementById('modalVisorMapa');
    const iframe = document.getElementById('iframeMapa');
    
    modal.classList.add('oculto');
    modal.style.display = 'none';
    iframe.src = '';
}

// ==========================================
// MENÚ INFERIOR SCROLL (MATCH GLOBAL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const footer = document.getElementById('corpFooterMenu'); if (!footer) return;
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
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '#', active: true },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '../catalogos/index.html' }
    ];
    modulos.forEach(mod => {
        const btn = document.createElement('button');
        btn.className = `corp-nav-item ${mod.active ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid ${mod.icon}"></i><span>${mod.nombre}</span>`;
        btn.onclick = () => { if(!mod.active) window.location.replace(mod.url); };
        footer.appendChild(btn);
    });

    // Centra automáticamente el botón activo en la vista
    requestAnimationFrame(() => {
        const btnActivo = footer.querySelector('.corp-nav-item.active');
        if (btnActivo) {
            const footerRect = footer.getBoundingClientRect();
            const btnRect = btnActivo.getBoundingClientRect();
            footer.scrollLeft += (btnRect.left - footerRect.left) - (footerRect.width / 2) + (btnRect.width / 2);
        }
    });
});
