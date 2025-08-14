// controllers/posts.js
const Post = require('../models/Post');

// GET /api/posts?userId=:userId (или отдельным роутом)
exports.getUserPosts = async (req, res) => {
  try {
    const userId = req.params.userId || req.query.userId;
    const posts = await Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'username avatar _id');
    res.json(posts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username avatar _id');
    res.json(posts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar _id'); // <-- populate
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createPost = async (req, res) => {
  try {
    const author = req.user._id;
    const { description } = req.body;              // <-- correct
    let image = '';

    if (req.file) {
      const mimetype = req.file.mimetype;          // <-- mimetype (multer)
      image = `data:${mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const post = new Post({ author, description, image }); // <-- correct field
    await post.save();

    const populated = await post.populate('author', 'username avatar _id');
    res.status(201).json(populated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { description } = req.body;              // <-- correct
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== userId.toString())
      return res.status(403).json({ message: 'Forbidden' });

    if (description !== undefined) post.description = description;

    if (req.file) {
      const mimetype = req.file.mimetype;
      post.image = `data:${mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await post.save();
    const populated = await post.populate('author', 'username avatar _id');
    res.json(populated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== userId.toString())
      return res.status(403).json({ message: 'Forbidden' });

    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
