// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE Y TEMA
// ==========================================
// La configuración ya se cargó externamente desde firebase-config.js
const auth = firebase.auth();
const db = firebase.firestore();

let registrandoCuenta = false;
let cargaInicial = true;
let estadoAuthResuelto = false;
let splashOculto = false;
let modoAuthActual = 'login';

// Lógica inteligente de Tema Corporativo
function aplicarTema(tema) {
    const metaTheme = document.getElementById('themeColorMeta');
    
    if (tema === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (metaTheme) metaTheme.setAttribute('content', '#F0F2F5');
    } else if (tema === 'system') {
        const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (prefiereClaro) {
            document.documentElement.setAttribute('data-theme', 'light');
            if (metaTheme) metaTheme.setAttribute('content', '#F0F2F5');
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (metaTheme) metaTheme.setAttribute('content', '#18191A');
        }
    } else { // dark
        document.documentElement.removeAttribute('data-theme');
        if (metaTheme) metaTheme.setAttribute('content', '#18191A');
    }
}

function cambiarTemaManual(nuevoTema) {
    localStorage.setItem('temaVillaser', nuevoTema);
    aplicarTema(nuevoTema);
}

document.addEventListener("DOMContentLoaded", () => {
    // Escuchar si el teléfono cambia de modo automáticamente
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
        if (temaGuardado === 'system') aplicarTema('system');
    });

    // --- LÓGICA DE SESIÓN Y SPLASH SCREEN ---
    auth.onAuthStateChanged(async (user) => {
        if (registrandoCuenta) return;

        estadoAuthResuelto = true;

        if (user) {
            if (user.emailVerified) {
                // Descargamos de Firebase silenciosamente y actualizamos local
                try {
                    const doc = await db.collection('perfiles').doc(user.uid).get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.nombre) localStorage.setItem('villaser_conf_nombre', data.nombre);
                        if (data.slogan) localStorage.setItem('villaser_conf_slogan', data.slogan);
                        if (data.telefono) localStorage.setItem('villaser_conf_telefono', data.telefono);
                        if (data.logo) localStorage.setItem('villaser_conf_logo', data.logo);
                    }
                } catch (error) {
                    console.error("Error leyendo Firebase. Verifica las Reglas.", error);
                }

                document.getElementById('errorMessage').classList.add('oculto');
                mostrarAppPrincipal(user.email);
            } else {
                await auth.signOut();
                mostrarMensaje("Debes verificar tu correo para ingresar.", "error");
                mostrarPantallaLogin();
            }
        } else {
            mostrarPantallaLogin();
        }

        // Ocultar splash screen SOLO DESPUÉS de comprobar todo el estado
        if (cargaInicial) {
            const splash = document.getElementById('customSplashScreen');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.classList.add('oculto');
                    splashOculto = true;
                    mostrarControlesInstalacion();
                }, 500);
            } else {
                splashOculto = true;
                mostrarControlesInstalacion();
            }
            cargaInicial = false;
        } else {
            mostrarControlesInstalacion();
        }

        // Restaurar estado visual del botón Login
        const btnLogin = document.getElementById('loginBtn');
        if (btnLogin) {
            btnLogin.innerHTML = '<i class="fa-solid fa-lock-open"></i> Ingresar';
            btnLogin.disabled = false;
        }
    });

    document.getElementById('passwordInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            if (modoAuthActual === 'register') {
                crearCuenta();
            } else {
                iniciarSesion();
            }
        }
    });

    // --- PREVISUALIZACIÓN DE LOGO ---
    document.getElementById('confLogo').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500000) { 
                alert("La imagen es muy pesada. Debe ser menor a 500KB.");
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.getElementById('logoPreview');
                preview.src = event.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
});

// ==========================================
// 2. ENRUTAMIENTO Y ACCESO A MÓDULOS
// ==========================================
const rutas = {
    'btnPresupuesto': './presupuesto/index.html',
    'btnMateriales': './materiales/index.html',
    'btnInformeTecnico': './informes/index.html',
    'btnCostos': './costos/index.html',
    'btnPotencia': './potencia/index.html',
    'btnAgenda': './agenda/index.html',
    'btnProveedores': './proveedores/index.html',
    'btnPresupuesto2': './presupuesto2/index.html',
    'btnCalculadora': './leyescalc/index.html',
    'btnCatalogos': './catalogos/index.html',
    'btnFotos': './fotos/index.html',
    'btnPresupuestoPC': './presupuestoPC/index.html',
    'btnMaterialesPC': './materialesPC/index.html',
    'btnPreguntas': './preguntas/index.html',
};

