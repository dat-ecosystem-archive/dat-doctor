var swarm = require('discovery-swarm')
var pump = require('pump')
var defaults = require('dat-swarm-defaults')()
var thunky = require('thunky')
var debug = require('debug')('dat-doctor')

module.exports = runPublicPeerTest

function runPublicPeerTest (state, bus, opts, cb) {
  var address = opts.address
  var port = opts.port || 3282

  var connected = false
  var dataEcho = false

  var sw = swarm({
    dns: {
      domain: defaults.dns.domain,
      servers: defaults.dns.server
    },
    whitelist: [address],
    dht: false,
    hash: false,
    utp: opts.utp,
    tcp: opts.tcp
  })

  sw.on('error', function () {
    if (port === 3282) bus.emit('error', `Default Dat port did not work (${port}), using random port`)
    else bus.emit('error', `Specified port did not work (${port}), using random port`)
    sw.listen(0)
  })
  sw.listen(port)

  sw.on('listening', function () {
    state.title = 'Looking for Doctor on the Dat network...'
    sw.join('dat-doctor-public-peer', { announce: false })
    sw.on('connecting', function (peer) {
      state.title = `Connecting to Dat Doctor, ${peer.host}:${peer.port}`
      debug('Trying to connect to doctor, %s:%d', peer.host, peer.port)
    })
    sw.on('peer', function (peer) {
      state.title = `Discovered Dat Doctor, ${peer.host}:${peer.port}`
      debug('Discovered doctor, %s:%d', peer.host, peer.port)
    })
    sw.on('connection', function (connection) {
      connected = true
      state.title = `Connected to Dat Doctor!`
      debug('Connection established to doctor')
      connection.setEncoding('utf-8')
      connection.on('data', function (remote) {
        dataEcho = true
        state.title = `Successful data transfer with Dat Doctor via ${opts.tcp ? 'TCP' : 'UDP'}`
        destroy(cb)
      })
      pump(connection, connection, function () {
        debug('Connection closed')
        destroy(cb)
      })
    })
    // debug('Attempting connection to doctor, %s', doctor)
    setTimeout(function () {
      if (connected) return
      bus.emit('error', 'Connection timed out.')
      destroy(cb)
    }, 10000)
    var destroy = thunky(function (done) {
      sw.destroy(function () {
        if (connected && dataEcho) return done()
        state.title = `Public Peer Test via ${opts.tcp ? 'TCP' : 'UDP'} Failed`
        if (!connected) {
          done('Unable to connect to Dat public server')
        }
        if (!dataEcho) {
          done('Data was not echoed back from public server')
        }
        done()
      })
    })
  })
}
