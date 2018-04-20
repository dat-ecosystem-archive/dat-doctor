var exec = require('child_process').exec
var os = require('os')
var neatLog = require('neat-log')
var output = require('neat-log/output')
var neatTasks = require('neat-tasks')
var chalk = require('chalk')
var Menu = require('menu-string')
// var debug = require('debug')('dat-doctor')
var defaultTasks = require('./lib/tasks-default')

var NODE_VER = process.version
var DOCTOR_VER = require('./package.json').version
var DAT_PROCESS = process.title === 'dat'

module.exports = function (opts) {
  if (!opts) opts = {}
  opts.port = typeof opts.port === 'number' ? opts.port : 3282

  var views = [headerOutput, versionsOutput, menuView]
  var neat = neatLog(views)
  neat.use(getVersions)

  var menu = Menu([
    'Basic Tests (Checks your Dat installation and network setup)',
    'Peer-to-Peer Test (Debug connections between two computers)'
  ])
  neat.use(function (state) {
    state.opts = opts
    state.port = opts.port
  })
  neat.use(function (state, bus) {
    bus.emit('render')

    neat.input.on('down', function () {
      menu.down()
      bus.render()
    })
    neat.input.on('up', function () {
      menu.up()
      bus.render()
    })
    neat.input.on('enter', function () {
      state.selected = menu.selected()
      bus.render()
      startTests(state.selected)
    })
  })

  function startTests (selected) {
    if (selected.index === 0) {
      var runTasks = neatTasks(defaultTasks(opts), function () {
        process.exit(0)
      })
      views.push(runTasks.view)
      neat.use(runTasks.use)
    } else {
      console.error(`\n\n${chalk.bold.blue('TODO')}`)
      process.exit(1)
    }
  }

  function headerOutput (state) {
    return `Welcome to ${chalk.green('Dat')} Doctor!\n`
  }

  function menuView (state) {
    if (state.selected) return `Running ${state.selected.text}`
    return output(`
      Which tests would you like to run?
      ${menu.toString()}
    `)
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
    exec('dat -v', function (err, stdin, stderr) {
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
}
