const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
  userName: String,
  inGame: Boolean,
  roomID: String,
});

// compile model from schema
module.exports = mongoose.model("user", UserSchema);
