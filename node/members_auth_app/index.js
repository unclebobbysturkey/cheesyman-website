require('dotenv').config();

// setup express-session and pg session connection
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

// load in the auth, members, and requireAuth modules
const authRouter = require('./routers/auth');
const membersRouter = require('./routers/members');
const requireAuth = require('./middleware/requireAuth');

const app = express(); // define express object
const PORT = process.env.PORT;

const pgPool = new Pool({ connectionString: process.env.DB_URL });

app.use(session({
  store: new PgSession({ pool: pgPool, createTableIfMissing: true }), // createTableIfMissing will create a session table if one is gone (ex. on rebuilds)
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { // httpOnly prevents cookie from being reader by other browser JS, secure will only send over HTTPS
    secure: process.env.NODE_ENV === 'PROD',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // defines session validity length (7 days in milliseconds)
  }
}));

// when request with /auth comes in (/auth/check, /auth/login, /auth/logout, /auth/callback) send to authRouter
// when request with /members comes in, send to requireAuth then membersRouter. This is an app-layer session check (a secondary check to what nginx does with auth_request)
app.use('/auth', authRouter);
app.use('/members', requireAuth, membersRouter);

app.listen(PORT, () => {
  console.log(`auth_app listening on port ${PORT}`);
});
