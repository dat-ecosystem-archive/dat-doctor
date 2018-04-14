var os = require('os')
var crypto = require('crypto')
var dns = require('dns')
var exec = require('child_process').exec
var neatLog = require('neat-log')
var output = require('neat-log/output')
var neatTasks = require('neat-tasks')
var chalk = require('chalk')
var debug = require('debug')('dat-doctor')

var DOCTOR_URL = 'doctor1.publicbits.org'
var NODE_VER = process.version
var DOCTOR_VER = require('./package.json').version
var DAT_PROCESS = process.title === 'dat'

module.exports = function (opts) {
  var port = typeof opts.port === 'number' ? opts.port : 3282
  var id = typeof opts.id === 'string' ? opts.id : crypto.randomBytes(32).toString('hex')
  var doctorAddress = null

  var tasks = [
    {
      title: 'Pinging the Dat Doctor',
      task: dnsLookupTask
    },
    {
      title: 'Checking Dat Native Module Installation',
      task: nativeModuleTask
    },
    {
      title: 'Checking Dat Public Connections',
      task: publicPeerTask
    }
  ]

  var runTasks = neatTasks(tasks, function () {
    process.exit(0)
  })
  var neat = neatLog([headerOutput, versionsOutput, runTasks.view])
  neat.use(getVersions)
  neat.use(runTasks.use)

  function headerOutput (state) {
    return `Welcome to ${chalk.green('Dat')} Doctor!\n`
  }

  function versionsOutput (state) {
    if (!state.versions) return ''
    var version = state.versions
    return output(`
      Software Info:
        ${os.platform()} ${os.arch()}
        Node ${version.node}
        Dat Doctor v${version.doctor}
        ${datVer()}
    `) + '\n'

    function datVer () {
      if (!DAT_PROCESS || !version.dat) return ''
      return chalk.green(`dat v${version.dat}`)
    }
  }

  function getVersions (state, bus) {
    state.versions = {
      dat: null,
      doctor: DOCTOR_VER,
      node: NODE_VER
    }
    exec('dat -v', function(err, stdin, stderr) {
      if (err && err.code === 127) {
        // Dat not installed/executable
        state.datInstalled = false
        return bus.emit('render')
      }
      // if (err) return bus.emit('render')
      // TODO: right now dat -v exits with error code, need to fix
      state.versions.dat = stderr.toString().split('\n')[0].trim()
      bus.emit('render')
    })
  }

  function dnsLookupTask (state, bus, done) {
    dns.lookup(DOCTOR_URL, function (err, address, _) {
      if (err) {
        return done(`Could not resolve ${DOCTOR_URL}`)
      }
      state.title = 'Resolved Dat Doctor Address'
      doctorAddress = address
      done()
    })
  }

  function nativeModuleTask (state, bus, done) {
    try {
      require('utp-native2')
      state.title = 'Loaded native modules'
    } catch (err) {
      state.title = 'Error loading native modules'
      return done(`Unable to load utp-native.\n  This will make it harder to connect peer-to-peer.`)
    }
    done()
  }

  function publicPeerTask (state, bus, done) {
    setTimeout(done, 5000)
  }

  function startPublicPeer (address, cb) {
    var tests = [
      {
        name: 'utp only',
        utp: true,
        tcp: false,
        port: 3282
      },
      {
        name: 'tcp only',
        utp: false,
        tcp: true,
        port: 3283
      }
    ]
    var pending = tests.length
    tests.forEach(function (test) {
      test.address = address
      runPublicPeerTest(test, function (err) {
        if (err) return cb(err)
        if (!--pending) cb()
      })
    })
  }
}
