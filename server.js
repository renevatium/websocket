
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

    let messageData = JSON.parse(message)
    let data = messageData.data

    if(data.action == 'joinmeeting') {

      clients[data.fromId] = {
        id: data.fromId,
        socket: ws,
        type: 'host',
        max: data.maxConnections,
        map: Object.keys(clients).map(id => {

          if(clients[id].type == 'host') {
            clients[id].socket.send(JSON.stringify({
              action: 'requestoffer',
              fromId: data.fromId
            }))

            clients[id].map.push({
              id: data.fromId,
              type: 'host'
            })

            return {
              id: id,
              type: 'host'
            }
          }

        })
      }

    } else if(data.action == 'joinwebinar') {

      let clientIds = Object.keys(clients)
      for(let i=0;i<clientIds.length;i++) {

        let toId = clientIds[i]
        if(clients[toId].type == 'host') {

          if(clients[toId].map.length < clients[toId].max) {

            clients[toId].socket.send(JSON.stringify({
              action: 'requestoffer',
              fromId: data.fromId
            }))

            clients[data.fromId] = {
              id: data.fromId,
              socket: ws,
              type: 'peer',
              map: [{
                id: toId,
                type: 'host'
              }]
            }

            clients[toId].map.push({
              id: data.fromId,
              toId: toId,
              type: 'peer',
              max: data.maxConnections,
              map: []
            })

            break

          } else {

            const requestRelay = (peer, depth) => {

              if(peer.map.length < peer.max) {

                clients[peer.id].socket.send(JSON.stringify({
                  action: 'requestrelay',
                  fromId: data.fromId,
                  toId: peer.toId
                }))

                clients[data.fromId] = {
                  id: data.fromId,
                  socket: ws,
                  type: 'relay',
                  depth: depth,
                  map: [{
                    id: peer.toId,
                    peerId: peer.id,
                    type: 'relay'
                  }]
                }

                peer.map.push({
                  id: data.fromId,
                  toId: peer.id,
                  relayId: peer.toId,
                  type: 'relay',
                  depth: depth,
                  max: data.maxConnections,
                  map: []
                })

                return true
              }

              return false
            }

            const requestRelayLoop = (peers, depth) => {
              let nextLayer = []
              let relaySuccessful = false
              if(peers.length > 0) {
                for(let j=0;j<peers.length;j++) {
                  relaySuccessful = requestRelay(peers[j], depth)
                  if(relaySuccessful) {
                    //console.log(data.fromId, 'relaying', peers[j].toId, 'through', peers[j].id)
                    return true
                  } else {
                    nextLayer = nextLayer.concat(peers[j].map)
                  }
                }
                return requestRelayLoop(nextLayer, depth+1)
              }
            }

            requestRelayLoop(clients[toId].map, 1)

          }
        }
      }

    } else if(data.action == 'leavemeeting') {

      delete clients[data.fromId]
      Object.keys(clients).map(id => {
        clients[id].map.filter(client => client.id != data.fromId);
        clients[id].socket.send(JSON.stringify({
          action: 'leavemeeting',
          fromId: data.fromId
        }))
      })

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
        candidate: data.candidate
      }))

    } else if(data.action == 'togglevideo') {

      Object.values(clients[data.fromId].map).forEach(peer => {
        clients[peer.id].socket.send(JSON.stringify({
          action: 'toggleremotevideo',
          fromId: data.fromId,
          state: data.state
        }))
      })

    } else if(data.action == 'toggleaudio') {

      Object.values(clients[data.fromId].map).forEach(peer => {
        clients[peer.id].socket.send(JSON.stringify({
          action: 'toggleremoteaudio',
          fromId: data.fromId,
          state: data.state
        }))
      })

    }

  })
})

server.listen(8080, () => {
  console.log('WebSocket server started on port', server.address().port);
})
