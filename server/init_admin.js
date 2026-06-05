const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function createAdmin() {
  const conn = await mysql.createConnection({
    host: 'b070t3c0zull0q0jcuot-mysql.services.clever-cloud.com',
    user: 'uz4e7idr9wzfdoxn',
    password: 'dauAWOCJ6mosQeRS6v6u',
    database: 'b070t3c0zull0q0jcuot',
    port: 3306
  });

  const hash = await bcrypt.hash('@Sistemas12', 10);
  await conn.execute(
    'INSERT INTO users (name, email, password, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
    ['Admin Triomphe', 'TriompheSistemas@gmail.com', hash, 'admin', 1]
  );
  console.log('Admin creado');
  await conn.end();
}
createAdmin().catch(console.error);
