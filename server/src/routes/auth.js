const router = require('express').Router();
router.get('/', (req, res) => res.json({ route: 'auth ok' }));
module.exports = router;
