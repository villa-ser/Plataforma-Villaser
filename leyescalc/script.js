// ==========================================================================
// VARIABLES DE ESTADO GLOBAL Y NAVEGACIÓN ENTRE CALCULADORAS
// ==========================================================================
let calcActiva = 'leyes'; // 'leyes' | 'caida' | 'termico' | 'potencia'
let toastTimeout = null;
const CALC_HISTORIAL_KEY = 'villaser_calc_historial_v1';

// --- SISTEMA DE TOAST CORPORATIVO ---
function mostrarToast(titulo, mensaje, esError = false) {
    const toast = document.getElementById('toastNotificacion');
    if (!toast) return;
    
    document.getElementById('toastTitle').innerText = titulo;
    document.getElementById('toastMessage').innerText = mensaje;
    
    const icon = document.getElementById('toastIcon');
    if (esError) {
        toast.style.borderLeftColor = 'var(--error-red)';
        toast.style.borderColor = 'var(--error-red)';
        icon.className = 'fa-solid fa-triangle-exclamation toast-icon';
        icon.style.color = 'var(--error-red)';
    } else {
        toast.style.borderLeftColor = 'var(--success-green)';
        toast.style.borderColor = 'var(--success-green)';
        icon.className = 'fa-solid fa-check-circle toast-icon';
        icon.style.color = 'var(--success-green)';
    }

    clearTimeout(toastTimeout);
    toast.classList.add('mostrar');
    
    toastTimeout = setTimeout(() => {
        toast.classList.remove('mostrar');
    }, 3200);
}

// --- CAMBIO ENTRE LAS 4 CALCULADORAS ---
function cambiarCalculadora(id) {
    calcActiva = id;

    document.querySelectorAll('.nav-calc-btn').forEach(btn => btn.classList.remove('modo-activo'));
    const btnActivo = document.getElementById(`tab-btn-${id}`);
    if (btnActivo) btnActivo.classList.add('modo-activo');

    ['leyes', 'caida', 'termico', 'potencia'].forEach(mod => {
        const sec = document.getElementById(`sec-${mod}`);
        if (sec) sec.classList.toggle('oculto', mod !== id);
    });

    const titulos = {
        leyes: '<i class="fa-solid fa-bolt corp-accent-color"></i> LEYES ELÉCTRICAS',
        caida: '<i class="fa-solid fa-arrow-trend-down corp-accent-color"></i> CAÍDA DE TENSIÓN',
        termico: '<i class="fa-solid fa-temperature-half corp-accent-color"></i> BALANCE TÉRMICO',
        potencia: '<i class="fa-solid fa-gears corp-accent-color"></i> POTENCIA Y MOTORES'
    };
    document.getElementById('nav-titulo-modulo').innerHTML = titulos[id] || 'CALCULADORA';

    if (id === 'potencia') {
        const cardPot = document.getElementById(`pot-card-${potActiveCat}`);
        if (cardPot) cardPot.classList.add('modo-activo');
    }

    renderQuickStrip();
}

function reiniciarModuloActivo() {
    if (calcActiva === 'leyes') leyesLimpiarTodo();
    else if (calcActiva === 'caida') caidaResetAll();
    else if (calcActiva === 'termico') termResetAll();
    else if (calcActiva === 'potencia') potResetAll();
    mostrarToast("Reiniciado", "Valores restablecidos a su estado inicial.");
}

function toggleNumpadVisibilidad() {
    const grid = document.getElementById('tecladoGridContainer');
    const icon = document.getElementById('iconToggleNumpad');
    if (!grid || !icon) return;
    const oculto = grid.classList.toggle('oculto');
    icon.className = oculto ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
}

// --- BARRA DE ACCESOS RÁPIDOS ADAPTATIVA ---
function renderQuickStrip() {
    const strip = document.getElementById('calcQuickStrip');
    if (!strip) return;

    if (calcActiva === 'leyes') {
        strip.innerHTML = `
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('v', '220')">220V</button>
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('v', '380')">380V</button>
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('v', '24')">24V</button>
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('v', '12')">12V</button>
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('i', '10')">10A</button>
            <button type="button" class="calc-quick-chip" onclick="leyesQuickSet('i', '16')">16A</button>
        `;
    } else if (calcActiva === 'caida') {
        strip.innerHTML = `
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('mts', '15')">15m</button>
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('mts', '30')">30m</button>
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('mts', '50')">50m</button>
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('mts', '100')">100m</button>
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('vnom', '220')">220V</button>
            <button type="button" class="calc-quick-chip" onclick="caidaQuickSet('vnom', '380')">380V</button>
        `;
    } else if (calcActiva === 'termico') {
        const calibres = [10, 16, 20, 25, 32, 40, 63];
        strip.innerHTML = calibres.map(a =>
            `<button type="button" class="calc-quick-chip" onclick="termQuickAdd(${a})">+${a}A PIA</button>`
        ).join('');
    } else if (calcActiva === 'potencia') {
        if (potActiveCat === 'mot') {
            strip.innerHTML = `
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(0.75)">0.75 HP</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(1)">1 HP</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(1.5)">1.5 HP</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(2)">2 HP</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(3)">3 HP</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickMotorHP(5)">5 HP</button>
            `;
        } else if (potActiveCat === 'cap') {
            strip.innerHTML = `
                <button type="button" class="calc-quick-chip" onclick="potQuickCapTarget(0.95, 0.33)">Obj 0.95</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickCapTarget(0.92, 0.43)">Obj 0.92</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickCapTarget(0.90, 0.48)">Obj 0.90</button>
            `;
        } else {
            strip.innerHTML = `
                <button type="button" class="calc-quick-chip" onclick="potQuickSet('U', '220')">220V</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickSet('U', '380')">380V</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickSet('cos', '0.85')">cos 0.85</button>
                <button type="button" class="calc-quick-chip" onclick="potQuickSet('cos', '0.95')">cos 0.95</button>
            `;
        }
    }
}

// --- ENRUTADOR DEL TECLADO NUMÉRICO UNIFICADO ---
function numpadTecla(val) {
    if (calcActiva === 'leyes') leyesTecla(val);
    else if (calcActiva === 'caida') caidaPress(val);
    else if (calcActiva === 'termico') termPress(val);
    else if (calcActiva === 'potencia') potPress(val);
}

function numpadBorrar() {
    if (calcActiva === 'leyes') leyesBorrar();
    else if (calcActiva === 'caida') caidaClearVal();
    else if (calcActiva === 'termico') termDel();
    else if (calcActiva === 'potencia') potDel();
}

function numpadLimpiarCampo() {
    if (calcActiva === 'leyes') leyesLimpiarCampoActivo();
    else if (calcActiva === 'caida') caidaLimpiarCampoActivo();
    else if (calcActiva === 'termico') termLimpiarCampoActivo();
    else if (calcActiva === 'potencia') potLimpiarCampoActivo();
}

function numpadCalcular() {
    if (calcActiva === 'leyes') {
        leyesCalcular();
    } else if (calcActiva === 'caida') {
        caidaCalc();
        if (caidaUltimoResumen) registrarHistorialCalc('Caída de Tensión', `${document.getElementById('caida-out-u').innerText} (${document.getElementById('caida-out-pct').innerText})`, caidaUltimoResumen);
        mostrarToast("Cálculo Actualizado", "Caída de tensión recalculada.");
    } else if (calcActiva === 'termico') {
        termCalculate();
        if (termState.ultimoResumen) registrarHistorialCalc('Balance Térmico', `${document.getElementById('term-res-ptot').innerText} W (${document.getElementById('term-rec-box').innerText})`, termState.ultimoResumen);
        mostrarToast("Cálculo Actualizado", "Balance térmico recalculado.");
    } else if (calcActiva === 'potencia') {
        potCalc();
        if (potUltimoResumen) registrarHistorialCalc('Potencia / Motores', document.getElementById('pot-main-result').innerText, potUltimoResumen);
        mostrarToast("Cálculo Actualizado", "Potencia / Motor recalculado.");
    }
}

