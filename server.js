
'use strict'

const express = require('express')
const http = require('http')
const WebSocket = require('ws')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

wss.on('connection', ws => {
  ws.on('message', message => {
    wss.clients.forEach(client => {
      if (client != ws) {
        client.send(message)
      }
    })
  })
})

server.listen(8080, () => {
  console.log('WebSocket server started on port', server.address().port);
})
