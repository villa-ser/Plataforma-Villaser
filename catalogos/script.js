// ==============================================================
// MÓDULO CATÁLOGOS - VILLASER GESTIÓN
// ==============================================================

const ID_GENERICO_PENDIENTE = '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx';
const STORAGE_FAVORITOS = 'villaser_cat_favoritos_v1';
const STORAGE_RECIENTES = 'villaser_cat_recientes_v1';

// Base de datos estructurada (para sumar un catálogo, copiá un bloque de item)
const CATALOGOS_DATA = [
    {
        categoria: 'RESIDENCIAL',
        icono: 'fa-solid fa-house',
        items: [
            {
                uid: 'res-01a',
                titulo: 'Archivo 01-A',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Especificaciones técnicas y productos de la línea residencial.',
                tags: 'residencial hogar domiciliario cajas tableros'
            },
            {
                uid: 'res-01m',
                titulo: 'Archivo 01-M',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Detalles y medidas de componentes residenciales.',
                tags: 'residencial medidas dimensiones cotas planos'
            }
        ]
    },
    {
        categoria: 'ILUMINACIÓN',
        icono: 'fa-regular fa-lightbulb',
        items: [
            {
                uid: 'ilu-01b',
                titulo: 'Archivo 01-B',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Portfolio de artículos de iluminación y luminarias.',
                tags: 'iluminacion lamparas apliques artefactos luz'
            }
        ]
    },
    {
        categoria: 'CABLES',
        icono: 'fa-solid fa-plug',
        items: [
            {
                uid: 'cab-01b',
                titulo: 'Archivo 01-B',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Catálogo general de conductores eléctricos.',
                tags: 'cables conductores unipolar subterraneo sintenax taller seccion'
            }
        ]
    },
    {
        categoria: 'INDUSTRIALES',
        icono: 'fa-solid fa-industry',
        items: [
            {
                uid: 'ind-01b',
                titulo: 'Archivo 01-B',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Equipamiento y productos para el sector industrial.',
                tags: 'industrial trifasica contactores motores potencia tableros'
            }
        ]
    },
    {
        categoria: 'GENROD',
        icono: 'fa-solid fa-box',
        items: [
            {
                uid: 'gen-01b',
                titulo: 'Archivo 01-B',
                driveId: '1XUYNC3hnff0Z6bcxVzap8DvhAdSrmDHx',
                descripcion: 'Catálogo oficial de productos Genrod.',
                tags: 'genrod gabinetes cajas estancas tableros riel din'
            }
        ]
    },
    {
        categoria: 'JELUZ',
        icono: 'fa-solid fa-toggle-on',
        items: [
            {
                uid: 'jel-canal',
                titulo: 'Canalizaciones',
                driveId: '10A-LbVoZagzJsc6CcWi_W4BEO-vL1SR2',
                descripcion: 'Especificaciones técnicas de cañerías, conectores y accesorios para instalaciones.',
                tags: 'jeluz canos corrugado rigido pvc curvas conectores cablecanal'
            },
            {
                uid: 'jel-ilumi',
                titulo: 'Iluminación',
                driveId: '18ZH9gWd5GFleoQhJOS5QXBXMzxE9OCnU',
                descripcion: 'Portfolio de luminarias Jeluz y especificaciones.',
                tags: 'jeluz iluminacion paneles plafones dicroicas led'
            },
            {
                uid: 'jel-prod23',
                titulo: 'Productos 2023',
                driveId: '1xBSqbf4praQmj8oLZq_JOtIuA1EZ9XFo',
                descripcion: 'Catálogo residencial completo. Incluye líneas de interruptores Verona, Mito y Siglo XXI, tomacorrientes y cajas de embutir.',
                tags: 'jeluz verona mito siglo xxi teclas tomas bastidores tapas modulos cajas'
            },
            {
                uid: 'jel-prot23',
                titulo: 'Protecciones 2023',
                driveId: '1c493u0J-OCcK30-8WT_nSPIl9WkGn5zy',
                descripcion: 'Elementos de protección eléctrica e interruptores.',
                tags: 'jeluz termomagnetica disyuntor diferencial protector tension riel din'
            }
        ]
    },
    {
        categoria: 'MACROLED',
        icono: 'fa-solid fa-sun',
        items: [
            {
                uid: 'mac-gen',
                titulo: 'General',
                driveId: '1jS4sYB4Sd7G7Z4eUlQnUOwqP8qy8bzXf',
                descripcion: 'Portfolio completo de soluciones en iluminación LED. Lámparas, paneles, plafones y reflectores.',
                tags: 'macroled general lamparas bulbos galponeras reflectores tubos paneles'
            },
            {
                uid: 'mac-lum',
                titulo: 'Luminarias',
                driveId: '1TtYx8vhqKdbRFfa5gxLwbw6m2Cofnrh9',
                descripcion: 'Detalles técnicos de luminarias Macroled.',
                tags: 'macroled luminarias campanas alumbrado publico viales'
            },
            {
                uid: 'mac-mil',
                titulo: 'Milán',
                driveId: '1Ht0h3y5QMWYepPsav8uAZyxhx_BG0WWb',
                descripcion: 'Catálogo de la línea Milán.',
                tags: 'macroled milan decorativo colgantes apliques'
            },
            {
                uid: 'mac-proy',
                titulo: 'Proyectos',
                driveId: '1r8YyH00swvZulB5xw7HM-pPmazyoVPuX',
                descripcion: 'Iluminación aplicada a proyectos.',
                tags: 'macroled proyectos arquitectura oficinas comercios'
            },
            {
                uid: 'mac-sky',
                titulo: 'Skyline',
                driveId: '1AB-eoUMPL0tszNdqUWrngdoiTciHLqni',
                descripcion: 'Línea Skyline Macroled.',
                tags: 'macroled skyline lineal suspendido'
            },
            {
                uid: 'mac-tec',
                titulo: 'Teclas - Tomas',
                driveId: '1NKZ3Mo0UfBjVnZ92hpbjzXjqfSu_2Y0s',
                descripcion: 'Módulos, teclas y tomacorrientes Macroled.',
                tags: 'macroled teclas tomas interruptores puntos bastidores'
            },
            {
                uid: 'mac-tir',
                titulo: 'Tiras - Perfiles',
                driveId: '1hRcNuq_L7GkOu5_3vNVQKvJRZNAk5YdD',
                descripcion: 'Tiras de LED y perfilería de aluminio.',
                tags: 'macroled tiras led perfiles aluminio fuentes difusores'
            }
        ]
    }
];

