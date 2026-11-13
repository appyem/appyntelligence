import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { auth } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Expedientes from './pages/Expedientes'
import ExpedienteDetalle from './pages/ExpedienteDetalle'
import Enlaces from './pages/Enlaces'
import Evidencias from './pages/Evidencias'
import Diagnostico from './pages/Diagnostico'
import PublicLink from './pages/PublicLink'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-hacker-bg flex items-center justify-center">
        <div className="text-hacker-green font-mono animate-pulse">INICIALIZANDO SISTEMA...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/i/:token" element={<PublicLink />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/expedientes" element={user ? <Expedientes /> : <Navigate to="/login" />} />
        <Route path="/expediente/:id" element={user ? <ExpedienteDetalle /> : <Navigate to="/login" />} />
        <Route path="/enlaces" element={user ? <Enlaces /> : <Navigate to="/login" />} />
        <Route path="/evidencias" element={user ? <Evidencias /> : <Navigate to="/login" />} />
        <Route path="/diagnostico" element={user ? <Diagnostico /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
