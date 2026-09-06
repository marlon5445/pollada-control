'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Image from 'next/image'
import Swal from 'sweetalert2'
import { PlusCircle, Trash2, ArrowRight, Settings, CheckCircle2, Ticket, Users, LayoutGrid, CreditCard, XCircle, MousePointerSquareDashed } from 'lucide-react'

export default function AppPollada() {
  const [view, setView] = useState('loading') 
  const [configurado, setConfigurado] = useState(false)
  
  const [tarjetas, setTarjetas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  
  const [precio, setPrecio] = useState(15)
  const [usarRango, setUsarRango] = useState(false)
  const [cantidadNormal, setCantidadNormal] = useState(50)
  const [rangoInicio, setRangoInicio] = useState('001')
  const [rangoFin, setRangoFin] = useState('050')

  const [rangoSelInicio, setRangoSelInicio] = useState('')
  const [rangoSelFin, setRangoSelFin] = useState('')

  const saasSwal = Swal.mixin({
    background: '#1a1d24',
    color: '#ffffff',
    customClass: {
      popup: 'border border-[#2a2d36] rounded-2xl',
      title: 'text-2xl font-bold text-white',
      htmlContainer: 'text-gray-400',
      confirmButton: 'bg-[#00e5ff] text-black font-bold px-6 py-2.5 rounded-lg hover:bg-[#00b2cc] mx-2',
      cancelButton: 'bg-[#2a2d36] text-white font-bold px-6 py-2.5 rounded-lg hover:bg-[#363a45] mx-2',
      input: 'bg-[#0f1115] border border-[#2a2d36] text-white rounded-lg p-3 mt-4 w-full focus:outline-none focus:border-[#00e5ff]'
    },
    buttonsStyling: false
  })

  useEffect(() => {
    verificarConfiguracion()
  }, [])

  async function verificarConfiguracion() {
    const { data } = await supabase.from('configuracion_evento').select('*').single()
    if (data && data.configurado) {
      setConfigurado(true)
      setPrecio(data.precio_tarjeta)
      setView('landing')
      cargarTarjetas()
    } else {
      setConfigurado(false)
      setView('landing')
    }
  }

  async function cargarTarjetas() {
    const { data } = await supabase.from('tarjetas').select('*')
    if (data) {
      const ordenadas = data.sort((a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10))
      setTarjetas(ordenadas)
    } else {
      setTarjetas([])
    }
  }

  async function generarEvento(e) {
    e.preventDefault()
    let tarjetasArray = []
    let totalGenerado = 0

    if (usarRango) {
      const startNum = parseInt(rangoInicio, 10)
      const endNum = parseInt(rangoFin, 10)
      const padLen = rangoInicio.length
      if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) return saasSwal.fire('Error', 'El rango no es válido.', 'error')

      for (let i = startNum; i <= endNum; i++) {
        tarjetasArray.push({ numero: i.toString().padStart(padLen, '0'), historial_pagos: [] })
      }
      totalGenerado = tarjetasArray.length
    } else {
      totalGenerado = cantidadNormal
      for (let i = 1; i <= totalGenerado; i++) {
        tarjetasArray.push({ numero: i.toString(), historial_pagos: [] })
      }
    }

    saasSwal.fire({ title: 'Generando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    await supabase.from('configuracion_evento').upsert({ id: 1, nombre_evento: 'Gran Pollada', total_tarjetas: totalGenerado, precio_tarjeta: precio, configurado: true })
    await supabase.from('tarjetas').insert(tarjetasArray)
    await cargarTarjetas()
    setConfigurado(true)
    Swal.close()
    setView('dashboard')
  }

  async function borrarEvento() {
    const result = await saasSwal.fire({
      title: '⚠️ ¿Borrar Evento?',
      html: 'Se perderá todo el progreso financiero de manera irreversible.<br/><br/><b>Ingresa la contraseña para confirmar:</b>',
      icon: 'warning',
      input: 'password',
      inputPlaceholder: 'Contraseña de seguridad',
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar Todo',
      confirmButtonColor: '#ef4444',
      preConfirm: (password) => {
        if (password !== '2026jaujaucrema') {
          Swal.showValidationMessage('Contraseña incorrecta. Acceso denegado.');
        }
      }
    })
    
    if (!result.isConfirmed) return
    
    saasSwal.fire({ title: 'Borrando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    await supabase.from('tarjetas').delete().neq('numero', 'null_placeholder')
    await supabase.from('configuracion_evento').update({ configurado: false }).eq('id', 1)
    setConfigurado(false)
    setTarjetas([])
    setSeleccionadas([])
    Swal.close()
    setView('landing')
  }

  function toggleSeleccion(numero) {
    if (seleccionadas.includes(numero)) setSeleccionadas(seleccionadas.filter(n => n !== numero))
    else setSeleccionadas([...seleccionadas, numero])
  }

  function seleccionarRangoMultiple() {
    const inicio = parseInt(rangoSelInicio, 10)
    const fin = parseInt(rangoSelFin, 10)
    if (isNaN(inicio) || isNaN(fin) || inicio > fin) {
      return Swal.fire({ icon: 'error', title: 'Error', text: 'Rango incorrecto', background: '#1a1d24', color: '#fff' })
    }
    
    const tarjetasEnRango = tarjetas.filter(t => {
      const num = parseInt(t.numero, 10)
      return num >= inicio && num <= fin && t.estado_entrega !== 'entregado'
    }).map(t => t.numero)

    const combinadas = Array.from(new Set([...seleccionadas, ...tarjetasEnRango]))
    setSeleccionadas(combinadas)
    setRangoSelInicio('')
    setRangoSelFin('')
  }

  // --- REGISTRAR PEDIDO (MATEMÁTICA EN CASCADA) ---
  async function registrarPedido() {
    const selectedCardsObjects = tarjetas.filter(t => seleccionadas.includes(t.numero));
    const costoTotal = seleccionadas.length * precio;
    const yaPagado = selectedCardsObjects.reduce((sum, t) => sum + Number(t.monto_pagado || 0), 0);
    const deudaPendiente = costoTotal - yaPagado;

    if (deudaPendiente <= 0) return saasSwal.fire('Aviso', 'Estas tarjetas ya están pagadas.', 'info');

    const { value: formValues } = await saasSwal.fire({
      title: 'Registrar Pedido',
      html: `
        <div class="text-left space-y-4 mt-4 font-sans">
          <div>
            <label class="block text-gray-400 text-xs mb-1">Nombre del Cliente (Obligatorio) <span class="text-red-500">*</span></label>
            <input id="swal-nombre" placeholder="Ej. Familia Pérez" class="w-full bg-[#0f1115] border border-[#2a2d36] text-white rounded-lg p-3 outline-none focus:border-[#00e5ff]">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-gray-400 text-xs mb-1">Costo Total</label>
              <input disabled value="S/ ${deudaPendiente.toFixed(2)}" class="w-full bg-[#1a1d24] border border-[#2a2d36] text-gray-500 rounded-lg p-3 font-bold cursor-not-allowed">
            </div>
            <div>
              <label class="block text-[#ccff00] text-xs mb-1 font-bold">Adelanto / Pago Hoy</label>
              <input type="number" id="swal-monto" value="0" min="0" max="${deudaPendiente}" step="0.10"
                oninput="
                  const m = parseFloat(this.value) || 0;
                  const sel = document.getElementById('swal-metodo');
                  const opt = document.getElementById('opt-pendiente');
                  if (m > 0) {
                    opt.disabled = true;
                    if(sel.value === 'Pendiente') sel.value = 'Yape';
                  } else {
                    opt.disabled = false;
                    sel.value = 'Pendiente';
                  }
                " 
                class="w-full bg-[#0f1115] border border-[#ccff00] text-[#ccff00] rounded-lg p-3 font-bold outline-none focus:border-[#00e5ff]">
            </div>
          </div>
          <div>
            <label class="block text-gray-400 text-xs mb-1">Método de Pago</label>
            <select id="swal-metodo" class="w-full bg-[#0f1115] border border-[#2a2d36] text-white rounded-lg p-3 outline-none focus:border-[#00e5ff]">
              <option id="opt-pendiente" value="Pendiente">Ninguno (Debe todo)</option>
              <option value="Yape">Yape</option>
              <option value="Plin">Plin</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar Pedido',
      preConfirm: () => {
        const monto = parseFloat(document.getElementById('swal-monto').value) || 0;
        const metodo = document.getElementById('swal-metodo').value;
        const nombreIngresado = document.getElementById('swal-nombre').value.trim();
        
        if(!nombreIngresado) return Swal.showValidationMessage('El nombre del cliente es obligatorio');
        if(monto > deudaPendiente) return Swal.showValidationMessage('El pago no puede superar el costo total');
        if(monto > 0 && metodo === 'Pendiente') return Swal.showValidationMessage('Selecciona Yape, Plin o Efectivo para el monto ingresado');
        if(monto === 0 && metodo !== 'Pendiente') return Swal.showValidationMessage('Si el monto es 0, el método debe ser Ninguno');
        
        return { nombre: nombreIngresado, monto: monto, metodo: metodo }
      }
    });

    if (!formValues) return;

    let abonoRestante = formValues.monto;
    
    for (let t of selectedCardsObjects) {
      let deudaTarjeta = Number((precio - Number(t.monto_pagado || 0)).toFixed(2));
      let pagoAEstaTarjeta = 0;

      if (abonoRestante > 0 && deudaTarjeta > 0) {
        if (abonoRestante >= deudaTarjeta) {
          pagoAEstaTarjeta = deudaTarjeta;
        } else {
          pagoAEstaTarjeta = abonoRestante;
        }
        abonoRestante = Number((abonoRestante - pagoAEstaTarjeta).toFixed(2));
      }

      const nuevoMontoPagado = Number((Number(t.monto_pagado || 0) + pagoAEstaTarjeta).toFixed(2));
      const nuevoEstado = nuevoMontoPagado >= precio ? 'pagado' : 'parcial';
      
      let nuevoHistorial = Array.isArray(t.historial_pagos) ? [...t.historial_pagos] : [];
      if (pagoAEstaTarjeta > 0) {
        nuevoHistorial.push({ monto: pagoAEstaTarjeta, metodo: formValues.metodo, fecha: new Date().toLocaleDateString() });
      }

      await supabase.from('tarjetas')
        .update({ 
          cliente_nombre: formValues.nombre, 
          estado_pago: nuevoEstado, 
          monto_pagado: nuevoMontoPagado, 
          historial_pagos: nuevoHistorial 
        })
        .eq('numero', t.numero);
    }
    
    setSeleccionadas([]); cargarTarjetas();
  }

  // --- ABONAR DEUDA (MATEMÁTICA EN CASCADA) ---
  async function abonarDeuda(clienteObj) {
    const deuda = clienteObj.costo_total - clienteObj.monto_pagado;
    
    const { value: formValues } = await saasSwal.fire({
      title: `Abonar a ${clienteObj.cliente_nombre}`,
      html: `
        <div class="text-left font-sans mt-2">
          <p class="text-gray-400 text-sm mb-4">Deuda pendiente: <b class="text-[#ff2e7e] text-lg">S/ ${deuda.toFixed(2)}</b></p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-gray-400 text-xs mb-1">Monto a abonar</label>
              <input type="number" id="abono-monto" value="${deuda.toFixed(2)}" max="${deuda}" step="0.10" class="w-full bg-[#0f1115] border border-[#ccff00] text-[#ccff00] rounded-lg p-3 font-bold outline-none focus:border-[#00e5ff]">
            </div>
            <div>
              <label class="block text-gray-400 text-xs mb-1">Método</label>
              <select id="abono-metodo" class="w-full bg-[#0f1115] border border-[#2a2d36] text-white rounded-lg p-3 outline-none focus:border-[#00e5ff]">
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar Abono',
      preConfirm: () => {
        const monto = parseFloat(document.getElementById('abono-monto').value);
        if(!monto || monto <= 0 || monto > deuda) return Swal.showValidationMessage('Monto inválido');
        return { monto, metodo: document.getElementById('abono-metodo').value }
      }
    });

    if (!formValues) return;

    let abonoRestante = formValues.monto;
    
    for (let num of clienteObj.tarjetas) {
      const t = tarjetas.find(x => x.numero === num);
      let deudaTarjeta = Number((precio - Number(t.monto_pagado || 0)).toFixed(2));
      let pagoAEstaTarjeta = 0;

      if (abonoRestante > 0 && deudaTarjeta > 0) {
        if (abonoRestante >= deudaTarjeta) {
          pagoAEstaTarjeta = deudaTarjeta;
        } else {
          pagoAEstaTarjeta = abonoRestante;
        }
        abonoRestante = Number((abonoRestante - pagoAEstaTarjeta).toFixed(2));
      }

      const nuevoMontoPagado = Number((Number(t.monto_pagado || 0) + pagoAEstaTarjeta).toFixed(2));
      const nuevoEstado = nuevoMontoPagado >= precio ? 'pagado' : 'parcial';
      
      let nuevoHistorial = Array.isArray(t.historial_pagos) ? [...t.historial_pagos] : [];
      if (pagoAEstaTarjeta > 0) {
        nuevoHistorial.push({ monto: pagoAEstaTarjeta, metodo: formValues.metodo, fecha: new Date().toLocaleDateString() });
      }

      await supabase.from('tarjetas')
        .update({ estado_pago: nuevoEstado, monto_pagado: nuevoMontoPagado, historial_pagos: nuevoHistorial })
        .eq('numero', t.numero);
    }
    
    setSeleccionadas([]);
    cargarTarjetas();
  }

  async function anularPedido(clienteObj) {
    const result = await saasSwal.fire({
      title: '¿Anular Pedido?',
      html: `Se liberarán las tarjetas y se borrará el historial de pagos de <b>${clienteObj.cliente_nombre}</b>.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Anular',
      confirmButtonColor: '#ef4444'
    })
    if (!result.isConfirmed) return

    await supabase.from('tarjetas')
      .update({ cliente_nombre: null, estado_pago: 'libre', monto_pagado: 0, historial_pagos: [], estado_entrega: 'pendiente' })
      .in('numero', clienteObj.tarjetas);
      
    setSeleccionadas([]);
    cargarTarjetas();
  }


  // --- CÁLCULOS GLOBALES (SE MUEVEN ARRIBA PARA USARLOS EN LA MATRIZ Y LISTA) ---
  const tarjetasVendidas = tarjetas.filter(t => t.estado_pago !== 'libre');
  const recaudadoReal = tarjetasVendidas.reduce((sum, t) => sum + Number(t.monto_pagado || 0), 0);
  const totalmentePagados = tarjetasVendidas.filter(t => t.estado_pago === 'pagado').length;
  const parcialesPagados = tarjetasVendidas.filter(t => t.estado_pago === 'parcial').length;
  const entregadosCount = tarjetas.filter(t => t.estado_entrega === 'entregado').length;

  // ESTE AGRUPADOR ES LA CLAVE PARA SABER EL ESTADO GLOBAL DE CADA CLIENTE
  const pedidosAgrupados = tarjetasVendidas.reduce((acc, t) => {
    const nombre = t.cliente_nombre || 'Desconocido';
    if (!acc[nombre]) acc[nombre] = { cliente_nombre: nombre, tarjetas: [], monto_pagado: 0, costo_total: 0, entregadas: 0 };
    acc[nombre].tarjetas.push(t.numero);
    acc[nombre].monto_pagado += Number(t.monto_pagado || 0);
    acc[nombre].costo_total += precio;
    if (t.estado_entrega === 'entregado') acc[nombre].entregadas += 1;
    return acc;
  }, {});

  const clientesArray = Object.values(pedidosAgrupados).map(c => {
    c.estado_pago = c.monto_pagado >= c.costo_total ? 'pagado' : 'parcial';
    return c;
  });


  // --- ENTREGAS AL FIADO DESDE LA MATRIZ Y LISTA ---
  async function entregarSeleccionadas() {
    const selectedCardsObjects = tarjetas.filter(t => seleccionadas.includes(t.numero));
    
    // Verificamos si alguna de las tarjetas seleccionadas pertenece a un cliente con deuda global
    const owesMoney = selectedCardsObjects.some(t => {
       const cliente = pedidosAgrupados[t.cliente_nombre];
       return cliente && cliente.estado_pago === 'parcial';
    });

    if (owesMoney) {
       const result = await saasSwal.fire({
          title: '⚠️ Entrega con Deuda',
          html: 'Estás a punto de entregar platos a clientes que <b>aún tienen pagos pendientes</b>.<br/><br/>¿Confirmas que deseas entregarlos al fiado?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, Entregar (Fiado)',
          confirmButtonColor: '#f59e0b'
       });
       if (!result.isConfirmed) return;
    }

    await supabase.from('tarjetas').update({ estado_entrega: 'entregado' }).in('numero', seleccionadas)
    setSeleccionadas([]);
    cargarTarjetas();
  }

  async function entregarTodoCliente(clienteObj) {
    const deuda = clienteObj.costo_total - clienteObj.monto_pagado;
    const isFiado = deuda > 0;

    const result = await saasSwal.fire({
      title: isFiado ? '⚠️ Entrega con Deuda' : '¿Entregar Platos?',
      html: isFiado 
            ? `<b>${clienteObj.cliente_nombre}</b> aún debe <b class="text-[#ff2e7e]">S/ ${deuda.toFixed(2)}</b>.<br/><br/>¿Confirmas la entrega al fiado?` 
            : `¿Confirmas la entrega de todas las tarjetas de <b>${clienteObj.cliente_nombre}</b>?`,
      icon: isFiado ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: isFiado ? 'Sí, Entregar (Fiado)' : 'Sí, Entregar Todo',
      confirmButtonColor: isFiado ? '#f59e0b' : '#ccff00'
    })
    
    if (result.isConfirmed) {
      await supabase.from('tarjetas')
        .update({ estado_entrega: 'entregado' })
        .in('numero', clienteObj.tarjetas);
        // Ya no filtramos por eq('estado_pago', 'pagado'), entregamos TODO.
        
      setSeleccionadas([]);
      await cargarTarjetas();
      setView('dashboard');
    }
  }


  if (view === 'loading') return <div className="min-h-screen bg-[#0f1115] flex items-center justify-center text-white">Cargando...</div>

  const Navbar = () => (
    <nav className="flex items-center justify-between bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 md:px-6 py-2.5 md:py-3 shrink-0 mb-4 md:mb-6">
      <div className="flex items-center gap-3">
        <div className="w-14 h-10 md:w-20 md:h-14 relative shrink-0 drop-shadow-[0_0_8px_rgba(255,46,126,0.4)]">
          <Image src="/tu-pollada-logo.png" alt="Logo Navbar" fill className="object-contain" priority />
        </div>
      </div>
      <div className="flex gap-2 md:gap-4">
        {configurado && view === 'dashboard' && (
          <button onClick={() => setView('listado')} className="bg-[#1a1d24] text-white border border-[#2a2d36] hover:border-[#00e5ff] font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm md:text-base">
            <Users size={18} /> <span className="hidden md:inline">Ver Lista Clientes</span>
          </button>
        )}
        {configurado && view === 'listado' && (
          <button onClick={() => setView('dashboard')} className="bg-[#1a1d24] text-white border border-[#2a2d36] hover:border-[#ff2e7e] font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm md:text-base">
            <LayoutGrid size={18} /> <span className="hidden md:inline">Ver Matriz</span>
          </button>
        )}
        {configurado && (
          <button onClick={borrarEvento} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm md:text-base border border-red-500/20">
            <Trash2 size={18} /> <span className="inline">Borrar Evento</span>
          </button>
        )}
      </div>
    </nav>
  )

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white p-3 md:px-8 md:py-2 font-sans flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center text-center max-w-5xl mx-auto w-full py-2">
          <div className="w-48 h-32 md:w-[240px] md:h-[150px] lg:w-[280px] lg:h-[180px] relative mb-4 drop-shadow-[0_0_35px_rgba(255,46,126,0.3)] hover:drop-shadow-[0_0_45px_rgba(0,229,255,0.4)] transform hover:scale-105 transition-all duration-500">
            <Image src="/tu-pollada-logo.png" alt="Logo Gigante" fill className="object-contain" priority />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Gestión Inteligente de <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff2e7e] to-[#00e5ff]">Eventos y Polladas</span>
          </h1>
          {configurado ? (
            <button onClick={() => setView('dashboard')} className="bg-gradient-to-r from-[#00e5ff] to-[#00b2cc] text-black font-bold text-base md:text-lg py-2.5 px-8 md:px-10 rounded-full flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(0,229,255,0.3)]">
              Ir al Panel de Control <ArrowRight />
            </button>
          ) : (
            <button onClick={() => setView('config')} className="bg-gradient-to-r from-[#ff2e7e] to-[#e0206a] text-white font-bold text-base md:text-lg py-2.5 px-8 md:px-10 rounded-full flex items-center gap-3 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,46,126,0.3)]">
              Comenzar Evento Ahora <ArrowRight />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (view === 'config') {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white p-3 md:px-8 md:py-2 font-sans flex flex-col">
        <Navbar />
        <div className="max-w-xl mx-auto w-full bg-[#1a1d24] border border-[#2a2d36] rounded-2xl p-5 md:p-6 shadow-xl mb-4">
          <div className="flex items-center gap-3 mb-4 md:mb-5 pb-3 md:pb-4 border-b border-[#2a2d36]">
            <Settings className="text-[#00e5ff]" size={24} />
            <h2 className="text-xl md:text-2xl font-bold">Configurar Nuevo Evento</h2>
          </div>
          <form onSubmit={generarEvento} className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-gray-400 text-xs md:text-sm font-medium mb-1.5 md:mb-2">Precio por Plato (S/)</label>
              <input type="number" value={precio} onChange={e => setPrecio(Number(e.target.value))} className="w-full bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 md:p-3.5 text-lg md:text-xl font-bold focus:outline-none focus:border-[#ff2e7e] transition-colors" required />
            </div>
            <div className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4">
              <label className="flex items-center gap-3 cursor-pointer mb-2 md:mb-3">
                <input type="checkbox" checked={usarRango} onChange={() => setUsarRango(!usarRango)} className="w-4 h-4 accent-[#00e5ff] cursor-pointer" />
                <span className="font-medium text-sm md:text-base">¿Usar numeración personalizada?</span>
              </label>
              {usarRango ? (
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#2a2d36]">
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Desde (Ej: 0045)</label>
                    <input type="text" value={rangoInicio} onChange={e => setRangoInicio(e.target.value)} className="w-full bg-[#1a1d24] border border-[#2a2d36] rounded-lg p-2.5 font-mono text-sm focus:outline-none focus:border-[#00e5ff]" required />
                  </div>
                  <div>
                    <label className="block text-gray-500 text-xs mb-1">Hasta (Ej: 0100)</label>
                    <input type="text" value={rangoFin} onChange={e => setRangoFin(e.target.value)} className="w-full bg-[#1a1d24] border border-[#2a2d36] rounded-lg p-2.5 font-mono text-sm focus:outline-none focus:border-[#00e5ff]" required />
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-[#2a2d36]">
                  <label className="block text-gray-500 text-xs mb-1">Cantidad Total de Platos</label>
                  <input type="number" value={cantidadNormal} onChange={e => setCantidadNormal(Number(e.target.value))} className="w-full bg-[#1a1d24] border border-[#2a2d36] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#00e5ff]" required />
                </div>
              )}
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-[#ff2e7e] to-[#00e5ff] text-white font-bold py-3 md:py-3.5 rounded-xl mt-2 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-base md:text-lg shadow-lg">
              <Ticket size={20}/> Generar Base de Datos
            </button>
          </form>
        </div>
      </div>
    )
  }


  // --- VISTA LISTADO ---
  if (view === 'listado') {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans pb-32">
        <Navbar />
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="text-[#00e5ff]" /> Listado de Clientes</h2>
            <div className="bg-[#1a1d24] px-4 py-2 rounded-lg border border-[#2a2d36] text-sm">
              Grupos/Clientes: <span className="text-[#00e5ff] font-bold">{clientesArray.length}</span>
            </div>
          </div>

          {clientesArray.length === 0 ? (
             <div className="text-center py-20 bg-[#1a1d24] border border-[#2a2d36] rounded-2xl">
                <p className="text-gray-500 text-lg">Aún no hay ningún pedido registrado.</p>
             </div>
          ) : (
            <div className="overflow-x-auto bg-[#1a1d24] border border-[#2a2d36] rounded-2xl shadow-xl">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase bg-[#0f1115] text-gray-500 border-b border-[#2a2d36]">
                  <tr>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Tarjetas</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4 text-[#ccff00]">Pagado</th>
                    <th className="px-5 py-4 text-[#ff2e7e]">Debe</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesArray.map(c => {
                    const deuda = c.costo_total - c.monto_pagado;
                    return (
                    <tr key={c.cliente_nombre} className="border-b border-[#2a2d36] hover:bg-[#2a2d36]/50 transition-colors">
                       <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{c.cliente_nombre}</td>
                       <td className="px-5 py-4">
                          <div className="max-w-[150px] truncate text-gray-400" title={c.tarjetas.join(', ')}>
                             <b className="text-white">{c.tarjetas.length}</b> (N° {c.tarjetas.join(', ')})
                          </div>
                       </td>
                       <td className="px-5 py-4">S/ {c.costo_total.toFixed(2)}</td>
                       <td className="px-5 py-4 font-bold text-[#ccff00]">S/ {c.monto_pagado.toFixed(2)}</td>
                       <td className="px-5 py-4 font-bold text-[#ff2e7e]">S/ {deuda.toFixed(2)}</td>
                       <td className="px-5 py-4">
                          {c.estado_pago === 'parcial' 
                            ? <span className="bg-[#f59e0b]/20 text-[#f59e0b] text-[10px] font-bold px-2 py-1 rounded border border-[#f59e0b]/30">DEUDA</span>
                            : <span className="bg-[#00e5ff]/20 text-[#00e5ff] text-[10px] font-bold px-2 py-1 rounded border border-[#00e5ff]/30">PAGADO</span>
                          }
                       </td>
                       <td className="px-5 py-4 flex items-center justify-center gap-2">
                          
                          {/* BOTON ENTREGAR TODO INTELIGENTE: Cambia de color si hay deuda */}
                          {c.entregadas < c.tarjetas.length && (
                             <button 
                                onClick={() => entregarTodoCliente(c)} 
                                className={`px-3 py-1.5 rounded transition-colors border flex items-center gap-1 font-bold ${
                                  c.estado_pago === 'pagado' 
                                    ? 'bg-[#ccff00]/10 hover:bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/30' 
                                    : 'bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                                }`}
                              >
                               <CheckCircle2 size={14} /> Entregar Todo
                             </button>
                          )}

                          {c.estado_pago === 'parcial' && (
                            <button onClick={() => abonarDeuda(c)} className="bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 text-[#00e5ff] px-3 py-1.5 rounded transition-colors border border-[#00e5ff]/30 flex items-center gap-1 font-medium">
                              <CreditCard size={14} /> Abonar
                            </button>
                          )}
                          <button onClick={() => anularPedido(c)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded transition-colors border border-red-500/30 flex items-center gap-1 font-medium">
                            <XCircle size={14} /> Anular
                          </button>
                       </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- VISTA DASHBOARD (MATRIZ) ---
  const selectedCardsObjects = tarjetas.filter(t => seleccionadas.includes(t.numero));
  const countTotalSelected = selectedCardsObjects.length;
  
  const countLibre = selectedCardsObjects.filter(t => t.estado_pago === 'libre').length;
  // Ya no filtramos solo 'pagado' para entregar, permitimos cualquier 'vendida' que esté 'pendiente'
  const countPendientes = selectedCardsObjects.filter(t => t.estado_pago !== 'libre' && t.estado_entrega === 'pendiente').length;

  const canOrder = countLibre === countTotalSelected && countTotalSelected > 0;
  const canDeliver = countPendientes === countTotalSelected && countTotalSelected > 0;
  
  // Verificamos si en la selección hay alguna tarjeta de un cliente deudor
  const selectedHasDebt = selectedCardsObjects.some(t => {
     const c = pedidosAgrupados[t.cliente_nombre];
     return c && c.estado_pago === 'parcial';
  });


  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans pb-32">
      <Navbar />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-[#1a1d24] py-3 px-4 md:py-4 md:px-5 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#ccff00]">
          <p className="text-gray-400 text-[10px] md:text-xs font-bold mb-0.5 uppercase tracking-wider">Ingresos Reales</p>
          <p className="text-xl md:text-2xl font-black text-[#ccff00]">S/ {recaudadoReal.toFixed(2)}</p>
        </div>
        <div className="bg-[#1a1d24] py-3 px-4 md:py-4 md:px-5 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#00e5ff]">
          <p className="text-gray-400 text-[10px] md:text-xs font-bold mb-0.5 uppercase tracking-wider">Tarjetas Pagadas <span className="text-[#f59e0b] text-[10px] ml-1">(+ {parcialesPagados} Deuda)</span></p>
          <p className="text-xl md:text-2xl font-black text-[#00e5ff]">{totalmentePagados}</p>
        </div>
        <div className="bg-[#1a1d24] py-3 px-4 md:py-4 md:px-5 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#ff2e7e]">
          <p className="text-gray-400 text-[10px] md:text-xs font-bold mb-0.5 uppercase tracking-wider">Platos Entregados</p>
          <p className="text-xl md:text-2xl font-black text-[#ff2e7e]">{entregadosCount} <span className="text-sm md:text-base text-gray-500">/ {totalmentePagados + parcialesPagados}</span></p>
        </div>
      </div>

      <div className="bg-[#1a1d24] border border-[#2a2d36] rounded-3xl p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
          <h3 className="text-base md:text-lg font-bold flex items-center gap-2"><Ticket className="text-[#00e5ff]" size={20}/> Panel de Entregas</h3>
          
          <div className="flex items-center gap-2 bg-[#0f1115] p-1.5 md:p-2 rounded-lg border border-[#2a2d36] w-full md:w-auto overflow-x-auto">
             <MousePointerSquareDashed size={16} className="text-gray-500 ml-1 shrink-0" />
             <input type="number" placeholder="De" value={rangoSelInicio} onChange={e=>setRangoSelInicio(e.target.value)} className="bg-[#1a1d24] border border-[#2a2d36] text-white text-xs md:text-sm p-1.5 rounded w-12 md:w-16 text-center outline-none focus:border-[#00e5ff]" />
             <span className="text-gray-500 text-xs">-</span>
             <input type="number" placeholder="A" value={rangoSelFin} onChange={e=>setRangoSelFin(e.target.value)} className="bg-[#1a1d24] border border-[#2a2d36] text-white text-xs md:text-sm p-1.5 rounded w-12 md:w-16 text-center outline-none focus:border-[#00e5ff]" />
             <button onClick={seleccionarRangoMultiple} className="bg-[#2a2d36] hover:bg-[#363a45] text-white text-xs md:text-sm px-3 py-1.5 rounded font-medium transition-colors shrink-0">Seleccionar</button>
             {seleccionadas.length > 0 && <button onClick={()=>setSeleccionadas([])} className="text-gray-400 hover:text-white text-xs ml-2 shrink-0 underline">Limpiar</button>}
          </div>
        </div>
        
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-3">
          {tarjetas.map(t => {
            const isSelected = seleccionadas.includes(t.numero)
            let styles = 'bg-[#0f1115] border-[#2a2d36] text-gray-400 hover:border-[#00e5ff]' 
            
            // PSICOLOGÍA DE INTERFAZ: Usamos el estado GLOBAL del cliente para pintar las tarjetas de la matriz
            if (t.estado_pago !== 'libre') {
               const clienteInfo = pedidosAgrupados[t.cliente_nombre];
               const estadoParaPintar = clienteInfo ? clienteInfo.estado_pago : t.estado_pago;

               if (estadoParaPintar === 'parcial') {
                   styles = 'bg-[#f59e0b]/10 border-[#f59e0b] text-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.2)]'
               } else if (estadoParaPintar === 'pagado') {
                   styles = 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.2)]'
               }
            }

            if (t.estado_entrega === 'entregado') {
                styles = 'bg-[#0a0c0f] border-[#1a1d24] text-gray-700 cursor-not-allowed shadow-none'
            }

            if (isSelected) {
                styles = 'bg-[#ff2e7e] border-[#ff2e7e] text-white shadow-[0_0_20px_rgba(255,46,126,0.5)] scale-110 z-10 font-black'
            }

            return (
              <button
                key={t.numero}
                onClick={() => toggleSeleccion(t.numero)}
                disabled={t.estado_entrega === 'entregado' && !isSelected}
                className={`
                  aspect-square flex flex-col items-center justify-center border rounded-lg transition-all relative overflow-hidden
                  ${styles}
                `}
              >
                <span className="text-sm md:text-lg">{t.numero}</span>
                {t.estado_entrega === 'entregado' && !isSelected && (
                  <CheckCircle2 size={16} className="absolute text-gray-600/50" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {seleccionadas.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#13151a] border-t border-[#2a2d36] p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-50 transition-all">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white text-sm md:text-base">
              <span className="font-bold text-xl md:text-2xl text-[#ff2e7e]">{seleccionadas.length}</span> seleccionadas
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 justify-center">
              
              {canOrder && (
                <button onClick={registrarPedido} className="w-full md:w-auto bg-[#00e5ff] text-black font-bold px-6 py-2.5 rounded-lg hover:bg-[#00b2cc] transition-colors text-sm md:text-base shadow-[0_0_15px_rgba(0,229,255,0.3)] whitespace-nowrap">
                  🛒 Registrar Pedido / Venta
                </button>
              )}

              {canDeliver && (
                <button 
                  onClick={entregarSeleccionadas} 
                  className={`w-full md:w-auto font-bold px-6 md:px-10 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm md:text-base whitespace-nowrap ${
                     selectedHasDebt 
                     ? 'bg-[#f59e0b] text-black hover:bg-[#d97706] shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                     : 'bg-[#ccff00] text-black hover:bg-[#b3e600] shadow-[0_0_15px_rgba(204,255,0,0.3)]'
                  }`}
                >
                  <CheckCircle2 size={18} /> {selectedHasDebt ? 'Entregar (Fiado)' : 'Entregar Platos'}
                </button>
              )}

              {!canOrder && !canDeliver && (
                <div className="bg-[#2a2d36] border border-[#363a45] text-gray-300 font-medium px-6 py-2.5 rounded-lg text-sm md:text-base text-center w-full md:w-auto">
                  ⚠️ Selección mixta. Selecciona solo tarjetas Libres o solo tarjetas Vendidas.
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}