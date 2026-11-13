import { useState, useEffect } from 'react'
import { FileText, Search, Filter } from 'lucide-react'
import Layout from '../components/Layout'
import { getInvestigations, type Investigation } from '../lib/firestore'

export default function Expedientes() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModality, setFilterModality] = useState('all')

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

  const filteredInvestigations = investigations.filter(inv => {
    const matchesSearch = inv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.caseCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterModality === 'all' || inv.modality === filterModality
    return matchesSearch && matchesFilter
  })

  const getModalityLabel = (modality: string) => {
    const labels: Record<string, string> = {
      'rental_scam': 'Arrendamiento Falso',
      'identity_theft': 'Suplantacion',
      'financial_fraud': 'Fraude Financiero',
      'phishing': 'Phishing'
    }
    return labels[modality] || modality
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono text-hacker-cyan">GESTION DE EXPEDIENTES</h1>
          <p className="text-sm text-hacker-dim mt-1">Base de datos de investigaciones activas</p>
        </div>

        {/* Filtros */}
        <div className="bg-hacker-panel border border-hacker-border rounded-lg p-4 mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hacker-dim" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-hacker pl-10"
              placeholder="Buscar por codigo o titulo..."
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hacker-dim" />
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className="input-hacker pl-10 min-w-[200px]"
            >
              <option value="all">Todas las modalidades</option>
              <option value="rental_scam">Arrendamiento Falso</option>
              <option value="identity_theft">Suplantacion</option>
              <option value="financial_fraud">Fraude Financiero</option>
              <option value="phishing">Phishing</option>
            </select>
          </div>
        </div>

        {/* Lista de Expedientes */}
        <div className="bg-hacker-panel border border-hacker-border rounded-lg">
          <div className="p-4 border-b border-hacker-border flex justify-between items-center">
            <h2 className="font-mono text-hacker-cyan">EXPEDIENTES ({filteredInvestigations.length})</h2>
          </div>

          {filteredInvestigations.length === 0 ? (
            <div className="text-center py-12 text-hacker-dim font-mono">
              {investigations.length === 0 
                ? 'No hay expedientes registrados. Cree uno desde el Dashboard.'
                : 'No se encontraron expedientes con los filtros aplicados.'}
            </div>
          ) : (
            <div className="divide-y divide-hacker-border">
              {filteredInvestigations.map((inv) => (
                <div key={inv.id} className="p-4 hover:bg-hacker-bg transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-4 h-4 text-hacker-green" />
                        <span className="font-mono text-hacker-green text-sm">{inv.caseCode}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          inv.status === 'open' ? 'bg-hacker-green/10 text-hacker-green' :
                          inv.status === 'analyzing' ? 'bg-hacker-red/10 text-hacker-red' :
                          inv.status === 'closed' ? 'bg-hacker-cyan/10 text-hacker-cyan' :
                          'bg-hacker-dim/10 text-hacker-dim'
                        }`}>
                          {inv.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-hacker-dim text-sm mb-1">{inv.title}</div>
                      <div className="flex gap-4 text-xs font-mono text-hacker-dim">
                        <span>Modalidad: {getModalityLabel(inv.modality)}</span>
                        {inv.city && <span>Ciudad: {inv.city}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
