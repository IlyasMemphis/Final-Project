const Post = require('../models/Post')

exports.getRandomPosts = async (req, res) => {
    try {
        const posts = await Post.aggregate([
            {$sample: { size: 20 }}
        ])

        res.json(posts)
    } catch (err) {
        res.status(500).json({ message: 'Server error' })
    }
}