Object.keys(rutas).forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => window.location.replace(rutas[id]));
});

// ==========================================
// 3. FUNCIONES DE CONTROL DE UI & CONFIGURACIÓN
// ==========================================
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleIcon = document.getElementById('togglePasswordIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
        toggleIcon.style.color = 'var(--corp-accent)';
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
        toggleIcon.style.color = 'var(--corp-text-faded)';
    }
}

function mostrarMensaje(texto, tipo) {
    const errorMsg = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorTextContent');
    const errorIcon = document.getElementById('errorIcon');
    
    errorText.innerText = texto;
    errorMsg.classList.remove('oculto');
    
    if (tipo === "exito") {
        errorMsg.style.color = "var(--corp-success)";
        errorIcon.className = "fa-solid fa-circle-check";
    } else {
        errorMsg.style.color = "var(--corp-danger)";
        errorIcon.className = "fa-solid fa-circle-exclamation";
    }
}

function cambiarTabAuth(modo, limpiarError = true) {
    modoAuthActual = modo;

    const tabLogin = document.getElementById('tabBtnLogin');
    const tabRegister = document.getElementById('tabBtnRegister');
    const grupoTerminos = document.getElementById('grupoTerminos');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const forgotBox = document.getElementById('forgotPasswordContainer');
    const passwordInput = document.getElementById('passwordInput');

    if (modo === 'register') {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        grupoTerminos.classList.remove('oculto');
        loginBtn.classList.add('oculto');
        registerBtn.classList.remove('oculto');
        forgotBox.classList.add('oculto');
        passwordInput.setAttribute('autocomplete', 'new-password');
    } else {
        tabRegister.classList.remove('active');
        tabLogin.classList.add('active');
        grupoTerminos.classList.add('oculto');
        registerBtn.classList.add('oculto');
        loginBtn.classList.remove('oculto');
        forgotBox.classList.remove('oculto');
        passwordInput.setAttribute('autocomplete', 'current-password');
    }

    if (limpiarError) {
        document.getElementById('errorMessage').classList.add('oculto');
    }
}

function mostrarPantallaLogin() {
    // Mostrar interfaz de login clásica
    document.getElementById('loginScreen').classList.remove('oculto');
    document.getElementById('mainHeader').classList.remove('oculto');
    
    // Ocultar barra superior y grilla
    document.getElementById('appScreen').classList.add('oculto');
    document.getElementById('barraSuperiorNav').style.display = 'none';
    
    // Quitar el espaciado superior que evita chocar con la barra
    document.getElementById('mainContainer').style.paddingTop = '0px';

    mostrarControlesInstalacion();
}

function mostrarAppPrincipal(emailUsuario) {
    // Ocultar login y cabecera gigante
    document.getElementById('loginScreen').classList.add('oculto');
    document.getElementById('mainHeader').classList.add('oculto');
    
    const bannerPwa = document.getElementById('pwaInstallBanner');
    if (bannerPwa) {
        bannerPwa.classList.add('oculto');
        bannerPwa.style.display = 'none';
    }
    
    const emailDisplay = document.getElementById('userEmailDisplay');
    if (emailDisplay) emailDisplay.innerText = emailUsuario;

    const nombreCompleto = localStorage.getItem('villaser_conf_nombre') || 'Usuario';
    const primerNombre = nombreCompleto.split(" ")[0]; 
    const nameDisplay = document.getElementById('userFirstNameDisplay');
    if (nameDisplay) nameDisplay.innerText = primerNombre;

    // Mostrar la nueva barra superior, la grilla, y agregar espacio exacto
    document.getElementById('barraSuperiorNav').style.display = 'flex';
    document.getElementById('mainContainer').style.paddingTop = '72px'; 
    document.getElementById('appScreen').classList.remove('oculto');

    mostrarControlesInstalacion();
}

function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('oculto');
}

// Cierra menús al tocar fuera
document.addEventListener('click', (e) => { 
    const wrapper = document.getElementById('userMenuWrapper'); 
    const dropdown = document.getElementById('userDropdown'); 
    const modal = document.getElementById('modalConfig'); 
    if (wrapper && !wrapper.contains(e.target) && !dropdown.classList.contains('oculto') && (modal ? modal.classList.contains('oculto') : true)) { 
        dropdown.classList.add('oculto'); 
    } 
});

let editandoPerfil = false;

function cambiarPreferenciaNotificaciones(estado) {
    localStorage.setItem('villaser_notif_pref', estado);
    // Listo para conectar con Firebase Cloud Messaging (FCM) en la próxima actualización
}

