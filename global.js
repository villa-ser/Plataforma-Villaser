// ==========================================
// global.js - FUNCIONES COMPARTIDAS (WHATSAPP)
// ==========================================
let globalWspMensajeActual = "";
let globalWspTelefonoActual = "";

// 1. Abrir Modal Universal
function abrirModalWspGlobal(telefonoCliente, mensajeGenerado) {
    globalWspMensajeActual = mensajeGenerado;
    globalWspTelefonoActual = telefonoCliente;
    
    const modal = document.getElementById('modalWhatsApp');
    if (modal) modal.classList.remove('oculto');
    
    const btnAgendado = document.getElementById('btnWspGuardado');
    const inputManual = document.getElementById('inputWspManual');
    
    if (inputManual) inputManual.value = ""; // Limpia el input

    // Muestra u oculta el botón del cliente agendado
    if (btnAgendado) {
        if (globalWspTelefonoActual && globalWspTelefonoActual.trim() !== "") {
            btnAgendado.innerHTML = `<i class="fa-brands fa-whatsapp" style="color: white;"></i> Enviar al Cliente (${globalWspTelefonoActual})`;
            btnAgendado.style.display = 'flex';
        } else {
            btnAgendado.style.display = 'none';
        }
    }
}

// 2. Cerrar Modal
function cerrarModalWspGlobal() {
    const modal = document.getElementById('modalWhatsApp');
    if (modal) modal.classList.add('oculto');
}

// 3. Enviar al contacto guardado
function enviarWspGuardadoGlobal() {
    if (!globalWspTelefonoActual) return;
    procesarEnvioWspGlobal(globalWspTelefonoActual);
}

// 4. Enviar a número manual
function enviarWspManualGlobal() {
    const inputManual = document.getElementById('inputWspManual');
    const numero = inputManual ? inputManual.value.trim() : "";
    
    if (!numero) {
        if (typeof mostrarAlertaCorp === 'function') {
            mostrarAlertaCorp("Faltan Datos", "Por favor, ingresá un número válido.");
        } else {
            alert("Por favor, ingresá un número válido.");
        }
        return;
    }
    procesarEnvioWspGlobal(numero);
}

// 5. Buscar libremente en WhatsApp
function buscarEnWspGlobal() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(globalWspMensajeActual)}`, '_blank');
    cerrarModalWspGlobal();
}

// 6. Lógica de formateo y envío
function procesarEnvioWspGlobal(numero) {
    let cleanNumber = numero.replace(/\D/g, '');
    
    // Auto-formateo a código argentino si no lo tiene
    if (cleanNumber.length === 10) cleanNumber = "549" + cleanNumber;
    else if (!cleanNumber.startsWith("54")) cleanNumber = "549" + cleanNumber;
    
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(globalWspMensajeActual)}`, '_blank');
    cerrarModalWspGlobal();
}

// ==========================================
// global.js - AGENDA Y MODALES COMPARTIDOS
// ==========================================
let contactosAgendaGlobal = [];

function abrirModalAgendaGlobal() {
    // Busca el ID del usuario usando las funciones locales existentes
    const uid = typeof obtenerUid === 'function' ? obtenerUid() : (typeof obtenerUidSeguro === 'function' ? obtenerUidSeguro() : null);
    
    if (!uid || !db) {
        if (typeof mostrarAlertaCorp === 'function') mostrarAlertaCorp("Error", "Sin sesión detectada.");
        else alert("⚠️ Sin sesión detectada.");
        return;
    }
    
    document.getElementById('modalAgenda').classList.remove('oculto');
    document.getElementById('buscadorAgenda').value = "";
    
    db.collection("perfiles").doc(uid).collection("contactos")
      .orderBy("nombre").get()
      .then((snapshot) => {
          contactosAgendaGlobal = [];
          snapshot.forEach((doc) => { contactosAgendaGlobal.push(doc.data()); });
          filtrarAgendaGlobal();
      })
      .catch(() => {
          document.getElementById('listaAgenda').innerHTML = "<p style='color:var(--error-red); text-align:center;'>Error al cargar contactos.</p>";
      });
}

