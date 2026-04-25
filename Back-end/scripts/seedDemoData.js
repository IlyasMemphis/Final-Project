const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Follow = require('../src/models/Follow');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const Comment = require('../src/models/Comment');
const Like = require('../src/models/Like');

async function upsertUser({ email, username, fullName, password, avatar }) {
  let user = await User.findOne({ $or: [{ email }, { username }] });
  if (!user) {
    user = new User({ email, username, fullName, password, avatar });
    await user.save();
    return user;
  }

  let changed = false;
  if (username && user.username !== username) {
    user.username = username;
    changed = true;
  }
  if (fullName && user.fullName !== fullName) {
    user.fullName = fullName;
    changed = true;
  }
  if (email && user.email !== email) {
    user.email = email;
    changed = true;
  }
  if (avatar && user.avatar !== avatar) {
    user.avatar = avatar;
    changed = true;
  }
  if (changed) await user.save();
  return user;
}

async function ensurePost(authorId, description, image) {
  const exists = await Post.findOne({ author: authorId, description });
  if (exists) return exists;
  return Post.create({ author: authorId, description, image });
}

async function ensureFollow(follower, following) {
  if (String(follower) === String(following)) return;
  await Follow.updateOne(
    { follower, following },
    { $setOnInsert: { follower, following } },
    { upsert: true }
  );
}

async function ensureLike(user, post) {
  if (!user || !post) return null;
  const exists = await Like.findOne({ user, post });
  if (exists) return exists;
  return Like.create({ user, post });
}

async function ensureComment(user, post, text) {
  if (!user || !post || !text) return null;
  const exists = await Comment.findOne({ user, post, text });
  if (exists) return exists;
  return Comment.create({ user, post, text });
}

async function ensureMessage(sender, peer, text, unreadForPeer = false) {
  const exists = await Message.findOne({ sender, peer, text });
  if (exists) return exists;
  const readBy = unreadForPeer ? [sender] : [sender, peer];
  return Message.create({ sender, peer, text, readBy });
}

async function ensureNotification({ user, fromUser, type, post }) {
  const exists = await Notification.findOne({ user, fromUser, type, post: post || null, isRead: false });
  if (exists) return exists;
  return Notification.create({ user, fromUser, type, post, isRead: false });
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in Back-end/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const baseUsers = [
    {
      email: 'nora.lang@ichgram.demo',
      username: 'nora.lang',
      fullName: 'Nora Lang',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    {
      email: 'alex.weber@ichgram.demo',
      username: 'alex.weber',
      fullName: 'Alex Weber',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
    {
      email: 'sara.klein@ichgram.demo',
      username: 'sara.klein',
      fullName: 'Sara Klein',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    {
      email: 'mike.ross@ichgram.demo',
      username: 'mike.ross',
      fullName: 'Mike Ross',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    },
    {
      email: 'emma.stone@ichgram.demo',
      username: 'emma.stone',
      fullName: 'Emma Stone',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400',
    },
    {
      email: 'liam.gray@ichgram.demo',
      username: 'liam.gray',
      fullName: 'Liam Gray',
      password: 'DemoPass123!',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    },
  ];

  const users = {};
  for (const profile of baseUsers) {
    const user = await upsertUser(profile);
    users[user.username] = user;
  }

  const demoViewer = await upsertUser({
    email: 'demo.viewer@ichgram.demo',
    username: 'demo.viewer',
    fullName: 'Demo Viewer',
    password: 'DemoViewer123!',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  });

  const posts = [];
  posts.push(await ensurePost(users['nora.lang']._id, 'Small UI details matter more than they seem.', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1200'));
  posts.push(await ensurePost(users['alex.weber']._id, 'Morning run before shipping the next update.', 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200'));
  posts.push(await ensurePost(users['sara.klein']._id, 'Working on cleaner states and empty screens.', 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1200'));
  posts.push(await ensurePost(users['mike.ross']._id, 'Keeping notifications useful and readable.', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=1200'));
  posts.push(await ensurePost(users['emma.stone']._id, 'Message UX should feel instant.', 'https://images.unsplash.com/photo-1519337265831-281ec6cc8514?w=1200'));

  await ensureFollow(demoViewer._id, users['nora.lang']._id);
  await ensureFollow(users['alex.weber']._id, demoViewer._id);
  await ensureFollow(users['sara.klein']._id, demoViewer._id);
  await ensureFollow(users['mike.ross']._id, users['nora.lang']._id);
  await ensureFollow(users['emma.stone']._id, users['nora.lang']._id);
  await ensureFollow(users['liam.gray']._id, users['nora.lang']._id);
  await ensureFollow(users['nora.lang']._id, users['alex.weber']._id);
  await ensureFollow(users['sara.klein']._id, users['alex.weber']._id);
  await ensureFollow(users['mike.ross']._id, users['alex.weber']._id);
  await ensureFollow(users['nora.lang']._id, users['sara.klein']._id);
  await ensureFollow(users['emma.stone']._id, users['sara.klein']._id);
  await ensureFollow(users['liam.gray']._id, users['sara.klein']._id);

  await ensureLike(users['alex.weber']._id, posts[0]._id);
  await ensureLike(users['sara.klein']._id, posts[0]._id);
  await ensureLike(users['mike.ross']._id, posts[0]._id);
  await ensureLike(users['emma.stone']._id, posts[0]._id);
  await ensureLike(users['liam.gray']._id, posts[0]._id);

  await ensureLike(users['nora.lang']._id, posts[1]._id);
  await ensureLike(users['sara.klein']._id, posts[1]._id);
  await ensureLike(users['mike.ross']._id, posts[1]._id);
  await ensureLike(demoViewer._id, posts[1]._id);

  await ensureLike(users['nora.lang']._id, posts[2]._id);
  await ensureLike(users['alex.weber']._id, posts[2]._id);
  await ensureLike(users['mike.ross']._id, posts[2]._id);
  await ensureLike(users['emma.stone']._id, posts[2]._id);

  await ensureComment(users['alex.weber']._id, posts[0]._id, 'Great composition and lighting.');
  await ensureComment(users['sara.klein']._id, posts[0]._id, 'Looks very clean. Love it.');
  await ensureComment(users['mike.ross']._id, posts[0]._id, 'This one should go to Explore.');

  await ensureComment(users['nora.lang']._id, posts[1]._id, 'Morning energy on point 🔥');
  await ensureComment(users['emma.stone']._id, posts[1]._id, 'Strong post, keep going!');

  await ensureComment(users['liam.gray']._id, posts[2]._id, 'Nice color grading.');
  await ensureComment(demoViewer._id, posts[2]._id, 'Clean UX mood here.');

  await ensureMessage(users['alex.weber']._id, demoViewer._id, 'Hey! Could you review the latest prototype?', true);
  await ensureMessage(users['sara.klein']._id, demoViewer._id, 'I left a comment on your post draft.', true);
  await ensureMessage(demoViewer._id, users['nora.lang']._id, 'Thanks for the feedback earlier!', false);

  await ensureNotification({
    user: demoViewer._id,
    fromUser: users['alex.weber']._id,
    type: 'follow',
    post: null,
  });
  await ensureNotification({
    user: demoViewer._id,
    fromUser: users['nora.lang']._id,
    type: 'like',
    post: posts[0]._id,
  });
  await ensureNotification({
    user: demoViewer._id,
    fromUser: users['sara.klein']._id,
    type: 'comment',
    post: posts[2]._id,
  });

  console.log('Demo data is ready.');
  console.log('Demo login: demo.viewer');
  console.log('Demo password: DemoViewer123!');
  console.log('Demo email: demo.viewer@ichgram.demo');

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
