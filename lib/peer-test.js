var dnsDiscovery = require('dns-discovery')
var swarm = require('discovery-swarm')
var crypto = require('crypto')
var pump = require('pump')
var defaults = require('dat-swarm-defaults')()
var dns = require('dns')
var thunky = require('thunky')
var output = require('neat-log/output')
var chalk = require('chalk')
var debug = require('debug')('dat-doctor')

module.exports = p2pTest

function p2pTest (state, bus, views) {
  views.push(function (state) {
    if (!state.id) return ''
    return output(`
      To test p2p connectivity login to another computer and run:

      ${chalk.blue(`dat doctor ${state.id}`)}

      Waiting for incoming connections...
    `)
  })

  var tick = 0
  var sw = swarm({
    dns: {
      servers: defaults.dns.server
    },
    dht: false
  })

  sw.on('error', function () {
    sw.listen(0)
  })
  sw.listen(state.port)
  sw.on('listening', function () {
    bus.emit('render')
    sw.join(state.id)
    sw.on('connecting', function (peer) {
      bus.emit('connecting', peer)
    })
    sw.on('peer', function (peer) {
      debug('Discovered %s:%d', peer.host, peer.port)
    })
    sw.on('connection', function (connection, info) {
      var num = tick++
      var prefix = '0000'.slice(0, -num.toString().length) + num

      var data = crypto.randomBytes(16).toString('hex')
      debug('[%s-%s] Connection established to remote peer', prefix, info.type)
      var buf = ''
      connection.setEncoding('utf-8')
      connection.write(data)
      connection.on('data', function (remote) {
        buf += remote
        if (buf.length === data.length) {
          debug('[%s-%s] Remote peer echoed expected data back, success!', prefix, info.type)
        }
      })
      pump(connection, connection, function () {
        debug('[%s-%s] Connected closed', prefix, info.type)
      })
    })
  })
}
