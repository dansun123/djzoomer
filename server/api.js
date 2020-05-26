/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/
require("dotenv").config();
var autocorrect = {}

const API_KEY = process.env.API_KEY;
const express = require("express");
var request = require('request');
const levenshteiner = require('levenshteiner');
const utf8 = require('utf8');
// import models so we can interact with the database
const User = require("./models/user");
const Game = require("./models/game");
const Room = require("./models/room");
const Message = require("./models/message");
const Song = require("./models/song");

// import authentication library
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

//initialize socket
const socket = require("./server-socket");

var api = require('genius-api');
var genius = new api(process.env.GENIUS_CLIENT_ACCESS_TOKEN);
var getLyrics = require('genius-lyrics-api').getLyrics;

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.post("/initsocket", (req, res) => {
  // do nothing if user not logged in
  if (req.user) socket.addUser(req.user, socket.getSocketFromSocketID(req.body.socketid));
  res.send({});
});

// |------------------------------|
// | write your API methods below!|
// |------------------------------|


router.post("/newUser", (req,res) => {
  let newName = req.body.newName;
  User.find({name: newName})
  let user = new User({
    name: newName,
    roomID: undefined,
  });
  user.save();
  res.send({newName: newName});
});




router.post("/createNewRoom", auth.ensureLoggedIn,(req, res) => {

  let min = 10000
  let max = min*10-1
  let roomID = String(Math.floor(Math.random() * (max-min) + min))
  // what if its already taken :o

  Room.findOne({roomID: roomID}, (room) => {
    if(room) {
      User.findById(req.user._id).then((user) => {
        user.roomID = roomID;
        user.save().then(() => {
          res.send({id: roomID})
        })
      })
    } else {
      const newRoom = new Room({
        roomID: roomID,
      })
      newRoom.save().then(() => {
        res.send({id: roomID})
      });
    }
  })
});

// sends a list of users in the room (objects {userId: aw23aa, userName: AkshajK})
router.post("/joinRoom", auth.ensureLoggedIn, (req, res) => {
  Room.findOne({roomID : req.body.roomID}).then((room) => {
    if(room) {
      User.findById(req.user._id).then((user) => {
        user.roomID = req.body.roomID;
        user.save().then(() => {
          socket.getIo().emit("someoneJoinedRoom", {userId: req.user._id, userName: req.user.userName, roomID: req.body.roomID, mode: user.mode})
          let message = new Message({
            sender: {userId: req.user._id, userName: req.user.userName},
            roomID: req.body.roomID, 
            message: req.user.userName + " joined the Room",
            systemMessage: true
          })
          socket.getIo().emit("newMessage", message)
        


          
          userList = []
          User.find({roomID: user.roomID}).then((users) => {
            users.forEach((user2) => {
              userList.push({userId: user2._id, userName: user2.userName, mode: user.mode})
              if(userList.length === users.length) {
                
                Game.findOne({
                  $or: [
                    {roomID: req.body.roomID, status: "inProgress"},
                    {roomID: req.body.roomID, status: "timer"}
                       ]
                }).then((game) => {
                  if(game) {
                    res.send({userList: userList, status: game.status, queue: room.queue});
                  }
                  else {
                    res.send({userList: userList, status: "waiting", queue: room.queue});
                  }
                })
              }
            })
          })
        })
      })
    } else {
      res.send(false)
    }
  })
});

router.get("/songs", auth.ensureLoggedIn, (req, res) => {
    Song.find({}).then((songs) => {
      let listOfSongs = []
      songs.forEach((song) => {
        let highScore = 0 
        let arr = song.highScores.filter((entry) => {return entry.userId === req.user._id})
        if(arr.length > 0) highScore = arr[0].score 
        listOfSongs.push({title: song.title, primaryArtist: song.primaryArtist, songID: song._id, difficulty: song.answerKey.length, highScore: highScore})
        if(listOfSongs.length === songs.length) {
          res.send(listOfSongs.sort((a, b) => {
            return a.difficulty - b.difficulty
          }));
        }
      })
    })
})

router.get("/songLyrics", (req, res) => {
  console.log(req.query.title)
  request('https://itunes.apple.com/search?term='+utf8.encode(req.query.title)+'&entity=song&limit=1', (error, response, body) => {
    if (!error && response.statusCode == 200) {
      let songURL = JSON.parse(body).results[0].previewUrl
      genius.search(req.query.title).then(function(response1) {
        genius.song(response1.hits[0].result.id).then(function(response) {
          console.log('song', response.song); 
          let title = String(response.song.title);
          let primaryArtist =  response.song.primary_artist.name;
          // let featuredArtists = "Daniel";
          let artUrl = response.song.song_art_image_url;
          let id = String(response.song.id);
          let embedContent = response.song.embed_content;
          const options = {
            apiKey: process.env.GENIUS_CLIENT_ACCESS_TOKEN, // genius developer access token
            title: utf8.encode(title),
            artist: utf8.encode(primaryArtist),
            optimizeQuery: true
          }
          getLyrics(options).then(answer => {
            console.log("lyrics")
            console.log(answer)
            res.send({
              title: title,
              primaryArtist: primaryArtist,
              // featuredArtists: featuredArtists,
              artUrl: artUrl,
              id: id,
              answerKey: (answer ? answer.substring(0, Math.min(answer.length, 1500)) : null),
              url: songURL,
              embedContent: embedContent
            })
          })
        });
      });
    }
  })
})