function establecerModoEdicionPerfil(activo) {
    editandoPerfil = activo;

    const campos = ['confNombre', 'confSlogan', 'confTelefono', 'confLogo'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !activo;
    });

    const grupoInputLogo = document.getElementById('grupoInputLogo');
    const sinLogoTexto = document.getElementById('sinLogoTexto');
    const logoPreview = document.getElementById('logoPreview');
    const tieneLogo = logoPreview && logoPreview.src && logoPreview.src.startsWith('data:image');

    if (grupoInputLogo) {
        if (activo) {
            grupoInputLogo.classList.remove('oculto');
        } else {
            grupoInputLogo.classList.add('oculto');
        }
    }

    if (sinLogoTexto) {
        sinLogoTexto.style.display = (!activo && !tieneLogo) ? 'block' : 'none';
    }

    const btn = document.getElementById('btnToggleEditConfig');
    if (btn) {
        if (activo) {
            btn.classList.remove('secondary-btn');
            btn.classList.add('primary-btn');
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
        } else {
            btn.classList.remove('primary-btn');
            btn.classList.add('secondary-btn');
            btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar';
        }
    }
}

function manejarBotonPerfil() {
    if (!editandoPerfil) {
        establecerModoEdicionPerfil(true);
        const inputNombre = document.getElementById('confNombre');
        if (inputNombre) inputNombre.focus();
    } else {
        guardarConfiguracion();
    }
}

async function abrirConfiguracion() {
    document.getElementById('modalConfig').classList.remove('oculto');
    document.getElementById('userDropdown').classList.add('oculto');

    // Siempre inicia bloqueado para evitar modificaciones accidentales
    establecerModoEdicionPerfil(false);

    // 1. Cargar rápido de memoria local
    document.getElementById('confNombre').value = localStorage.getItem('villaser_conf_nombre') || '';
    document.getElementById('confSlogan').value = localStorage.getItem('villaser_conf_slogan') || '';
    document.getElementById('confTelefono').value = localStorage.getItem('villaser_conf_telefono') || '';
    document.getElementById('confLogo').value = '';
    
    const logoGuardado = localStorage.getItem('villaser_conf_logo');
    const logoPreview = document.getElementById('logoPreview');
    const sinLogoTexto = document.getElementById('sinLogoTexto');

    if (logoGuardado && logoGuardado.startsWith('data:image')) {
        logoPreview.src = logoGuardado;
        logoPreview.style.display = 'block';
        if (sinLogoTexto) sinLogoTexto.style.display = 'none';
    } else {
        logoPreview.src = '';
        logoPreview.style.display = 'none';
        if (sinLogoTexto) sinLogoTexto.style.display = 'block';
    }

    // Sincronizar Tema Visual
    const temaGuardado = localStorage.getItem('temaVillaser') || 'system';
    const radioTema = document.getElementById(`tema_${temaGuardado}`);
    if (radioTema) radioTema.checked = true;

    // Sincronizar Preferencia de Notificaciones (por defecto 'off' hasta activar FCM)
    const notifGuardada = localStorage.getItem('villaser_notif_pref') || 'off';
    const radioNotif = document.getElementById(`notif_${notifGuardada}`);
    if (radioNotif) radioNotif.checked = true;

    // 2. Si no hay datos locales, forzamos lectura a la nube
    const user = auth.currentUser;
    if (user && !document.getElementById('confNombre').value) {
        try {
            const doc = await db.collection('perfiles').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.nombre) { document.getElementById('confNombre').value = data.nombre; localStorage.setItem('villaser_conf_nombre', data.nombre); }
                if (data.slogan) { document.getElementById('confSlogan').value = data.slogan; localStorage.setItem('villaser_conf_slogan', data.slogan); }
                if (data.telefono) { document.getElementById('confTelefono').value = data.telefono; localStorage.setItem('villaser_conf_telefono', data.telefono); }
                if (data.logo) {
                    logoPreview.src = data.logo;
                    logoPreview.style.display = 'block';
                    if (sinLogoTexto) sinLogoTexto.style.display = 'none';
                    localStorage.setItem('villaser_conf_logo', data.logo);
                }
            }
        } catch (e) {
            console.log("No se pudo leer de la nube al abrir config", e);
        }
    }
}

function cerrarConfiguracion() {
    establecerModoEdicionPerfil(false);
    document.getElementById('modalConfig').classList.add('oculto');
}

