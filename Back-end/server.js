// server.js
const express = require('express')
const dotenv = require('dotenv')
const http = require('http')
const socketIo = require('socket.io')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const jwt = require('jsonwebtoken')

const connectDB = require('./src/config/db')
const authRoutes = require('./src/routes/auth')
const profileRoutes = require('./src/routes/profile')
const userRoutes = require('./src/routes/protected')
const postRoutes = require('./src/routes/postRoutes')
const likeRoutes = require('./src/routes/likeRoutes')
const commentRoutes = require('./src/routes/commentRoutes')
const searchRoutes = require('./src/routes/searchRoutes')
const exploreRoutes = require('./src/routes/exploreRoutes')
const messageRoutes = require('./src/routes/messageRoutes')
const followRoutes = require('./src/routes/followRoutes')
const notificationRoutes = require('./src/routes/notifications')
const usersRoutes = require('./src/routes/usersRoutes')

const setupSocket = require('./src/socket/socket')

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server, { cors: { origin: '*' } })

const cors = require('cors')
app.use(cors({ origin: '*' }))

connectDB()
app.use(express.json())

app.use((req, res, next) => {
  req.io = io
  next()
})

/* ---------------------- UPLOADS: static dir & storage ---------------------- */
const UPLOAD_ROOT = path.join(__dirname, 'uploads')
const AVA_DIR = path.join(UPLOAD_ROOT, 'avatars')
const POSTS_DIR = path.join(UPLOAD_ROOT, 'posts')
const POSTS_INDEX = path.join(POSTS_DIR, 'index.json')

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT)
if (!fs.existsSync(AVA_DIR)) fs.mkdirSync(AVA_DIR)
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR)
if (!fs.existsSync(POSTS_INDEX)) fs.writeFileSync(POSTS_INDEX, '[]')

app.use('/uploads', express.static(UPLOAD_ROOT))

/* -------------------------------- helpers --------------------------------- */
function getUserIdFromToken(req) {
  try {
    const h = req.headers.authorization || ''
    const m = h.match(/^Bearer\s+(.+)/i)
    if (!m) return null
    const payload = jwt.verify(m[1], process.env.JWT_SECRET || 'secret')
    return payload.id || payload._id || payload.userId || null
  } catch { return null }
}
function buildPublicUrl(req, rel) {
  return `${req.protocol}://${req.get('host')}${rel.startsWith('/') ? '' : '/'}${rel}`
}
function safeReadJson(file, fallback = []) {
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw)
  } catch { return fallback }
}
function safeWriteJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)) } catch {}
}

/* ---------------------------- AVATAR UPLOAD ---------------------------- */
const storageAvatar = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, AVA_DIR) },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
    const uid = getUserIdFromToken(req) || 'anon'
    cb(null, `${uid}_${Date.now()}${ext}`)
  }
})
const uploadAvatar = multer({ storage: storageAvatar })

// Принимаем как "file", так и "avatar"
const avatarFields = uploadAvatar.fields([
  { name: 'file', maxCount: 1 },
  { name: 'avatar', maxCount: 1 }
])

async function handleAvatarUpload(req, res) {
  try {
    const file = (req.files?.file?.[0]) || (req.files?.avatar?.[0]) || req.file
    if (!file) return res.status(400).json({ error: 'No file' })

    const rel = `/uploads/avatars/${path.basename(file.path)}`
    const url = buildPublicUrl(req, rel)

    const userId = getUserIdFromToken(req)
    if (userId) {
      try {
        const User = require('./src/models/User')
        await User.findByIdAndUpdate(userId, { avatar: url }, { new: true })
      } catch (_) { /* нет модели — ок */ }
    }

    return res.json({ url })
  } catch (e) {
    console.error('Upload error:', e)
    return res.status(500).json({ error: 'Upload failed' })
  }
}

// Совместимые пути
app.post('/api/users/me/avatar', avatarFields, handleAvatarUpload)
app.post('/api/upload/avatar', avatarFields, handleAvatarUpload)
app.post('/api/upload', avatarFields, handleAvatarUpload)

