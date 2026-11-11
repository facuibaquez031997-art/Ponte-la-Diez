export interface FotoUploadSignatureDto {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
  publicId: string
  allowedFormats: string
}