// ==========================================================================
// 1. MÓDULO LEYES ELÉCTRICAS (OHM, WATT, MÁGICO PRO INTELIGENTE)
// ==========================================================================
const leyesState = {
    foco: 'v',
    modo: 'PRO',
    vals: { v: '', i: '', r: '', p: '' },
    userOrder: [],        // Mantiene el historial de hasta 2 campos ingresados por el usuario
    resuelto: false,
    sobreescribirFoco: false,
    ultimoResumenTexto: ''
};

const leyesPlaceholders = { v: 'Volts', i: 'Amps', r: 'Ohms', p: 'Watts' };

function leyesSetFoco(campo) {
    leyesState.foco = campo;
    if (leyesState.resuelto) {
        leyesState.sobreescribirFoco = true;
    }
    ['v', 'i', 'r', 'p'].forEach(k => {
        const box = document.getElementById(`leyes-box-${k}`);
        if (box) box.classList.remove('active');
    });
    const activo = document.getElementById(`leyes-box-${campo}`);
    if (activo) {
        activo.classList.add('active');
    }
}

function leyesActualizarTags() {
    ['v', 'i', 'r', 'p'].forEach(k => {
        const tag = document.getElementById(`leyes-tag-${k}`);
        const box = document.getElementById(`leyes-box-${k}`);
        if (!tag || !box) return;

        if (leyesState.vals[k] === '') {
            tag.className = 'calc-box-tag oculto';
            tag.innerText = '';
            box.classList.remove('solved');
        } else if (leyesState.userOrder.includes(k)) {
            tag.className = 'calc-box-tag dato';
            tag.innerText = 'DATO';
            box.classList.remove('solved');
        } else {
            tag.className = 'calc-box-tag calc';
            tag.innerText = 'CALC';
            box.classList.add('solved');
        }
    });
}

function leyesRenderInputs() {
    ['v', 'i', 'r', 'p'].forEach(k => {
        const span = document.getElementById(`leyes-val-${k}`);
        if (!span) return;
        const val = leyesState.vals[k];
        if (val === '') {
            span.innerText = leyesPlaceholders[k];
            span.style.color = 'var(--ngc-text-faded)';
        } else {
            span.innerText = val;
            span.style.color = 'var(--ngc-text-main)';
        }
    });
    leyesActualizarTags();
}

function leyesPrepararEscritura(campo) {
    // Si ya había un cálculo resuelto, limpiamos los campos calculados automáticamente
    if (leyesState.resuelto) {
        ['v', 'i', 'r', 'p'].forEach(key => {
            if (!leyesState.userOrder.includes(key)) {
                leyesState.vals[key] = '';
            }
        });
        leyesState.resuelto = false;
    }

    // Si el usuario tocó una caja con valor previo tras resolver, arranca limpio en ese campo
    if (leyesState.sobreescribirFoco) {
        leyesState.vals[campo] = '';
        leyesState.sobreescribirFoco = false;
    }

    // Registrar este campo como uno de los 2 datos activos (FIFO de máximo 2)
    if (!leyesState.userOrder.includes(campo)) {
        if (leyesState.userOrder.length >= 2) {
            const masAntiguo = leyesState.userOrder.shift();
            leyesState.vals[masAntiguo] = '';
        }
        leyesState.userOrder.push(campo);
    }
}

function leyesQuickSet(campo, valor) {
    leyesSetFoco(campo);
    leyesPrepararEscritura(campo);
    leyesState.vals[campo] = valor;
    leyesRenderInputs();
    if (leyesState.userOrder.length === 2) {
        leyesCalcular();
    }
}

function leyesCambiarModo(modo) {
    leyesState.modo = modo;
    leyesLimpiarTodo();

    ['PRO', 'OHM', 'WATT'].forEach(m => {
        document.getElementById(`btn-leyes-${m}`).classList.remove('modo-activo');
    });
    document.getElementById(`btn-leyes-${modo}`).classList.add('modo-activo');

    const boxR = document.getElementById('leyes-box-r');
    const boxP = document.getElementById('leyes-box-p');
    const inst = document.getElementById('leyes-instruccion');

    if (modo === 'OHM') {
        boxR.style.display = 'block';
        boxP.style.display = 'none';
        inst.innerHTML = "<b>Ley de Ohm:</b> V = I × R (Ingresa 2 valores y presiona <b>=</b>)";
    } else if (modo === 'WATT') {
        boxR.style.display = 'none';
        boxP.style.display = 'block';
        inst.innerHTML = "<b>Ley de Watt:</b> P = V × I (Ingresa 2 valores y presiona <b>=</b>)";
    } else {
        boxR.style.display = 'block';
        boxP.style.display = 'block';
        inst.innerHTML = "Calculadora PRO: Ingresa <b>2</b> valores y presiona <b>=</b> para despejar el resto.";
    }
    leyesSetFoco('v');
}

function leyesTecla(val) {
    const k = leyesState.foco;
    if (!k) return;

    leyesPrepararEscritura(k);

    let str = leyesState.vals[k];
    if (val === '.' && str.includes('.')) return;
    if (str.length >= 9) return;

    if (str === '' && val === '.') str = '0.';
    else if (str === '0' && val !== '.') str = val;
    else str += val;

    leyesState.vals[k] = str;
    leyesRenderInputs();
}

function leyesBorrar() {
    const k = leyesState.foco;
    if (!k) return;
    if (leyesState.resuelto) {
        ['v', 'i', 'r', 'p'].forEach(key => {
            if (!leyesState.userOrder.includes(key)) leyesState.vals[key] = '';
        });
        leyesState.resuelto = false;
    }
    leyesState.sobreescribirFoco = false;
    leyesState.vals[k] = leyesState.vals[k].slice(0, -1);
    if (leyesState.vals[k] === '') {
        leyesState.userOrder = leyesState.userOrder.filter(item => item !== k);
    }
    leyesRenderInputs();
}

function leyesLimpiarCampoActivo() {
    const k = leyesState.foco;
    if (!k) return;
    leyesState.vals[k] = '';
    leyesState.userOrder = leyesState.userOrder.filter(item => item !== k);
    leyesState.resuelto = false;
    leyesState.sobreescribirFoco = false;
    leyesRenderInputs();
}

function leyesLimpiarTodo() {
    leyesState.vals = { v: '', i: '', r: '', p: '' };
    leyesState.userOrder = [];
    leyesState.resuelto = false;
    leyesState.sobreescribirFoco = false;
    leyesState.ultimoResumenTexto = '';
    leyesRenderInputs();
    document.getElementById('leyes-formula-box').innerHTML = `
        <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Fórmulas Aplicadas</span>
        Ingrese 2 magnitudes conocidas y presione <b>=</b> para ver el desarrollo.
    `;
    leyesSetFoco(leyesState.foco || 'v');
}

