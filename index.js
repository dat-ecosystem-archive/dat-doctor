var dnsDiscovery = require('dns-discovery')
var swarm = require('discovery-swarm')
var crypto = require('crypto')
var pump = require('pump')
var defaults = require('datland-swarm-defaults')()
var dns = require('dns')
var thunky = require('thunky')

var doctor = 'doctor1.publicbits.org'

module.exports = function (opts) {
  var port = typeof opts.port === 'number' ? opts.port : 3282
  var id = typeof opts.id === 'string' ? opts.id : crypto.randomBytes(32).toString('hex')
  
  dns.lookup(doctor, function (err, address, family) {
    if (err) {
      console.error('Could not resolve', doctor, 'skipping...')
      return startP2P()
    }
    startPublicPeer(address)
  })
  
  function startPublicPeer(address) {
    var sw = swarm({
      dns: {
        servers: defaults.dns.server
      },
      whitelist: [address],
      hash: false,
      announce: false
    })
    sw.listen(port)
    sw.on('listening', function () {
      console.log('[info] Starting phase one (Public Server)')
      sw.join('dat-doctor-public-peer')
      sw.on('connecting', function (peer) {
        console.log('[info] Trying to connect to doctor, %s:%d', peer.host, peer.port)
      })
      sw.on('peer', function (peer) {
        console.log('[info] Discovered doctor, %s:%d', peer.host, peer.port)
      })
      sw.on('connection', function (connection) {
        connected = true
        console.log('[info] Connection established to doctor')
        connection.setEncoding('utf-8')
        connection.on('data', function (remote) {
          console.log('[info] Sending data back to doctor %s', remote.toString())
          console.log('[info] Phase one success!')
        })
        pump(connection, connection, function () {
          console.log('[info] Connection closed')
          destroy()
        })
      })
      console.log('[info] Attempting connection to doctor, %s', doctor)
      setTimeout(function () {
        if (connected) return
        destroy()
      }, 10000)
      var destroy = thunky(function (cb) {
        sw.destroy(function () {
          console.log('[info] End of phase one (Public Server), moving on to phase two (Peer to Peer)')
          startP2P()
          cb()
        })
      })
    })
  }
  
  function startP2P() {
    var client = dnsDiscovery({
      servers: defaults.dns.server
    })

    var tick = 0
    var sw = swarm({
      dns: {
        servers: defaults.dns.server
      }
    })

    sw.on('error', function () {
      sw.listen(0)
    })
    sw.listen(port)
    sw.on('listening', function () {
      client.whoami(function (err, me) {
        if (err) return console.error('Could not detect public ip / port')
        console.log('Public IP: ' + me.host)
        console.log('Your public port was ' + (me.port ? 'consistent' : 'inconsistent') + ' across remote multiple hosts')
        if (!me.port) console.log('Looks like you are behind a symmetric nat. Try enabling upnp.')
        else console.log('Looks like you can accept incoming p2p connections.')
        client.destroy()
        sw.join(id)
        sw.on('connecting', function (peer) {
          console.log('[info] Trying to connect to %s:%d', peer.host, peer.port)
        })
        sw.on('peer', function (peer) {
          console.log('[info] Discovered %s:%d', peer.host, peer.port)
        })
        sw.on('connection', function (connection) {
          var num = tick++
          var prefix = '0000'.slice(0, -num.toString().length) + num

          var data = crypto.randomBytes(16).toString('hex')
          console.log('[%s] Connection established to remote peer', prefix)
          var buf = ''
          connection.setEncoding('utf-8')
          connection.write(data)
          connection.on('data', function (remote) {
            buf += remote
            if (buf.length === data.length) {
              console.log('[%s] Remote peer echoed expected data back', prefix)
            }
          })
          pump(connection, connection, function () {
            console.log('[%s] Connected closed', prefix)
          })
        })

        console.log('')
        console.log('To test p2p connectivity login to another computer and run:')
        console.log('')
        if (process.argv[1].slice(process.argv[1].lastIndexOf('/') + 1) === 'dat-doctor') {
          console.log('  dat-doctor ' + id)
        } else {
          console.log('  dat doctor ' + id)
        }
        console.log('')
        console.log('Waiting for incoming connections... (local port: %d)', sw.address().port)
        console.log('')
      })
    })
  }
}
