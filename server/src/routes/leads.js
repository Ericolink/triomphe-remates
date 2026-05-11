const router = require('express').Router();
router.get('/', (req, res) => res.json({ route: 'leads ok' }));
module.exports = router;
