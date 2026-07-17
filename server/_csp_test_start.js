require('dotenv').config();
const app = require('./app.js');
app.listen(3099, () => console.log('TEST_SERVER_READY on 3099'));
