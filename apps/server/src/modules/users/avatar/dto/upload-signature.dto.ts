export interface UploadSignatureDto {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  allowedFormats: string
  overwrite: boolean
  invalidate: boolean
}
