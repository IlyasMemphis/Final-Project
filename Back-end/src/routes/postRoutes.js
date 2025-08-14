const express = require('express')
const router = express.Router()
const multer = require('multer')
const authMiddleware = require('../middleware/auth')
const postController = require('../controllers/postController')

const storage = multer.memoryStorage()
const upload = multer({ storage })

router.get('/user/:userId', postController.getUserPosts)
router.get('/', postController.getAllPosts)
router.get('/:id', postController.getPostById)

router.post('/', authMiddleware, upload.single('image', postController.createPost))
router.put('/:id', authMiddleware, upload.single('image', postController.updatePost))
router.delete('/:id', authMiddleware, postController.deletePost)

module.exports = router