function cerrarModalAgendaGlobal() {
    document.getElementById('modalAgenda').classList.add('oculto');
}

function filtrarAgendaGlobal() {
    const texto = document.getElementById('buscadorAgenda').value.toLowerCase();
    const contenedor = document.getElementById('listaAgenda'); 
    contenedor.innerHTML = '';
    
    // Soporte simultáneo para múltiples formatos de base de datos
    const filtrados = contactosAgendaGlobal.filter(c => 
        (c.nombre || '').toLowerCase().includes(texto) || 
        (c.dir || c.direccion || '').toLowerCase().includes(texto) || 
        (c.telefono || c.tel || '').includes(texto)
    );
    
    if (filtrados.length === 0) { 
        contenedor.innerHTML = "<p style='color:var(--ngc-text-faded);'>Sin resultados.</p>"; 
        return; 
    }
    
    filtrados.forEach(c => {
        const telVal = c.telefono || c.tel || ''; 
        const dirVal = c.dir || c.direccion || '';
        const div = document.createElement('div'); 
        div.className = "modal-list-item";
        div.innerHTML = `<div><h4>${c.nombre}</h4><small>${dirVal || 'Sin dirección'}</small></div>
            <button class="corp-btn-small" onclick="seleccionarContacto('${c.nombre.replace(/'/g, "\\'")}', '${dirVal.replace(/'/g, "\\'")}', '${telVal.replace(/'/g, "\\'")}')">Usar</button>`;
        contenedor.appendChild(div);
    });
}

function cerrarModalBorradoresGlobal() {
    document.getElementById('modalBorradores').classList.add('oculto');
}

// ==========================================
// global.js - MODAL REINICIO / NUEVO DOC
// ==========================================
function abrirModalConfirmarNuevoGlobal() {
    const modal = document.getElementById('modalConfirmarNuevo');
    if (modal) modal.classList.remove('oculto');
}

function cerrarModalConfirmarNuevoGlobal() {
    const modal = document.getElementById('modalConfirmarNuevo');
    if (modal) modal.classList.add('oculto');
}