function leyesCalcular() {
    // Si ya estaba resuelto y el usuario vuelve a presionar '=', recalcula usando los 2 datos originales
    if (leyesState.resuelto && leyesState.userOrder.length === 2) {
        ['v', 'i', 'r', 'p'].forEach(key => {
            if (!leyesState.userOrder.includes(key)) leyesState.vals[key] = '';
        });
    }

    let v = parseFloat(leyesState.vals.v);
    let i = parseFloat(leyesState.vals.i);
    let r = parseFloat(leyesState.vals.r);
    let p = parseFloat(leyesState.vals.p);

    let v_ok = !isNaN(v);
    let i_ok = !isNaN(i);
    let r_ok = !isNaN(r);
    let p_ok = !isNaN(p);

    let activos = [v_ok, i_ok, r_ok, p_ok].filter(Boolean).length;

    if (activos < 2) {
        mostrarToast("Faltan Datos", "Debes ingresar exactamente 2 valores.", true);
        return;
    }
    if (activos > 2) {
        mostrarToast("Exceso de Datos", "Borra con 'C' e ingresa solo 2 valores.", true);
        return;
    }

    let f1 = '', f2 = '';
    let fOhm = '', fWatt = '';
    const fmt = n => Number(n.toFixed(2)).toString();

    try {
        if (v_ok && i_ok) {
            p = v * i;
            r = v / i;
            fOhm = `R = V / I = ${fmt(v)} / ${fmt(i)} = ${fmt(r)} Ω`;
            fWatt = `P = V × I = ${fmt(v)} × ${fmt(i)} = ${fmt(p)} W`;
            f1 = fWatt;
            f2 = fOhm;
        } else if (v_ok && r_ok) {
            i = v / r;
            p = (v * v) / r;
            fOhm = `I = V / R = ${fmt(v)} / ${fmt(r)} = ${fmt(i)} A`;
            fWatt = `P = V² / R = ${fmt(v)}² / ${fmt(r)} = ${fmt(p)} W`;
            f1 = fOhm;
            f2 = fWatt;
        } else if (v_ok && p_ok) {
            i = p / v;
            r = (v * v) / p;
            fWatt = `I = P / V = ${fmt(p)} / ${fmt(v)} = ${fmt(i)} A`;
            fOhm = `R = V² / P = ${fmt(v)}² / ${fmt(p)} = ${fmt(r)} Ω`;
            f1 = fWatt;
            f2 = fOhm;
        } else if (i_ok && r_ok) {
            v = i * r;
            p = (i * i) * r;
            fOhm = `V = I × R = ${fmt(i)} × ${fmt(r)} = ${fmt(v)} V`;
            fWatt = `P = I² × R = ${fmt(i)}² × ${fmt(r)} = ${fmt(p)} W`;
            f1 = fOhm;
            f2 = fWatt;
        } else if (i_ok && p_ok) {
            v = p / i;
            r = p / (i * i);
            fWatt = `V = P / I = ${fmt(p)} / ${fmt(i)} = ${fmt(v)} V`;
            fOhm = `R = P / I² = ${fmt(p)} / ${fmt(i)}² = ${fmt(r)} Ω`;
            f1 = fWatt;
            f2 = fOhm;
        } else if (r_ok && p_ok) {
            v = Math.sqrt(p * r);
            i = Math.sqrt(p / r);
            f1 = `V = √(P × R) = √(${fmt(p)} × ${fmt(r)}) = ${fmt(v)} V`;
            f2 = `I = √(P / R) = √(${fmt(p)} / ${fmt(r)}) = ${fmt(i)} A`;
            fOhm = f1;
            fWatt = f2;
        }

        if (!isFinite(v) || !isFinite(i) || !isFinite(r) || !isFinite(p)) {
            throw new Error("División por cero");
        }

        leyesState.vals.v = fmt(v);
        leyesState.vals.i = fmt(i);
        leyesState.vals.r = (leyesState.modo !== 'WATT') ? fmt(r) : '';
        leyesState.vals.p = (leyesState.modo !== 'OHM') ? fmt(p) : '';
        leyesState.resuelto = true;
        leyesState.sobreescribirFoco = true;

        leyesRenderInputs();

        const extraKw = p >= 1000 ? ` (${(p / 1000).toFixed(2)} kW)` : '';
        let htmlDesarrollo = `<span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Desarrollo Matemático (${leyesState.modo})</span>`;
        let textoDesarrollo = `CÁLCULO DE LEYES ELÉCTRICAS (Modo ${leyesState.modo})\n`;

        if (leyesState.modo === 'OHM') {
            htmlDesarrollo += `<b>${fOhm}</b>`;
            textoDesarrollo += `Fórmula y reemplazo:\n• ${fOhm}\n\nResultados:\n• Tensión (V): ${leyesState.vals.v} V\n• Corriente (A): ${leyesState.vals.i} A\n• Resistencia (Ω): ${leyesState.vals.r} Ω`;
        } else if (leyesState.modo === 'WATT') {
            htmlDesarrollo += `<b>${fWatt}${extraKw}</b>`;
            textoDesarrollo += `Fórmula y reemplazo:\n• ${fWatt}${extraKw}\n\nResultados:\n• Tensión (V): ${leyesState.vals.v} V\n• Corriente (A): ${leyesState.vals.i} A\n• Potencia (W): ${leyesState.vals.p} W${extraKw}`;
        } else {
            htmlDesarrollo += `• <b>${f1}${extraKw}</b><br>• <b>${f2}</b>`;
            textoDesarrollo += `Fórmulas y reemplazos:\n• ${f1}${extraKw}\n• ${f2}\n\nResultados:\n• Tensión (V): ${leyesState.vals.v} V\n• Corriente (A): ${leyesState.vals.i} A\n• Resistencia (Ω): ${leyesState.vals.r} Ω\n• Potencia (W): ${leyesState.vals.p} W${extraKw}`;
        }

        document.getElementById('leyes-formula-box').innerHTML = htmlDesarrollo;
        leyesState.ultimoResumenTexto = textoDesarrollo;

        registrarHistorialCalc(
            `Leyes Eléctricas (${leyesState.modo})`,
            `${leyesState.vals.v}V · ${leyesState.vals.i}A · ${leyesState.vals.p || '-'}W`,
            textoDesarrollo
        );

        mostrarToast("¡Cálculo Exitoso!", "Resultados despejados correctamente.");
    } catch (error) {
        mostrarToast("Error Matemático", "Operación imposible (verifique ceros).", true);
    }
}

// ==========================================================================
// 2. MÓDULO CAÍDA DE TENSIÓN (AEA 90364-5-52)
// ==========================================================================
let caidaActiveField = 'amp';
let caidaData = { amp: '', mts: '', vnom: '220', cosphi: '0.85', senphi: '0.53' };
let caidaUltimoResumen = '';

const tablaR = {
    'cu': { 1.0: 18.1, 1.5: 13.3, 2.5: 7.98, 4: 4.95, 6: 3.30, 10: 1.91, 16: 1.21, 25: 0.78, 35: 0.554, 50: 0.386, 70: 0.268, 95: 0.193 },
    'al': { 1.0: 30.1, 1.5: 21.0, 2.5: 12.6, 4: 7.82, 6: 5.21, 10: 3.08, 16: 1.91, 25: 1.20, 35: 0.868, 50: 0.641, 70: 0.443, 95: 0.320 }
};

function caidaSetActive(field) {
    caidaActiveField = field;
    document.querySelectorAll('#sec-caida .calc-box').forEach(el => el.classList.remove('active'));
    document.getElementById('caida-disp-cosphi').classList.remove('sub-active');
    document.getElementById('caida-disp-senphi').classList.remove('sub-active');

    if (field === 'cosphi' || field === 'senphi') {
        document.getElementById('caida-grp-phi').classList.add('active');
        document.getElementById('caida-disp-' + field).classList.add('sub-active');
    } else {
        const grp = document.getElementById('caida-grp-' + field);
        if (grp) grp.classList.add('active');
    }
}

function caidaQuickSet(field, valor) {
    caidaSetActive(field);
    caidaData[field] = valor;
    document.getElementById('caida-disp-' + field).innerText = valor;
    caidaCalc();
}

function caidaActualizarSistema() {
    const sisEl = document.querySelector('input[name="caida-sis"]:checked');
    if (sisEl) {
        if (sisEl.value === '1.732' && caidaData.vnom === '220') {
            caidaData.vnom = '380';
            document.getElementById('caida-disp-vnom').innerText = '380';
        } else if (sisEl.value === '2' && caidaData.vnom === '380') {
            caidaData.vnom = '220';
            document.getElementById('caida-disp-vnom').innerText = '220';
        }
    }
    caidaCalc();
}

function caidaSetSec(val) {
    document.getElementById('caida-disp-sec-sel').innerHTML = `<span>${val}</span> <i class="fa-solid fa-chevron-down" style="font-size: 0.65rem;"></i>`;
    document.getElementById('caida-sec-val').value = val;
    document.getElementById('detSec').removeAttribute('open');
    caidaUpdateTable();
}

function caidaSetPreset(cp, sp) {
    caidaData.cosphi = cp.toString();
    caidaData.senphi = sp.toString();
    document.getElementById('caida-disp-cosphi').innerText = cp;
    document.getElementById('caida-disp-senphi').innerText = sp;
    caidaCalc();

    if (cp === 0.30) {
        document.getElementById('modalArranque').classList.remove('oculto');
    }
}

function caidaCloseModal() {
    document.getElementById('modalArranque').classList.add('oculto');
    caidaSetActive('amp');
}

