
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
        count: 0,
        map: Object.keys(clients).map(id => {

          if(clients[id].type == 'host') {

            clients[id].map.push({
              id: data.fromId,
              type: 'host'
            })

            clients[id].socket.send(JSON.stringify({
              action: 'requestoffer',
              fromId: data.fromId
            }))

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

          console.log('connecting', data.fromId, 'to host', toId)

          if(clients[toId].count < clients[toId].max) {

            clients[data.fromId] = {
              id: data.fromId,
              socket: ws,
              type: 'peer',
              max: data.maxConnections,
              count: 0,
              map: [{
                id: toId,
                type: 'host'
              }]
            }

            clients[toId].map.push({
              id: data.fromId,
              toId: toId,
              type: 'peer'
            })

            clients[toId].count += 1

            clients[toId].socket.send(JSON.stringify({
              action: 'requestoffer',
              fromId: data.fromId
            }))

            continue

          } else {

            const requestRelay = (peer, depth) => {

              if(clients[peer.id].count < clients[peer.id].max) {

                let validateIndex = clients[peer.id].map.findIndex(value => {
                  return value.id == data.fromId
                })

                if(validateIndex < 0) {

                  clients[data.fromId] = {
                    id: data.fromId,
                    socket: ws,
                    type: 'relay',
                    depth: depth,
                    max: data.maxConnections,
                    count: 0,
                    map: [{
                      id: peer.toId,
                      peerId: peer.id,
                      type: 'relay'
                    }]
                  }

                  clients[peer.id].map.push({
                    id: data.fromId,
                    toId: peer.id,
                    relayId: peer.toId,
                    type: 'relay'
                  })

                  clients[peer.id].count += 1

                  clients[peer.id].socket.send(JSON.stringify({
                    action: 'requestrelay',
                    fromId: data.fromId,
                    toId: peer.toId
                  }))

                  return true

                }
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

                    console.log(data.fromId, 'relaying', peers[j].toId, 'through', peers[j].id, 'at depth', depth)

                    return true
                  } else {
                    nextLayer = nextLayer.concat(clients[peers[j].id].map)
                  }
                }
                return requestRelayLoop(nextLayer, depth+1)
              }
            }

            let relaySuccess = requestRelayLoop(clients[toId].map, 1)
            if(!relaySuccess) {
              console.dir(clients, { depth: 2 })
            }

          }
        }
      }

    } else if(data.action == 'leavemeeting') {

      console.log('leavemeeting', data.fromId)

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

      clients[data.fromId].map.forEach(peer => {
        clients[peer.id].socket.send(JSON.stringify({
          action: 'toggleremotevideo',
          fromId: data.fromId,
          state: data.state
        }))
      })

    } else if(data.action == 'toggleaudio') {

      clients[data.fromId].map.forEach(peer => {
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
