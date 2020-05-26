let io;

const User = require("./models/user");
const Message = require("./models/message");
const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object

const getSocketFromUserID = (userid) => userToSocketMap[userid];
const getUserFromSocketID = (socketid) => socketToUserMap[socketid];
const getSocketFromSocketID = (socketid) => io.sockets.connected[socketid];

const addUser = (user, socket) => {
  const oldSocket = userToSocketMap[user._id];
  if (oldSocket && oldSocket.id !== socket.id) {
    // there was an old tab open for this user, force it to disconnect
    // FIXME: is this the behavior you want?
    oldSocket.disconnect();
    delete socketToUserMap[oldSocket.id];
  }

  userToSocketMap[user._id] = socket;
  socketToUserMap[socket.id] = user;
};

const removeUser = (user, socket) => {
  if (user) delete userToSocketMap[user._id];
  delete socketToUserMap[socket.id];
};

module.exports = {
  init: (http) => {
    io = require("socket.io")(http);

    io.on("connection", (socket) => {
      console.log(`socket has connected ${socket.id}`);
      socket.on("disconnect", (reason) => {
        console.log("disconnect")
        const user = getUserFromSocketID(socket.id);

        removeUser(user, socket);
        if(user) {
        User.findById(user._id).then((activeuser) => {
            
              io.emit("inactive", {userId: user._id})
              let roomID = activeuser.roomID
              let message = new Message({
                sender: {userId: user._id, userName: activeuser.userName},
                roomID: roomID, 
                message: activeuser.userName + " left the Room",
                systemMessage: true
              })
              io.emit("newMessage", message)
              activeuser.roomID = "Lobby"
              activeuser.inactivityCount = 0
           
          activeuser.save()
            })
          }
      });
      
    });
  },

  addUser: addUser,
  removeUser: removeUser,

  getSocketFromUserID: getSocketFromUserID,
  getUserFromSocketID: getUserFromSocketID,
  getSocketFromSocketID: getSocketFromSocketID,
  getIo: () => io,
};
