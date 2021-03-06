const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  roomID: String,
  queue: [{
    songID: String,
    title: String,
    primaryArtist: String
  }],
});

// compile model from schema
module.exports = mongoose.model("room", RoomSchema);
