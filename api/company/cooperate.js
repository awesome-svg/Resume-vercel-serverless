
// api/cooperate.js
const express = require('express');
const router = express.Router();

router.post('/api/contact/messageSubmit', async (req, res) => {
  const pool = req.app.locals.pool; // 从 locals 获取 pool
  try {
    const { name, email, phone, company_name, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ code: 400, msg: '姓名、邮箱和留言为必填项' });
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO contact_messages 
         (name, email, phone, company_name, subject, message, is_read, follow_up_status) 
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, 'pending')`,
        [name, email, phone, company_name, subject, message]
      );
    } finally {
      client.release();
    }

    return res.status(200).json({ code: 200, msg: '提交成功' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ code: 500, msg: '服务器错误' });
  }
});

module.exports = router;