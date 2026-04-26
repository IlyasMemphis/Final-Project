// src/routes/exploreRoutes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // скорректируй путь, если модели в другом месте

// GET /api/explore?sort=trending|new|random&page=1&limit=60
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 60, 1), 200);
    const sortQ = String(req.query.sort || 'new').toLowerCase(); // trending|new|random

    const base = [
      {
        $lookup: {
          from: 'users',                    // коллекция User по умолчанию = 'users'
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { username: 1, avatar: 1 } }]
        }
      },
      { $unwind: '$author' },
      {
        $lookup: {
          from: 'likes',
          let: { postId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
            { $count: 'count' }
          ],
          as: 'likeStats'
        }
      },
      {
        $addFields: {
          likesCount: { $ifNull: [{ $arrayElemAt: ['$likeStats.count', 0] }, 0] }
        }
      },
      { $project: { description: 1, image: 1, createdAt: 1, likesCount: 1, author: 1 } }
    ];

    if (sortQ === 'random') {
      const items = await Post.aggregate([...base, { $sample: { size: limit } }]).exec();
      return res.json(items);
    }

    const sortStage = sortQ === 'new'
      ? { createdAt: -1 }
      : { likesCount: -1, createdAt: -1 }; // trending

    const pipeline = [
      ...base,
      { $sort: sortStage },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    const items = await Post.aggregate(pipeline).exec();
    return res.json(items);
  } catch (e) {
    next(e);
  }
});

// опционально хелсчек
router.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = router;
