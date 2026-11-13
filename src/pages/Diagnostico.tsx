import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { db } from '../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { MapPin, Globe, Clock, FileText, Link as LinkIcon, Download, X, Map as MapIcon } from 'lucide-react'
import { createEvidenceFromDiagnosis } from '../lib/evidence'
import { getInvestigations, type Investigation } from '../lib/firestore'

interface EventData {
  id: string
  timestamp?: any
  ipAddress?: string
  browser?: string
  os?: string
  device?: string
  language?: string
  timezone?: string
  location?: { latitude: number; longitude: number; accuracy: number }
  privacyAccepted?: boolean
  locationGranted?: boolean
  accessType?: string
  linkId?: string
  token?: string
  sessionId?: string
}

interface LinkData {
  id: string
  token?: string
  investigationId?: string
  caseCode?: string
  purpose?: string
  status?: string
  createdAt?: any
  accessCount?: number
}

interface InvestigationData {
  id: string
  caseCode?: string
  title?: string
  modality?: string
  city?: string
}

interface EnrichedEvent extends EventData {
  link?: LinkData
  investigation?: InvestigationData
}

export default function Diagnostico() {
  const [events, setEvents] = useState<EnrichedEvent[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EnrichedEvent | null>(null)
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)

  useEffect(() => {
    loadAllData()
    loadInvestigations()
  }, [])

  const loadAllData = async () => {
    try {
      const eventsSnap = await getDocs(collection(db, 'link_events'))
      const allEvents: EventData[] = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as EventData))
      
      const linksSnap = await getDocs(collection(db, 'smart_links'))
      const linksMap = new Map<string, LinkData>()
      linksSnap.docs.forEach(d => {
        linksMap.set(d.id, { id: d.id, ...d.data() } as LinkData)
      })
      
      const invSnap = await getDocs(collection(db, 'investigations'))
      const invMap = new Map<string, InvestigationData>()
      invSnap.docs.forEach(d => {
        invMap.set(d.id, { id: d.id, ...d.data() } as InvestigationData)
      })
      
      const enrichedEvents: EnrichedEvent[] = allEvents.map(event => {
        const link = event.linkId ? linksMap.get(event.linkId) : undefined
        const investigation = link?.investigationId ? invMap.get(link.investigationId) : undefined
        return { ...event, link, investigation }
      })
      
      enrichedEvents.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
      setEvents(enrichedEvents)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInvestigations = async () => {
    try {
      const data = await getInvestigations()
      setInvestigations(data)
    } catch (error) {
      console.error('Error cargando expedientes:', error)
    }
  }

  const openSaveModal = (event: EnrichedEvent) => {
    setSelectedEvent(event)
    if (event.investigation) {
      const inv = investigations.find(i => i.id === event.investigation?.id)
      setSelectedInvestigation(inv || null)
    }
    setShowModal(true)
  }

  const handleSaveAsEvidence = async () => {
    if (!selectedEvent || !selectedInvestigation) {
      alert('Seleccione un expediente')
      return
    }

    setSaving(selectedEvent.id)
    try {
      await createEvidenceFromDiagnosis(
        selectedInvestigation.id!,
        selectedInvestigation.caseCode,
        selectedEvent,
        selectedEvent.link
      )
      alert('Diagnóstico guardado como evidencia correctamente')
      setShowModal(false)
      setSelectedEvent(null)
      setSelectedInvestigation(null)
    } catch (error) {
      console.error('Error guardando como evidencia:', error)
      alert('Error al guardar el diagnóstico como evidencia')
    } finally {
      setSaving(null)
    }
  }

  const formatTimestamp = (ts: any) => {
    if (!ts?.toDate) return 'N/A'
    return ts.toDate().toLocaleString('es-CO', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://www.google.com/maps?q=${lat},${lng}&z=18&output=embed`
  }

  if (loading) return <Layout><div className="text-center py-12 text-hacker-green font-mono">CARGANDO DATOS...</div></Layout>

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-mono text-hacker-cyan mb-6">DIAGNOSTICO COMPLETO DE EVENTOS</h1>
        
        <div className="bg-hacker-panel border border-hacker-border rounded-lg p-4 mb-6">
          <div className="text-hacker-dim text-sm">Total de eventos registrados: <span className="text-hacker-green font-mono text-lg">{events.length}</span></div>
        </div>

        {events.length === 0 ? (
          <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
            <p className="text-hacker-dim font-mono">No hay eventos en la base de datos.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.map((event) => (
              <div key={event.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
                {event.investigation && (
                  <div className="bg-hacker-bg border border-hacker-green/30 rounded p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-hacker-green" />
                      <span className="font-mono text-hacker-green text-sm">EXPEDIENTE ASOCIADO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div><span className="text-hacker-dim">Código:</span> <span className="text-hacker-cyan">{event.investigation.caseCode}</span></div>
                      <div><span className="text-hacker-dim">Modalidad:</span> <span className="text-hacker-cyan">{event.investigation.modality}</span></div>
                      <div className="col-span-2"><span className="text-hacker-dim">Título:</span> <span className="text-hacker-cyan">{event.investigation.title}</span></div>
                      {event.investigation.city && <div><span className="text-hacker-dim">Ciudad:</span> <span className="text-hacker-cyan">{event.investigation.city}</span></div>}
                    </div>
                  </div>
                )}

                {event.link && (
                  <div className="bg-hacker-bg border border-hacker-cyan/30 rounded p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon className="w-4 h-4 text-hacker-cyan" />
                      <span className="font-mono text-hacker-cyan text-sm">ENLACE INTELIGENTE</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div><span className="text-hacker-dim">Propósito:</span> <span className="text-hacker-green">{event.link.purpose}</span></div>
                      <div><span className="text-hacker-dim">Estado:</span> <span className="text-hacker-green">{event.link.status?.toUpperCase()}</span></div>
                      <div><span className="text-hacker-dim">Creado:</span> <span className="text-hacker-cyan">{formatTimestamp(event.link.createdAt)}</span></div>
                      <div><span className="text-hacker-dim">Accesos totales:</span> <span className="text-hacker-cyan">{event.link.accessCount || 0}</span></div>
                      <div className="col-span-2">
                        <span className="text-hacker-dim">URL:</span>
                        <code className="text-hacker-green text-xs break-all ml-2">{window.location.origin}/i/{event.link.token}</code>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-hacker-dim" />
                    <span className="font-mono text-hacker-cyan text-sm">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${
                      event.accessType === 'human_visit' ? 'bg-hacker-green/10 text-hacker-green' : 'bg-hacker-cyan/10 text-hacker-cyan'
                    }`}>
                      {event.accessType?.toUpperCase()}
                    </span>
                    <button
                      onClick={() => openSaveModal(event)}
                      disabled={saving === event.id}
                      className="btn-hacker px-3 py-1 text-xs flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      {saving === event.id ? 'GUARDANDO...' : 'GUARDAR COMO EVIDENCIA'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <div className="text-hacker-dim mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> IP PÚBLICA</div>
                    <div className="text-hacker-green text-base">{event.ipAddress}</div>
                  </div>
                  <div>
                    <div className="text-hacker-dim mb-1">NAVEGADOR / SO</div>
                    <div className="text-hacker-cyan">{event.browser} / {event.os}</div>
                  </div>
                  <div>
                    <div className="text-hacker-dim mb-1">DISPOSITIVO</div>
                    <div className="text-hacker-cyan">{event.device}</div>
                  </div>
                  <div>
                    <div className="text-hacker-dim mb-1">IDIOMA / ZONA HORARIA</div>
                    <div className="text-hacker-cyan">{event.language} / {event.timezone}</div>
                  </div>

                  {event.location && (
                    <div className="col-span-2">
                      <div className="bg-hacker-bg border border-hacker-green/30 rounded p-3 mb-3">
                        <div className="text-hacker-green mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> UBICACIÓN GPS AUTORIZADA</div>
                        <div className="text-hacker-green text-base mb-2">
                          Latitud: {event.location.latitude.toFixed(6)}<br/>
                          Longitud: {event.location.longitude.toFixed(6)}<br/>
                          <span className="text-hacker-dim text-xs">Precisión: {Math.round(event.location.accuracy)} metros</span>
                        </div>
                      </div>
                      
                      {/* Mapa de Google Maps */}
                      <div className="bg-hacker-bg border border-hacker-cyan/30 rounded overflow-hidden">
                        <div className="bg-hacker-cyan/10 px-3 py-2 flex items-center gap-2 border-b border-hacker-cyan/30">
                          <MapIcon className="w-4 h-4 text-hacker-cyan" />
                          <span className="font-mono text-hacker-cyan text-xs">UBICACIÓN EN MAPA - GOOGLE MAPS</span>
                        </div>
                        <iframe
                          src={getGoogleMapsUrl(event.location.latitude, event.location.longitude)}
                          width="100%"
                          height="300"
                          style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Ubicación GPS"
                        ></iframe>
                        <div className="bg-hacker-bg px-3 py-2 text-xs font-mono text-hacker-dim border-t border-hacker-cyan/30">
                          <a 
                            href={`https://www.google.com/maps?q=${event.location.latitude},${event.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-hacker-cyan hover:text-hacker-green transition-all"
                          >
                            Abrir en Google Maps en nueva pestaña →
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-hacker-border text-xs font-mono">
                  <div className="flex gap-6 mb-2">
                    <span className="text-hacker-dim">Privacidad: <span className={event.privacyAccepted ? 'text-hacker-green' : 'text-hacker-red'}>{event.privacyAccepted ? '✓ ACEPTADA' : '✗ RECHAZADA'}</span></span>
                    <span className="text-hacker-dim">Ubicación: <span className={event.locationGranted ? 'text-hacker-green' : 'text-hacker-red'}>{event.locationGranted ? '✓ AUTORIZADA' : '✗ DENEGADA'}</span></span>
                  </div>
                  <div className="text-hacker-dim/60 break-all">
                    <strong>Session ID:</strong> {event.sessionId}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de selección de expediente */}
        {showModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-hacker-panel border border-hacker-green rounded-lg w-full max-w-lg p-6 shadow-glow-green max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-mono text-hacker-green flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  GUARDAR COMO EVIDENCIA
                </h2>
                <button
                  onClick={() => { setShowModal(false); setSelectedEvent(null); setSelectedInvestigation(null) }}
                  className="text-hacker-dim hover:text-hacker-red transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-hacker-bg border border-hacker-border rounded p-4 mb-4">
                <div className="text-xs text-hacker-dim font-mono mb-2">EVENTO A GUARDAR</div>
                <div className="text-hacker-cyan text-sm">
                  {selectedEvent.investigation?.caseCode || 'Sin expediente asociado'} - {formatTimestamp(selectedEvent.timestamp)}
                </div>
                <div className="text-hacker-dim text-xs mt-1">
                  IP: {selectedEvent.ipAddress} | {selectedEvent.browser} / {selectedEvent.os}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">
                  Seleccionar Expediente de Destino
                </label>
                <select
                  value={selectedInvestigation?.id || ''}
                  onChange={(e) => {
                    const inv = investigations.find(i => i.id === e.target.value)
                    setSelectedInvestigation(inv || null)
                  }}
                  className="input-hacker"
                  required
                >
                  <option value="">Seleccione un expediente...</option>
                  {investigations.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.caseCode} - {inv.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvestigation && (
                <div className="bg-hacker-bg border border-hacker-green/30 rounded p-3 mb-4 text-xs font-mono">
                  <div className="text-hacker-green mb-1">EXPEDIENTE SELECCIONADO:</div>
                  <div className="text-hacker-cyan">{selectedInvestigation.caseCode}</div>
                  <div className="text-hacker-dim text-xs mt-1">{selectedInvestigation.title}</div>
                </div>
              )}

              <div className="bg-hacker-bg border border-hacker-border rounded p-3 mb-4 text-xs font-mono text-hacker-dim">
                <div className="text-hacker-cyan mb-1">SE CREARÁ:</div>
                <div>- Archivo JSON con toda la información del diagnóstico</div>
                <div>- Hash SHA-256 del archivo</div>
                <div>- Registro en cadena de custodia</div>
                <div>- Almacenamiento seguro en Firebase</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowModal(false); setSelectedEvent(null); setSelectedInvestigation(null) }}
                  className="flex-1 px-4 py-2 border border-hacker-border text-hacker-dim font-mono text-sm rounded hover:bg-hacker-bg transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleSaveAsEvidence}
                  disabled={!selectedInvestigation || saving !== null}
                  className="flex-1 btn-hacker disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'GUARDANDO...' : 'GUARDAR EVIDENCIA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
