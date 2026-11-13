import { db, auth } from './firebase'
import {
  collection, addDoc, getDocs, query, where, onSnapshot,
  serverTimestamp, Timestamp, doc, deleteDoc
} from 'firebase/firestore'

export interface SmartLink {
  id?: string
  token: string
  investigationId: string
  caseCode: string
  purpose: string
  status: 'active' | 'expired' | 'revoked'
  createdAt: Timestamp | null
  expiresAt: Timestamp | null
  createdBy: string
  accessCount: number
}

const LINKS = 'smart_links'
const EVENTS = 'link_events'

const generateSecureToken = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export const createSmartLink = async (
  investigationId: string,
  caseCode: string,
  purpose: string,
  expiresDays: number = 30
): Promise<string> => {
  const user = auth.currentUser
  if (!user) throw new Error('Usuario no autenticado')

  const token = generateSecureToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresDays)

  const docRef = await addDoc(collection(db, LINKS), {
    token,
    investigationId,
    caseCode,
    purpose,
    status: 'active',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    createdBy: user.uid,
    accessCount: 0
  })

  return docRef.id
}

export const getLinksByInvestigation = async (investigationId: string): Promise<SmartLink[]> => {
  const snap = await getDocs(query(collection(db, LINKS), where('investigationId', '==', investigationId)))
  const links = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SmartLink[]
  return links.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export const subscribeToLinksByInvestigation = (
  investigationId: string,
  onChange: (links: SmartLink[]) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  const q = query(collection(db, LINKS), where('investigationId', '==', investigationId))
  return onSnapshot(q, (snap) => {
    const links = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SmartLink[]
    links.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    onChange(links)
  }, (error) => onError?.(error))
}

// NUEVA FUNCIÓN: Eliminar enlace y todos sus eventos asociados
export const deleteSmartLink = async (linkId: string): Promise<void> => {
  // 1. Eliminar todos los eventos asociados
  const eventsSnap = await getDocs(query(collection(db, EVENTS), where('linkId', '==', linkId)))
  const deletePromises = eventsSnap.docs.map(d => deleteDoc(doc(db, EVENTS, d.id)))
  await Promise.all(deletePromises)
  
  // 2. Eliminar el enlace
  await deleteDoc(doc(db, LINKS, linkId))
}
