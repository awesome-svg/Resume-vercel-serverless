
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const { put } = require('@vercel/blob');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 初始化 Express
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库连接配置 (Neon PostgreSQL)
// 注意：在 Serverless 环境中，建议设置连接超时和最大连接数
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon 需要 SSL
  },
  max: 10, // 限制连接池大小，避免耗尽数据库连接
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Multer 配置：仅用于内存存储，以便后续上传到 Vercel Blob
// 不再使用 diskStorage，因为 Vercel 文件系统是临时的
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

// 投递接口
app.post('/api/recruitment/apply', upload.single('resume'), async (req, res) => {
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
        // 尝试修复可能的 Latin1 编码问题（常见于某些客户端上传）
        originalName = Buffer.from(originalName, 'latin1').toString('utf-8');
    } catch (e) {
        // 如果已经是 UTF-8，则保持不变
    }
		
    // 3. 上传文件到 Vercel Blob
    // 生成唯一文件名，避免冲突
    const fileExtension = path.extname(originalname);
    const uniqueFileName = `resumes/${uuidv4()}${fileExtension}`;
    
    // 上传到 Vercel Blob
    // access: 'public' 允许公开访问（如果需要私有，设为 'private' 并生成签名 URL）
    const blob = await put(uniqueFileName, resumeFile.buffer, {
      access: 'public',
      contentType: resumeFile.mimetype,
    });

    // blob.url 是文件的公开访问地址
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
      resumeUrl // 存储 Blob URL 而不是本地路径
    ];

    const result = await pool.query(insertSql, params);
    
    console.log('数据插入成功, ID:', result.rows.id);

    return res.status(200).json({ 
      code: 200, 
      msg: '投递成功',
      data: { id: result.rows.id }
    });

  } catch (err) {
    console.error('投递异常：', err);
    
    // 区分错误类型
    if (err.message && err.message.includes('仅支持')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
    
    return res.status(500).json({ 
      code: 500, 
      msg: '服务器内部错误，请稍后重试' 
    });
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 导出 Express 应用供 Vercel 使用
module.exports = app;
