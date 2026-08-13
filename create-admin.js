// create-admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ตั้งค่า Database Connection
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // ใส่ password DB ของคุณ
  database: 'teerapat_news'
};

async function createAdmin() {
  try {
    const bootstrap = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    await bootstrap.execute('CREATE DATABASE IF NOT EXISTS teerapat_news');
    await bootstrap.end();

    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const adminUser = {
      name: 'Admin',
      email: 'admin@teerapatnews.com',
      password: 'AdminPassword123!'
    };

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminUser.password, salt);

    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [adminUser.email]
    );

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [hashedPassword, adminUser.email]
      );
      console.log('🔄 พบบัญชี Admin อยู่แล้ว ระบบได้รีเซ็ตรหัสผ่านใหม่เรียบร้อยแล้ว');
      console.log(`Email: ${adminUser.email}`);
      console.log(`Password: ${adminUser.password}`);
    } else {
      await connection.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [adminUser.name, adminUser.email, hashedPassword]
      );
      console.log('✅ สร้างบัญชี Admin เรียบร้อยแล้ว!');
      console.log(`Email: ${adminUser.email}`);
      console.log(`Password: ${adminUser.password}`);
    }

    await connection.end();
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  }
}

createAdmin();