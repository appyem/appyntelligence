import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Link as LinkIcon, Upload, Activity, AlertCircle, MapPin, Globe, Clock, RefreshCw } from 'lucide-react'
import Layout from '../components/Layout'
import { db } from '../lib/firebase'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { subscribeToLinksByInvestigation, type SmartLink } from '../lib/links'
import { subscribeToEvidenceByInvestigation, formatFileSize, formatTimestamp, type Evidence } from '../lib/evidence'
import { subscribeToEventsByInvestigation, formatEventTimestamp, getAccessTypeLabel, type LinkEvent } from '../lib/events'
import type { Investigation } from '../lib/firestore'

export default function ExpedienteDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [links, setLinks] = useState<SmartLink[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [events, setEvents] = useState<LinkEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(true)
  const [syncError, setSyncError] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'links' | 'evidence' | 'events'>('info')

  useEffect(() => {
    if (!id) return
    let alive = true

    getDoc(doc(db, 'investigations', id))
      .then((snap) => {
        if (!alive) return
        if (snap.exists()) setInvestigation({ id: snap.id, ...snap.data() } as Investigation)
      })
      .catch((e) => setSyncError(String(e)))
      .finally(() => { if (alive) setLoading(false) })

    const reportError = (error: unknown) => {
      console.error('[Detalle] Error de sincronizacion:', error)
      setSyncError(error instanceof Error ? error.message : String(error))
      setSyncing(false)
    }

    const unsubLinks = subscribeToLinksByInvestigation(id, setLinks, reportError)
    const unsubEvidence = subscribeToEvidenceByInvestigation(id, setEvidence, reportError)
    const unsubEvents = subscribeToEventsByInvestigation(id, (data) => {
      setEvents(data)
      setSyncing(false)
      setSyncError('')
    }, reportError)

    return () => {
      alive = false
      unsubLinks()
      unsubEvidence()
      unsubEvents()
    }
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !investigation) return
    try {
      await updateDoc(doc(db, 'investigations', id), { status: newStatus, updatedAt: serverTimestamp() })
      setInvestigation({ ...investigation, status: newStatus as Investigation['status'] })
    } catch (error) {
      console.error('Error actualizando estado:', error)
    }
  }

  if (loading) return <Layout><div className="text-center py-12 text-hacker-green font-mono animate-pulse">CARGANDO EXPEDIENTE...</div></Layout>

  if (!investigation) return (
    <Layout>
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-hacker-red mx-auto mb-4" />
        <p className="text-hacker-dim font-mono">Expediente no encontrado</p>
      </div>
    </Layout>
  )

  const consentedEvents = events.filter(e => e.privacyAccepted).length
  const locatedEvents = events.filter(e => e.location).length

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/expedientes')} className="flex items-center gap-2 text-hacker-dim hover:text-hacker-cyan font-mono text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> VOLVER A EXPEDIENTES
        </button>

        {syncError && (
          <div className="bg-hacker-red/10 border border-hacker-red/40 rounded p-3 mb-4 text-xs font-mono text-hacker-red break-all">
            ERROR DE SINCRONIZACION: {syncError}
          </div>
        )}

        <div className="bg-hacker-panel border border-hacker-border rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-mono text-hacker-green text-lg mb-2">{investigation.caseCode}</div>
              <h1 className="text-2xl text-hacker-cyan mb-2">{investigation.title}</h1>
              <div className="flex gap-4 text-sm font-mono text-hacker-dim">
                <span>Modalidad: {investigation.modality}</span>
                <span>Ciudad: {investigation.city || 'N/A'}</span>
              </div>
            </div>
            <select value={investigation.status} onChange={(e) => handleStatusChange(e.target.value)} className="input-hacker max-w-[200px]">
              <option value="open">ABIERTO</option>
              <option value="analyzing">EN ANALISIS</option>
              <option value="closed">CERRADO</option>
              <option value="archived">ARCHIVADO</option>
            </select>
          </div>
          {investigation.description && <div className="mt-4 p-4 bg-hacker-bg border border-hacker-border rounded text-sm text-hacker-dim">{investigation.description}</div>}
        </div>

        <div className="flex gap-2 mb-6 border-b border-hacker-border">
          {(['info', 'links', 'evidence', 'events'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-mono text-sm transition-all flex items-center gap-2 ${activeTab === tab ? 'text-hacker-green border-b-2 border-hacker-green' : 'text-hacker-dim hover:text-hacker-cyan'}`}>
              {tab === 'info' && 'INFORMACION'}
              {tab === 'links' && `ENLACES (${links.length})`}
              {tab === 'evidence' && `EVIDENCIAS (${evidence.length})`}
              {tab === 'events' && (
                <>
                  {`EVENTOS (${events.length})`}
                  {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <span className="w-2 h-2 rounded-full bg-hacker-green animate-pulse" />}
                </>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
            <h2 className="text-lg font-mono text-hacker-cyan mb-4">RESUMEN DEL EXPEDIENTE</h2>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between"><span className="text-hacker-dim">Creado:</span><span className="text-hacker-cyan">{formatTimestamp(investigation.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-hacker-dim">Ultima actualizacion:</span><span className="text-hacker-cyan">{formatTimestamp(investigation.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-hacker-dim">Enlaces generados:</span><span className="text-hacker-green">{links.length}</span></div>
              <div className="flex justify-between"><span className="text-hacker-dim">Eventos de acceso:</span><span className="text-hacker-green">{events.length}</span></div>
              <div className="flex justify-between"><span className="text-hacker-dim">Consentimientos otorgados:</span><span className="text-hacker-green">{consentedEvents}</span></div>
              <div className="flex justify-between"><span className="text-hacker-dim">Ubicaciones autorizadas:</span><span className="text-hacker-green">{locatedEvents}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-4">
            {links.length === 0 ? (
              <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
                <LinkIcon className="w-12 h-12 text-hacker-dim mx-auto mb-4" />
                <p className="text-hacker-dim font-mono">No hay enlaces generados. Creelos desde el Dashboard.</p>
              </div>
            ) : links.map((link) => (
              <div key={link.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono text-hacker-green text-sm">{link.purpose}</div>
                    <div className="text-xs text-hacker-dim mt-1">Accesos: {link.accessCount ?? 0} | Expira: {formatTimestamp(link.expiresAt)}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-mono ${link.status === 'active' ? 'bg-hacker-green/10 text-hacker-green' : 'bg-hacker-red/10 text-hacker-red'}`}>{link.status?.toUpperCase()}</span>
                </div>
                <code className="text-xs text-hacker-cyan font-mono break-all">{window.location.origin}/i/{link.token}</code>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-4">
            {evidence.length === 0 ? (
              <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 text-hacker-dim mx-auto mb-4" />
                <p className="text-hacker-dim font-mono">No hay evidencias cargadas para este expediente.</p>
              </div>
            ) : evidence.map((ev) => (
              <div key={ev.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-hacker-cyan text-sm mb-1 truncate">{ev.fileName}</div>
                    <div className="text-xs text-hacker-dim">{ev.type} | {formatFileSize(ev.fileSize)} | {formatTimestamp(ev.uploadedAt)}</div>
                    <div className="text-xs text-hacker-green font-mono mt-2 break-all">SHA-256: {ev.sha256}</div>
                  </div>
                  <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-hacker px-3 py-1 text-xs">VER</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-hacker-dim flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-hacker-green animate-pulse" />
              CANAL EN VIVO ACTIVO - los accesos aparecen sin recargar la pagina
            </div>

            {events.length === 0 ? (
              <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
                <Activity className="w-12 h-12 text-hacker-dim mx-auto mb-4" />
                <p className="text-hacker-dim font-mono">Sin eventos registrados para este expediente.</p>
                <p className="text-xs text-hacker-dim mt-2">Genere un enlace en el Dashboard y abralo en otra pestaña.</p>
              </div>
            ) : events.map((event) => {
              const info = getAccessTypeLabel(event.accessType)
              return (
                <div key={event.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-hacker-dim" />
                      <span className="font-mono text-hacker-cyan text-sm">{formatEventTimestamp(event.timestamp)}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-mono ${info.color} bg-hacker-bg border border-hacker-border`}>{info.label}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <div className="text-hacker-dim mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> IP PUBLICA OBSERVADA</div>
                      <div className="text-hacker-green">{event.ipAddress}</div>
                    </div>
                    <div><div className="text-hacker-dim mb-1">NAVEGADOR / SO</div><div className="text-hacker-cyan">{event.browser} / {event.os}</div></div>
                    <div><div className="text-hacker-dim mb-1">DISPOSITIVO</div><div className="text-hacker-cyan">{event.device}</div></div>
                    <div><div className="text-hacker-dim mb-1">IDIOMA / ZONA</div><div className="text-hacker-cyan">{event.language} / {event.timezone}</div></div>

                    {event.location ? (
                      <div className="col-span-2">
                        <div className="text-hacker-dim mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> UBICACION GPS AUTORIZADA</div>
                        <div className="text-hacker-green">
                          Lat: {event.location.latitude.toFixed(6)}, Lng: {event.location.longitude.toFixed(6)}
                          <span className="text-hacker-dim ml-2">(precision reportada: {Math.round(event.location.accuracy)} m)</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 pt-3 border-t border-hacker-border text-xs font-mono text-hacker-dim">
                    <div className="flex gap-4">
                      <span>Privacidad: {event.privacyAccepted ? 'ACEPTADA' : 'NO ACEPTADA'}</span>
                      <span>Ubicacion: {event.locationGranted ? 'AUTORIZADA' : 'NO AUTORIZADA'}</span>
                    </div>
                    <div className="mt-1 text-hacker-dim/60 break-all">User-Agent: {event.userAgent}</div>
                    <div className="mt-2 text-hacker-dim/60">
                      Nota: un acceso HTTP no prueba que una persona haya abierto el enlace. Puede ser una vista previa automatizada.
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
