import 'reflect-metadata';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
import cookieParser from 'cookie-parser';
import { verify } from 'jsonwebtoken';
import { User } from './entity/User/User';
import { UserResolver } from './entity/User/UserResolver';
import { createAccessToken, createRefershToken, sendRefreshToken } from './utils/auth';
import cors from 'cors';

(async () => {
  const app = express();
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );

  app.use(cookieParser());

  app.get('/', (_req, res) => res.send('Hello'));

  app.post('/refresh_token', async (req, res) => {
    const refreshToken = req.cookies.jwt;

    if (!refreshToken) {
      console.log('Refresh token not received!');

      return res.send({
        ok: false,
        accessToken: '',
      });
    }

    let payload: any = null;

    try {
      payload = verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
    } catch (err) {
      console.log('Refresh token not valid!', err);
      return res.send({ ok: false, accessToken: '' });
    }

    // Refresh Token is valid, issue a new token
    const user = await User.findOne({ id: payload.userId });

    if (!user) {
      console.log('User is not available anymore.');
      return res.send({ ok: false, accessToken: '' });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return res.send({ ok: false, accessToken: '' });
    }

    sendRefreshToken(res, createRefershToken(user));

    return res.send({ ok: true, accessToken: createAccessToken(user) });
  });

  await createConnection();

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [UserResolver],
    }),
    context: ({ req, res }) => ({ req, res }),
  });

  apolloServer.applyMiddleware({ app, cors: false });

  app.listen(4009, () => console.log('🚀 Server started...'));
})();
