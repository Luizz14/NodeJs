import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

import z from 'zod'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/radis'
import { voting } from '../../utils/voting-pub-sub'

export async function voteOnPoll(app: FastifyInstance) {
  app.post('/polls/:pollId/votes', async (request, reply) => {
    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid(),
    })

    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    })

    const { pollId } = voteOnPollParams.parse(request.params)
    const { pollOptionId } = voteOnPollBody.parse(request.body)

    let { sessionId } = request.cookies

    if (sessionId) {
      const userPreviusVoteOnPoll = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            sessionId,
            pollId,
          },
        },
      })

      if (
        userPreviusVoteOnPoll &&
        userPreviusVoteOnPoll.pollOptionId !== pollOptionId
      ) {
        await prisma.vote.delete({
          where: {
            id: userPreviusVoteOnPoll.id,
          },
        })

        const votes = await redis.zincrby(
          pollId,
          -1,
          userPreviusVoteOnPoll.pollOptionId
        )

        voting.publish(pollId, {
          pollOptionId: userPreviusVoteOnPoll.pollOptionId,
          votes: Number(votes),
        })

        await redis.zincrby(pollId, -1, userPreviusVoteOnPoll.pollOptionId)
      } else if (userPreviusVoteOnPoll) {
        return reply.code(400).send({
          error: 'User already voted on this poll',
        })
      }
    }

    if (!sessionId) {
      sessionId = randomUUID()

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        signed: true,
        httpOnly: true,
      })
    }

    await prisma.vote.create({
      data: {
        sessionId,
        pollId,
        pollOptionId,
      },
    })

    const votes = await redis.zincrby(pollId, 1, pollOptionId)

    voting.publish(pollId, {
      pollOptionId,
      votes: Number(votes),
    })

    return reply.code(201).send()
  })
}
