'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Swal from 'sweetalert2'
import { PlusCircle, LogOut, Ticket, ArrowRight, Trash2 } from 'lucide-react'

export default function Lobby() {
  const [user, setUser] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const [nombreEvento, setNombreEvento] = useState('')
  const [precio, setPrecio] = useState(15)
  const [cantidad, setCantidad] = useState(50)

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
    verificarSesion()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setUser(session.user)
      cargarEventos(session.user.id)
    } else {
      setLoading(false)
    }
  }

  async function cargarEventos(userId) {
    const { data } = await supabase.from('eventos').select('*').eq('user_id', userId).order('creado_en', { ascending: false })
    if (data) setEventos(data)
    setLoading(false)
  }

  async function iniciarSesionGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setUser(null)
    setEventos([])
  }

  async function crearEvento(e) {
    e.preventDefault()
    if (!nombreEvento.trim()) return

    saasSwal.fire({ title: 'Creando evento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })

    // 1. Crear el evento con estado_suscripcion por defecto 'gratis' (Listo para el futuro)
    const { data: eventoData, error } = await supabase.from('eventos').insert([
      { 
        user_id: user.id, 
        nombre_evento: nombreEvento, 
        precio_tarjeta: precio,
        estado_suscripcion: 'gratis' 
      }
    ]).select().single()

    if (error) {
      saasSwal.fire('Error', 'No se pudo crear el evento', 'error')
      return
    }

    // 2. Generar las tarjetas automáticas asociadas a este evento_id
    let tarjetasArray = []
    for (let i = 1; i <= cantidad; i++) {
      tarjetasArray.push({
        evento_id: eventoData.id,
        numero: i.toString(),
        historial_pagos: []
      })
    }

    await supabase.from('tarjetas').insert(tarjetasArray)
    Swal.close()

    // 3. Redirigir al panel exclusivo de este evento
    router.push(`/evento/${eventoData.id}`)
  }

  async function borrarEvento(eventoId, nombre) {
    const result = await saasSwal.fire({
      title: '⚠️ ¿Borrar Evento?',
      html: `Se eliminará el evento <b>${nombre}</b> y todas sus tarjetas de manera irreversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar Todo',
      confirmButtonColor: '#ef4444'
    })

    if (!result.isConfirmed) return

    saasSwal.fire({ title: 'Borrando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    await supabase.from('eventos').delete().eq('id', eventoId)
    Swal.close()
    cargarEventos(user.id)
  }

  if (loading) return <div className="min-h-screen bg-[#0f1115] text-white flex items-center justify-center font-sans">Cargando plataforma...</div>

  return (
    <main className="min-h-screen bg-[#0f1115] text-white p-4 md:p-8 font-sans flex flex-col items-center">
      <div className="max-w-3xl w-full">
        <nav className="flex justify-between items-center bg-[#13151a] border border-[#2a2d36] rounded-2xl p-4 mb-8 shadow-lg">
          <h1 className="font-extrabold text-lg md:text-xl text-transparent bg-clip-text bg-gradient-to-r from-[#ff2e7e] to-[#00e5ff]">
            Tu Pollada SaaS
          </h1>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden md:inline">{user.email}</span>
              <button onClick={cerrarSesion} className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:bg-red-500/20 transition-colors">
                <LogOut size={16} /> Salir
              </button>
            </div>
          )}
        </nav>

        {!user ? (
          <div className="text-center py-20 bg-[#1a1d24] border border-[#2a2d36] rounded-3xl p-8 shadow-xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Gestiona tus Polladas de Forma Profesional</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto text-sm md:text-base">
              Inicia sesión con Google en un solo toque. Cero contraseñas, acceso instantáneo y tus eventos seguros en la nube.
            </p>
            <button onClick={iniciarSesionGoogle} className="bg-white text-black font-bold px-8 py-3.5 rounded-full hover:bg-gray-200 transition-all flex items-center gap-3 mx-auto shadow-lg text-base">
              Continuar con Google
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Formulario para crear nuevo evento */}
            <div className="bg-[#1a1d24] border border-[#2a2d36] rounded-3xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><PlusCircle className="text-[#00e5ff]" /> Crear Nueva Pollada</h3>
              <form onSubmit={crearEvento} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Nombre del Evento</label>
                  <input type="text" value={nombreEvento} onChange={e=>setNombreEvento(e.target.value)} placeholder="Ej. Gran Pollada Pro-Salud Bomberos" className="w-full bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 text-white outline-none focus:border-[#00e5ff]" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Precio por Plato (S/)</label>
                    <input type="number" value={precio} onChange={e=>setPrecio(Number(e.target.value))} className="w-full bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 text-white outline-none focus:border-[#00e5ff]" required />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Cantidad de Platos</label>
                    <input type="number" value={cantidad} onChange={e=>setCantidad(Number(e.target.value))} className="w-full bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 text-white outline-none focus:border-[#00e5ff]" required />
                  </div>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-[#ff2e7e] to-[#00e5ff] text-black font-bold py-3.5 rounded-xl mt-2 hover:opacity-90 transition-opacity shadow-lg">
                  Generar Evento en Vivo
                </button>
              </form>
            </div>

            {/* Listado de eventos del usuario */}
            <div>
              <h3 className="text-xl font-bold mb-4">Mis Eventos Activos</h3>
              {eventos.length === 0 ? (
                <div className="text-center py-12 bg-[#1a1d24] border border-[#2a2d36] rounded-2xl">
                  <p className="text-gray-500">Aún no tienes eventos creados. ¡Crea el primero arriba!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {eventos.map(ev => (
                    <div key={ev.id} className="bg-[#1a1d24] border border-[#2a2d36] p-4 rounded-2xl flex justify-between items-center hover:border-[#2a2d36]/80 transition-colors">
                      <div>
                        <h4 className="font-bold text-lg text-white">{ev.nombre_evento}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">Precio: <b className="text-[#ccff00]">S/ {ev.precio_tarjeta}</b></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => router.push(`/evento/${ev.id}`)} className="bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 hover:bg-[#00e5ff]/20 transition-colors text-sm">
                          Administrar <ArrowRight size={16} />
                        </button>
                        <button onClick={() => borrarEvento(ev.id, ev.nombre_evento)} className="bg-red-500/10 text-red-500 border border-red-500/20 p-2 rounded-xl hover:bg-red-500/20 transition-colors" title="Borrar evento">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}