export class HealthResponseDto {
  status: 'ok'
  database: 'up' | 'down'
  timestamp: string
}