function guardarConfiguracion() {
    const nombre = document.getElementById('confNombre').value.trim();
    const slogan = document.getElementById('confSlogan').value.trim();
    const telefono = document.getElementById('confTelefono').value.trim();
    const logoPreview = document.getElementById('logoPreview').src;

    const user = auth.currentUser;
    if (!user) {
        alert("Sesión caducada. Inicia sesión nuevamente para guardar.");
        return;
    }

    localStorage.setItem('villaser_conf_nombre', nombre);
    localStorage.setItem('villaser_conf_slogan', slogan);
    localStorage.setItem('villaser_conf_telefono', telefono);

    // Actualizar en vivo el primer nombre en la barra superior
    const primerNombre = (nombre || 'Usuario').split(" ")[0];
    const nameDisplay = document.getElementById('userFirstNameDisplay');
    if (nameDisplay) nameDisplay.innerText = primerNombre;

    const perfilData = {
        nombre: nombre,
        slogan: slogan,
        telefono: telefono
    };

    if (logoPreview && logoPreview.startsWith('data:image')) {
        localStorage.setItem('villaser_conf_logo', logoPreview);
        perfilData.logo = logoPreview;
    }

    // Volver a bloquear el perfil (botón regresa a "Editar"), cerrar config y mostrar éxito
    establecerModoEdicionPerfil(false);
    cerrarConfiguracion();
    document.getElementById('modalExitoCorp').classList.remove('oculto');

    // Sincronizar con Firebase EN SEGUNDO PLANO
    db.collection('perfiles').doc(user.uid).set(perfilData, { merge: true })
        .then(() => console.log("Datos sincronizados exitosamente."))
        .catch((error) => {
            console.error("Error nube:", error);
        });
}

function cerrarModalExitoCorp() {
    document.getElementById('modalExitoCorp').classList.add('oculto');
}

function abrirTerminos(desdeRegistro) {
    document.getElementById('modalTerminos').classList.remove('oculto');
    const contenedorDescarga = document.getElementById('btnDescargaPdfContainer');
    
    if (desdeRegistro) {
        contenedorDescarga.style.display = 'block';
    } else {
        contenedorDescarga.style.display = 'none';
        document.getElementById('userDropdown').classList.add('oculto');
    }
}

function cerrarTerminos() { document.getElementById('modalTerminos').classList.add('oculto'); }
document.getElementById('modalTerminos').addEventListener('click', function(e) { if(e.target === this) cerrarTerminos(); });


// ==========================================
// 4. FUNCIONES DE FIREBASE (AUTH)
// ==========================================
function crearCuenta() { 
    const email = document.getElementById('emailInput').value.trim(); 
    const password = document.getElementById('passwordInput').value.trim();
    const aceptaTerminos = document.getElementById('aceptaTerminos').checked;
    
    if (!email || !password) {
        mostrarMensaje("Completa correo y contraseña.", "error"); return;
    }
    if (!aceptaTerminos) {
        mostrarMensaje("Debes aceptar los Términos y Condiciones.", "error"); return;
    }

    registrandoCuenta = true;
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            userCredential.user.sendEmailVerification().catch(e => console.log(e));
            auth.signOut().then(() => {
                registrandoCuenta = false;
                mostrarMensaje("¡Cuenta creada! Se envió correo de validación.", "exito");
                document.getElementById('passwordInput').value = '';
                document.getElementById('passwordInput').type = 'password';
                document.getElementById('togglePasswordIcon').classList.replace('fa-eye-slash', 'fa-eye');
                document.getElementById('togglePasswordIcon').style.color = 'var(--corp-text-faded)';
                document.getElementById('aceptaTerminos').checked = false; 
                cambiarTabAuth('login', false);
                mostrarPantallaLogin();
            });
        })
        .catch((error) => {
            registrandoCuenta = false;
            let msg = "Error al crear la cuenta.";
            if (error.code === 'auth/email-already-in-use') msg = "Correo ya registrado.";
            if (error.code === 'auth/weak-password') msg = "Mínimo 6 caracteres.";
            mostrarMensaje(msg, "error");
        });
}

function iniciarSesion() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    if (!email || !password) {
        mostrarMensaje("Completa correo y contraseña.", "error"); return;
    }
    
    document.getElementById('errorMessage').classList.add('oculto');

    const btnLogin = document.getElementById('loginBtn');
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    btnLogin.disabled = true;

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.signInWithEmailAndPassword(email, password))
        .catch((error) => {
            btnLogin.innerHTML = '<i class="fa-solid fa-lock-open"></i> Ingresar';
            btnLogin.disabled = false;

            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').type = 'password';
            document.getElementById('togglePasswordIcon').classList.replace('fa-eye-slash', 'fa-eye');
            
            let msg = "Error al ingresar. Revisa los datos.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = "Datos incorrectos.";
            mostrarMensaje(msg, "error");
        });
}

