const router = require('express').Router();
router.get('/', (req, res) => res.json({ route: 'properties ok' }));
module.exports = router;
