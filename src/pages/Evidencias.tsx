import { useState, useEffect } from 'react'
import { Upload, Image, Video, Music, File, Eye, Download } from 'lucide-react'
import Layout from '../components/Layout'
import { db } from '../lib/firebase'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { uploadEvidence, formatFileSize, formatTimestamp, type Evidence } from '../lib/evidence'
import { getInvestigations, type Investigation } from '../lib/firestore'

export default function Evidencias() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [evidenceType, setEvidenceType] = useState<Evidence['type']>('screenshot')
  const [description, setDescription] = useState('')
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadAllEvidence()
    loadInvestigations()
  }, [])

  const loadAllEvidence = async () => {
    try {
      const q = query(collection(db, 'evidence'), orderBy('uploadedAt', 'desc'))
      const querySnapshot = await getDocs(q)
      const allEvidence = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Evidence[]
      setEvidence(allEvidence)
    } catch (error) {
      console.error('Error cargando evidencias:', error)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !selectedInvestigation) {
      alert('Seleccione un expediente y un archivo')
      return
    }

    setUploading(true)
    try {
      await uploadEvidence(
        selectedInvestigation.id!,
        selectedInvestigation.caseCode,
        selectedFile,
        evidenceType,
        description
      )
      alert('Evidencia cargada exitosamente')
      setShowUploadModal(false)
      setSelectedFile(null)
      setDescription('')
      setSelectedInvestigation(null)
      await loadAllEvidence()
    } catch (error) {
      console.error('Error subiendo evidencia:', error)
      alert('Error al subir la evidencia')
    } finally {
      setUploading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'photo':
      case 'screenshot':
        return <Image className="w-5 h-5 text-hacker-cyan" />
      case 'video':
        return <Video className="w-5 h-5 text-hacker-cyan" />
      case 'audio':
        return <Music className="w-5 h-5 text-hacker-cyan" />
      default:
        return <File className="w-5 h-5 text-hacker-cyan" />
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-mono text-hacker-cyan">BOVEDA DE EVIDENCIAS</h1>
            <p className="text-sm text-hacker-dim mt-1">Repositorio seguro con cadena de custodia</p>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-hacker flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            CARGAR EVIDENCIA
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-hacker-green font-mono animate-pulse">
            CARGANDO EVIDENCIAS...
          </div>
        ) : evidence.length === 0 ? (
          <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
            <File className="w-12 h-12 text-hacker-dim mx-auto mb-4" />
            <p className="text-hacker-dim font-mono">No hay evidencias registradas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {evidence.map((ev) => (
              <div key={ev.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  {getIcon(ev.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-hacker-green text-sm">{ev.caseCode}</span>
                      <span className="text-xs text-hacker-dim font-mono uppercase">{ev.type}</span>
                    </div>
                    <div className="text-hacker-dim text-sm mb-2 truncate">{ev.fileName}</div>
                    <div className="flex gap-4 text-xs font-mono text-hacker-dim">
                      <span>Tamaño: {formatFileSize(ev.fileSize)}</span>
                      <span>Subido: {formatTimestamp(ev.uploadedAt)}</span>
                    </div>
                    <div className="mt-2 text-xs font-mono text-hacker-dim">
                      <span className="text-hacker-cyan">SHA-256: </span>
                      <span className="text-hacker-green break-all">{ev.sha256}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-hacker px-3 py-1 text-xs flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      VER
                    </a>
                    <a href={ev.fileUrl} download={ev.fileName} className="btn-hacker px-3 py-1 text-xs flex items-center gap-1">
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showUploadModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-hacker-panel border border-hacker-green rounded-lg w-full max-w-lg p-6 shadow-glow-green max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-mono text-hacker-green mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                CARGAR NUEVA EVIDENCIA
              </h2>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Expediente</label>
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

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Tipo de Evidencia</label>
                  <select 
                    value={evidenceType} 
                    onChange={(e) => setEvidenceType(e.target.value as Evidence['type'])}
                    className="input-hacker"
                  >
                    <option value="screenshot">Captura de Pantalla</option>
                    <option value="photo">Fotografia</option>
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                    <option value="document">Documento</option>
                    <option value="chat">Conversacion</option>
                    <option value="receipt">Comprobante</option>
                    <option value="other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Archivo</label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="input-hacker"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-hacker-dim mb-2 uppercase">Descripcion (Opcional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input-hacker min-h-[80px] resize-none"
                    placeholder="Detalles de la evidencia..."
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 px-4 py-2 border border-hacker-border text-hacker-dim font-mono text-sm rounded hover:bg-hacker-bg transition-all"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-1 btn-hacker"
                  >
                    {uploading ? 'SUBIENDO...' : 'CARGAR EVIDENCIA'}
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
