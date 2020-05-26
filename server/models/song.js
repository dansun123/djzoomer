const mongoose = require("mongoose");

const SongSchema = new mongoose.Schema({
  answerKey: String,
  title: String,
  primaryArtist: String,
  // featuredArtists: Array,
  artUrl: String,
  geniusID: String,
  songUrl: String,
  embedContent: String,
  highScores: [{userId: String, userName: String, score: Number, lyrics: Array}]
});

// compile model from schema
module.exports = mongoose.model("song", SongSchema);