function cerrarSesion() {
    localStorage.removeItem('villaser_conf_nombre');
    localStorage.removeItem('villaser_conf_slogan');
    localStorage.removeItem('villaser_conf_telefono');
    localStorage.removeItem('villaser_conf_logo');
    
    auth.signOut().then(() => window.location.reload());
}

function recuperarPassword() {
    const email = document.getElementById('emailInput').value.trim();
    if (!email) {
        mostrarMensaje("Ingresa tu correo arriba y presiona recuperar.", "error"); return;
    }
    auth.sendPasswordResetEmail(email)
        .then(() => mostrarMensaje(`Recuperación enviada a ${email}.`, "exito"))
        .catch(() => mostrarMensaje("Error al enviar el correo.", "error"));
}

// ==========================================
// 5. CONFIGURACIÓN PWA (INSTALACIÓN)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('ServiceWorker registrado con éxito:', reg.scope))
            .catch(err => console.log('Error al registrar ServiceWorker:', err));
    });
}

// Captura autosuficiente del evento (respalda también si no está en el <head>)
if (!window.__pwaPromptListenerRegistrado) {
    window.__pwaPromptListenerRegistrado = true;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredInstallPrompt = e;
        mostrarControlesInstalacion();
    });
}

let temporizadorBannerPWA = null;
let bannerYaMostradoEnEstaCarga = false;

function mostrarControlesInstalacion() {
    const promptGuardado = window.deferredInstallPrompt;
    if (!promptGuardado) return;

    const btnInstalarMenu = document.getElementById('btn-instalar');
    const pwaInstallBanner = document.getElementById('pwaInstallBanner');
    const loginScreen = document.getElementById('loginScreen');

    // 1. Mostrar siempre la opción dentro del menú de perfil (logueado o no)
    if (btnInstalarMenu) {
        btnInstalarMenu.classList.remove('oculto');
        btnInstalarMenu.style.display = 'flex';
    }

    // 2. Mostrar el cartel superior durante 7 segundos solo cuando ya se quitó el splash y está en el login
    const enPantallaLogin = loginScreen && !loginScreen.classList.contains('oculto');
    if (pwaInstallBanner && splashOculto && estadoAuthResuelto && !bannerYaMostradoEnEstaCarga && !auth.currentUser && enPantallaLogin) {
        bannerYaMostradoEnEstaCarga = true;
        pwaInstallBanner.style.opacity = '1';
        pwaInstallBanner.classList.remove('oculto');
        pwaInstallBanner.style.display = 'flex';

        clearTimeout(temporizadorBannerPWA);
        temporizadorBannerPWA = setTimeout(() => {
            pwaInstallBanner.style.opacity = '0';
            setTimeout(() => {
                pwaInstallBanner.classList.add('oculto');
                pwaInstallBanner.style.display = 'none';
            }, 400);
        }, 7000); // 7000 ms = 7 segundos
    }
}

function ocultarControlesInstalacion() {
    clearTimeout(temporizadorBannerPWA);
    const btnInstalarMenu = document.getElementById('btn-instalar');
    const pwaInstallBanner = document.getElementById('pwaInstallBanner');

    if (btnInstalarMenu) {
        btnInstalarMenu.classList.add('oculto');
        btnInstalarMenu.style.display = 'none';
    }
    if (pwaInstallBanner) {
        pwaInstallBanner.classList.add('oculto');
        pwaInstallBanner.style.display = 'none';
    }
}

async function ejecutarInstalacionPWA(e) {
    if (e) e.preventDefault();
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.add('oculto');

    const promptGuardado = window.deferredInstallPrompt;
    if (!promptGuardado) return;

    promptGuardado.prompt();
    const { outcome } = await promptGuardado.userChoice;

    if (outcome === 'accepted') {
        ocultarControlesInstalacion();
    }
    window.deferredInstallPrompt = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const btnInstalarMenu = document.getElementById('btn-instalar');
    const btnBannerInstalar = document.getElementById('btnBannerInstalar');

    if (btnInstalarMenu) btnInstalarMenu.addEventListener('click', ejecutarInstalacionPWA);
    if (btnBannerInstalar) btnBannerInstalar.addEventListener('click', ejecutarInstalacionPWA);

    mostrarControlesInstalacion();
});

window.addEventListener('appinstalled', () => {
    window.deferredInstallPrompt = null;
    ocultarControlesInstalacion();
});
