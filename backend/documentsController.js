import { createClient } from '@supabase/supabase-js'
import express from 'express'
import multer from 'multer'
import { uploadDocumentToSupabase } from './controllers/documentsController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() }) // Almacena el archivo temporalmente en memoria para subirlo a Supabase

// Inicializar cliente de Supabase con tus credenciales de entorno
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function uploadDocumentToSupabase(req, res) {
  try {
    // El archivo y los datos provienen del FormData enviado por el frontend
    const { patient_id, document_type, description } = req.body
    const file = req.file // Asegúrate de usar un middleware como 'multer' en Express

    if (!file) {
      return res.status(400).json({ ok: false, message: 'No se adjuntó ningún archivo.' })
    }

    const fileExt = file.originalname.split('.').pop()
    const fileName = `patient_${patient_id}_${Date.now()}.${fileExt}`
    const filePath = `clinical_docs/${fileName}`

    // 1. Subir el archivo al Bucket de Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents') // Nombre de tu Bucket en Supabase
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      })

    if (storageError) {
      throw new Error(`Error en Storage: ${storageError.message}`)
    }

    // 2. Obtener la URL pública firmada o de acceso al archivo almacenado
    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    const fileUrl = publicUrlData.publicUrl

    // 3. Registrar los metadatos del documento en la tabla de base de datos
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          patient_id,
          document_type,
          file_name: fileName,
          description,
          file_url: fileUrl,
          storage_path: filePath,
          created_at: new Date()
        }
      ])
      .select()

    if (dbError) {
      throw new Error(`Error en Base de Datos: ${dbError.message}`)
    }

    return res.status(200).json({
      ok: true,
      message: 'Documento almacenado correctamente en Supabase',
      document: dbData[0]
    })

  } catch (error) {
    console.error('Error al procesar la subida:', error)
    return res.status(500).json({ ok: false, message: error.message })
  }
}
// Esta es la ruta que llama tu frontend
router.post('/frontend/src/supabaseClient.js', upload.single('file'), uploadDocumentToSupabase)

export default router