import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react'
import { db } from '../lib/firebase'
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, increment
} from 'firebase/firestore'

type AccessStatus = 'loading' | 'consent_pending' | 'consent_granted' | 'consent_denied' | 'invalid'

export default function PublicLink() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<AccessStatus>('loading')
  const [caseCode, setCaseCode] = useState('')
  const [eventId, setEventId] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<string>('')
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!token || registeredRef.current) return
    registeredRef.current = true
    void init(token)
  }, [token])

  const init = async (linkToken: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'smart_links'), where('token', '==', linkToken)))
      if (snap.empty) { setStatus('invalid'); return }

      const linkDoc = snap.docs[0]
      const data = linkDoc.data()

      if (data.status === 'revoked') { setStatus('invalid'); return }
      if (data.expiresAt?.toDate && data.expiresAt.toDate() < new Date()) { setStatus('invalid'); return }

      setCaseCode(data.caseCode || '')
      setStatus('consent_pending')

      const ua = navigator.userAgent
      const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Desconocido'
      const os = ua.includes('Windows') ? 'Windows' : ua.includes('Android') ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Desconocido'
      const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop'
      const isBot = ['WhatsApp','Telegram','Slack','Discord','TwitterBot','facebookexternalhit','LinkedInBot'].some(b => ua.includes(b))

      let ipAddress = 'No disponible'
      try {
        const r = await fetch('https://api.ipify.org?format=json')
        ipAddress = (await r.json()).ip
      } catch { /* servicio externo no disponible */ }

      const eventRef = await addDoc(collection(db, 'link_events'), {
        linkId: linkDoc.id,
        token: linkToken,
        investigationId: data.investigationId,
        timestamp: serverTimestamp(),
        ipAddress,
        userAgent: ua,
        browser, os, device,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        accessType: isBot ? 'bot_preview' : 'human_visit',
        location: null,
        privacyAccepted: false,
        locationGranted: false,
        sessionId: crypto.randomUUID()
      })
      setEventId(eventRef.id)

      await updateDoc(doc(db, 'smart_links', linkDoc.id), { accessCount: increment(1) })
    } catch (error) {
      console.error('[PublicLink] Error registrando acceso:', error)
      setStatus('invalid')
    }
  }

  const patchEvent = async (payload: Record<string, unknown>) => {
    if (!eventId) return
    try {
      await updateDoc(doc(db, 'link_events', eventId), payload)
    } catch (error) {
      console.error('[PublicLink] Error actualizando consentimiento:', error)
    }
  }

  // Función mejorada para obtener ubicación con máxima precisión
  const getHighAccuracyLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      let bestPosition: GeolocationPosition | null = null
      let watchId: number | null = null
      let attempts = 0
      const maxAttempts = 3

      const tryGetLocation = () => {
        attempts++
        setLocationStatus(`Obteniendo ubicación... Intento ${attempts}/${maxAttempts}`)

        // Usar watchPosition para obtener actualizaciones continuas
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            // Guardar la posición con mejor precisión
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
              bestPosition = position
              setLocationStatus(`Precisión actual: ${Math.round(position.coords.accuracy)}m`)
            }

            // Si obtenemos precisión menor a 50m, es suficientemente buena
            if (position.coords.accuracy <= 50) {
              if (watchId !== null) navigator.geolocation.clearWatch(watchId)
              resolve(position)
            }
          },
          (error) => {
            if (attempts >= maxAttempts) {
              if (watchId !== null) navigator.geolocation.clearWatch(watchId)
              if (bestPosition) {
                resolve(bestPosition)
              } else {
                reject(error)
              }
            } else {
              // Reintentar
              setTimeout(tryGetLocation, 1000)
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 30000, // 30 segundos para obtener señal GPS
            maximumAge: 0 // No usar caché
          }
        )

        // Timeout de seguridad: si después de 15 segundos no hay respuesta, usar lo que tengamos
        setTimeout(() => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId)
            if (bestPosition) {
              resolve(bestPosition)
            } else {
              reject(new Error('Timeout obteniendo ubicación'))
            }
          }
        }, 15000)
      }

      tryGetLocation()
    })
  }

  const handleAccept = () => {
    setStatus('consent_granted')
    setLocationStatus('Solicitando ubicación de alta precisión...')
    
    if (!navigator.geolocation) {
      void patchEvent({ privacyAccepted: true, locationGranted: false, finalStatus: 'consent_granted_no_geolocation' })
      return
    }

    getHighAccuracyLocation()
      .then((position) => {
        setLocationStatus(`Ubicación obtenida con precisión de ${Math.round(position.coords.accuracy)}m`)
        void patchEvent({
          privacyAccepted: true,
          locationGranted: true,
          finalStatus: 'consent_granted_with_location',
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed
          }
        })
      })
      .catch((error) => {
        console.error('Error obteniendo ubicación:', error)
        setLocationStatus('No se pudo obtener la ubicación')
        void patchEvent({ privacyAccepted: true, locationGranted: false, finalStatus: 'consent_granted_location_denied' })
      })
  }

  const handleDecline = () => {
    setStatus('consent_denied')
    void patchEvent({ privacyAccepted: false, locationGranted: false, finalStatus: 'consent_denied' })
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hacker-bg flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-hacker-green animate-spin mb-4" />
        <div className="text-hacker-green font-mono">VERIFICANDO ENLACE...</div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-hacker-bg flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <XCircle className="w-16 h-16 text-hacker-red mx-auto mb-4" />
          <h1 className="text-2xl font-mono text-hacker-red mb-2">ENLACE NO VALIDO</h1>
          <p className="text-hacker-dim font-mono text-sm">El enlace no existe, expiro o fue revocado.</p>
        </div>
      </div>
    )
  }

  if (status === 'consent_pending') {
    return (
      <div className="min-h-screen bg-hacker-bg flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hacker-green/10 border border-hacker-green/30 mb-4">
              <Shield className="w-8 h-8 text-hacker-green" />
            </div>
            <h1 className="text-2xl font-mono text-hacker-green tracking-widest">APPY INTELLIGENCE</h1>
            <p className="text-sm text-hacker-dim mt-2 font-mono">APPYEMPRESA S.A.S. - COLOMBIA</p>
          </div>

          <div className="bg-hacker-panel border border-hacker-cyan rounded-lg p-6">
            <h2 className="text-lg font-mono text-hacker-cyan mb-4">AVISO DE PRIVACIDAD Y CONSENTIMIENTO</h2>
            <div className="bg-hacker-bg border border-hacker-border rounded p-4 mb-4 text-sm text-hacker-dim font-mono space-y-2">
              <p>Este enlace esta asociado al expediente <span className="text-hacker-green">{caseCode}</span>.</p>
              <p>Ya se registraron datos tecnicos de la conexion:</p>
              <ul className="list-disc list-inside text-hacker-cyan space-y-1">
                <li>Direccion IP publica observada</li>
                <li>Navegador, sistema operativo y tipo de dispositivo</li>
                <li>Idioma y zona horaria declarados</li>
                <li>Fecha y hora del acceso</li>
              </ul>
              <p className="mt-3">Si usted acepta, se solicitara ademas la <span className="text-hacker-green">ubicacion del dispositivo</span> mediante el permiso propio del navegador. Puede rechazarla sin perder el acceso.</p>
              <p className="mt-3">Tratamiento conforme a la Ley 1581 de 2012. Finalidad: apoyo documental a la investigacion. Usted puede consultar, corregir o solicitar la eliminacion de sus datos.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDecline} className="flex-1 px-4 py-3 border border-hacker-red text-hacker-red font-mono text-sm rounded hover:bg-hacker-red/10 transition-all">RECHAZAR UBICACION</button>
              <button onClick={handleAccept} className="flex-1 btn-hacker">ACEPTAR Y CONTINUAR</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-hacker-bg flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        {locationStatus ? (
          <>
            <MapPin className="w-16 h-16 text-hacker-green mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-mono text-hacker-green mb-2">OBTENIENDO UBICACION</h1>
            <p className="text-hacker-dim font-mono text-sm">{locationStatus}</p>
            <p className="text-hacker-dim font-mono text-xs mt-4">Expediente: {caseCode}</p>
          </>
        ) : (
          <>
            <CheckCircle className="w-16 h-16 text-hacker-green mx-auto mb-4" />
            <h1 className="text-xl font-mono text-hacker-green mb-2">
              {status === 'consent_denied' ? 'ACCESO REGISTRADO SIN UBICACION' : 'VERIFICACION COMPLETADA'}
            </h1>
            <p className="text-hacker-dim font-mono text-sm">Su decision de consentimiento ha sido documentada.</p>
            <p className="text-hacker-dim font-mono text-xs mt-4">Expediente: {caseCode}</p>
          </>
        )}
      </div>
    </div>
  )
}