router.post("/songLink", (req, res) => {
  console.log(req.body.embedContent)
  const song = new Song({
    answerKey: req.body.answerKey,
    title: req.body.title,
    primaryArtist: req.body.primaryArtist,
    // featuredArtists: req.body.featuredArtists,
    artUrl: req.body.artUrl,
    geniusID: req.body.geniusID,
    songUrl: req.body.songUrl,
    embedContent: req.body.embedContent,
  })
  song.save();
  res.send({});
})

router.post("/setMode", auth.ensureLoggedIn, (req, res) => {
  User.findById(req.user._id).then((user) => {
    user.mode = req.body.mode 
    user.save().then(() => {
      res.send({})
    })
  })
})

router.post("/playNote", auth.ensureLoggedIn, (req, res) => {
  socket.getIo().emit("playNote", {midiNumber: req.body.midiNumber, instrument: req.body.instrument, gameID: req.body.gameID})
 
  User.findById(req.user._id).then((user) => {
    user.inactivityCount = 0
    user.save()
  })
  res.send({})
})

router.post("/stopNote", auth.ensureLoggedIn, (req, res) => {
  socket.getIo().emit("stopNote", {midiNumber: req.body.midiNumber, instrument: req.body.instrument, gameID: req.body.gameID})
 
  res.send({})
})



