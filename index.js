var dnsDiscovery = require('dns-discovery')
var swarm = require('discovery-swarm')
var crypto = require('crypto')
var pump = require('pump')
var defaults = require('datland-swarm-defaults')()
var dns = require('dns')
var thunky = require('thunky')
var fmt = require('util').format
var EOL = require('os').EOL

var doctor = 'doctor1.publicbits.org'

module.exports = function (opts) {
  var port = typeof opts.port === 'number' ? opts.port : 3282
  var id = typeof opts.id === 'string' ? opts.id : crypto.randomBytes(32).toString('hex')
  var out = opts.out || process.stderr
  var log = function () {
    out.write(fmt.apply(null, arguments) + EOL)
  }

  dns.lookup(doctor, function (err, address, family) {
    if (err) {
      log('Could not resolve', doctor, 'skipping...')
      return startP2PDNS()
    }
    startPublicPeer(address)
  })

  function startPublicPeer (address) {
    var connected = false
    var sw = swarm({
      dns: {
        servers: defaults.dns.server
      },
      whitelist: [address],
      dht: false,
      hash: false
    })
    sw.on('error', function () {
      sw.listen(0)
    })
    sw.listen(8765)
    sw.on('listening', function () {
      log('[info] Starting phase one (Public Server)')
      sw.join('dat-doctor-public-peer', {announce: false})
      sw.on('connecting', function (peer) {
        log('[info] Trying to connect to doctor, %s:%d', peer.host, peer.port)
      })
      sw.on('peer', function (peer) {
        log('[info] Discovered doctor, %s:%d', peer.host, peer.port)
      })
      sw.on('connection', function (connection) {
        connected = true
        log('[info] Connection established to doctor')
        connection.setEncoding('utf-8')
        connection.on('data', function (remote) {
          log('[info] Sending data back to doctor %s', remote.toString())
          log('[info] Phase one success!')
        })
        pump(connection, connection, function () {
          log('[info] Connection closed')
          destroy()
        })
      })
      log('[info] Attempting connection to doctor, %s', doctor)
      setTimeout(function () {
        if (connected) return
        log('[info] Connection timeout, fail!')
        destroy()
      }, 10000)
      var destroy = thunky(function (cb) {
        sw.destroy(function () {
          log('[info] End of phase one (Public Server), moving on to phase two (Peer to Peer via DNS)')
          startP2PDNS()
          cb()
        })
      })
    })
  }

  function startP2PDNS () {
    var client = dnsDiscovery({
      servers: defaults.dns.server
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
        if (err) return log('Could not detect public ip / port')
        log('Public IP: ' + me.host)
        log('Your public port was ' + (me.port ? 'consistent' : 'inconsistent') + ' across remote multiple hosts')
        if (!me.port) log('Looks like you are behind a symmetric nat. Try enabling upnp.')
        else log('Looks like you can accept incoming p2p connections.')
        client.destroy()
        sw.join(id)
        sw.on('connecting', function (peer) {
          log('[info] Trying to connect to %s:%d', peer.host, peer.port)
        })
        sw.on('peer', function (peer) {
          log('[info] Discovered %s:%d', peer.host, peer.port)
        })
        sw.on('connection', function (connection) {
          var num = tick++
          var prefix = '0000'.slice(0, -num.toString().length) + num

          var data = crypto.randomBytes(16).toString('hex')
          log('[%s] Connection established to remote peer', prefix)
          var buf = ''
          connection.setEncoding('utf-8')
          connection.write(data)
          connection.on('data', function (remote) {
            buf += remote
            if (buf.length === data.length) {
              log('[%s] Remote peer echoed expected data back, success!', prefix)
            }
          })
          pump(connection, connection, function () {
            log('[%s] Connected closed', prefix)
          })
        })

        log('')
        log('To test p2p connectivity login to another computer and run:')
        log('')
        if (process.argv[1].slice(process.argv[1].lastIndexOf('/') + 1) === 'dat-doctor') {
          log('  dat-doctor ' + id)
        } else {
          log('  dat doctor ' + id)
        }
        log('')
        log('Waiting for incoming connections... (local port: %d)', sw.address().port)
        log('')
      })
    })
  }
}
