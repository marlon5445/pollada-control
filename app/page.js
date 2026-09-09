// MAGIA DE GOOGLE ONE TAP Y DETECCIÓN DE SESIÓN
  useEffect(() => {
    if (view === 'landing' && !user) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleOneTap,
            auto_select: true, 
            cancel_on_tap_outside: false
          })
          
          window.google.accounts.id.prompt((notification) => {
            // SOLO mostramos la caja de correo si Google nos dice que 
            // no encontró ninguna sesión para mostrar la ventanita.
            if (notification.isNotDisplayed()) {
              setMostrarEmail(true)
            }
          })
        }
      }
      
      script.onerror = () => setMostrarEmail(true) 
      
      document.body.appendChild(script)

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script)
        }
      }
    }
  }, [view, user])