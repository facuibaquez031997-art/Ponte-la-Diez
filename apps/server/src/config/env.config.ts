import { plainToInstance } from 'class-transformer'
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:5173'

  @IsString()
  DATABASE_URL: string

  @IsString()
  @MinLength(16)
  JWT_SECRET: string

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string

  @IsOptional()
  @IsBooleanString()
  ENGRAM_ENABLED?: string

  @IsOptional()
  @IsString()
  ENGRAM_URL?: string

  @IsOptional()
  @IsBooleanString()
  GENTLE_AI_ENABLED?: string

  @IsOptional()
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string

  @IsOptional()
  @IsString()
  CLOUDINARY_API_KEY?: string

  @IsOptional()
  @IsString()
  CLOUDINARY_API_SECRET?: string

  @IsOptional()
  @IsString()
  CLIENT_URL?: string

  @IsOptional()
  @IsString()
  MP_ACCESS_TOKEN?: string

  @IsOptional()
  @IsString()
  MP_WEBHOOK_SECRET?: string

  @IsOptional()
  @IsString()
  MP_NOTIFICATION_URL?: string

  @IsOptional()
  @IsString()
  MP_CLIENT_ID?: string

  @IsOptional()
  @IsString()
  MP_CLIENT_SECRET?: string

  @IsOptional()
  @IsString()
  MP_REDIRECT_URI?: string

  /** 32 bytes as 64 hex characters (`openssl rand -hex 32`). Encrypts the owners' tokens. */
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{64}$/)
  MP_TOKEN_ENCRYPTION_KEY?: string

  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string

  @IsOptional()
  @IsString()
  VAPID_SUBJECT?: string
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })
  const errors = validateSync(config, { skipMissingProperties: false })
  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.map((e) => e.toString()).join('')}`)
  }
  return config
}
