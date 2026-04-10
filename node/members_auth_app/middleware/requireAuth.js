// this is middleware that runs when a request comes in to /members, before sending the user to the membersRouter
// it functions as an app layer session cookie check, in tandem with the auth_required done by nginx (/auth/check)
function requireAuth(req, res, next) {
    if (req.session?.user?.authed === true) { // does the request header have a session and user and is the user authed? head to membersRouter if true, else...401
        next();
    } else {
        res.sendStatus(401);
    }
}

module.exports = requireAuth;