/* ---------------------------- PATCH profile me ----------------------------- */
async function handlePatchMe(req, res) {
  try {
    const userId = getUserIdFromToken(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { username, website, bio, avatar, avatarUrl } = req.body
    const updates = {}
    if (typeof username === 'string') updates.username = username
    if (typeof website === 'string') updates.website = website
    if (typeof bio === 'string') updates.bio = bio
    if (typeof avatar === 'string') updates.avatar = avatar
    if (typeof avatarUrl === 'string') updates.avatar = avatarUrl

    let savedUser = null
    try {
      const User = require('./src/models/User')
      savedUser = await User.findByIdAndUpdate(userId, updates, { new: true })
    } catch (_) {
      savedUser = { _id: userId, ...updates }
    }

    return res.json({ ok: true, user: savedUser })
  } catch (e) {
    console.error('Patch me error:', e)
    return res.status(500).json({ error: 'Save failed' })
  }
}
app.patch('/api/users/me', handlePatchMe)
app.patch('/api/profile/me', handlePatchMe)
app.patch('/api/profile', handlePatchMe)
app.patch('/api/user/me', handlePatchMe)

/* ---------------------------- POSTS (совместимость) ------------------------ */
/** Хранилище для медиа постов */
const storagePost = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, POSTS_DIR) },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    const uid = getUserIdFromToken(req) || 'anon'
    cb(null, `${uid}_${Date.now()}${ext}`)
  }
})
const uploadPost = multer({ storage: storagePost })

// Принимаем разные имена полей: image / file / photo / video
const postFields = uploadPost.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'video', maxCount: 1 },
])

async function dbCreatePost({ userId, mediaUrl, description }) {
  const Post = require('./src/models/Post')
  let created = await Post.create({
    author: userId,
    image: mediaUrl,        // при необходимости поменяйте на imageUrl в схеме
    description,
  })
  try {
    created = await Post.findById(created._id)
      .populate('author', 'username avatar')
  } catch {}
  return created
}

function mockCreatePost({ userId, mediaUrl, description }) {
  const index = safeReadJson(POSTS_INDEX, [])
  const mock = {
    _id: `mock_${Date.now()}`,
    author: userId ? { _id: userId, username: 'user', avatar: null } : null,
    image: mediaUrl,
    description: description || '',
    createdAt: new Date().toISOString(),
    likesCount: 0,
    commentsCount: 0,
  }
  index.unshift(mock)
  safeWriteJson(POSTS_INDEX, index.slice(0, 200))
  return mock
}

async function handleCreatePost(req, res) {
  try {
    const file =
      (req.files?.image?.[0]) ||
      (req.files?.file?.[0]) ||
      (req.files?.photo?.[0]) ||
      (req.files?.video?.[0]) ||
      req.file || null

    const mediaUrl = file
      ? buildPublicUrl(req, `/uploads/posts/${path.basename(file.path)}`)
      : (typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : null)

    const { description, caption, text } = req.body || {}
    const desc = typeof description === 'string' ? description
      : typeof caption === 'string' ? caption
      : typeof text === 'string' ? text : ''

    const userId = getUserIdFromToken(req)

    try {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const created = await dbCreatePost({ userId, mediaUrl, description: desc })
      return res.json({ ok: true, post: created })
    } catch (dbErr) {
      const created = mockCreatePost({ userId, mediaUrl, description: desc })
      return res.json({ ok: true, post: created })
    }
  } catch (e) {
    console.error('Create post error:', e)
    return res.status(500).json({ error: 'Create post failed' })
  }
}

async function handleListPosts(req, res) {
  try {
    try {
      const Post = require('./src/models/Post')
      const posts = await Post.find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('author', 'username avatar')
      return res.json(posts)
    } catch (_) {
      const list = safeReadJson(POSTS_INDEX, [])
      return res.json(list)
    }
  } catch (e) {
    console.error('List posts error:', e)
    return res.status(500).json({ error: 'Failed to list posts' })
  }
}

async function handleGetPostById(req, res) {
  const { id } = req.params
  try {
    try {
      const Post = require('./src/models/Post')
      const p = await Post.findById(id).populate('author', 'username avatar')
      if (!p) return res.status(404).json({ error: 'Not found' })
      return res.json(p)
    } catch (_) {
      const list = safeReadJson(POSTS_INDEX, [])
      const p = list.find(x => String(x._id) === String(id))
      if (!p) return res.status(404).json({ error: 'Not found' })
      return res.json(p)
    }
  } catch (e) {
    console.error('Get post by id error:', e)
    return res.status(500).json({ error: 'Failed to get post' })
  }
}

