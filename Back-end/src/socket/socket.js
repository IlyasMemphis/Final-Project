const setupSocket = (io) => {
    io.on('connection', (socket) => {
        const userId = socket.handshake.query.userId
        if (userId) {
            socket.join(userId)
            console.log(`User connected: ${userId}`);
        }

        socket.on('disconnect', () => {
            console.log('User disconnected');
            
        })
    })
}

module.exports = setupSocket