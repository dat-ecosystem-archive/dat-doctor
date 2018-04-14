var dnsDiscovery = require('dns-discovery')
var swarm = require('discovery-swarm')
var crypto = require('crypto')
var pump = require('pump')
var defaults = require('dat-swarm-defaults')()
var thunky = require('thunky')

module.exports = function () {

}

function runPublicPeerTest (opts, cb) {
  var address = opts.address
  var name = opts.name || 'test'
  var port = opts.port || 3282

  var connected = false
  var dataEcho = false

  if (opts.utp && !opts.tcp) {
    // Check UTP support for utp only
    // TODO: discovery swarm fails hard if no server works
    try {
      require('utp-native')
    } catch (err) {
      log('[error] FAIL - unable to load utp-native, utp connections will not work')
      return cb()
    }
  }

  var sw = swarm({
    dns: {
      servers: defaults.dns.server
    },
    whitelist: [address],
    dht: false,
    hash: false,
    utp: opts.utp,
    tcp: opts.tcp
  })

  sw.on('error', function () {
    if (port === 3282) log('[error] Default Dat port did not work (3282), using random port')
    sw.listen(0)
  })
  sw.listen(port)

  sw.on('listening', function () {
    sw.join('dat-doctor-public-peer', {announce: false})
    sw.on('connecting', function (peer) {
      debug('Trying to connect to doctor, %s:%d', peer.host, peer.port)
    })
    sw.on('peer', function (peer) {
      debug('Discovered doctor, %s:%d', peer.host, peer.port)
    })
    sw.on('connection', function (connection) {
      connected = true
      debug('Connection established to doctor')
      connection.setEncoding('utf-8')
      connection.on('data', function (remote) {
        dataEcho = true
        log(`[info] ${name.toUpperCase()} - success!`)
      })
      pump(connection, connection, function () {
        debug('Connection closed')
        destroy(cb)
      })
    })
    debug('Attempting connection to doctor, %s', doctor)
    setTimeout(function () {
      if (connected) return
      log('[error] FAIL - Connection timeout, fail.')
      destroy(cb)
    }, 10000)
    var destroy = thunky(function (cb) {
      sw.destroy(function () {
        if (!connected) {
          log('[error] FAIL - Unable to connect to public server.')
        }
        if (!dataEcho) {
          log('[error] FAIL - Data was not echoed back from public server.')
        }
        cb()
      })
    })
  })
}