router.post("/startGame", auth.ensureLoggedIn, (req, res) => {
  let gameData = []
  User.find({}).then((users) => {
    let counter = 0
    users.forEach((user) => {
      counter += 1
      if(user.roomID === req.body.roomID) {
        gameData.push({userId: user._id, userName: user.userName, score: 0, lyrics: [], mode: user.mode})
      }

      if(counter === users.length) {

        // create game
        let endTime = new Date((new Date()).getTime() + 33*1000) 
        let startTime = new Date((new Date()).getTime() + 3*1000) 

        

        // get random Song
        Song.aggregate(
          [ { $sample: { size: 1 } } ]
       ).then((songs) => {
          songs.forEach(randomSong => {

            let parameter = {_id: randomSong._id}
            if(req.body.song) parameter = {_id: req.body.song.songID}

            Song.findOne(parameter).then((song) => {
              const game = new Game({
                songID: song._id,
                answerKey: song.answerKey.replace(/(\r\n|\n|\r)/gm," ").replace(/(~|`|!|@|#|$|%|^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/g,"").toLowerCase(),
                endTime: endTime,
                gameData: gameData,
                roomID: req.body.roomID,
                status: "timer" // inProgress, timer, finished. 
              });
              game.save().then(() => {
                // API Get
                    Room.findOne({roomID: req.body.roomID}).then((room) => {
                      let arr = room.queue
                     // console.log(song._id)
                      
                      arr = arr.filter((song2) => {return song2.songID !== song._id.toString()})
                     // console.log(arr)
                      room.queue = arr
                      room.save()
                    })
      
                    socket.getIo().emit("startTimer", {roomID: req.body.roomID, gameID: game._id, songID: song._id, songURL: song.songUrl, endTime: endTime, startTime: startTime, gameData: gameData})
                    autocorrect[game._id.toString()] = require('autocorrect')({words: game.answerKey})
                    setTimeout(() => {
                      Game.findById(game._id).then((newGame) => {
                        newGame.status = "inProgress"
             
                        newGame.save().then(()=> {
                          socket.getIo().emit("inProgress", {roomID: req.body.roomID, gameID: game._id})
                        })
                      })
                     
                      
                    }, 3000)
                    setTimeout(() => {
                      Game.findById(game._id).then((newGame) => {

                        Song.findOne(parameter).then((song) => {
                          let curhighscores = song.highScores
                          let curgameData = newGame.gameData 
                          let i=0
                          let j=0
                          
                            for(j=0; j<curgameData.length; j++) {
                              let checked = false 
                              for(i=0; i<curhighscores.length; i++) {
                               if(curhighscores[i].userId === curgameData[j].userId) {
                                 checked = true 
                                  if(curhighscores[i].score < curgameData[j].score) {
                                    curhighscores[i] = curgameData[j]
                                  }
                                }
                            }
                            if(!checked) curhighscores.push(curgameData[j])
                          }
                          song.highScores = curhighscores
                          song.markModified("highScores")
                          song.save().then(() => {

                          newGame.status = "finished"
                        let finishedGameData = newGame.gameData
                        let lyrics = newGame.answerKey
                        lyrics = lyrics.split(" ")
                        finishedGameData.push({userId: "0", userName: "Lyrics", score: 100, lyrics: lyrics, mode: "Typing"})
                        newGame.save().then(()=> {
                          socket.getIo().emit("finished", {roomID: req.body.roomID, gameID: game._id, gameData: finishedGameData, highScores: curhighscores})
                       
                          finishedGameData.forEach((obj) => {
                            if(obj.userId === "0") return;
                            User.findById(obj.userId).then((activeuser) => {
                              let curcount = activeuser.inactivityCount;
                              if(obj.lyrics.length > 0) 
                                activeuser.inactivityCount = 0
                              else {
                                if(curcount >= 200) {
                                  socket.getIo().emit("inactive", {userId: obj.userId})
                                  activeuser.roomID = "Lobby"
                                  let message = new Message({
                                    sender: {userId: obj.userId, userName: activeuser.userName},
                                    roomID: req.body.roomID, 
                                    message: activeuser.userName + " left the Room",
                                    systemMessage: true
                                  })
                                  socket.getIo().emit("newMessage", message)
                                  activeuser.inactivityCount = 0
                                } 
                                else {
                                  activeuser.inactivityCount = curcount + 1
                                }
                              }
                              activeuser.save()
    
    
                            })
                          })
                       
                        })
                        })

                        
                      })
    
                      })
                    }, 33000)
          
                 
              })
            })






          })
       })
        

        
      }
    })
  })
  
  

  res.send({});
});

var stringSimilarity = require('string-similarity');

let similarity = (lyrics, answerKey) => {
  //console.log(lyrics)
  //console.log(answerKey)
  return Math.round(stringSimilarity.compareTwoStrings(lyrics.join(' '), answerKey)*100);
}

router.post("/updateGameData", auth.ensureLoggedIn, (req, res) => {
  // score calculation
 
 
  Game.findById(req.body.gameID).then((game) => {
    let answerKey = game.answerKey.split(" ")
    //console.log(answerKey)
    let newLyrics = req.body.lyrics 
    for(var i=0; i<newLyrics.length; i++) {
      newLyrics[i] = newLyrics[i].replace(/\s+/g,'')
      let result = levenshteiner.levenshteinOnArray(newLyrics[i], answerKey)
      let correctedword = result.value
      let similarity = stringSimilarity.compareTwoStrings(newLyrics[i], correctedword)
      //console.log(correctedword + " " + newLyrics[i] + " " + similarity + " " + result.distance )
      if((similarity > 0.35)) {
        
        if(!answerKey.includes(newLyrics[i])) {
          //console.log("a")
          if(Math.abs(newLyrics[i].length - correctedword.length) < 3) {
            //console.log("b")
            //console.log(newLyrics[i].charAt(0))
            //console.log(correctedword.charAt(0))
             if((newLyrics[i].charAt(0) === correctedword.charAt(0)) || ((result.distance <= 2)))
                newLyrics[i] = correctedword
          }
        }
      }
    }
    //newLyrics[newLyrics.length - 1] = autocorrect[game._id.toString()](newLyrics[newLyrics.length - 1])
    let newScore = similarity(newLyrics, game.answerKey) // better score calculationn D:
    socket.getIo().emit("updateGameScore", {userId: req.user._id, userName: req.user.userName, score: newScore, lyrics: newLyrics, roomID: req.body.roomID})

    let arr = game.gameData
    arr = arr.filter((obj) => {return obj.userId !== req.user._id.toString()})
    arr.push({userId: req.user._id,  userName: req.user.userName, score: newScore, lyrics: newLyrics, mode: req.body.mode})
    game.gameData = arr 
    game.markModified("gameData")
    game.save().then(() => {
      res.send({});
    })
  })

});


router.post("/newMessage", auth.ensureLoggedIn, (req, res) => {
  let systemMessage = false
  if(req.body.systemMessage) systemMessage = true
  let message = new Message({
    sender: {userId: req.user._id, userName: req.user.userName},
    roomID: req.body.roomID, 
    message: req.body.message,
    systemMessage: systemMessage
  })
  socket.getIo().emit("newMessage", message)
  User.findById(req.user._id).then((user) => {
    user.inactivityCount = 0

    user.save()
  })

  res.send({});
});

router.post("/updateSongs", (req,res) => {
  Song.find({}).then((songs) => {
    songs.forEach((song) => {
      request('https://itunes.apple.com/search?term='+utf8.encode(song.title + " " + song.primaryArtist)+'&entity=song&limit=1', (error, response, body) => {
      if (!error && response.statusCode == 200) {
        
        let songUrl = JSON.parse(body).results[0].previewUrl
        song.songUrl = songUrl
        song.save();
      }
    })
    })
  })
  res.send({})
})

router.post("/newSongReq", auth.ensureLoggedIn, (req, res) => {
  Room.findOne({roomID: req.body.roomID}).then((room) => {
    let q = room.queue;
    q.push(req.body.newSong);
    room.queue = q;
    room.save().then(() => {
      socket.getIo().emit("newQ", {q:q, roomID: req.body.roomID})
      res.send({});
    });
  })
});


router.post("/setRoomID", auth.ensureLoggedIn, (req, res) => {
  User.findById(req.user._id).then((user) => {
    user.roomID = req.body.roomID
    user.save().then(() => {
      res.send({})
    })
  })
})

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
