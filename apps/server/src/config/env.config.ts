import { plainToInstance } from 'class-transformer'
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
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

  @IsOptional()
  @IsString()
  JWT_SECRET?: string

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
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })
  const errors = validateSync(config, { skipMissingProperties: false })
  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.map((e) => e.toString()).join('')}`)
  }
  return config
}
