import { db } from './firebase'
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'

export interface Investigation {
  id?: string
  caseCode: string
  title: string
  modality: string
  status: 'open' | 'analyzing' | 'closed' | 'archived'
  description?: string
  city?: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  createdBy: string
}

const INVESTIGATIONS_COLLECTION = 'investigations'

// Generar código de caso único (APPY-2026-00001)
const generateCaseCode = async (): Promise<string> => {
  const year = new Date().getFullYear()
  const querySnapshot = await getDocs(collection(db, INVESTIGATIONS_COLLECTION))
  const count = querySnapshot.size + 1
  return `APPY-${year}-${String(count).padStart(5, '0')}`
}

// Crear nuevo expediente
export const createInvestigation = async (
  title: string,
  modality: string,
  createdBy: string,
  description?: string,
  city?: string
): Promise<string> => {
  const caseCode = await generateCaseCode()
  
  const docRef = await addDoc(collection(db, INVESTIGATIONS_COLLECTION), {
    caseCode,
    title,
    modality,
    status: 'open',
    description: description || '',
    city: city || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy
  })
  
  return docRef.id
}

// Obtener todos los expedientes
export const getInvestigations = async (): Promise<Investigation[]> => {
  const q = query(
    collection(db, INVESTIGATIONS_COLLECTION),
    orderBy('createdAt', 'desc')
  )
  
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Investigation[]
}

// Actualizar estado del expediente
export const updateInvestigationStatus = async (
  id: string,
  status: Investigation['status']
): Promise<void> => {
  const docRef = doc(db, INVESTIGATIONS_COLLECTION, id)
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp()
  })
}

// Eliminar expediente
export const deleteInvestigation = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, INVESTIGATIONS_COLLECTION, id))
}
