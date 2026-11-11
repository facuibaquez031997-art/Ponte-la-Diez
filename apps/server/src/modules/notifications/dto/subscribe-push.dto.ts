import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator'

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  p256dh!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  auth!: string
}

export class SubscribePushDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  endpoint!: string

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint!: string
}
