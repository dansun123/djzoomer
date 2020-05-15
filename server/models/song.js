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
});

// compile model from schema
module.exports = mongoose.model("song", SongSchema);