/* ---------------------------- UPDATE POST (НОВОЕ) -------------------------- */
async function dbUpdatePost({ id, userId, mediaUrl, description }) {
  const Post = require('./src/models/Post')

  // При желании можно проверять автора:
  // const existing = await Post.findById(id)
  // if (!existing) return null
  // if (userId && existing.author && String(existing.author) !== String(userId)) {
  //   const err = new Error('Forbidden'); err.status = 403; throw err
  // }

  const updates = {}
  if (typeof description === 'string') updates.description = description
  if (typeof mediaUrl === 'string' && mediaUrl) updates.image = mediaUrl

  let updated = await Post.findByIdAndUpdate(id, updates, { new: true })
  if (!updated) return null
  try {
    updated = await Post.findById(updated._id).populate('author', 'username avatar')
  } catch {}
  return updated
}

function mockUpdatePost({ id, mediaUrl, description }) {
  const list = safeReadJson(POSTS_INDEX, [])
  const idx = list.findIndex(x => String(x._id) === String(id))
  if (idx === -1) return null
  const cur = list[idx]
  const updated = {
    ...cur,
    description: typeof description === 'string' ? description : cur.description,
    image: typeof mediaUrl === 'string' && mediaUrl ? mediaUrl : cur.image,
    updatedAt: new Date().toISOString(),
  }
  list[idx] = updated
  safeWriteJson(POSTS_INDEX, list)
  return updated
}

async function handleUpdatePost(req, res) {
  const { id } = req.params
  try {
    const file =
      (req.files?.image?.[0]) ||
      (req.files?.file?.[0]) ||
      (req.files?.photo?.[0]) ||
      (req.files?.video?.[0]) ||
      req.file || null

    const mediaUrl = file
      ? buildPublicUrl(req, `/uploads/posts/${path.basename(file.path)}`)
      : (typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : null)

    const { description, caption, text } = req.body || {}
    const desc = typeof description === 'string' ? description
      : typeof caption === 'string' ? caption
      : typeof text === 'string' ? text : undefined

    const userId = getUserIdFromToken(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const updated = await dbUpdatePost({ id, userId, mediaUrl, description: desc })
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ ok: true, post: updated })
    } catch (dbErr) {
      const updated = mockUpdatePost({ id, mediaUrl, description: desc })
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.json({ ok: true, post: updated })
    }
  } catch (e) {
    console.error('Update post error:', e)
    return res.status(500).json({ error: 'Update post failed' })
  }
}

/* ----------- Совместимые пути (чтобы фронт ничего не менять) -------------- */
// CREATE
app.post('/api/posts', postFields, handleCreatePost)          // POST /api/posts
app.post('/api/post', postFields, handleCreatePost)           // POST /api/post
app.post('/api/create-post', postFields, handleCreatePost)    // POST /api/create-post
app.post('/post', postFields, handleCreatePost)               // POST /post (старый)
app.post('/posts/create', postFields, handleCreatePost)       // POST /posts/create
app.post('/api/posts/create', postFields, handleCreatePost)   // POST /api/posts/create

// LIST
app.get('/api/posts', handleListPosts)                        // GET /api/posts
app.get('/posts', handleListPosts)                            // GET /posts

// GET BY ID (для гидратации поста на фронте)
app.get('/api/posts/:id', handleGetPostById)
app.get('/post/:id', handleGetPostById)

// UPDATE (НОВЫЕ/СОВМЕСТИМЫЕ МАРШРУТЫ, чтобы починить 404)
app.patch('/api/posts/:id', postFields, handleUpdatePost)
app.put('/api/posts/:id', postFields, handleUpdatePost)
app.post('/api/posts/:id/update', postFields, handleUpdatePost)

// Полностью совместимые старые пути:
app.post('/post/:id/update', postFields, handleUpdatePost)
app.put('/post/:id/update', postFields, handleUpdatePost)
app.patch('/post/:id/update', postFields, handleUpdatePost)

app.post('/api/post/:id/update', postFields, handleUpdatePost)
app.put('/api/post/:id/update', postFields, handleUpdatePost)
app.patch('/api/post/:id/update', postFields, handleUpdatePost)

app.post('/posts/:id/update', postFields, handleUpdatePost)
app.put('/posts/:id/update', postFields, handleUpdatePost)
app.patch('/posts/:id/update', postFields, handleUpdatePost)

/* --------------------------------- ROUTES --------------------------------- */
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/posts', postRoutes)          // базовые роуты проекта (останутся рабочими)
app.use('/api/likes', likeRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/explore', exploreRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/follow', followRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/users', usersRoutes)

setupSocket(io)

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error(err);
  }
})
