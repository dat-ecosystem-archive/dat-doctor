var dns = require('dns')
var chalk = require('chalk')
var debug = require('debug')('dat-doctor')
var runPublicTest = require('./public-test')
var whoamiTest = require('./whoami-test')

module.exports = function (opts) {
  if (!opts) opts = {}

  var DOCTOR_URL = 'doctor1.datprotocol.com'
  var doctorAddress = null
  var port = opts.port
  var skipUTP = false

  var tasks = [
    {
      title: 'Who am I?',
      task: function (state, bus, done) {
        state.port = port
        bus.on('error', function (err) {
          if (!state.output) state.output = '  ' + chalk.dim(err)
          else state.output += '\n  ' + chalk.dim(err)
        })
        whoamiTest(state, bus, done)
      }
    },
    {
      title: 'Checking Dat Native Module Installation',
      task: nativeModuleTask
    },
    {
      title: 'Pinging the Dat Doctor',
      task: dnsLookupTask
    },
    {
      title: 'Checking Dat Public Connections via TCP',
      task: function (state, bus, done) {
        publicPeerTask(state, bus, { tcp: true, utp: false }, done)
      },
      skip: function (done) {
        if (doctorAddress) return done()
        done(`Skipping... unable to reach ${DOCTOR_URL}`)
      }
    },
    {
      title: 'Checking Dat Public Connections via UTP',
      task: function (state, bus, done) {
        publicPeerTask(state, bus, { tcp: false, utp: true }, done)
      },
      skip: function (done) {
        if (!doctorAddress) {
          return done(`Skipping... unable to reach ${DOCTOR_URL}`)
        }
        if (skipUTP) {
          return done('Skipping... UTP not available')
        }
        return done()
      }
    }
  ]

  return tasks

  function dnsLookupTask (state, bus, done) {
    dns.lookup(DOCTOR_URL, function (err, address, _) {
      if (err) {
        state.title = 'Unable to reach the Dat Doctor Server'
        return done(`Please check if you can resolve the url manually, ${chalk.reset.cyanBright(`ping ${DOCTOR_URL}`)}`)
      }
      state.title = 'Resolved Dat Doctor Server'
      doctorAddress = address
      done()
    })
  }

  function nativeModuleTask (state, bus, done) {
    try {
      require('utp-native')
      state.title = 'Loaded native modules'
    } catch (err) {
      state.title = 'Error loading native modules'
      // TODO: link to FAQ/More Help
      skipUTP = true
      return done(`Unable to load utp-native.\n  This will make it harder to connect peer-to-peer.`)
    }
    done()
  }

  function publicPeerTask (state, bus, opts, done) {
    opts = Object.assign({ port: port, address: doctorAddress }, opts)
    state.errors = []
    state.messages = []

    bus.on('error', (err) => {
      // TODO: persist these after task is done?
      debug('ERROR - ', err)
    })

    runPublicTest(state, bus, opts, function (err) {
      if (err) return done(err)
      done()
    })
  }
}
