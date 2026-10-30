import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module.js'

describe('Health (e2e)', () => {
  let app: INestApplication<App>

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body.status).toBe('ok')
    expect(['up', 'down']).toContain(res.body.database)
  })
})
