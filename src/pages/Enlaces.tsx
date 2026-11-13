import { useState, useEffect } from 'react'
import { Link as LinkIcon, Copy, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import { db } from '../lib/firebase'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { deleteSmartLink, type SmartLink } from '../lib/links'

export default function Enlaces() {
  const [links, setLinks] = useState<SmartLink[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadAllLinks()
  }, [])

  const loadAllLinks = async () => {
    try {
      const q = query(collection(db, 'smart_links'), orderBy('createdAt', 'desc'))
      const querySnapshot = await getDocs(q)
      const allLinks = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SmartLink[]
      setLinks(allLinks)
    } catch (error) {
      console.error('Error cargando enlaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/i/${token}`
    navigator.clipboard.writeText(url)
    alert('Enlace copiado al portapapeles')
  }

  const handleDelete = async (linkId: string) => {
    if (!confirm('¿Está seguro de eliminar este enlace y todos sus eventos asociados? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleting(linkId)
    try {
      await deleteSmartLink(linkId)
      alert('Enlace y eventos eliminados correctamente')
      await loadAllLinks()
    } catch (error) {
      console.error('Error eliminando enlace:', error)
      alert('Error al eliminar el enlace')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate()
    return date.toLocaleDateString('es-CO', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono text-hacker-cyan">ENLACES INTELIGENTES</h1>
          <p className="text-sm text-hacker-dim mt-1">Motor de trazabilidad y recolección de eventos</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-hacker-green font-mono animate-pulse">
            CARGANDO ENLACES...
          </div>
        ) : links.length === 0 ? (
          <div className="bg-hacker-panel border border-hacker-border rounded-lg p-12 text-center">
            <LinkIcon className="w-12 h-12 text-hacker-dim mx-auto mb-4" />
            <p className="text-hacker-dim font-mono">No hay enlaces generados aún.</p>
            <p className="text-xs text-hacker-dim mt-2">Genere enlaces desde el Dashboard de expedientes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <div key={link.id} className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-hacker-green text-sm">{link.caseCode}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        link.status === 'active' ? 'bg-hacker-green/10 text-hacker-green' :
                        link.status === 'expired' ? 'bg-hacker-red/10 text-hacker-red' :
                        'bg-hacker-dim/10 text-hacker-dim'
                      }`}>
                        {link.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-hacker-dim text-sm">{link.purpose}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs text-hacker-dim font-mono">ACCESOS</div>
                      <div className="text-2xl font-mono text-hacker-cyan">{link.accessCount || 0}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(link.id!)}
                      disabled={deleting === link.id}
                      className="px-3 py-2 border border-hacker-red text-hacker-red font-mono text-xs rounded hover:bg-hacker-red/10 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-hacker-bg border border-hacker-border rounded p-3 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-hacker-green font-mono flex-1 truncate">
                      {window.location.origin}/i/{link.token}
                    </code>
                    <button
                      onClick={() => copyToClipboard(link.token)}
                      className="btn-hacker px-3 py-1 text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      COPIAR
                    </button>
                  </div>
                </div>

                <div className="flex gap-6 text-xs font-mono text-hacker-dim">
                  <div>
                    <span className="text-hacker-dim">Creado: </span>
                    <span className="text-hacker-cyan">{formatDate(link.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-hacker-dim">Expira: </span>
                    <span className="text-hacker-cyan">{formatDate(link.expiresAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
