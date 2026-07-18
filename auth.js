const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({error: "Missing token"});
            return;
        }

        const token = authHeader.slice("Bearer ".length).trim();

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            req.user = payload;
            next();
        } catch (error) {
            res.status(401).json({error: "Invalid or expired token"});
        }
}

module.exports = authenticate;