function caidaSincronizarTrig() {
    if (caidaActiveField === 'cosphi') {
        const c = parseFloat(caidaData.cosphi);
        if (!isNaN(c) && c >= 0 && c <= 1) {
            const s = Math.sqrt(Math.max(0, 1 - c * c)).toFixed(2);
            caidaData.senphi = s;
            document.getElementById('caida-disp-senphi').innerText = s;
        }
    } else if (caidaActiveField === 'senphi') {
        const s = parseFloat(caidaData.senphi);
        if (!isNaN(s) && s >= 0 && s <= 1) {
            const c = Math.sqrt(Math.max(0, 1 - s * s)).toFixed(2);
            caidaData.cosphi = c;
            document.getElementById('caida-disp-cosphi').innerText = c;
        }
    }
}

function caidaPress(num) {
    let val = caidaData[caidaActiveField];
    if (num === '.' && val.includes('.')) return;
    if (val.length >= 7) return;

    if (val === '0' && num !== '.') val = '';
    if (val === '' && num === '.') val = '0.';
    else val += num;

    caidaData[caidaActiveField] = val;
    document.getElementById('caida-disp-' + caidaActiveField).innerText = val;
    caidaSincronizarTrig();
    caidaCalc();
}

function caidaClearVal() {
    let val = caidaData[caidaActiveField];
    if (val.length > 0) {
        val = val.slice(0, -1);
        caidaData[caidaActiveField] = val;
        document.getElementById('caida-disp-' + caidaActiveField).innerText = val === '' ? '0' : val;
        caidaSincronizarTrig();
        caidaCalc();
    }
}

function caidaLimpiarCampoActivo() {
    caidaData[caidaActiveField] = '';
    document.getElementById('caida-disp-' + caidaActiveField).innerText = '0';
    caidaCalc();
}

function caidaResetAll() {
    caidaData = { amp: '', mts: '', vnom: '220', cosphi: '0.85', senphi: '0.53' };
    document.getElementById('caida-disp-amp').innerText = '0';
    document.getElementById('caida-disp-mts').innerText = '0';
    document.getElementById('caida-disp-vnom').innerText = '220';
    document.getElementById('caida-disp-cosphi').innerText = '0.85';
    document.getElementById('caida-disp-senphi').innerText = '0.53';
    
    caidaSetSec('2.5');
    document.getElementById('caida-pre-normal').checked = true;
    document.getElementById('caida-sis-mono').checked = true;
    document.getElementById('caida-mat-cu').checked = true;
    
    caidaUpdateTable();
    caidaSetActive('amp');
}

function caidaUpdateTable() {
    const m = document.querySelector('input[name="caida-mat"]:checked').value;
    const s = document.getElementById('caida-sec-val').value;
    document.getElementById('caida-disp-res').innerText = tablaR[m][s];
    caidaCalc();
}