// ==============================================================
// CONTROL GLOBAL DEL BOTÓN NATIVO "VOLVER" (PWA EXIT GUARD)
// ==============================================================
(function inicializarControlSalidaPWA() {
    let ignorarProximoPopstate = false;

    // 1. Inyectar estilos mínimos de respaldo (para que funcione también en la raíz sin global.css)
    function inyectarEstilosModalSalida() {
        if (document.getElementById('estilos-modal-salida-pwa')) return;
        const style = document.createElement('style');
        style.id = 'estilos-modal-salida-pwa';
        style.textContent = `
            #modalSalirPWA {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                z-index: 999999;
            }
            #modalSalirPWA.oculto {
                display: none !important;
            }
            #modalSalirPWA .pwa-exit-card {
                background: var(--ngc-glass, var(--corp-card-bg, #242526));
                border: var(--ngc-border-glass, var(--corp-border, 1px solid #3E4042));
                color: var(--ngc-text-main, var(--corp-text-main, #E4E6EB));
                border-radius: 14px;
                padding: 24px 20px;
                width: 100%;
                max-width: 380px;
                text-align: center;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
            }
            #modalSalirPWA .pwa-exit-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            #modalSalirPWA .pwa-exit-btn {
                flex: 1;
                padding: 12px 14px;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 700;
                cursor: pointer;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: transform 0.15s ease, opacity 0.15s ease;
            }
            #modalSalirPWA .pwa-exit-btn:active {
                transform: scale(0.97);
            }
            #modalSalirPWA .btn-permanecer {
                background: var(--ngc-neon, var(--corp-accent, #2374E1));
                color: #ffffff;
            }
            #modalSalirPWA .btn-salir-app {
                background: transparent;
                color: var(--error-red, var(--corp-danger, #E41E3F));
                border: 1px solid var(--error-red, var(--corp-danger, #E41E3F));
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Inyectar el HTML del modal en el DOM
    function inyectarModalSalida() {
        if (document.getElementById('modalSalirPWA')) return;
        inyectarEstilosModalSalida();

        const modalHTML = `
            <div id="modalSalirPWA" class="modal-overlay oculto gpu-accel" role="dialog" aria-modal="true">
                <div class="corp-modal-card pwa-exit-card">
                    <i class="fa-solid fa-right-from-bracket" style="font-size: 2.2rem; color: var(--error-red, #E41E3F); margin-bottom: 12px; display: block;"></i>
                    <h3 style="margin-bottom: 8px; font-size: 1.15rem; color: var(--ngc-text-main, var(--corp-text-main, #E4E6EB));">
                        ¿Salir de la aplicación?
                    </h3>
                    <p style="font-size: 0.88rem; line-height: 1.4; color: var(--ngc-text-faded, var(--corp-text-faded, #B0B3B8)); margin: 0;">
                        Para moverte entre secciones sin cerrar la app, utilizá los <b>botones de navegación de abajo</b>.
                    </p>
                    <div class="corp-modal-actions pwa-exit-actions">
                        <button type="button" class="pwa-exit-btn btn-permanecer" onclick="permanecerEnPWA()">
                            <i class="fa-solid fa-check"></i> Permanecer
                        </button>
                        <button type="button" class="pwa-exit-btn btn-salir-app" onclick="salirDePWA()">
                            <i class="fa-solid fa-door-open"></i> Salir
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 3. Armar el estado en el historial para interceptar el botón Volver
    function armarTrampaHistorial() {
        if (!window.history.state || !window.history.state.pwaTrap) {
            window.history.pushState({ pwaTrap: true }, '', window.location.href);
        }
    }

    // 4. Acciones de los botones del modal
    window.permanecerEnPWA = function () {
        const modal = document.getElementById('modalSalirPWA');
        if (modal) modal.classList.add('oculto');
        // Volver a bloquear el botón atrás para la próxima vez
        window.history.pushState({ pwaTrap: true }, '', window.location.href);
    };

    window.salirDePWA = function () {
        const modal = document.getElementById('modalSalirPWA');
        if (modal) modal.classList.add('oculto');
        ignorarProximoPopstate = true;

        // Intentar cerrar la ventana standalone de la PWA
        window.close();

        // Retroceder todo el historial interno de la PWA para salir al escritorio del teléfono
        const pasosAtras = window.history.length - 1;
        if (pasosAtras > 0) {
            window.history.go(-pasosAtras);
        } else {
            window.history.back();
        }
    };

    // 5. Escuchar el evento nativo de retroceso del celular
    window.addEventListener('popstate', function () {
        if (ignorarProximoPopstate) {
            ignorarProximoPopstate = false;
            return;
        }
        inyectarModalSalida();
        const modal = document.getElementById('modalSalirPWA');
        if (modal) modal.classList.remove('oculto');
    });

    // Inicializar al cargar la página y reforzar en el primer toque (requisito de Chrome Android)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inyectarModalSalida();
            armarTrampaHistorial();
        });
    } else {
        inyectarModalSalida();
        armarTrampaHistorial();
    }

    window.addEventListener('pointerdown', armarTrampaHistorial, { once: true });
})();
                            
