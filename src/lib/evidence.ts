import { db, storage, auth } from './firebase'
import {
  collection, addDoc, getDocs, query, where, onSnapshot, serverTimestamp
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import CryptoJS from 'crypto-js'

export interface CustodyEvent {
  at: string
  action: 'created' | 'accessed' | 'exported'
  user: string
  details?: string
}

export interface Evidence {
  id?: string
  investigationId: string
  caseCode: string
  type: 'screenshot' | 'photo' | 'audio' | 'video' | 'document' | 'chat' | 'receipt' | 'other'
  fileName: string
  fileSize: number
  mimeType: string
  fileUrl: string
  storagePath: string
  sha256: string
  uploadedBy: string
  uploadedAt: Timestamp | null
  description?: string
  custodyLog: CustodyEvent[]
}

const EVIDENCE = 'evidence'

const calculateSHA256 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      const wordArray = CryptoJS.lib.WordArray.create(buffer)
      resolve(CryptoJS.SHA256(wordArray).toString())
    }
    reader.onerror = () => reject(new Error('Error leyendo archivo'))
    reader.readAsArrayBuffer(file)
  })
}

export const uploadEvidence = async (
  investigationId: string,
  caseCode: string,
  file: File,
  type: Evidence['type'],
  description?: string
): Promise<string> => {
  const user = auth.currentUser
  if (!user) throw new Error('Usuario no autenticado')

  const sha256 = await calculateSHA256(file)
  const storagePath = `evidence/${investigationId}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file, { contentType: file.type })
  const fileUrl = await getDownloadURL(storageRef)

  const custodyLog: CustodyEvent[] = [{
    at: new Date().toISOString(),
    action: 'created',
    user: user.uid,
    details: 'Evidencia cargada al sistema'
  }]

  const docRef = await addDoc(collection(db, EVIDENCE), {
    investigationId, caseCode, type,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    fileUrl, storagePath, sha256,
    uploadedBy: user.uid,
    uploadedAt: serverTimestamp(),
    description: description || '',
    custodyLog
  })

  return docRef.id
}

// NUEVA FUNCIÓN: Crear evidencia desde datos de diagnóstico
export const createEvidenceFromDiagnosis = async (
  investigationId: string,
  caseCode: string,
  eventData: any,
  linkData: any
): Promise<string> => {
  const user = auth.currentUser
  if (!user) throw new Error('Usuario no autenticado')

  // Crear un JSON con toda la información del diagnóstico
  const diagnosisData = {
    tipo: 'DIAGNOSTICO_DE_ENLACE_INTELIGENTE',
    fechaExportacion: new Date().toISOString(),
    expediente: {
      id: investigationId,
      codigo: caseCode
    },
    enlace: {
      id: linkData?.id,
      token: linkData?.token,
      proposito: linkData?.purpose,
      url: `${window.location.origin}/i/${linkData?.token}`,
      creado: linkData?.createdAt?.toDate?.().toISOString(),
      estado: linkData?.status,
      totalAccesos: linkData?.accessCount
    },
    evento: {
      id: eventData.id,
      timestamp: eventData.timestamp?.toDate?.().toISOString(),
      ipAddress: eventData.ipAddress,
      navegador: eventData.browser,
      sistemaOperativo: eventData.os,
      dispositivo: eventData.device,
      idioma: eventData.language,
      zonaHoraria: eventData.timezone,
      accessType: eventData.accessType,
      privacidadAceptada: eventData.privacyAccepted,
      ubicacionAutorizada: eventData.locationGranted,
      ubicacion: eventData.location ? {
        latitud: eventData.location.latitude,
        longitud: eventData.location.longitude,
        precisionMetros: eventData.location.accuracy
      } : null,
      sessionId: eventData.sessionId,
      userAgent: eventData.userAgent
    }
  }

  // Convertir a string y luego a Blob
  const jsonString = JSON.stringify(diagnosisData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const file = new File([blob], `diagnostico_${caseCode}_${Date.now()}.json`, { type: 'application/json' })

  // Calcular hash
  const sha256 = await calculateSHA256(file)

  // Subir a Storage
  const storagePath = `evidence/${investigationId}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file, { contentType: 'application/json' })
  const fileUrl = await getDownloadURL(storageRef)

  // Crear registro en Firestore
  const custodyLog: CustodyEvent[] = [{
    at: new Date().toISOString(),
    action: 'created',
    user: user.uid,
    details: 'Diagnóstico de enlace exportado como evidencia'
  }]

  const docRef = await addDoc(collection(db, EVIDENCE), {
    investigationId,
    caseCode,
    type: 'document',
    fileName: file.name,
    fileSize: file.size,
    mimeType: 'application/json',
    fileUrl,
    storagePath,
    sha256,
    uploadedBy: user.uid,
    uploadedAt: serverTimestamp(),
    description: `Diagnóstico completo del enlace con token ${linkData?.token?.substring(0, 16)}...`,
    custodyLog
  })

  return docRef.id
}

const sortEvidence = (list: Evidence[]) =>
  list.sort((a, b) => (b.uploadedAt?.toMillis?.() ?? 0) - (a.uploadedAt?.toMillis?.() ?? 0))

export const getEvidenceByInvestigation = async (investigationId: string): Promise<Evidence[]> => {
  const snap = await getDocs(query(collection(db, EVIDENCE), where('investigationId', '==', investigationId)))
  return sortEvidence(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Evidence[])
}

export const subscribeToEvidenceByInvestigation = (
  investigationId: string,
  onChange: (items: Evidence[]) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  const q = query(collection(db, EVIDENCE), where('investigationId', '==', investigationId))
  return onSnapshot(q, (snap) => {
    onChange(sortEvidence(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Evidence[]))
  }, (error) => onError?.(error))
}

export const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp?.toDate) return 'N/A'
  return timestamp.toDate().toLocaleString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