function caidaCalc() {
    const sisEl = document.querySelector('input[name="caida-sis"]:checked');
    const matEl = document.querySelector('input[name="caida-mat"]:checked');
    const k = parseFloat(sisEl.value);
    const sisNombre = k === 2 ? 'Monofásico (k=2)' : 'Trifásico (k=√3)';
    const matKey = matEl.value;
    const matNombre = matKey === 'cu' ? 'Cobre' : 'Aluminio';
    const sec = document.getElementById('caida-sec-val').value;

    const Vn = parseFloat(caidaData.vnom) || 220;
    const I = parseFloat(caidaData.amp) || 0;
    const M = parseFloat(caidaData.mts) || 0;
    const R = parseFloat(document.getElementById('caida-disp-res').innerText);
    const X = 0.08; 
    const cp = parseFloat(caidaData.cosphi) || 0;
    const sp = parseFloat(caidaData.senphi) || 0;
    const statusBanner = document.getElementById('caida-aea-status');

    if (I <= 0 || M <= 0) {
        document.getElementById('caida-out-u').innerText = "0.00 V";
        document.getElementById('caida-out-pct').innerText = "0.00 %";
        document.getElementById('caida-out-fin').innerText = "0.00 V";
        if (statusBanner) {
            statusBanner.className = 'calc-status-pill';
            statusBanner.innerHTML = 'Norma AEA 90364-5-52: Máx. 3% Iluminación | 5% Fuerza Motriz | 15% Arranque';
        }
        document.getElementById('caida-formula-box').innerHTML = `
            <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Desarrollo ΔU (AEA 90364-5-52)</span>
            ΔU = k · I · L · (R · cos φ + X · sen φ)<br>
            <span style="color: var(--ngc-text-faded);">Ingrese Amperes (I) y Metros (L) para ver el reemplazo.</span>
        `;
        caidaUltimoResumen = '';
        return;
    }

    const L = M / 1000;
    const du = k * I * L * (R * cp + X * sp);
    const pc = (du / Vn) * 100;
    const vf = Vn - du;

    document.getElementById('caida-out-u').innerText = du.toFixed(2) + " V";
    document.getElementById('caida-out-pct').innerText = pc.toFixed(2) + " %";
    document.getElementById('caida-out-fin').innerText = vf.toFixed(2) + " V";

    // Evaluar cumplimiento AEA 90364-5-52 y sugerir sección mínima
    const esArranque = document.getElementById('caida-pre-motor')?.checked;
    const limiteObjetivo = esArranque ? 15 : 3;
    const seccionesComerciales = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95];
    let secSugerida = null;
    for (const sTest of seccionesComerciales) {
        const rTest = tablaR[matKey][sTest];
        const duTest = k * I * L * (rTest * cp + X * sp);
        const pcTest = (duTest / Vn) * 100;
        if (pcTest <= limiteObjetivo) {
            secSugerida = `${sTest} mm² (${pcTest.toFixed(2)}%)`;
            break;
        }
    }

    let estadoTexto = '';
    if (statusBanner) {
        if (esArranque) {
            if (pc <= 15) {
                statusBanner.className = 'calc-status-pill ok';
                estadoTexto = `CUMPLE AEA Arranque (≤ 15%)`;
            } else {
                statusBanner.className = 'calc-status-pill err';
                estadoTexto = `EXCEDE 15% Arranque · Sugerido: ${secSugerida || '> 95 mm²'}`;
            }
        } else {
            if (pc <= 3) {
                statusBanner.className = 'calc-status-pill ok';
                estadoTexto = `CUMPLE AEA ≤ 3% (Iluminación y Fuerza Motriz)`;
            } else if (pc <= 5) {
                statusBanner.className = 'calc-status-pill warn';
                estadoTexto = `VÁLIDO SOLO FUERZA (≤ 5%) · Para ≤ 3% usar ${secSugerida || '> 95 mm²'}`;
            } else {
                statusBanner.className = 'calc-status-pill err';
                estadoTexto = `FUERA DE NORMA (> 5%) · Mín. recomendada: ${secSugerida || '> 95 mm²'}`;
            }
        }
        statusBanner.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${estadoTexto}`;
    }

    const eqBase = `ΔU = k · I · L · (R · cos φ + X · sen φ)`;
    const eqReemp = `ΔU = ${k} · ${I} · ${L.toFixed(4)} · (${R} · ${cp} + ${X} · ${sp}) = ${du.toFixed(2)} V`;
    const eqPct = `ΔU% = (${du.toFixed(2)} / ${Vn}) · 100 = ${pc.toFixed(2)} % | U_llegada = ${vf.toFixed(2)} V`;

    document.getElementById('caida-formula-box').innerHTML = `
        <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Desarrollo ΔU (${sisNombre} - ${matNombre} ${sec}mm²)</span>
        ${eqBase}<br>
        <b>${eqReemp}</b><br>
        <span style="color: var(--success-green); font-weight: bold;">${eqPct}</span>
    `;

    caidaUltimoResumen = `CÁLCULO DE CAÍDA DE TENSIÓN (AEA 90364-5-52)\n` +
        `Sistema: ${sisNombre} | Conductor: ${matNombre} ${sec} mm² | V_nom: ${Vn} V\n` +
        `Distancia: ${M} m (${L.toFixed(4)} km) | Corriente: ${I} A | cos φ: ${cp} | sen φ: ${sp}\n` +
        `Diagnóstico AEA: ${estadoTexto}\n\n` +
        `Fórmula:\n${eqBase}\n\n` +
        `Reemplazo de valores:\n${eqReemp}\n${eqPct}`;
        }

// ==========================================================================
// 3. MÓDULO BALANCE TÉRMICO EN TABLEROS (AEA 770)
// ==========================================================================
const termState = {
    activeField: 'val',
    phase: 'mono',
    inputs: { val: '0', aux: '0' },
    cabeceras: [],
    salidas: [],
    ultimoResumen: ''
};

const tableDissipation = [
    { max: 10, w: 3 }, { max: 16, w: 3.5 }, { max: 25, w: 4.5 },
    { max: 32, w: 6 }, { max: 40, w: 7.5 }, { max: 50, w: 9 },
    { max: 63, w: 13 }, { max: 100, w: 15 }, { max: 125, w: 20 }
];

function termGetWatts(amps) {
    const entry = tableDissipation.find(e => amps <= e.max);
    return entry ? entry.w : 20;
}

function termSetFocus(fieldId) {
    termState.activeField = fieldId;
    document.querySelectorAll('#sec-termico .calc-box').forEach(el => el.classList.remove('active'));
    document.getElementById(`term-in-${fieldId}`).classList.add('active');
}

function termSetPhase(p) {
    termState.phase = p;
    termCalculate();
}

function termQuickAdd(amps) {
    termState.salidas.push(amps);
    termUpdateList();
    termCalculate();
}

function termDuplicateItem(type, index) {
    if (type === 'CAB') {
        const val = termState.cabeceras[index];
        if (val !== undefined) termState.cabeceras.push(val);
    } else {
        const val = termState.salidas[index];
        if (val !== undefined) termState.salidas.push(val);
    }
    termUpdateList();
    termCalculate();
}

function termPress(n) {
    let currentString = termState.inputs[termState.activeField];
    if (n === '.' && currentString.includes('.')) return;
    if (currentString.length >= 6) return;

    if (currentString === "0" && n !== '.') currentString = n;
    else if (currentString === "" && n === '.') currentString = "0.";
    else currentString += n;

    termState.inputs[termState.activeField] = currentString;
    document.getElementById(`term-v-${termState.activeField}`).innerText = currentString;
    termCalculate();
}

function termDel() {
    let currentString = termState.inputs[termState.activeField];
    if (currentString.length > 1) currentString = currentString.slice(0, -1);
    else currentString = "0";

    if (currentString === "0.") currentString = "0";
    termState.inputs[termState.activeField] = currentString;
    document.getElementById(`term-v-${termState.activeField}`).innerText = currentString;
    termCalculate();
}

function termLimpiarCampoActivo() {
    termState.inputs[termState.activeField] = "0";
    document.getElementById(`term-v-${termState.activeField}`).innerText = "0";
    termCalculate();
}

function termAddItem(type) {
    const val = parseFloat(termState.inputs.val);
    if (val > 0) {
        if (type === 'CAB') termState.cabeceras.push(val);
        else termState.salidas.push(val);
        
        termState.inputs.val = "0";
        document.getElementById('term-v-val').innerText = "0";
        
        termUpdateList();
        termCalculate();
    } else {
        mostrarToast("Valor Inválido", "Ingresa los Amperes del dispositivo antes de añadir.", true);
    }
}

function termRemoveItem(type, index) {
    if (type === 'CAB') termState.cabeceras.splice(index, 1);
    else termState.salidas.splice(index, 1);
    termUpdateList();
    termCalculate();
}

function termUpdateList() {
    const container = document.getElementById('term-circ-list');
    const poles = (termState.phase === 'mono') ? 2 : 4;

    if (termState.cabeceras.length === 0 && termState.salidas.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 10px; font-size: 0.78rem; color: var(--ngc-text-faded);">Tablero vacío</div>';
        return;
    }
    
    let html = "";
    termState.cabeceras.forEach((v, i) => {
        const wPolo = termGetWatts(v);
        html += `<div class="circuit-item">
            <span><span class="tag-cab">CAB</span> <b>${v}A</b> <small style="color:var(--ngc-text-faded);">(${wPolo}W/polo × ${poles}P)</small></span>
            <div data-html2canvas-ignore="true" style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="calc-dup-btn" onclick="termDuplicateItem('CAB', ${i})" title="Duplicar">+1</button>
                <span style="color:var(--error-red); cursor:pointer; font-weight:bold; padding: 0 4px;" onclick="termRemoveItem('CAB', ${i})">✕</span>
            </div>
        </div>`;
    });
    termState.salidas.forEach((v, i) => {
        const wPolo = termGetWatts(v);
        html += `<div class="circuit-item">
            <span><span class="tag-pia">PIA</span> <b>${v}A</b> <small style="color:var(--ngc-text-faded);">(${wPolo}W/polo × ${poles}P)</small></span>
            <div data-html2canvas-ignore="true" style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="calc-dup-btn" onclick="termDuplicateItem('PIA', ${i})" title="Duplicar">+1</button>
                <span style="color:var(--error-red); cursor:pointer; font-weight:bold; padding: 0 4px;" onclick="termRemoveItem('PIA', ${i})">✕</span>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function termCalculate() {
    let k = 1;
    const n = termState.salidas.length;
    if (n >= 2 && n <= 3) k = 0.8;
    else if (n >= 4 && n <= 5) k = 0.7;
    else if (n >= 6 && n <= 9) k = 0.6;
    else if (n >= 10) k = 0.5;

    const ke = 0.85; 
    const poles = (termState.phase === 'mono') ? 2 : 4;
    const sisTexto = termState.phase === 'mono' ? 'Monofásico (2 Polos)' : 'Trifásico (4 Polos)';

    let p_cab_total = 0;
    termState.cabeceras.forEach(amp => { 
        p_cab_total += (termGetWatts(amp) * poles * (ke ** 2)); 
    });

    let p_sal_total = 0;
    termState.salidas.forEach(amp => { 
        p_sal_total += (termGetWatts(amp) * poles * (k ** 2)); 
    });

    const p_aux = parseFloat(termState.inputs.aux) || 0;
    const ptot = ((p_cab_total + p_sal_total) * 1.2) + p_aux;
    const sugGabinete = Math.ceil(ptot * 1.1);

    document.getElementById('term-res-ptot').innerText = ptot.toFixed(1);
    document.getElementById('term-rec-box').innerText = `Gabinete: > ${sugGabinete} W`;

    termUpdateList();

    if (termState.cabeceras.length === 0 && termState.salidas.length === 0 && p_aux === 0) {
        document.getElementById('term-math-breakdown').innerHTML = `
            <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Desglose del Cálculo</span>
            Agregue cabeceras o salidas para calcular...
        `;
        termState.ultimoResumen = '';
        return;
    }

    const eqBase = `P_tot = (P_cab + P_sal) · 1.2 + P_aux`;
    const eqReemp = `P_tot = (${p_cab_total.toFixed(2)} + ${p_sal_total.toFixed(2)}) · 1.2 + ${p_aux} = ${ptot.toFixed(1)} W`;

    document.getElementById('term-math-breakdown').innerHTML = `
        <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> Desglose Térmico (${sisTexto})</span>
        • Cabeceras (${termState.cabeceras.length} ud, Ke=${ke}): <b>${p_cab_total.toFixed(2)} W</b><br>
        • Salidas (${termState.salidas.length} ud, K=${k}): <b>${p_sal_total.toFixed(2)} W</b><br>
        • Fórmula: ${eqBase}<br>
        • Reemplazo: <b>${eqReemp}</b><br>
        • Gabinete recomendado (+10%): <b style="color: var(--success-green);">> ${sugGabinete} W</b>
    `;

    const listaCabTxt = termState.cabeceras.length ? termState.cabeceras.map(a => `${a}A`).join(', ') : 'Ninguna';
    const listaSalTxt = termState.salidas.length ? termState.salidas.map(a => `${a}A`).join(', ') : 'Ninguna';

    termState.ultimoResumen = `CÁLCULO DE BALANCE TÉRMICO EN TABLERO (AEA 770)\n` +
        `Sistema: ${sisTexto}\n` +
        `Cabeceras (${termState.cabeceras.length} ud, Ke=${ke}): [${listaCabTxt}] -> ${p_cab_total.toFixed(2)} W\n` +
        `Salidas (${termState.salidas.length} ud, K=${k}): [${listaSalTxt}] -> ${p_sal_total.toFixed(2)} W\n` +
        `Auxiliares (P_aux): ${p_aux} W\n\n` +
        `Fórmula:\n${eqBase}\n\n` +
        `Reemplazo de valores:\n${eqReemp}\n` +
        `Sugerencia Gabinete: > ${sugGabinete} W`;
}

function termResetAll() {
    termState.cabeceras = [];
    termState.salidas = [];
    termState.inputs.val = "0";
    termState.inputs.aux = "0";
    document.getElementById('term-v-val').innerText = "0";
    document.getElementById('term-v-aux').innerText = "0";
    document.getElementById('term-phase-mono').checked = true;
    termState.phase = 'mono';
    termUpdateList();
    termCalculate();
    termSetFocus('val');
      }

// ==========================================================================
// 4. MÓDULO POTENCIA, MOTORES Y CAPACITORES
// ==========================================================================
let potActiveCat = 'mono';
let potActiveF = '';
let potCurrentVals = {};
let potSelectedEqId = '';
let potPersistentStore = {};
let potUltimoResumen = '';
let potMotUnit = 'W'; // 'W' | 'kW' | 'HP'

const SQRT3 = Math.sqrt(3);

const potLabelsMap = {
    U: 'Tensión U (V)',
    I: 'Corriente I (A)',
    cos: 'cos φ',
    sen: 'sen φ',
    P: 'Potencia P',
    n: 'Rend. η',
    tg1: 'tg φ1 (Ini)',
    tg2: 'tg φ2 (Fin)'
};

function potGetMotorWatts(rawP) {
    if (potMotUnit === 'kW') return rawP * 1000;
    if (potMotUnit === 'HP') return rawP * 745.7;
    return rawP;
}

const potDb = {
    mono: {
        catName: "Sistemas Monofásicos",
        desc: "<b>Potencias Monofásicas:</b> Cargas conectadas entre fase y neutro (220V). La activa es trabajo útil; la reactiva oscila en la red.",
        eqs: {
            p_m: {
                n: "Potencia Activa (W)", unit: "W", short: "Activa (W)",
                f_txt: "P = U · I · cos φ",
                v: { U: 220, I: 0, cos: 0.85 },
                f: d => d.U * d.I * d.cos,
                sub: (d, r) => `P = ${d.U} · ${d.I} · ${d.cos} = ${r.toFixed(2)} W`
            },
            s_m: {
                n: "Potencia Aparente (VA)", unit: "VA", short: "Aparente (VA)",
                f_txt: "S = U · I",
                v: { U: 220, I: 0 },
                f: d => d.U * d.I,
                sub: (d, r) => `S = ${d.U} · ${d.I} = ${r.toFixed(2)} VA`
            },
            q_m: {
                n: "Potencia Reactiva (VAr)", unit: "VAr", short: "Reactiva (VAr)",
                f_txt: "Q = U · I · sen φ",
                v: { U: 220, I: 0, sen: 0.53 },
                f: d => d.U * d.I * d.sen,
                sub: (d, r) => `Q = ${d.U} · ${d.I} · ${d.sen} = ${r.toFixed(2)} VAr`
            }
        }
    },
    tri: {
        catName: "Sistemas Trifásicos",
        desc: "<b>Sistemas Trifásicos (380V):</b> Se introduce √3 (1.732) para compensar el desfase entre las tres fases.",
        eqs: {
            p_t: {
                n: "Potencia Activa (W)", unit: "W", short: "Activa (W)",
                f_txt: "P = √3 · U · I · cos φ",
                v: { U: 380, I: 0, cos: 0.85 },
                f: d => SQRT3 * d.U * d.I * d.cos,
                sub: (d, r) => `P = 1.732 · ${d.U} · ${d.I} · ${d.cos} = ${r.toFixed(2)} W`
            },
            s_t: {
                n: "Potencia Aparente (VA)", unit: "VA", short: "Aparente (VA)",
                f_txt: "S = √3 · U · I",
                v: { U: 380, I: 0 },
                f: d => SQRT3 * d.U * d.I,
                sub: (d, r) => `S = 1.732 · ${d.U} · ${d.I} = ${r.toFixed(2)} VA`
            },
            q_t: {
                n: "Potencia Reactiva (VAr)", unit: "VAr", short: "Reactiva (VAr)",
                f_txt: "Q = √3 · U · I · sen φ",
                v: { U: 380, I: 0, sen: 0.53 },
                f: d => SQRT3 * d.U * d.I * d.sen,
                sub: (d, r) => `Q = 1.732 · ${d.U} · ${d.I} · ${d.sen} = ${r.toFixed(2)} VAr`
            }
        }
    },
    mot: {
        catName: "Cálculo de Motores Eléctricos",
        desc: "<b>Cálculo de Motores:</b> Determina la corriente nominal según la potencia mecánica (P) y el rendimiento (η).",
        eqs: {
            i_mm: {
                n: "Corriente Motor Monofásico (A)", unit: "A", short: "Motor Mono [A]",
                f_txt: "I = P / (U · η · cos φ)",
                v: { P: 1500, U: 220, n: 0.85, cos: 0.8 },
                f: d => potGetMotorWatts(d.P) / (d.U * d.n * d.cos),
                sub: (d, r) => {
                    const pw = potGetMotorWatts(d.P);
                    const conv = potMotUnit !== 'W' ? ` [${d.P} ${potMotUnit} = ${pw.toFixed(0)} W]` : '';
                    return `I = ${pw.toFixed(0)}${conv} / (${d.U} · ${d.n} · ${d.cos}) = ${r.toFixed(2)} A`;
                }
            },
            i_mt: {
                n: "Corriente Motor Trifásico (A)", unit: "A", short: "Motor Trif [A]",
                f_txt: "I = P / (√3 · U · η · cos φ)",
                v: { P: 5500, U: 380, n: 0.88, cos: 0.82 },
                f: d => potGetMotorWatts(d.P) / (SQRT3 * d.U * d.n * d.cos),
                sub: (d, r) => {
                    const pw = potGetMotorWatts(d.P);
                    const conv = potMotUnit !== 'W' ? ` [${d.P} ${potMotUnit} = ${pw.toFixed(0)} W]` : '';
                    return `I = ${pw.toFixed(0)}${conv} / (1.732 · ${d.U} · ${d.n} · ${d.cos}) = ${r.toFixed(2)} A`;
                }
            }
        }
    },
    cap: {
        catName: "Corrección de Factor de Potencia",
        desc: "<b>Corrección cos φ (50Hz, ω = 314.16):</b> Calcula el capacitor en µF para compensar energía reactiva.",
        eqs: {
            c_uf: {
                n: "Capacidad Requerida (µF)", unit: "µF", short: "Capacidad (µF)",
                f_txt: "C = [P · (tg φ1 - tg φ2) · 10⁶] / (ω · U²)",
                v: { P: 1000, tg1: 0.75, tg2: 0.33, U: 220 },
                f: d => (d.P * (d.tg1 - d.tg2) * 1000000) / (314.16 * Math.pow(d.U, 2)),
                sub: (d, r) => `C = [${d.P} · (${d.tg1} - ${d.tg2}) · 10⁶] / (314.16 · ${d.U}²) = ${r.toFixed(2)} µF`
            }
        }
    }
};

function potSetMotUnit(unit) {
    potMotUnit = unit;
    potRenderHelperBar();
    potRenderInputs();
}

function potQuickMotorHP(hp) {
    potMotUnit = 'HP';
    potCurrentVals.P = hp.toString();
    potPersistentStore[`${potActiveCat}_P`] = hp.toString();
    potRenderHelperBar();
    potRenderInputs();
}

function potQuickSet(field, valor) {
    if (potCurrentVals[field] === undefined) return;
    potCurrentVals[field] = valor;
    potPersistentStore[`${potActiveCat}_${field}`] = valor;
    const el = document.getElementById('pot-v-' + field);
    if (el) el.innerText = valor;
    potCalc();
}

function potQuickCapIni(cosIni) {
    const tg1 = Math.tan(Math.acos(cosIni)).toFixed(2);
    potCurrentVals.tg1 = tg1;
    potPersistentStore[`${potActiveCat}_tg1`] = tg1;
    const el = document.getElementById('pot-v-tg1');
    if (el) el.innerText = tg1;
    potCalc();
}

function potQuickCapTarget(cosFin, tg2Val) {
    potCurrentVals.tg2 = tg2Val.toString();
    potPersistentStore[`${potActiveCat}_tg2`] = tg2Val.toString();
    const el = document.getElementById('pot-v-tg2');
    if (el) el.innerText = tg2Val.toString();
    potCalc();
}

function potRenderHelperBar() {
    const bar = document.getElementById('pot-helper-bar');
    if (!bar) return;

    if (potActiveCat === 'mot') {
        bar.classList.remove('oculto');
        bar.innerHTML = `
            <span style="color: var(--ngc-text-faded); font-weight: 600;">Unidad de Potencia P:</span>
            <div class="calc-mini-pills">
                <button type="button" class="calc-mini-pill ${potMotUnit === 'W' ? 'active' : ''}" onclick="potSetMotUnit('W')">Watts (W)</button>
                <button type="button" class="calc-mini-pill ${potMotUnit === 'kW' ? 'active' : ''}" onclick="potSetMotUnit('kW')">kW</button>
                <button type="button" class="calc-mini-pill ${potMotUnit === 'HP' ? 'active' : ''}" onclick="potSetMotUnit('HP')">HP</button>
            </div>
        `;
    } else if (potActiveCat === 'cap') {
        bar.classList.remove('oculto');
        bar.innerHTML = `
            <span style="color: var(--ngc-text-faded); font-weight: 600;">cos φ1 inicial → tg φ1:</span>
            <div class="calc-mini-pills">
                <button type="button" class="calc-mini-pill" onclick="potQuickCapIni(0.65)">0.65</button>
                <button type="button" class="calc-mini-pill" onclick="potQuickCapIni(0.75)">0.75</button>
                <button type="button" class="calc-mini-pill" onclick="potQuickCapIni(0.80)">0.80</button>
                <button type="button" class="calc-mini-pill" onclick="potQuickCapIni(0.85)">0.85</button>
            </div>
        `;
    } else {
        bar.classList.add('oculto');
        bar.innerHTML = '';
    }
}

function potUpdateCat(catId) {
    potActiveCat = catId;
    document.querySelectorAll('#sec-potencia .nav-calc-btn').forEach(c => c.classList.remove('modo-activo'));
    document.getElementById('pot-card-' + catId).classList.add('modo-activo');
    
    const subArea = document.getElementById('pot-sub-selectors');
    subArea.innerHTML = '';
    
    const eqKeys = Object.keys(potDb[catId].eqs);
    subArea.className = 'sub-cat-grid' + (eqKeys.length === 2 ? ' cols-2' : (eqKeys.length === 1 ? ' cols-1' : ''));

    eqKeys.forEach((k, idx) => {
        let btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'corp-btn' + (idx === 0 ? ' modo-activo' : '');
        btn.style.fontSize = '0.75rem';
        btn.style.padding = '9px 6px';
        btn.innerText = potDb[catId].eqs[k].short;
        
        if (idx === 0) potSelectedEqId = k;
        
        btn.onclick = () => {
            potSelectedEqId = k;
            document.querySelectorAll('#pot-sub-selectors .corp-btn').forEach(b => b.classList.remove('modo-activo'));
            btn.classList.add('modo-activo');
            potRenderInputs();
        };
        
        subArea.appendChild(btn);
    });
    
    potRenderHelperBar();
    potRenderInputs();
    if (calcActiva === 'potencia') renderQuickStrip();
}

function potRenderInputs() {
    const eq = potDb[potActiveCat].eqs[potSelectedEqId];
    const area = document.getElementById('pot-input-area');
    area.innerHTML = '';
    potCurrentVals = {};
    
    Object.keys(eq.v).forEach((k, i) => {
        const storeKey = `${potActiveCat}_${k}`;
        if (potPersistentStore[storeKey] !== undefined) {
            potCurrentVals[k] = potPersistentStore[storeKey];
        } else {
            potCurrentVals[k] = eq.v[k].toString();
        }
        
        let div = document.createElement('div');
        div.className = 'flex-1 calc-box' + (i === 0 ? ' active' : '');
        div.onclick = () => {
            potActiveF = k;
            document.querySelectorAll('#pot-input-area .calc-box').forEach(x => x.classList.remove('active'));
            div.classList.add('active');
        };
        
        let labelTxt = potLabelsMap[k] || k.toUpperCase();
        if (k === 'P') {
            labelTxt = potActiveCat === 'mot' ? `Potencia (${potMotUnit})` : 'Potencia P (W)';
        }
        div.innerHTML = `<label>${labelTxt}</label><span id="pot-v-${k}" class="calc-val">${potCurrentVals[k]}</span>`;
        area.appendChild(div);
        
        if (i === 0) potActiveF = k;
    });
    
    document.getElementById('pot-res-label').innerText = eq.n;
    potCalc();
}

function potPress(n) {
    let val = potCurrentVals[potActiveF];
    if (n === '.' && val.includes('.')) return;
    if (val.length >= 7) return;

    if (val === '0' && n !== '.') val = '';
    if (val === '' && n === '.') val = '0.';
    else val += n;

    potCurrentVals[potActiveF] = val;
    potPersistentStore[`${potActiveCat}_${potActiveF}`] = val;
    document.getElementById('pot-v-' + potActiveF).innerText = val;
    potCalc();
}

function potDel() {
    let val = potCurrentVals[potActiveF].toString();
    if (val.length > 1) val = val.slice(0, -1);
    else val = '0';

    potCurrentVals[potActiveF] = val;
    potPersistentStore[`${potActiveCat}_${potActiveF}`] = val;
    document.getElementById('pot-v-' + potActiveF).innerText = val;
    potCalc();
}

function potLimpiarCampoActivo() {
    potCurrentVals[potActiveF] = '0';
    potPersistentStore[`${potActiveCat}_${potActiveF}`] = '0';
    document.getElementById('pot-v-' + potActiveF).innerText = '0';
    potCalc();
}

function potCalc() {
    const eq = potDb[potActiveCat].eqs[potSelectedEqId];
    const d = {};
    Object.keys(potCurrentVals).forEach(k => d[k] = parseFloat(potCurrentVals[k]) || 0);
    
    const rawRes = eq.f(d);
    const resVal = isFinite(rawRes) ? rawRes : 0;
    const resStr = `${resVal.toFixed(2)} ${eq.unit}`;

    document.getElementById('pot-main-result').innerText = resStr;

    const eqSub = isFinite(rawRes) ? eq.sub(d, resVal) : 'Complete los divisores distintos de cero.';
    document.getElementById('pot-formula-info').innerHTML = `
        <span class="formula-title"><i class="fa-solid fa-square-root-variable"></i> ${eq.n}</span>
        Fórmula: <b>${eq.f_txt}</b><br>
        Reemplazo: <b style="color: var(--success-green);">${eqSub}</b><br>
        <div style="margin-top: 6px; font-size: 0.72rem; color: var(--ngc-text-faded);">${potDb[potActiveCat].desc}</div>
    `;

    potUltimoResumen = `CÁLCULO DE ${potDb[potActiveCat].catName.toUpperCase()} - ${eq.n.toUpperCase()}\n` +
        `Fórmula:\n${eq.f_txt}\n\n` +
        `Reemplazo de valores:\n${eqSub}\n\n` +
        `Resultado Final: ${resStr}`;
}

function potResetAll() {
    potPersistentStore = {};
    potMotUnit = 'W';
    potUpdateCat('mono');
                      }

// ==========================================================================
// 5. COPIADO, WHATSAPP, HISTORIAL LOCAL Y CAPTURA PNG
// ==========================================================================
function obtenerTextoResumenActivo() {
    if (calcActiva === 'leyes') return leyesState.ultimoResumenTexto;
    if (calcActiva === 'caida') return caidaUltimoResumen;
    if (calcActiva === 'termico') return termState.ultimoResumen;
    if (calcActiva === 'potencia') return potUltimoResumen;
    return '';
}

function copiarFormula() {
    const textoCopiar = obtenerTextoResumenActivo();
    if (!textoCopiar) {
        mostrarToast("Sin Cálculo", "Realiza un cálculo primero para copiar su fórmula.", true);
        return;
    }

    const textoFinal = `${textoCopiar}\n\n— Calculado con Villaser Gestión`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textoFinal)
            .then(() => mostrarToast("Fórmula Copiada", "Fórmula y valores copiados al portapapeles."))
            .catch(() => copiarFallback(textoFinal));
    } else {
        copiarFallback(textoFinal);
    }
}

