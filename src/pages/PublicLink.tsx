import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, CheckCircle, XCircle, Loader2, Cpu } from 'lucide-react'
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
  const [isReady, setIsReady] = useState(false)
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
      setIsReady(true)
      setStatus('consent_pending')

      await updateDoc(doc(db, 'smart_links', linkDoc.id), { accessCount: increment(1) })
    } catch (error) {
      console.error('[PublicLink] Error registrando acceso:', error)
      setStatus('invalid')
    }
  }

  // NUEVA FUNCIÓN: Inferir modelo del dispositivo
  const inferDeviceModel = (userAgent: string, screenWidth: number, screenHeight: number, os: string): string => {
    // Android: Extraer modelo directamente del User-Agent
    const androidModelMatch = userAgent.match(/;\s*([A-Za-z0-9\s\-_]+)\s+Build\//)
    if (androidModelMatch) {
      return androidModelMatch[1].trim()
    }

    // Android: Buscar patrones de modelos conocidos
    const androidPatterns = [
      { pattern: /SM-G99[0-9]/, model: 'Samsung Galaxy S21' },
      { pattern: /SM-G998/, model: 'Samsung Galaxy S21 Ultra' },
      { pattern: /SM-S90[0-9]/, model: 'Samsung Galaxy S22' },
      { pattern: /SM-S908/, model: 'Samsung Galaxy S22 Ultra' },
      { pattern: /SM-S91[0-9]/, model: 'Samsung Galaxy S23' },
      { pattern: /SM-S918/, model: 'Samsung Galaxy S23 Ultra' },
      { pattern: /SM-S92[0-9]/, model: 'Samsung Galaxy S24' },
      { pattern: /Pixel [0-9]/, model: 'Google Pixel' },
      { pattern: /OnePlus/, model: 'OnePlus' },
      { pattern: /Redmi/, model: 'Xiaomi Redmi' },
      { pattern: /Mi [0-9]/, model: 'Xiaomi Mi' }
    ]

    for (const { pattern, model } of androidPatterns) {
      if (pattern.test(userAgent)) {
        return model
      }
    }

    // iOS/iPad: Inferir basado en resolución y versión del SO
    if (os === 'iOS') {
      const iosVersionMatch = userAgent.match(/OS (\d+)_(\d+)/)
      const iosVersion = iosVersionMatch ? `${iosVersionMatch[1]}.${iosVersionMatch[2]}` : ''
      
      // Mapa de resoluciones de iPhone (puntos, no píxeles físicos)
      const iPhoneModels: Record<string, string> = {
        '390x844': 'iPhone 13/14/15',
        '428x926': 'iPhone 13/14/15 Pro Max',
        '375x812': 'iPhone X/XS/11 Pro',
        '414x896': 'iPhone XR/11',
        '360x780': 'iPhone 12 mini/13 mini',
        '430x932': 'iPhone 14/15 Pro Max',
        '393x852': 'iPhone 14/15 Pro'
      }

      const resolution = `${screenWidth}x${screenHeight}`
      if (iPhoneModels[resolution]) {
        return `${iPhoneModels[resolution]} (iOS ${iosVersion})`
      }
    }

    // iPad: Inferir basado en resolución
    if (userAgent.includes('iPad')) {
      const resolution = `${screenWidth}x${screenHeight}`
      if (screenWidth >= 1024) {
        return `iPad Pro (${resolution})`
      } else {
        return `iPad Air/Mini (${resolution})`
      }
    }

    // Desktop: No se puede inferir modelo específico
    if (os === 'Windows' || os === 'macOS' || os === 'Linux') {
      return 'PC Desktop/Laptop (modelo no identificable)'
    }

    return 'Modelo no identificado'
  }

  const collectFingerprint = async () => {
    let batteryLevel = null
    let isCharging = null
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery()
        batteryLevel = battery.level
        isCharging = battery.charging
      }
    } catch (e) { /* API no soportada en este navegador */ }

    const nav = navigator as any
    const ua = navigator.userAgent
    const os = ua.includes('Windows') ? 'Windows' : ua.includes('Android') ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Desconocido'
    
    const deviceModel = inferDeviceModel(ua, window.screen.width, window.screen.height, os)

    return {
      cpuCores: navigator.hardwareConcurrency || null,
      ramGB: nav.deviceMemory || null,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      touchPoints: navigator.maxTouchPoints,
      networkType: nav.connection?.effectiveType || null,
      downlinkMbps: nav.connection?.downlink || null,
      saveData: nav.connection?.saveData || null,
      batteryLevel,
      isCharging,
      referrer: document.referrer || 'Acceso Directo',
      languages: navigator.languages,
      deviceModel
    }
  }

  const patchEvent = async (payload: Record<string, unknown>) => {
    if (!eventId) {
      console.error('[PublicLink] Intento de actualizar evento sin eventId')
      return
    }
    try {
      await updateDoc(doc(db, 'link_events', eventId), payload)
    } catch (error) {
      console.error('[PublicLink] Error actualizando consentimiento:', error)
    }
  }

  const getHighAccuracyLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      let bestPosition: GeolocationPosition | null = null
      let watchId: number | null = null
      let attempts = 0
      const maxAttempts = 3

      const tryGetLocation = () => {
        attempts++
        setLocationStatus(`Obteniendo ubicación... Intento ${attempts}/${maxAttempts}`)

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
              bestPosition = position
              setLocationStatus(`Precisión actual: ${Math.round(position.coords.accuracy)}m`)
            }
            if (position.coords.accuracy <= 50) {
              if (watchId !== null) navigator.geolocation.clearWatch(watchId)
              resolve(position)
            }
          },
          (error) => {
            if (attempts >= maxAttempts) {
              if (watchId !== null) navigator.geolocation.clearWatch(watchId)
              if (bestPosition) resolve(bestPosition)
              else reject(error)
            } else {
              setTimeout(tryGetLocation, 1000)
            }
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        )

        setTimeout(() => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId)
            if (bestPosition) resolve(bestPosition)
            else reject(new Error('Timeout obteniendo ubicación'))
          }
        }, 15000)
      }
      tryGetLocation()
    })
  }

  const handleAccept = async () => {
    if (!isReady || !eventId) {
      alert('El sistema aún se está inicializando. Por favor espere un momento.')
      return
    }

    setStatus('consent_granted')
    setLocationStatus('Analizando huella digital del dispositivo...')
    
    const fingerprint = await collectFingerprint()
    
    if (!navigator.geolocation) {
      await patchEvent({ 
        privacyAccepted: true, 
        locationGranted: false, 
        finalStatus: 'consent_granted_no_geolocation',
        fingerprint 
      })
      return
    }

    setLocationStatus('Solicitando ubicación de alta precisión...')
    try {
      const position = await getHighAccuracyLocation()
      setLocationStatus(`Ubicación obtenida con precisión de ${Math.round(position.coords.accuracy)}m`)
      await patchEvent({
        privacyAccepted: true,
        locationGranted: true,
        finalStatus: 'consent_granted_with_location',
        fingerprint,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed
        }
      })
    } catch (error) {
      console.error('Error obteniendo ubicación:', error)
      setLocationStatus('No se pudo obtener la ubicación')
      await patchEvent({ 
        privacyAccepted: true, 
        locationGranted: false, 
        finalStatus: 'consent_granted_location_denied',
        fingerprint 
      })
    }
  }

  const handleDecline = async () => {
    if (!isReady || !eventId) {
      alert('El sistema aún se está inicializando. Por favor espere un momento.')
      return
    }
    setStatus('consent_denied')
    const fingerprint = await collectFingerprint()
    await patchEvent({ 
      privacyAccepted: false, 
      locationGranted: false, 
      finalStatus: 'consent_denied',
      fingerprint 
    })
  }

  if (status === 'loading' || (status === 'consent_pending' && !isReady)) {
    return (
      <div className="min-h-screen bg-hacker-bg flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-hacker-green animate-spin mb-4" />
        <div className="text-hacker-green font-mono animate-pulse">INICIALIZANDO SISTEMA DE REGISTRO...</div>
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

  if (status === 'consent_pending' && isReady) {
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
              <p>Al aceptar, se registraran datos tecnicos de conexion y una <span className="text-hacker-cyan">huella digital del dispositivo</span> (hardware, red, estado de bateria y modelo inferido) con fines de prevencion de fraude.</p>
              <p className="mt-3">Si usted acepta, se solicitara ademas la <span className="text-hacker-green">ubicacion del dispositivo</span> mediante el permiso propio del navegador.</p>
              <p className="mt-3 text-hacker-dim">Tratamiento conforme a la Ley 1581 de 2012. Finalidad: apoyo documental a la investigacion.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDecline} className="flex-1 px-4 py-3 border border-hacker-red text-hacker-red font-mono text-sm rounded hover:bg-hacker-red/10 transition-all">RECHAZAR</button>
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
            <Cpu className="w-16 h-16 text-hacker-green mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-mono text-hacker-green mb-2">ANALIZANDO DISPOSITIVO</h1>
            <p className="text-hacker-dim font-mono text-sm">{locationStatus}</p>
            <p className="text-hacker-dim font-mono text-xs mt-4">Expediente: {caseCode}</p>
          </>
        ) : (
          <>
            <CheckCircle className="w-16 h-16 text-hacker-green mx-auto mb-4" />
            <h1 className="text-xl font-mono text-hacker-green mb-2">
              {status === 'consent_denied' ? 'ACCESO REGISTRADO SIN UBICACION' : 'VERIFICACION COMPLETADA'}
            </h1>
            <p className="text-hacker-dim font-mono text-sm">Su decision y huella digital han sido documentadas.</p>
            <p className="text-hacker-dim font-mono text-xs mt-4">Expediente: {caseCode}</p>
          </>
        )}
      </div>
    </div>
  )
}
