import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from './../src/app.module.js'
import { PrismaService } from './../src/common/prisma/prisma.service.js'
import { Roles } from './../src/modules/auth/decorators/roles.decorator.js'

describe('Auth (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  const email = `e2e-${Date.now()}@test.local`
  const password = 'password123'
  let token: string

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    )
    await app.init()
    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } })
    await app.close()
  })

  it('registra un usuario con rol PLAYER por defecto y no expone el hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ nombre: 'Test', email, password })
      .expect(201)
    expect(res.body.accessToken).toBeTypeOf('string')
    expect(res.body.user.rol).toBe('PLAYER')
    expect(res.body.user.passwordHash).toBeUndefined()
    token = res.body.accessToken
  })

  it('rechaza email duplicado', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ nombre: 'Test', email: email.toUpperCase(), password })
      .expect(409)
  })

  it('valida el body', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ nombre: 'T', email: 'no-es-email', password: 'corta' })
      .expect(400)
  })

  it('login correcto devuelve token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200)
    expect(res.body.accessToken).toBeTypeOf('string')
  })

  it('login con contraseña incorrecta devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'incorrecta1' })
      .expect(401)
  })

  it('GET /auth/me requiere token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401)
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalido')
      .expect(401)
  })

  it('GET /auth/me devuelve el perfil con token válido', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.email).toBe(email)
  })

  it('health sigue siendo público', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200)
  })

  it('RolesGuard bloquea a un PLAYER en rutas OWNER', async () => {
    const { Controller, Get, Module } = await import('@nestjs/common')

    @Controller('owner-only')
    class OwnerOnlyController {
      @Roles('OWNER')
      @Get()
      ok(): { ok: boolean } {
        return { ok: true }
      }
    }
    @Module({ controllers: [OwnerOnlyController] })
    class OwnerOnlyModule {}

    const fixture = await Test.createTestingModule({
      imports: [AppModule, OwnerOnlyModule],
    }).compile()
    const app2 = fixture.createNestApplication()
    await app2.init()
    try {
      await request(app2.getHttpServer())
        .get('/owner-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(403)

      const owner = await request(app2.getHttpServer())
        .post('/auth/register')
        .send({ nombre: 'Dueño', email: `owner-${Date.now()}@test.local`, password, rol: 'OWNER' })
        .expect(201)
      await request(app2.getHttpServer())
        .get('/owner-only')
        .set('Authorization', `Bearer ${owner.body.accessToken}`)
        .expect(200)
    } finally {
      await app2.close()
    }
  })
})
