// src/routes/exploreRoutes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post'); // скорректируй путь, если модели в другом месте

// GET /api/explore?sort=trending|new|random&page=1&limit=12
router.get('/', async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
    const sortQ = String(req.query.sort || 'trending').toLowerCase(); // trending|new|random

    const base = [
      { $addFields: { likesCount: { $size: { $ifNull: ['$likes', []] } } } },
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
