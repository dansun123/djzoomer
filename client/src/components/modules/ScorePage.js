import React, { Component, useState } from "react";
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import LinearProgress from '@material-ui/core/LinearProgress'
export default function ScorePage(props) {
  const [maxValue, setMaxValue] = useState(15)
  let scoreListElements = props.gameData.sort((a, b) => {return b.score - a.score}).map((user, place) => {
    let color = "#6c57f5"
    let fontWeight = 'normal'

    let nameColor = "#0000FF"

    if(user.userId === props.userId) {
      color = "#678efd"
      fontWeight = 'bold'

    }
    if(user.userId === "0") {
      color = "#3bb033"
      fontWeight = 'bold'
      nameColor = "#3bb033"
    }
 
   
    if(user.score > maxValue) {
      setMaxValue(maxValue * 2)
    }
    if(Object.keys(props).includes("cutOff")) {
      if(place >= props.cutOff) return <></>
    }
    return <ListItem button dense>
    <Box width={"200px"}>
    <h3 style={{fontWeight: "900", color: nameColor}}>{(user.userName || "") + ": " + (user.score || "0") + " "} </h3>
    </Box>
    <Box width={"calc(100% - 200px)"}>
    <h3 style={{fontWeight: fontWeight, color: color}}>{user.lyrics.join(" ")}</h3>
    </Box>
    
    </ListItem>
  })

  let height = "370px";
  return (
    <Box  style={{overflow: "scroll", maxHeight: height}} >
        <List>
          {scoreListElements}
        </List>
    </Box>
  );
};
