'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Swal from 'sweetalert2'
import { ArrowLeft, Users, LayoutGrid, Ticket, CreditCard, CheckCircle2, XCircle, MousePointerSquareDashed } from 'lucide-react'

export default function PanelEvento() {
  const params = useParams()
  const eventoId = params.id
  const router = useRouter()

  const [evento, setEvento] = useState(null)
  const [tarjetas, setTarjetas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [view, setView] = useState('dashboard') // 'dashboard' o 'listado'

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
    if (eventoId) {
      cargarDatosEvento()
    }
  }, [eventoId])

  async function cargarDatosEvento() {
    // 1. Cargar info del evento
    const { data: eventoData } = await supabase.from('eventos').select('*').eq('id', eventoId).single()
    if (eventoData) {
      setEvento(eventoData)
    }

    // 2. Cargar tarjetas de este evento
    const { data: tarjetasData } = await supabase.from('tarjetas').select('*').eq('evento_id', eventoId)
    if (tarjetasData) {
      const ordenadas = tarjetasData.sort((a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10))
      setTarjetas(ordenadas)
    }
  }

  function toggleSeleccion(numero) {
    if (seleccionadas.includes(numero)) {
      setSeleccionadas(seleccionadas.filter(n => n !== numero))
    } else {
      setSeleccionadas([...seleccionadas, numero])
    }
  }

  function seleccionarRangoMultiple() {
    const inicio = parseInt(rangoSelInicio, 10)
    const fin = parseInt(rangoSelFin, 10)
    if (isNaN(inicio) || isNaN(fin) || inicio > fin) {
      return saasSwal.fire('Error', 'Rango incorrecto', 'error')
    }
    
    const tarjetasEnRango = tarjetas.filter(t => {
      const num = parseInt(t.numero, 10)
      return num >= inicio && num <= fin && t.estado_entrega !== 'entregado'
    }).map(t => t.numero)

    setSeleccionadas(Array.from(new Set([...seleccionadas, ...tarjetasEnRango])))
    setRangoSelInicio('')
    setRangoSelFin('')
  }

  // --- REGISTRAR PEDIDO ---
  async function registrarPedido() {
    const precio = evento.precio_tarjeta
    const selectedCardsObjects = tarjetas.filter(t => seleccionadas.includes(t.numero))
    const costoTotal = seleccionadas.length * precio
    const yaPagado = selectedCardsObjects.reduce((sum, t) => sum + Number(t.monto_pagado || 0), 0)
    const deudaPendiente = costoTotal - yaPagado

    if (deudaPendiente <= 0) return saasSwal.fire('Aviso', 'Estas tarjetas ya están pagadas.', 'info')

    const { value: formValues } = await saasSwal.fire({
      title: 'Registrar Pedido',
      html: `
        <div class="text-left space-y-4 mt-4 font-sans">
          <div>
            <label class="block text-gray-400 text-xs mb-1">Nombre del Cliente <span class="text-red-500">*</span></label>
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
        const monto = parseFloat(document.getElementById('swal-monto').value) || 0
        const metodo = document.getElementById('swal-metodo').value
        const nombreIngresado = document.getElementById('swal-nombre').value.trim()
        
        if(!nombreIngresado) return Swal.showValidationMessage('El nombre del cliente es obligatorio')
        if(monto > deudaPendiente) return Swal.showValidationMessage('El pago no puede superar el costo total')
        if(monto > 0 && metodo === 'Pendiente') return Swal.showValidationMessage('Selecciona un método de pago para el monto ingresado')
        
        return { nombre: nombreIngresado, monto, metodo }
      }
    })

    if (!formValues) return

    let abonoRestante = formValues.monto
    
    for (let t of selectedCardsObjects) {
      let deudaTarjeta = Number((precio - Number(t.monto_pagado || 0)).toFixed(2))
      let pagoAEstaTarjeta = 0

      if (abonoRestante > 0 && deudaTarjeta > 0) {
        pagoAEstaTarjeta = abonoRestante >= deudaTarjeta ? deudaTarjeta : abonoRestante
        abonoRestante = Number((abonoRestante - pagoAEstaTarjeta).toFixed(2))
      }

      const nuevoMontoPagado = Number((Number(t.monto_pagado || 0) + pagoAEstaTarjeta).toFixed(2))
      const nuevoEstado = nuevoMontoPagado >= precio ? 'pagado' : 'parcial'
      
      let nuevoHistorial = Array.isArray(t.historial_pagos) ? [...t.historial_pagos] : []
      if (pagoAEstaTarjeta > 0) {
        nuevoHistorial.push({ monto: pagoAEstaTarjeta, metodo: formValues.metodo, fecha: new Date().toLocaleDateString() })
      }

      await supabase.from('tarjetas')
        .update({ 
          cliente_nombre: formValues.nombre, 
          estado_pago: nuevoEstado, 
          monto_pagado: nuevoMontoPagado, 
          historial_pagos: nuevoHistorial 
        })
        .eq('id', t.id)
    }
    
    setSeleccionadas([])
    cargarDatosEvento()
  }

  // --- CÁLCULOS GLOBALES ---
  const precio = evento ? evento.precio_tarjeta : 15
  const tarjetasVendidas = tarjetas.filter(t => t.estado_pago !== 'libre')
  const recaudadoReal = tarjetasVendidas.reduce((sum, t) => sum + Number(t.monto_pagado || 0), 0)
  const totalmentePagados = tarjetasVendidas.filter(t => t.estado_pago === 'pagado').length
  const parcialesPagados = tarjetasVendidas.filter(t => t.estado_pago === 'parcial').length
  const entregadosCount = tarjetas.filter(t => t.estado_entrega === 'entregado').length

  const pedidosAgrupados = tarjetasVendidas.reduce((acc, t) => {
    const nombre = t.cliente_nombre || 'Desconocido'
    if (!acc[nombre]) acc[nombre] = { cliente_nombre: nombre, tarjetas: [], monto_pagado: 0, costo_total: 0, entregadas: 0 }
    acc[nombre].tarjetas.push(t.numero)
    acc[nombre].monto_pagado += Number(t.monto_pagado || 0)
    acc[nombre].costo_total += precio
    if (t.estado_entrega === 'entregado') acc[nombre].entregadas += 1
    return acc
  }, {})

  const clientesArray = Object.values(pedidosAgrupados).map(c => {
    c.estado_pago = c.monto_pagado >= c.costo_total ? 'pagado' : 'parcial'
    return c
  })

  async function entregarSeleccionadas() {
    await supabase.from('tarjetas').update({ estado_entrega: 'entregado' }).in('numero', seleccionadas).eq('evento_id', eventoId)
    setSeleccionadas([])
    cargarDatosEvento()
  }

  if (!evento) return <div className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center font-sans">Cargando evento...</div>

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans pb-32">
      <nav className="flex items-center justify-between bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 md:px-6 py-3 mb-6">
        <button onClick={() => router.push('/')} className="bg-[#1a1d24] text-gray-300 border border-[#2a2d36] hover:text-white font-medium py-2 px-3 rounded-lg flex items-center gap-2 text-sm">
          <ArrowLeft size={16} /> Mis Eventos
        </button>
        <div className="text-center">
          <h2 className="font-bold text-base md:text-lg text-transparent bg-clip-text bg-gradient-to-r from-[#ff2e7e] to-[#00e5ff]">{evento.nombre_evento}</h2>
        </div>
        <div className="flex gap-2">
          {view === 'dashboard' ? (
            <button onClick={() => setView('listado')} className="bg-[#1a1d24] text-white border border-[#2a2d36] hover:border-[#00e5ff] font-medium py-2 px-3 rounded-lg flex items-center gap-2 text-sm">
              <Users size={16} /> <span className="hidden md:inline">Clientes</span>
            </button>
          ) : (
            <button onClick={() => setView('dashboard')} className="bg-[#1a1d24] text-white border border-[#2a2d36] hover:border-[#ff2e7e] font-medium py-2 px-3 rounded-lg flex items-center gap-2 text-sm">
              <LayoutGrid size={16} /> <span className="hidden md:inline">Matriz</span>
            </button>
          )}
        </div>
      </nav>

      {view === 'dashboard' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
            <div className="bg-[#1a1d24] py-3 px-4 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#ccff00]">
              <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase">Ingresos Reales</p>
              <p className="text-xl md:text-2xl font-black text-[#ccff00]">S/ {recaudadoReal.toFixed(2)}</p>
            </div>
            <div className="bg-[#1a1d24] py-3 px-4 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#00e5ff]">
              <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase">Pagadas <span className="text-[#f59e0b] text-[10px]">(+ {parcialesPagados} Deuda)</span></p>
              <p className="text-xl md:text-2xl font-black text-[#00e5ff]">{totalmentePagados}</p>
            </div>
            <div className="bg-[#1a1d24] py-3 px-4 rounded-xl border border-[#2a2d36] border-l-4 border-l-[#ff2e7e]">
              <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase">Entregados</p>
              <p className="text-xl md:text-2xl font-black text-[#ff2e7e]">{entregadosCount} <span className="text-sm text-gray-500">/ {totalmentePagados + parcialesPagados}</span></p>
            </div>
          </div>

          <div className="bg-[#1a1d24] border border-[#2a2d36] rounded-3xl p-4 md:p-6 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
              <h3 className="text-base font-bold flex items-center gap-2"><Ticket className="text-[#00e5ff]" size={18}/> Panel de Matriz</h3>
              <div className="flex items-center gap-2 bg-[#0f1115] p-1.5 rounded-lg border border-[#2a2d36] w-full md:w-auto">
                <MousePointerSquareDashed size={16} className="text-gray-500 ml-1" />
                <input type="number" placeholder="De" value={rangoSelInicio} onChange={e=>setRangoSelInicio(e.target.value)} className="bg-[#1a1d24] border border-[#2a2d36] text-white text-xs p-1.5 rounded w-14 text-center outline-none" />
                <span className="text-gray-500 text-xs">-</span>
                <input type="number" placeholder="A" value={rangoSelFin} onChange={e=>setRangoSelFin(e.target.value)} className="bg-[#1a1d24] border border-[#2a2d36] text-white text-xs p-1.5 rounded w-14 text-center outline-none" />
                <button onClick={seleccionarRangoMultiple} className="bg-[#2a2d36] hover:bg-[#363a45] text-white text-xs px-3 py-1.5 rounded font-medium">Seleccionar</button>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {tarjetas.map(t => {
                const isSelected = seleccionadas.includes(t.numero)
                let styles = 'bg-[#0f1115] border-[#2a2d36] text-gray-400 hover:border-[#00e5ff]'
                if (t.estado_pago !== 'libre') {
                  const clienteInfo = pedidosAgrupados[t.cliente_nombre]
                  const estadoPintar = clienteInfo ? clienteInfo.estado_pago : t.estado_pago
                  if (estadoPintar === 'parcial') styles = 'bg-[#f59e0b]/10 border-[#f59e0b] text-[#f59e0b]'
                  if (estadoPintar === 'pagado') styles = 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff]'
                }
                if (t.estado_entrega === 'entregado') styles = 'bg-[#0a0c0f] border-[#1a1d24] text-gray-700 cursor-not-allowed'
                if (isSelected) styles = 'bg-[#ff2e7e] border-[#ff2e7e] text-white font-black scale-105 z-10'

                return (
                  <button key={t.id} onClick={() => toggleSeleccion(t.numero)} disabled={t.estado_entrega === 'entregado' && !isSelected} className={`aspect-square flex flex-col items-center justify-center border rounded-lg transition-all relative ${styles}`}>
                    <span className="text-sm md:text-base">{t.numero}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto">
          <h3 className="text-xl font-bold mb-4">Listado de Clientes</h3>
          {clientesArray.length === 0 ? (
            <p className="text-gray-500 text-center py-12 bg-[#1a1d24] border border-[#2a2d36] rounded-2xl">No hay pedidos registrados.</p>
          ) : (
            <div className="overflow-x-auto bg-[#1a1d24] border border-[#2a2d36] rounded-2xl">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase bg-[#0f1115] text-gray-500 border-b border-[#2a2d36]">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tarjetas</th>
                    <th className="px-4 py-3 text-[#ccff00]">Pagado</th>
                    <th className="px-4 py-3 text-[#ff2e7e]">Debe</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesArray.map(c => (
                    <tr key={c.cliente_nombre} className="border-b border-[#2a2d36]">
                      <td className="px-4 py-3 font-bold text-white">{c.cliente_nombre}</td>
                      <td className="px-4 py-3">{c.tarjetas.length} (N° {c.tarjetas.join(', ')})</td>
                      <td className="px-4 py-3 text-[#ccff00] font-bold">S/ {c.monto_pagado.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#ff2e7e] font-bold">S/ {(c.costo_total - c.monto_pagado).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {seleccionadas.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#13151a] border-t border-[#2a2d36] p-4 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div><span className="font-bold text-xl text-[#ff2e7e]">{seleccionadas.length}</span> seleccionadas</div>
            <div className="flex gap-2">
              <button onClick={registrarPedido} className="bg-[#00e5ff] text-black font-bold px-6 py-2.5 rounded-lg hover:bg-[#00b2cc] text-sm">
                🛒 Registrar Venta
              </button>
              <button onClick={entregarSeleccionadas} className="bg-[#ccff00] text-black font-bold px-6 py-2.5 rounded-lg hover:bg-[#b3e600] text-sm flex items-center gap-1">
                <CheckCircle2 size={16} /> Entregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}