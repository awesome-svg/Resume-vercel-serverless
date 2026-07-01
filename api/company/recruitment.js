const express = require('express');
const multer = require('multer');
const { put } = require('@vercel/blob');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Multer 配置：仅用于内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 pdf/doc/docx 格式的简历'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * 简历投递接口
 * POST /api/recruitment/apply
 */
router.post('/apply', upload.single('resume'), async (req, res) => {
  // 注意：pool 需要从外部传入或通过依赖注入，或者直接在 index.js 定义后引入
  // 这里我们假设 pool 通过 req.app.locals.pool 访问，或者我们在 index.js 中绑定
  const pool = req.app.locals.pool; 

  try {
    // 1. 获取表单字段
    const {
      name,
      phone,
      email,
      education,
      message,
      job_id: jobId
    } = req.body;

    // 2. 获取简历文件
    const resumeFile = req.file;
    if (!resumeFile) {
      return res.status(400).json({ code: 400, msg: '请上传简历文件' });
    }

    let originalName = resumeFile.originalname;
    try {
      // 尝试修复可能的 Latin1 编码问题
      originalName = Buffer.from(originalName, 'latin1').toString('utf-8');
    } catch (e) {
      // 如果已经是 UTF-8，则保持不变
    }

    // 3. 上传文件到 Vercel Blob
    const uniqueFileName = `resumes/${uuidv4()}${originalName}`;
    
    const blob = await put(uniqueFileName, resumeFile.buffer, {
      access: 'public',
      contentType: resumeFile.mimetype,
      addRandomSuffix: false, 
    });

    const resumeUrl = blob.url;

    // 4. 插入数据库
    const insertSql = `
      INSERT INTO recruitment_apply 
      (job_id, username, phone, email, education, self_intro, resume_url) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    
    const params = [
      jobId || null,
      name,
      phone,
      email,
      education,
      message || null,
      resumeUrl
    ];

    const result = await pool.query(insertSql, params);
    
    console.log('数据插入成功, ID:', result.rows[0].id); // 注意：result.rows 是数组

    return res.status(200).json({ 
      code: 200, 
      msg: '投递成功',
      data: { id: result.rows[0].id }
    });

  } catch (err) {
    console.error('投递异常：', err);
    
    if (err.message && err.message.includes('仅支持')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
    
    return res.status(500).json({ 
      code: 500, 
      msg: '服务器内部错误，请稍后重试' 
    });
  }
});

module.exports = router;
