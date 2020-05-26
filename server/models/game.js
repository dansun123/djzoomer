const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema({
  songID: String,
  endTime: Date,
  gameData: [{
    userId: String,
    userName: String,
    score: Number,
    lyrics: Array,
    mode: {type: String, default: "Typing"}
  }],
  roomID: String,
  status: String, // inProgress, timer, finished. ,
  answerKey: String
});

// compile model from schema
module.exports = mongoose.model("game", GameSchema);
