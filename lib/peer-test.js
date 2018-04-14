var dnsDiscovery = require('dns-discovery')
var swarm = require('discovery-swarm')
var crypto = require('crypto')
var pump = require('pump')
var defaults = require('dat-swarm-defaults')()
var dns = require('dns')
var thunky = require('thunky')

module.exports = function () {

}

function startP2PDNS () {
  var client = dnsDiscovery({
    servers: defaults.dns.server
  })

  client.on('error', function (err) {
    log('[info] dns-discovery emitted ' + err.message)
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
  sw.listen(port)
  sw.on('listening', function () {
    client.whoami(function (err, me) {
      if (err) return log('[error] Could not detect public ip / port')
      log('[info] Public IP: ' + me.host)
      log('[info] Your public port was ' + (me.port ? 'consistent' : 'inconsistent') + ' across remote multiple hosts')
      if (!me.port) log('[error] Looks like you are behind a symmetric nat. Try enabling upnp.')
      client.destroy()
      sw.join(id)
      sw.on('connecting', function (peer) {
        log('[info] Trying to connect to %s:%d', peer.host, peer.port)
      })
      sw.on('peer', function (peer) {
        debug('Discovered %s:%d', peer.host, peer.port)
      })
      sw.on('connection', function (connection, info) {
        var num = tick++
        var prefix = '0000'.slice(0, -num.toString().length) + num

        var data = crypto.randomBytes(16).toString('hex')
        log('[%s-%s] Connection established to remote peer', prefix, info.type)
        var buf = ''
        connection.setEncoding('utf-8')
        connection.write(data)
        connection.on('data', function (remote) {
          buf += remote
          if (buf.length === data.length) {
            log('[%s-%s] Remote peer echoed expected data back, success!', prefix, info.type)
          }
        })
        pump(connection, connection, function () {
          log('[%s-%s] Connected closed', prefix, info.type)
        })
      })

      log('')
      log('To test p2p connectivity login to another computer and run:')
      log('')
      log('  dat doctor ' + id)
      log('')
      log('Waiting for incoming connections... (local port: %d)', sw.address().port)
      log('')
    })
  })
}