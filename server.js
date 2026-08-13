const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let pool;

async function ensureDatabase() {
  const bootstrap = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
  });

  await bootstrap.execute('CREATE DATABASE IF NOT EXISTS teerapat_news');
  await bootstrap.end();

  pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'teerapat_news',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS news (
      id VARCHAR(255) PRIMARY KEY,
      category VARCHAR(255) DEFAULT 'ทั่วไป',
      categoryLabel VARCHAR(255) DEFAULT 'ทั่วไป',
      title VARCHAR(255) NOT NULL,
      image TEXT,
      author VARCHAR(255) DEFAULT 'ทีมข่าว TeerapatNews',
      timeAgo VARCHAR(255) DEFAULT 'เมื่อสักครู่',
      readTime VARCHAR(255) DEFAULT '3 นาที',
      thumbClass VARCHAR(255) DEFAULT 'p1',
      body JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [adminRows] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    ['admin@teerapatnews.com']
  );

  if (adminRows.length === 0) {
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      ['Admin', 'admin@teerapatnews.com', adminPasswordHash]
    );
    console.log('✅ Seeded admin account: admin@teerapatnews.com / AdminPassword123!');
  }

  const [newsCountRows] = await pool.execute('SELECT COUNT(*) AS total FROM news');
  console.log(`✅ Database initialized successfully with ${newsCountRows[0].total} articles`);
}

// ==========================================
// 👤 USER & AUTH APIs
// ==========================================

// 2. API สมัครสมาชิก
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ ok: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    const role = email.toLowerCase() === 'admin@teerapatnews.com' ? 'admin' : 'user';
    return res.json({
      ok: true,
      message: 'สมัครสมาชิกสำเร็จ!',
      user: { id: result.insertId, name, email, role }
    });
  } catch (error) {
    console.error('❌ Register Error:', error.message);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + error.message });
  }
});

// 3. API สำหรับเข้าสู่ระบบ (Login)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ ok: false, message: 'ไม่พบอีเมลนี้ในระบบ' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(400).json({ ok: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const isAdmin = user.email.toLowerCase() === 'admin@teerapatnews.com';
    return res.json({
      ok: true,
      message: 'เข้าสู่ระบบสำเร็จ!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: isAdmin ? 'admin' : 'user'
      }
    });
  } catch (error) {
    console.error('❌ Login Error:', error.message);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

// 4. API สำหรับอัปเดตข้อมูลโปรไฟล์
app.post('/api/update-profile', async (req, res) => {
  const { id, name, email } = req.body;

  if (!id || !name || !email) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ ok: false, message: 'อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว' });
    }

    await pool.execute(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, id]
    );

    const role = email.toLowerCase() === 'admin@teerapatnews.com' ? 'admin' : 'user';
    return res.json({
      ok: true,
      message: 'อัปเดตข้อมูลสำเร็จ!',
      user: { id, name, email, role }
    });
  } catch (error) {
    console.error('❌ Update Profile Error:', error.message);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + error.message });
  }
});

// ==========================================
// 📰 NEWS APIs (FULL CRUD)
// ==========================================

// 5. ดึงรายการข่าวทั้งหมด
app.get('/api/news', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM news ORDER BY created_at DESC, id DESC');

    const newsList = rows.map(item => ({
      ...item,
      body: typeof item.body === 'string' ? JSON.parse(item.body) : item.body
    }));

    return res.json(newsList);
  } catch (error) {
    console.error('❌ Get News Error:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 6. ดึงข่าวรายฉบับ (ตาม id)
app.get('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM news WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'ไม่พบข่าวนี้' });
    }

    const article = rows[0];
    article.body = typeof article.body === 'string' ? JSON.parse(article.body) : article.body;

    return res.json(article);
  } catch (error) {
    console.error('❌ Get Article Error:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 7. [เพิ่มใหม่] เพิ่มข่าวใหม่ (Create)
app.post('/api/news', async (req, res) => {
  const { category, categoryLabel, title, image, author, timeAgo, readTime, thumbClass, body } = req.body;

  if (!title || !image || !body) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
  }

  try {
    const id = req.body.id || require('crypto').randomUUID();
    const bodyJson = JSON.stringify(body);
    await pool.execute(
      `INSERT INTO news (id, category, categoryLabel, title, image, author, timeAgo, readTime, thumbClass, body) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        category || 'ทั่วไป',
        categoryLabel || 'ทั่วไป',
        title,
        image,
        author || 'ทีมข่าว TeerapatNews',
        timeAgo || 'เมื่อสักครู่',
        readTime || '3 นาที',
        thumbClass || 'p1',
        bodyJson
      ]
    );

    return res.json({ ok: true, message: 'เพิ่มข่าวเรียบร้อยแล้ว', id });
  } catch (error) {
    console.error('❌ Add News Error:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 8. [เพิ่มใหม่] แก้ไขข่าว (Update)
app.put('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  const { category, categoryLabel, title, image, author, timeAgo, readTime, body } = req.body;

  try {
    const bodyJson = JSON.stringify(body);
    const [result] = await pool.execute(
      `UPDATE news 
       SET category = ?, categoryLabel = ?, title = ?, image = ?, author = ?, timeAgo = ?, readTime = ?, body = ?
       WHERE id = ?`,
      [category, categoryLabel, title, image, author, timeAgo, readTime, bodyJson, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'ไม่พบข่าวที่ต้องการแก้ไข' });
    }

    return res.json({ ok: true, message: 'แก้ไขข่าวเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ Update News Error:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// 9. [เพิ่มใหม่] ลบข่าว (Delete)
app.delete('/api/news/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM news WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: 'ไม่พบข่าวที่ต้องการลบ' });
    }

    return res.json({ ok: true, message: 'ลบข่าวเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ Delete News Error:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

ensureDatabase()
  .then(() => {
    app.listen(3000, () => {
      console.log('🚀 Server is running on http://localhost:3000');
    });
  })
  .catch((error) => {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  });