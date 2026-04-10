// authRouter
// create express object and create the router; define MSAL object
const express = require('express');
const router = express.Router();
const msal = require('@azure/msal-node');

const msalConfig = { // define config for MSAL.
    auth: {
        clientId: process.env.APP_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.APP_SECRET
    }
};
// setup the msalClient object 
const msalClient = new msal.ConfidentialClientApplication(msalConfig);
// grab the allowed emails from .env
const allowedEmails = process.env.ALLOWED_EMAILS.split(',');
// required for both /login and /callback routes
const authCodeURLParams = {
    scopes: ['openid', 'profile', 'email'],
    redirectUri: process.env.REDIRECT_URI
};

// looks to see if there is session for the user who is auth. If so, send 200. If so, send 401. 
router.get('/check',(req,res) => {
    if (req.session?.user?.authed === true) {
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
});

// this route accepts the Entra response with a token code. 
// the token code is exchanged for a token (browser never sees this code)
// the email is read from the recieved token and checked against the allowedEmails list
// if the user is in the allowed email list, then add a session entry to the DB
// a session cookie is added to the response header using Set-Cookie
router.get('/callback', async (req,res) => {
    try{
        const token = await msalClient.acquireTokenByCode({
            code: req.query.code,
            scopes: ['openid', 'profile', 'email'],
            redirectUri: process.env.REDIRECT_URI 
        });
        const email = token.account.username;

        if (!allowedEmails.includes(email)) {
            return res.status(403).send('Email Not on Allowed List')
        }

        req.session.user = { email, authed: true };

        res.redirect('/members');
    } catch (err) {
        console.error('Callback error:', err);
        return res.status(500).send('Account Auth Failed!')
    }
});

// uses MSAL to to request an authUrl; will then redirect use to that URL 
router.get('/login', async (req,res) => {
    try {
        const authUrl = await msalClient.getAuthCodeUrl(authCodeURLParams);
        res.redirect(authUrl);
    } catch (err) {
        console.error('Failed to get authUrl from msalClient:', err);
        res.status(500).send('Mircrosoft (MSAL) Login Failed');
    }
})

// destroys the session cookie. Does not destroy any microsoft tokens 
router.get('/logout', (req,res) => {
  
        req.session.destroy((err) => {
            if (err) {
                console.error('Error during logout:', err);
                return res.status(500).send('Logout Failed');
            }
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
});

// allows for index.js to use router
module.exports = router;