let filtroCategoriaActivo = 'TODOS';
let toastTimer = null;

// ==============================================================
// UTILIDADES
// ==============================================================
function normalizarTexto(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escaparHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function obtenerFavoritos() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_FAVORITOS)) || [];
    } catch {
        return [];
    }
}

function obtenerRecientes() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_RECIENTES)) || [];
    } catch {
        return [];
    }
}

function buscarItemPorUid(uid) {
    for (const grupo of CATALOGOS_DATA) {
        const encontrado = grupo.items.find(i => i.uid === uid);
        if (encontrado) {
            return { ...encontrado, categoria: grupo.categoria, icono: grupo.icono };
        }
    }
    return null;
}

function mostrarToast(titulo, mensaje, tipo = 'success') {
    const toast = document.getElementById('toastCorp');
    const icon = document.getElementById('toastIcon');
    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMsg');
    if (!toast) return;

    titleEl.textContent = titulo;
    msgEl.textContent = mensaje;

    if (tipo === 'warning') {
        toast.style.borderColor = 'var(--ngc-warning)';
        icon.className = 'fa-solid fa-star toast-icon';
        icon.style.color = 'var(--ngc-warning)';
    } else {
        toast.style.borderColor = 'var(--success-green)';
        icon.className = 'fa-solid fa-circle-check toast-icon';
        icon.style.color = 'var(--success-green)';
    }

    toast.classList.add('mostrar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('mostrar'), 2600);
}

// ==============================================================
// RENDERIZADO DE CHIPS, RECIENTES Y LISTADO
// ==============================================================
function renderizarChips() {
    const container = document.getElementById('catChipsContainer');
    if (!container) return;

    const favCount = obtenerFavoritos().length;
    const opciones = [
        { id: 'TODOS', label: 'Todos' },
        { id: 'FAVORITOS', label: `★ Favoritos (${favCount})` },
        ...CATALOGOS_DATA.map(g => ({ id: g.categoria, label: g.categoria }))
    ];

    container.innerHTML = opciones.map(op => `
        <button type="button"
                class="ap-chip ${filtroCategoriaActivo === op.id ? 'active' : ''}"
                onclick="seleccionarChip('${op.id}')">
            ${escaparHTML(op.label)}
        </button>
    `).join('');
}

function seleccionarChip(catId) {
    filtroCategoriaActivo = catId;
    renderizarChips();
    renderizarCatalogos();
}

function renderizarRecientes() {
    const card = document.getElementById('catRecientesCard');
    const list = document.getElementById('catRecientesList');
    if (!card || !list) return;

    const recientes = obtenerRecientes()
        .map(uid => buscarItemPorUid(uid))
        .filter(Boolean);

    if (recientes.length === 0) {
        card.classList.add('oculto');
        return;
    }

    card.classList.remove('oculto');
    list.innerHTML = recientes.map(item => `
        <button type="button" class="cat-recent-pill" onclick="abrirCatalogoVisor('${item.uid}')">
            <i class="fa-regular fa-file-pdf" style="color: var(--error-red);"></i>
            <span>${escaparHTML(item.categoria)} · ${escaparHTML(item.titulo)}</span>
        </button>
    `).join('');
}

function renderizarCatalogos() {
    const container = document.getElementById('catListadoContainer');
    const contadorEl = document.getElementById('catContador');
    const searchInput = document.getElementById('catSearchInput');
    if (!container) return;

    const termino = normalizarTexto(searchInput ? searchInput.value : '');
    const favoritos = obtenerFavoritos();
    const hayFiltroActivo = termino.length > 0 || filtroCategoriaActivo === 'FAVORITOS';

    let totalVisibles = 0;
    let html = '';

    CATALOGOS_DATA.forEach(grupo => {
        if (filtroCategoriaActivo !== 'TODOS' &&
            filtroCategoriaActivo !== 'FAVORITOS' &&
            grupo.categoria !== filtroCategoriaActivo) {
            return;
        }

        const itemsFiltrados = grupo.items.filter(item => {
            if (filtroCategoriaActivo === 'FAVORITOS' && !favoritos.includes(item.uid)) {
                return false;
            }
            if (!termino) return true;

            const bolsaTexto = normalizarTexto(
                `${grupo.categoria} ${item.titulo} ${item.descripcion} ${item.tags || ''}`
            );
            return bolsaTexto.includes(termino);
        });

        if (itemsFiltrados.length === 0) return;
        totalVisibles += itemsFiltrados.length;

        const abrirGrupo = (hayFiltroActivo || filtroCategoriaActivo === grupo.categoria) ? 'open' : '';

        const itemsHTML = itemsFiltrados.map(item => {
            const esFav = favoritos.includes(item.uid);
            const esPendiente = item.driveId === ID_GENERICO_PENDIENTE;
            const urlDescarga = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.driveId)}`;

            return `
                <details class="gnc-sub-acc cat-sub-acc" ${termino ? 'open' : ''}>
                    <summary class="cat-sub-summary">
                        <div class="cat-sub-title">
                            <i class="fa-regular fa-file-pdf" style="color: var(--error-red);"></i>
                            <span>${escaparHTML(item.titulo)}</span>
                        </div>
                        <div class="cat-sub-right">
                            ${esPendiente ? '<span class="cat-tag-pending">ID base</span>' : ''}
                            <button type="button"
                                    class="cat-star-btn ${esFav ? 'active' : ''}"
                                    title="Fijar en favoritos"
                                    onclick="toggleFavorito('${item.uid}', event)">
                                <i class="${esFav ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                            </button>
                            <i class="fa-solid fa-angle-down acc-icon-indicator" style="font-size: 0.8rem;"></i>
                        </div>
                    </summary>

                    <div class="cat-sub-body">
                        <p class="cat-desc">
                            <strong>Contenido:</strong> ${escaparHTML(item.descripcion)}
                        </p>

                        <div class="cat-actions-grid">
                            <button type="button"
                                    class="corp-btn primary-action"
                                    onclick="abrirCatalogoVisor('${item.uid}')">
                                <i class="fa-solid fa-expand"></i> P. Completa
                            </button>

                            <a href="${urlDescarga}"
                               target="_blank"
                               rel="noopener"
                               class="corp-btn success-btn">
                                <i class="fa-solid fa-download"></i> Bajar
                            </a>

                            <button type="button"
                                    class="corp-btn cat-share-btn"
                                    title="Compartir enlace del catálogo"
                                    onclick="compartirCatalogo('${item.uid}')">
                                <i class="fa-solid fa-share-nodes"></i>
                            </button>
                        </div>
                    </div>
                </details>
            `;
        }).join('');

        html += `
            <details class="corp-card gnc-main-acc cat-group-card" ${abrirGrupo}>
                <summary class="cat-group-summary">
                    <span class="corp-card-title" style="margin: 0;">
                        <i class="${grupo.icono} corp-accent-color"></i> ${escaparHTML(grupo.categoria)}
                    </span>
                    <div class="cat-group-meta">
                        <span class="cat-group-count">${itemsFiltrados.length}</span>
                        <i class="fa-solid fa-chevron-down acc-icon-indicator"></i>
                    </div>
                </summary>
                <div class="cat-items-stack">
                    ${itemsHTML}
                </div>
            </details>
        `;
    });

    if (totalVisibles === 0) {
        html = `
            <div class="corp-card" style="text-align: center; padding: 28px 16px;">
                <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: var(--ngc-text-faded); margin-bottom: 10px;"></i>
                <p style="font-size: 0.9rem; color: var(--ngc-text-faded); margin-bottom: 12px;">
                    No se encontraron catálogos con ese criterio.
                </p>
                <button type="button" class="corp-btn-small" onclick="resetearFiltros()">
                    Mostrar todos los catálogos
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
    if (contadorEl) {
        contadorEl.textContent = `${totalVisibles} ${totalVisibles === 1 ? 'archivo' : 'archivos'}`;
    }

    // Solo aplica exclusividad cuando no hay búsqueda activa
    if (!hayFiltroActivo) {
        setupAccordion('.gnc-main-acc');
        setupAccordion('.gnc-sub-acc');
    }
}

// ==============================================================
// ACCIONES DE USUARIO (VISOR, FAVORITOS, COMPARTIR)
// ==============================================================
function abrirCatalogoVisor(uid) {
    const item = buscarItemPorUid(uid);
    if (!item) return;

    // Guardar en historial de recientes (máximo 4)
    const actuales = obtenerRecientes().filter(id => id !== uid);
    actuales.unshift(uid);
    localStorage.setItem(STORAGE_RECIENTES, JSON.stringify(actuales.slice(0, 4)));

    const tituloCompleto = `${item.categoria} - ${item.titulo}`;
    const urlVisor = `visor.html?id=${encodeURIComponent(item.driveId)}&titulo=${encodeURIComponent(tituloCompleto)}`;
    window.location.replace(urlVisor);
}

function toggleFavorito(uid, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    let favs = obtenerFavoritos();
    const existe = favs.includes(uid);

    if (existe) {
        favs = favs.filter(id => id !== uid);
        mostrarToast('Favoritos', 'Catálogo quitado de favoritos.');
    } else {
        favs.unshift(uid);
        mostrarToast('Favoritos', 'Catálogo fijado en favoritos.', 'warning');
    }

    localStorage.setItem(STORAGE_FAVORITOS, JSON.stringify(favs));
    renderizarChips();
    renderizarCatalogos();
}

async function compartirCatalogo(uid) {
    const item = buscarItemPorUid(uid);
    if (!item) return;

    const urlDrive = `https://drive.google.com/file/d/${item.driveId}/view`;
    const titulo = `Catálogo ${item.categoria} - ${item.titulo}`;
    const texto = `${titulo} (Villaser):\n${urlDrive}`;

    if (navigator.share) {
        try {
            await navigator.share({ title: titulo, text: titulo, url: urlDrive });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return;
        }
    }

    try {
        await navigator.clipboard.writeText(texto);
        mostrarToast('Enlace copiado', 'Listo para pegar y enviar por WhatsApp.');
    } catch {
        const temp = document.createElement('textarea');
        temp.value = texto;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        mostrarToast('Enlace copiado', 'Listo para pegar y enviar por WhatsApp.');
    }
}

function resetearFiltros() {
    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) searchInput.value = '';
    filtroCategoriaActivo = 'TODOS';
    renderizarChips();
    renderizarCatalogos();
}

// ==============================================================
// LÓGICA DE ACORDEONES EXCLUSIVOS
// ==============================================================
function setupAccordion(className) {
    const groups = document.querySelectorAll(className);
    groups.forEach((acc) => {
        acc.addEventListener('toggle', () => {
            if (acc.open) {
                groups.forEach((other) => {
                    if (other !== acc) other.removeAttribute('open');
                });
            }
        });
    });
}

// ==============================================================
// INICIALIZACIÓN Y MENÚ INFERIOR SCROLL
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    renderizarChips();
    renderizarRecientes();
    renderizarCatalogos();

    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderizarCatalogos());
    }

    const btnLimpiarRecientes = document.getElementById('btnLimpiarRecientes');
    if (btnLimpiarRecientes) {
        btnLimpiarRecientes.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_RECIENTES);
            renderizarRecientes();
        });
    }

    const footer = document.getElementById('corpFooterMenu');
    if (!footer) return;
    
    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topografico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '../leyescalc/index.html' },
        { nombre: 'Proveedores', icon: 'fa-truck-fast', url: '../proveedores/index.html' },
        { nombre: 'Catalogos', icon: 'fa-book-open', url: '#', active: true }
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
