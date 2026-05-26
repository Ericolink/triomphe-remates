const bcrypt = require('bcryptjs');
require('dotenv').config();

async function updateAdmin() {
  const { User, sequelize } = require('./src/models/index');

  try {
    await sequelize.authenticate();

    const hash = await bcrypt.hash('@Sistemas12', 12);

    await User.update(
      { email: 'TriompheSistemas@gmail.com', password: hash },
      { where: { id: 2 } }
    );

    const user = await User.findOne({ where: { email: 'TriompheSistemas@gmail.com' } });
    console.log('✅ Credenciales actualizadas');
    console.log('Email:', user.email);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateAdmin();
