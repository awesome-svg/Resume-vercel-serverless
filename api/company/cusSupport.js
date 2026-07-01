
//客户支持页面
const express = require('express');
const router = express.Router();

// 引入静态JSON数据作为模拟数据库
// 假设 qAqSearch.json 是一个数组，结构如: [{ id, title, content, tags }, ...]
const mockDatabase = require('../config/qAqSearch.json');

router.get('/qAqSearch', (req, res) => {
    try {
        // 1. 获取查询参数
        const keyWords = req.query.q;

        // 2. 参数校验：如果关键词为空，返回错误
        if (!keyWords || typeof keyWords !== 'string' || keyWords.trim() === '') {
            return res.status(400).json({
                code: 400,
                msg: '查询关键词不能为空',
                data: null
            });
        }

        // 3. 预处理关键词：去除首尾空格，转为小写，并按空格分割成数组
        // 这样支持多词搜索，例如 "如何 重置 密码"
        const keywords = keyWords.trim().toLowerCase().split(/\s+/);

        // 4. 执行评分搜索算法
        const scoredResults = mockDatabase.map(item => {
            let score = 0;
            
            // 确保字段存在并转为小写字符串，防止报错
            const titleLower = (item.title || '').toLowerCase();
            const contentLower = (item.content || '').toLowerCase();
            // 假设 tags 是数组，将其连接为字符串；如果不是数组则做空处理
            const tagsArray = Array.isArray(item.tags) ? item.tags : [];
            const tagsLower = tagsArray.join(' ').toLowerCase();

            keywords.forEach(keyword => {
                if (!keyword) return; // 跳过空字符串
                // 标题匹配权重最高 (10分)
                if (titleLower.includes(keyword)) {
                    score += 10;
                } // 标签匹配权重次之 (5分)
                if (tagsLower.includes(keyword)) {
                    score += 5;
                }
// 内容匹配权重最低 (1分)
                if (contentLower.includes(keyword)) {
                    score += 1;
                }
            });

            // 返回包含原始数据和得分的新对象
            return { ...item, score };
        })
        .filter(item => item.score > 0) // 过滤掉得分为0的项（即不匹配的项）
        .sort((a, b) => b.score - a.score); // 按得分从高到低排序

        // 5. 结果判断
        if (scoredResults.length === 0) {
            return res.status(404).json({
                code: 404,
                msg: '未找到匹配的问答信息',
                data: []
            });
        }
        // 6. 返回成功结果
        return res.status(200).json({
            code: 200,
            msg: '搜索成功',
            data: scoredResults
        });

    } catch (error) {
        console.error('搜索接口异常:', error);
        return res.status(500).json({
            code: 500,
            msg: '服务器内部错误',
            data: null
        });
    }
});

module.exports = router;
