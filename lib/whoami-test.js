var dnsDiscovery = require('dns-discovery')
var defaults = require('dat-swarm-defaults')()
var figures = require('figures')
var debug = require('debug')('dat-doctor')

module.exports = whoamiTest

function whoamiTest (state, bus, done) {
  createClient(state.port)

  function createClient (port) {
    var client = dnsDiscovery({
      servers: defaults.dns.server
    })

    client.once('error', function (err) {
      if (err.code !== 'EADDRINUSE') return done('ERROR: ' + err.message)
      if (state.port === 3282) bus.emit('error', `Default Dat port (${state.port}) in use, using random port.`)
      else bus.emit('error', `${figures.info} Specified port (${state.port}) in use, using random port`)
      bus.emit('error', 'Using a different port may impact Dat if you have a firewall.')
      client.on('close', function () {
        createClient([0])
      })
      client.destroy()
    })

    client.listen(port)
    client.on('listening', function () {
      client.whoami(function (err, me) {
        client.destroy()
        if (err) return done('Could not detect public ip / port')
        if (!me.port) return done('symmetric nat')
        state.host = me.host // public IP
        state.port = me.port
        state.title = `Your address is: ${state.host}:${state.port}`
        done()
      })
    })
  }
}
