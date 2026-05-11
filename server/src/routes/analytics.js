const router = require('express').Router();
router.get('/', (req, res) => res.json({ route: 'analytics ok' }));
module.exports = router;