// ==========================================================================
// MOTOR GLOBAL DE SELECTORES TIPO ACORDEÓN (AUTO-HYDRATION PWA)
// ==========================================================================
(function () {
    function posicionarListaFlotante(details, summary, list) {
        if (!details.open) {
            list.classList.remove('is-floating');
            list.style.top = '';
            list.style.bottom = '';
            list.style.left = '';
            list.style.width = '';
            return;
        }

        const rect = summary.getBoundingClientRect();
        const margen = 10;
        const anchoDeseado = Math.min(window.innerWidth - margen * 2, Math.max(rect.width, 220));
        let left = rect.left;

        if (left + anchoDeseado > window.innerWidth - margen) {
            left = Math.max(margen, window.innerWidth - anchoDeseado - margen);
        }

        list.classList.add('is-floating');
        list.style.left = `${left}px`;
        list.style.width = `${anchoDeseado}px`;

        const espacioAbajo = window.innerHeight - rect.bottom - margen;
        const espacioArriba = rect.top - margen;

        if (espacioAbajo < 190 && espacioArriba > espacioAbajo) {
            list.style.top = 'auto';
            list.style.bottom = `${window.innerHeight - rect.top + 6}px`;
            list.style.maxHeight = `${Math.min(250, espacioArriba - 8)}px`;
        } else {
            list.style.bottom = 'auto';
            list.style.top = `${rect.bottom + 6}px`;
            list.style.maxHeight = `${Math.min(250, Math.max(120, espacioAbajo - 8))}px`;
        }
    }

    function mejorarSelectNativo(select) {
        if (!select || select.dataset.corpUpgraded === '1' || select.dataset.native === 'true') return;
        select.dataset.corpUpgraded = '1';

        const details = document.createElement('details');
        details.className = 'corp-custom-select';
        if (select.disabled) details.setAttribute('disabled', 'true');

        const summary = document.createElement('summary');
        summary.className = select.className || 'corp-input';
        if (select.getAttribute('style')) {
            summary.setAttribute('style', select.getAttribute('style'));
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'corp-select-label';
        summary.appendChild(labelSpan);

        const list = document.createElement('div');
        list.className = 'corp-select-list';

        details.appendChild(summary);
        details.appendChild(list);

        select.style.display = 'none';
        select.parentNode.insertBefore(details, select.nextSibling);

        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

        function sincronizarUI() {
            const optActiva = select.options[select.selectedIndex];
            labelSpan.textContent = optActiva ? optActiva.text : '-- Seleccione --';

            const valActual = descriptor.get.call(select);
            list.querySelectorAll('.corp-select-option').forEach(el => {
                el.classList.toggle('selected', el.dataset.value === valActual);
            });

            if (select.disabled) {
                details.setAttribute('disabled', 'true');
                details.removeAttribute('open');
            } else {
                details.removeAttribute('disabled');
            }
        }

        function reconstruirOpciones() {
            list.innerHTML = '';
            Array.from(select.options).forEach(opt => {
                const item = document.createElement('div');
                item.className = 'corp-select-option';
                item.dataset.value = opt.value;
                item.textContent = opt.text;

                if (opt.disabled) {
                    item.style.opacity = '0.45';
                    item.style.pointerEvents = 'none';
                }

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (select.disabled) return;
                    descriptor.set.call(select, opt.value);
                    sincronizarUI();
                    details.removeAttribute('open');
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                });

                list.appendChild(item);
            });
            sincronizarUI();
        }

        // Intercepta asignaciones programáticas (ej: document.getElementById('gabIP').value = ...)
        Object.defineProperty(select, 'value', {
            get() {
                return descriptor.get.call(this);
            },
            set(nuevoValor) {
                descriptor.set.call(this, nuevoValor);
                sincronizarUI();
            }
        });

        details.addEventListener('toggle', () => {
            if (details.open) {
                if (select.disabled) {
                    details.removeAttribute('open');
                    return;
                }
                document.querySelectorAll('details.corp-custom-select[open]').forEach(otro => {
                    if (otro !== details) otro.removeAttribute('open');
                });
                sincronizarUI();
                requestAnimationFrame(() => posicionarListaFlotante(details, summary, list));
            } else {
                posicionarListaFlotante(details, summary, list);
            }
        });

        select.addEventListener('change', sincronizarUI);

        // Observa si un script agrega/quita <option> dinámicamente
        const observer = new MutationObserver(reconstruirOpciones);
        observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

        reconstruirOpciones();
    }

    window.inicializarSelectsCorporativos = function (contenedor = document) {
        contenedor.querySelectorAll('select.corp-input:not([data-native="true"])').forEach(mejorarSelectNativo);
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.inicializarSelectsCorporativos();
    });

    // Cierra al tocar fuera
    document.addEventListener('click', (e) => {
        document.querySelectorAll('details.corp-custom-select[open]').forEach(det => {
            if (!det.contains(e.target)) det.removeAttribute('open');
        });
    });

    // Cierra si el usuario hace scroll en el modal o en la página para evitar listas desacopladas
    window.addEventListener('scroll', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('corp-select-list')) return;
        document.querySelectorAll('details.corp-custom-select[open]').forEach(det => det.removeAttribute('open'));
    }, true);
})();
