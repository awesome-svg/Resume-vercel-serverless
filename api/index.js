const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// 引入业务路由模块
const resumeRoutes = require('./company/recruitment');
const coperaRoutes = require('./company/cooperate');
const supportRoutes = require('./company/cusSupport');


// 初始化 Express
const app = express();

// --- 全局中间件 ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// --- 数据库连接配置 (Neon PostgreSQL) ---
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Neon 需要 SSL
  },
  max: 10, // 限制连接池大小
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 将 pool 挂载到 app.locals，以便在路由文件中通过 req.app.locals.pool 访问
app.locals.pool = pool;

// 测试数据库连接错误监听
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// 1.  --- 路由分发 ---
app.use('/api/recruitment', resumeRoutes);
app.use('/api/contact', coperaRoutes);
app.use('/api/support', supportRoutes);


// 2. 健康检查接口
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 3. 默认 404 处理
app.use((req, res) => {
  res.status(404).json({ code: 404, msg: 'API 路径不存在' });
});

// --- 导出 Express 应用供 Vercel 使用 ---
module.exports = app;
