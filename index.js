var os = require('os')
var crypto = require('crypto')
var dns = require('dns')
var exec = require('child_process').exec
var neatLog = require('neat-log')
var output = require('neat-log/output')
var neatTasks = require('neat-tasks')
var chalk = require('chalk')
var Menu = require('menu-string')
var debug = require('debug')('dat-doctor')
var runPublicTest = require('./lib/public-test')
var whoamiTest = require('./lib/whoami-test')

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
      title: 'Pinging the Dat Doctor',
      task: dnsLookupTask
    },
    {
      title: 'Checking Dat Native Module Installation',
      task: nativeModuleTask
    },
    {
      title: 'Checking Dat Public Connections via TCP',
      task: function (state, bus, done) {
        publicPeerTask(state, bus, {tcp: true, utp: false}, done)
      },
      skip: function (cb) {
        if (doctorAddress) return cb()
        cb(`Skipping... unable to reach ${DOCTOR_URL}`)
      }
    },
    {
      title: 'Checking Dat Public Connections via UTP',
      task: function (state, bus, done) {
        publicPeerTask(state, bus, {tcp: false, utp: true}, done)
      },
      skip: function (cb) {
        if (doctorAddress) return cb()
        cb(`Skipping... unable to reach ${DOCTOR_URL}`)
      }
    },
    {
      title: 'Starting optional peer-to-peer test',
      task: function (state, bus, done) {
        done('todo')
      }
    }
  ]

  var runTasks = neatTasks(tasks, function () {
    process.exit(0)
  })
  var neat = neatLog([headerOutput, versionsOutput, runTasks.view])
  neat.use(getVersions)
  neat.use(runTasks.use)
  // neat.input.on('update', function () {
  //   neat.render()
  // })


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
      return done(`Unable to load utp-native.\n  This will make it harder to connect peer-to-peer.`)
    }
    done()
  }

  function publicPeerTask (state, bus, opts, done) {
    opts = Object.assign({port: port, address: doctorAddress}, opts)
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
