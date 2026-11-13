import { db } from './firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'

export interface LinkEvent {
  id?: string
  linkId: string
  token: string
  timestamp: Timestamp | null
  ipAddress: string
  userAgent: string
  browser: string
  os: string
  device: string
  language: string
  timezone: string
  accessType: string
  finalStatus?: string
  location?: { latitude: number; longitude: number; accuracy: number } | null
  privacyAccepted: boolean
  locationGranted: boolean
  sessionId: string
}

/**
 * Suscripcion en tiempo real a los eventos de un expediente.
 * Consulta de un solo campo (linkId) => indice automatico, sin configuracion en Firebase.
 * El orden se hace en el cliente.
 */
export const subscribeToEventsByInvestigation = (
  investigationId: string,
  onChange: (events: LinkEvent[]) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  const buckets = new Map<string, LinkEvent[]>()
  let eventUnsubs: Array<() => void> = []

  const emit = () => {
    const all = Array.from(buckets.values()).flat()
    all.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
    onChange(all)
  }

  const linksQuery = query(collection(db, 'smart_links'), where('investigationId', '==', investigationId))

  const unsubLinks = onSnapshot(linksQuery, (snap) => {
    eventUnsubs.forEach(u => u())
    eventUnsubs = []
    buckets.clear()

    const linkIds = snap.docs.map(d => d.id)
    if (linkIds.length === 0) {
      onChange([])
      return
    }

    linkIds.forEach((linkId) => {
      const eq = query(collection(db, 'link_events'), where('linkId', '==', linkId))
      const unsub = onSnapshot(eq, (es) => {
        buckets.set(linkId, es.docs.map(d => ({ id: d.id, ...d.data() })) as LinkEvent[])
        emit()
      }, (error) => onError?.(error))
      eventUnsubs.push(unsub)
    })
  }, (error) => onError?.(error))

  return () => {
    unsubLinks()
    eventUnsubs.forEach(u => u())
    eventUnsubs = []
  }
}

export const formatEventTimestamp = (timestamp: any): string => {
  if (!timestamp?.toDate) return 'pendiente...'
  return timestamp.toDate().toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

export const getAccessTypeLabel = (accessType: string): { label: string; color: string } => {
  switch (accessType) {
    case 'human_visit': return { label: 'ACCESO DE NAVEGADOR', color: 'text-hacker-green' }
    case 'bot_preview': return { label: 'VISTA PREVIA (BOT)', color: 'text-hacker-cyan' }
    case 'browser_prefetch': return { label: 'PRE-CARGA NAVEGADOR', color: 'text-hacker-dim' }
    default: return { label: (accessType || 'DESCONOCIDO').toUpperCase(), color: 'text-hacker-dim' }
  }
}
