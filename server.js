
'use strict'

// https://github.com/aws-samples/simple-websockets-chat-app

const express = require('express')
const http = require('http')
const WebSocket = require('ws')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

let clients = {}

wss.on('connection', ws => {
  ws.on('message', message => {

    console.log(message)

    let messageData = JSON.parse(message)
    let data = messageData.data

    if(data.action == 'joinmeeting') {

      clients[data.fromId] = {
        id: data.fromId,
        socket: ws,
        map: Object.keys(clients).map(id => {

          clients[id].socket.send(JSON.stringify({
            action: 'requestoffer',
            fromId: data.fromId
          }))

          clients[id].map.push({
            id: data.fromId,
            type: 'offer'
          })

          return {
            id: id,
            type: 'answer'
          }
        })
      }

    } else if(data.action == 'offer') {

      clients[data.toId].socket.send(JSON.stringify({
        action: 'receiveoffer',
        fromId: data.fromId,
        offer: data.offer
      }))

    } else if(data.action == 'answer') {

      clients[data.toId].socket.send(JSON.stringify({
        action: 'receiveanswer',
        fromId: data.fromId,
        answer: data.answer
      }))

    } else if(data.action == 'candidate') {

      clients[data.toId].socket.send(JSON.stringify({
        action: 'receivecandidate',
        fromId: data.fromId,
        answer: data.candidate
      }))

    }

  })
})

server.listen(8080, () => {
  console.log('WebSocket server started on port', server.address().port);
})
