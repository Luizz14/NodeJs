import request from 'supertest'
import { it, beforeAll, afterAll, describe, expect, beforeEach } from 'vitest'
import { app } from '../src/app'
import { execSync } from 'child_process'

describe('Transactions routes', () => {
  beforeAll(async () => {
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    execSync('npm run knex migrate:rollback --all')
    execSync('npm run knex migrate:latest')
  })

  it('should be created a new transaction', async () => {
    await request(app.server)
      .post('/transactions')
      .send({
        title: 'Salário',
        amount: 3000,
        type: 'credit',
      })
      .expect(201)
  })

  it('should be able to list all transactions', async () => {
    const createTransactionResponse = await request(app.server)
      .post('/transactions')
      .send({
        title: 'Salário',
        amount: 3000,
        type: 'credit',
      })

    const cookies = createTransactionResponse.get('Set-Cookie')

    const listTransactionsResponse = await request(app.server)
      .get('/transactions')
      .set('Cookie', cookies!)
      .expect(200)

    expect(listTransactionsResponse.body.transactions).toEqual([
      expect.objectContaining({
        title: 'Salário',
        amount: 3000,
      }),
    ])
  })

  it('should be able to get a specific transaction', async () => {
    const createTransactionResponse = await request(app.server)
      .post('/transactions')
      .send({
        title: 'Salário',
        amount: 3000,
        type: 'credit',
      })

    const cookies = createTransactionResponse.get('Set-Cookie')

    const listTransactionsResponse = await request(app.server)
      .get('/transactions')
      .set('Cookie', cookies!)

    const transactionId = listTransactionsResponse.body.transactions[0].id

    const getTransactionRepsonse = await request(app.server)
      .get(`/transactions/${transactionId}`)
      .set('Cookie', cookies!)
      .expect(200)

    expect(getTransactionRepsonse.body.transaction).toEqual(
      expect.objectContaining({
        title: 'Salário',
        amount: 3000,
      })
    )
  })

  it('should be able to get the summary', async () => {
    const createTransactionResponse = await request(app.server)
      .post('/transactions')
      .send({
        title: 'Salário',
        amount: 3000,
        type: 'credit',
      })

    await request(app.server).post('/transactions').send({
      title: 'OH O SALARIO INDO EMBORA OH',
      amount: 12000,
      type: 'debit',
    })

    const cookies = createTransactionResponse.get('Set-Cookie')

    const summaryResponse = await request(app.server)
      .get('/transactions/summary')
      .set('Cookie', cookies!)
      .expect(200)

    expect(summaryResponse.body.summary).toEqual({
      amount: 3000,
    })
  })
})