function copiarFallback(texto) {
    const textArea = document.createElement("textarea");
    textArea.value = texto;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        mostrarToast("Fórmula Copiada", "Fórmula y valores copiados al portapapeles.");
    } catch (err) {
        mostrarToast("Error", "No se pudo copiar el texto.", true);
    }
    document.body.removeChild(textArea);
}

function enviarWhatsAppCalc() {
    const textoCopiar = obtenerTextoResumenActivo();
    if (!textoCopiar) {
        mostrarToast("Sin Cálculo", "Realiza un cálculo primero para compartirlo.", true);
        return;
    }
    const mensaje = encodeURIComponent(`*VILLASER GESTIÓN — CÁLCULO TÉCNICO*\n\n${textoCopiar}`);
    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
}

// --- HISTORIAL DE CÁLCULOS EN LOCALSTORAGE ---
function obtenerHistorialCalc() {
    try {
        return JSON.parse(localStorage.getItem(CALC_HISTORIAL_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function registrarHistorialCalc(modulo, resumenCorto, textoCompleto) {
    if (!textoCompleto) return;
    const lista = obtenerHistorialCalc();
    // Evitar duplicados consecutivos idénticos
    if (lista.length > 0 && lista[0].texto === textoCompleto) return;

    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const fecha = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

    lista.unshift({
        id: Date.now(),
        modulo,
        resumen: resumenCorto,
        texto: textoCompleto,
        fechaHora: `${fecha} ${hora}`
    });

    localStorage.setItem(CALC_HISTORIAL_KEY, JSON.stringify(lista.slice(0, 15)));
}

function abrirModalHistorial() {
    const modal = document.getElementById('modalHistorialCalc');
    const cont = document.getElementById('listaHistorialCalc');
    if (!modal || !cont) return;

    const lista = obtenerHistorialCalc();
    if (lista.length === 0) {
        cont.innerHTML = `<div style="text-align:center; padding:24px 12px; color:var(--ngc-text-faded); font-size:0.85rem;">Todavía no hay cálculos guardados en el historial.</div>`;
    } else {
        cont.innerHTML = lista.map((item, idx) => `
            <div class="modal-list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="font-size:0.7rem; font-weight:700; color:var(--ngc-neon); text-transform:uppercase;">${item.modulo}</span>
                    <small>${item.fechaHora}</small>
                </div>
                <h4 style="font-size:0.92rem;">${item.resumen}</h4>
                <div style="display:flex; gap:6px; margin-top:2px;">
                    <button type="button" class="corp-btn-small flex-1" onclick="copiarItemHistorial(${idx})">
                        <i class="fa-regular fa-copy"></i> Copiar
                    </button>
                    <button type="button" class="corp-btn-small flex-1" style="color:var(--success-green); background:rgba(49,162,76,0.12);" onclick="wspItemHistorial(${idx})">
                        <i class="fa-brands fa-whatsapp"></i> Enviar
                    </button>
                </div>
            </div>
        `).join('');
    }

    modal.classList.remove('oculto');
}

function cerrarModalHistorial() {
    document.getElementById('modalHistorialCalc')?.classList.add('oculto');
}

function copiarItemHistorial(idx) {
    const item = obtenerHistorialCalc()[idx];
    if (!item) return;
    const textoFinal = `${item.texto}\n\n— Calculado con Villaser Gestión`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textoFinal)
            .then(() => mostrarToast("Copiado", "Cálculo del historial copiado."))
            .catch(() => copiarFallback(textoFinal));
    } else {
        copiarFallback(textoFinal);
    }
}

function wspItemHistorial(idx) {
    const item = obtenerHistorialCalc()[idx];
    if (!item) return;
    const mensaje = encodeURIComponent(`*VILLASER GESTIÓN — CÁLCULO TÉCNICO*\n\n${item.texto}`);
    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
}

function limpiarHistorialCalc() {
    localStorage.removeItem(CALC_HISTORIAL_KEY);
    abrirModalHistorial();
    mostrarToast("Historial Vacío", "Se eliminaron los registros guardados.");
}

async function capturarResultado() {
    if (typeof html2canvas === 'undefined') {
        mostrarToast("Error", "Librería de captura no disponible.", true);
        return;
    }

    const zona = document.getElementById('zonaCaptura');
    if (!zona) return;

    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
    const bgColor = isLightMode ? "#ffffff" : "#242526";
    const oldBg = zona.style.backgroundColor;
    const oldPadding = zona.style.padding;

    zona.style.backgroundColor = bgColor;
    zona.style.padding = "14px";

    try {
        const scrollY = window.scrollY;
        window.scrollTo(0, 0);

        const canvas = await html2canvas(zona, {
            backgroundColor: bgColor,
            scale: 2,
            useCORS: true,
            scrollY: 0
        });

        window.scrollTo(0, scrollY);

        const nombresArchivo = {
            leyes: 'Leyes_Electricas',
            caida: 'Caida_Tension',
            termico: 'Balance_Termico',
            potencia: 'Potencia_Motores'
        };
        const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        const link = document.createElement('a');
        link.download = `Villaser_${nombresArchivo[calcActiva]}_${fecha}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        mostrarToast("Captura Descargada", "Imagen guardada lista para tu informe.");
    } catch (e) {
        console.error(e);
        mostrarToast("Error de Captura", "No se pudo generar la imagen.", true);
    } finally {
        zona.style.backgroundColor = oldBg;
        zona.style.padding = oldPadding;
    }
}

// ==========================================================================
// SOPORTE DE TECLADO FÍSICO (PC / TABLET) Y CIERRE DE DESPLEGABLES
// ==========================================================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!document.getElementById('modalHistorialCalc')?.classList.contains('oculto')) {
        if (e.key === 'Escape') cerrarModalHistorial();
        return;
    }
    if (!document.getElementById('modalArranque')?.classList.contains('oculto')) {
        if (e.key === 'Escape' || e.key === 'Enter') caidaCloseModal();
        return;
    }

    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        numpadTecla(e.key);
    } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        numpadTecla('.');
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        numpadBorrar();
    } else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault();
        numpadLimpiarCampo();
    } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        numpadCalcular();
    }
});

document.addEventListener('click', (e) => {
    const detSec = document.getElementById('detSec');
    if (detSec && detSec.hasAttribute('open') && !detSec.contains(e.target)) {
        detSec.removeAttribute('open');
    }
});

// ==========================================================================
// INICIALIZACIÓN DE TODOS LOS SUB-MÓDULOS AL CARGAR
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    leyesSetFoco('v');
    leyesRenderInputs();

    caidaUpdateTable();
    caidaSetActive('amp');

    termUpdateList();
    termCalculate();
    termSetFocus('val');

    potUpdateCat('mono');
    renderQuickStrip();
});

// ==========================================
// MENÚ INFERIOR SCROLL (MATCH GLOBAL)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (new URLSearchParams(window.location.search).get('modal') === '1') return;

    const footer = document.getElementById('corpFooterMenu'); if (!footer) return;
    const modulos = [
        { nombre: 'Inicio', icon: 'fa-house', url: '../index.html' },
        { nombre: 'Presupuestos', icon: 'fa-file-invoice-dollar', url: '../presupuesto/index.html' },
        { nombre: 'Materiales', icon: 'fa-boxes-stacked', url: '../materiales/index.html' },
        { nombre: 'Informes', icon: 'fa-clipboard-check', url: '../informes/index.html' },
        { nombre: 'Potencia', icon: 'fa-bolt', url: '../potencia/index.html' },
        { nombre: 'Unifilar', icon: 'fa-diagram-project', url: '../unifilar/index.html' },
        { nombre: 'Topográfico', icon: 'fa-table-cells', url: '../topografico/index.html' },
        { nombre: 'Agenda', icon: 'fa-address-book', url: '../agenda/index.html' },
        { nombre: 'Mano de Obra', icon: 'fa-hand-holding-dollar', url: '../costos/index.html' },
        { nombre: 'Calculadora', icon: 'fa-calculator', url: '#', active: true },
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
});
