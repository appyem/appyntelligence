import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Shield, Terminal } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError('ACCESO DENEGADO: Credenciales invalidas o usuario no existe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hacker-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hacker-green/10 border border-hacker-green/30 mb-4">
            <Shield className="w-8 h-8 text-hacker-green" />
          </div>
          <h1 className="text-2xl font-mono text-hacker-green tracking-widest">APPY INTELLIGENCE</h1>
          <p className="text-sm text-hacker-dim mt-2 font-mono">SISTEMA DE ACCESO RESTRINGIDO</p>
        </div>

        <div className="bg-hacker-panel border border-hacker-border rounded-lg p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-hacker-cyan mb-2 uppercase">Identificador (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-hacker"
                placeholder="investigador@appyempresa.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-mono text-hacker-cyan mb-2 uppercase">Clave de Acceso</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-hacker"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-hacker-red/10 border border-hacker-red/30 text-hacker-red text-sm font-mono p-3 rounded flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-hacker w-full mt-6"
            >
              {loading ? 'AUTENTICANDO...' : 'INICIAR SESION'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 text-xs font-mono text-hacker-dim">
          ACCESO NO AUTORIZADO SERA REGISTRADO Y REPORTADO
        </div>
      </div>
    </div>
  )
}
