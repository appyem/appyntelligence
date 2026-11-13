import { useState, useEffect } from 'react'
import { Plus, FileText, AlertTriangle, CheckCircle, Link as LinkIcon } from 'lucide-react'
import Layout from '../components/Layout'
import { auth } from '../lib/firebase'
import { createInvestigation, getInvestigations, type Investigation } from '../lib/firestore'
import { createSmartLink } from '../lib/links'

export default function Dashboard() {
  const [showNewCaseModal, setShowNewCaseModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)
  const [caseTitle, setCaseTitle] = useState('')
  const [caseModality, setCaseModality] = useState('rental_scam')
  const [caseDescription, setCaseDescription] = useState('')
  const [caseCity, setCaseCity] = useState('')
  const [linkPurpose, setLinkPurpose] = useState('')
  const [linkExpires, setLinkExpires] = useState(30)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInvestigations()
  }, [])

  const loadInvestigations = async () => {
    try {
      const data = await getInvestigations()
      setInvestigations(data)
    } catch (error) {
      console.error('Error cargando expedientes:', error)
    }
  }

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const user = auth.currentUser
      if (!user) {
        alert('Error: Usuario no autenticado')
        return
      }

      await createInvestigation(
        caseTitle,
        caseModality,
        user.uid,
        caseDescription,
        caseCity
      )

      alert('Expediente creado exitosamente')
      setShowNewCaseModal(false)
      setCaseTitle('')
      setCaseDescription('')
      setCaseCity('')
      await loadInvestigations()
    } catch (error) {
      console.error('Error creando expediente:', error)
      alert('Error al crear el expediente')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvestigation) return
    
    setLoading(true)
    try {
      await createSmartLink(
        selectedInvestigation.id!,
        selectedInvestigation.caseCode,
        linkPurpose,
        linkExpires
      )
      alert(`Enlace generado exitosamente. Revise la seccion ENLACES INTELIGENTES.`)
      setShowLinkModal(false)
      setLinkPurpose('')
      setLinkExpires(30)
      setSelectedInvestigation(null)
    } catch (error) {
      console.error('Error generando enlace:', error)
      alert('Error al generar el enlace')
    } finally {
      setLoading(false)
    }
  }

  const openGenerateLinkModal = (inv: Investigation) => {
    setSelectedInvestigation(inv)
    setShowLinkModal(true)
  }

  const openCount = investigations.filter(i => i.status === 'open').length
  const analyzingCount = investigations.filter(i => i.status === 'analyzing').length
  const closedCount = investigations.filter(i => i.status === 'closed').length

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-mono text-hacker-cyan">PANEL DE CONTROL</h1>
            <p className="text-sm text-hacker-dim mt-1">Resumen de actividad de inteligencia</p>
          </div>
          <button 
            onClick={() => setShowNewCaseModal(true)}
            className="btn-hacker flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            NUEVO EXPEDIENTE
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-hacker-panel border border-hacker-border p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-5 h-5 text-hacker-cyan" />
              <span className="text-xs font-mono text-hacker-dim">ABIERTOS</span>
            </div>
            <div className="text-3xl font-mono text-hacker-green">{String(openCount).padStart(2, '0')}</div>
            <div className="text-xs text-hacker-dim mt-2">Expedientes activos</div>
          </div>

          <div className="bg-hacker-panel border border-hacker-border p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="w-5 h-5 text-hacker-red" />
              <span className="text-xs font-mono text-hacker-dim">EN ANALISIS</span>
            </div>
            <div className="text-3xl font-mono text-hacker-red">{String(analyzingCount).padStart(2, '0')}</div>
            <div className="text-xs text-hacker-dim mt-2">Casos en investigacion</div>
          </div>

          <div className="bg-hacker-panel border border-hacker-border p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-5 h-5 text-hacker-green" />
              <span className="text-xs font-mono text-hacker-dim">CERRADOS</span>
            </div>
            <div className="text-3xl font-mono text-hacker-cyan">{String(closedCount).padStart(2, '0')}</div>
            <div className="text-xs text-hacker-dim mt-2">Casos resueltos</div>
          </div>
        </div>

        {/* Lista de Expedientes Recientes */}
        <div className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
          <h2 className="text-lg font-mono text-hacker-cyan mb-4">EXPEDIENTES RECIENTES</h2>
          {investigations.length === 0 ? (
            <div className="text-center py-8 text-hacker-dim font-mono">
              No hay expedientes registrados. Cree uno nuevo para comenzar.
            </div>
          ) : (
            <div className="space-y-3">
              {investigations.slice(0, 5).map((inv) => (
                <div key={inv.id} className="bg-hacker-bg border border-hacker-border p-4 rounded flex justify-between items-center">
                  <div>
                    <div className="font-mono text-hacker-green text-sm">{inv.caseCode}</div>
                    <div className="text-hacker-dim text-sm mt-1">{inv.title}</div>
                    <div className="text-xs text-hacker-dim mt-1">{inv.city || 'Sin ciudad'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded text-xs font-mono ${
                      inv.status === 'open' ? 'bg-hacker-green/10 text-hacker-green' :
                      inv.status === 'analyzing' ? 'bg-hacker-red/10 text-hacker-red' :
                      'bg-hacker-cyan/10 text-hacker-cyan'
                    }`}>
                      {inv.status?.toUpperCase()}
                    </div>
                    <button
                      onClick={() => openGenerateLinkModal(inv)}
                      className="btn-hacker px-3 py-1 text-xs flex items-center gap-1"
                    >
                      <LinkIcon className="w-3 h-3" />
                      ENLACE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Nuevo Expediente */}
        {showNewCaseModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-hacker-panel border border-hacker-cyan rounded-lg w-full max-w-lg p-6 shadow-glow-cyan">
              <h2 className="text-lg font-mono text-hacker-cyan mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                REGISTRAR NUEVO EXPEDIENTE
              </h2>
              
              <form onSubmit={handleCreateCase} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Titulo del Caso</label>
                  <input
                    type="text"
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value)}
                    className="input-hacker"
                    placeholder="Ej: Estafa arrendamiento Bogota Norte"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Modalidad</label>
                  <select 
                    value={caseModality} 
                    onChange={(e) => setCaseModality(e.target.value)}
                    className="input-hacker"
                  >
                    <option value="rental_scam">Falsa Oferta de Arrendamiento</option>
                    <option value="identity_theft">Suplantacion de Identidad</option>
                    <option value="financial_fraud">Fraude Financiero</option>
                    <option value="phishing">Phishing / Ingenieria Social</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Ciudad</label>
                  <input
                    type="text"
                    value={caseCity}
                    onChange={(e) => setCaseCity(e.target.value)}
                    className="input-hacker"
                    placeholder="Ej: Bogota"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Descripcion (Opcional)</label>
                  <textarea
                    value={caseDescription}
                    onChange={(e) => setCaseDescription(e.target.value)}
                    className="input-hacker min-h-[100px] resize-none"
                    placeholder="Detalles iniciales del caso..."
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowNewCaseModal(false)}
                    className="flex-1 px-4 py-2 border border-hacker-border text-hacker-dim font-mono text-sm rounded hover:bg-hacker-bg transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-hacker"
                  >
                    {loading ? 'CREANDO...' : 'CREAR EXPEDIENTE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Generar Enlace */}
        {showLinkModal && selectedInvestigation && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-hacker-panel border border-hacker-green rounded-lg w-full max-w-lg p-6 shadow-glow-green">
              <h2 className="text-lg font-mono text-hacker-green mb-4 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                GENERAR ENLACE INTELIGENTE
              </h2>
              
              <div className="bg-hacker-bg border border-hacker-border rounded p-3 mb-4">
                <div className="text-xs text-hacker-dim font-mono mb-1">EXPEDIENTE ASOCIADO</div>
                <div className="text-hacker-green font-mono text-sm">{selectedInvestigation.caseCode}</div>
                <div className="text-hacker-dim text-xs mt-1">{selectedInvestigation.title}</div>
              </div>
              
              <form onSubmit={handleGenerateLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Proposito del Enlace</label>
                  <input
                    type="text"
                    value={linkPurpose}
                    onChange={(e) => setLinkPurpose(e.target.value)}
                    className="input-hacker"
                    placeholder="Ej: Verificacion de identidad del sospechoso"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Expiracion (dias)</label>
                  <select 
                    value={linkExpires} 
                    onChange={(e) => setLinkExpires(Number(e.target.value))}
                    className="input-hacker"
                  >
                    <option value={1}>1 dia</option>
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </div>

                <div className="bg-hacker-bg border border-hacker-border rounded p-3 text-xs font-mono text-hacker-dim">
                  <div className="text-hacker-cyan mb-1">INFORMACION REGISTRADA:</div>
                  <div>- IP publica del visitante</div>
                  <div>- Navegador y sistema operativo</div>
                  <div>- Idioma y zona horaria</div>
                  <div>- Ubicacion (con consentimiento expreso)</div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="flex-1 px-4 py-2 border border-hacker-border text-hacker-dim font-mono text-sm rounded hover:bg-hacker-bg transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-hacker"
                  >
                    {loading ? 'GENERANDO...' : 'GENERAR ENLACE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
