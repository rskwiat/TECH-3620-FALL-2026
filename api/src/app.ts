import 'dotenv/config';

import createError from 'http-errors';
import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Allow requests from the Expo web dev server (and any other origin during
// development) — browsers enforce CORS, native clients ignore it.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/users', usersRouter);
app.use('/health', healthRouter);

// catch 404 and forward to error handler
const notFound: RequestHandler = (_req, _res, next) => {
  next(createError(404));
};

// error handler — Express only treats a callback as an error handler when it
// declares all 4 parameters, so the trailing _next has to stay
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  res.status(err.status || 500).json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
};

app.use(notFound);
app.use(errorHandler);

export default app;
