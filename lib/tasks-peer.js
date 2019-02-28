var chalk = require('chalk')
// var debug = require('debug')('dat-doctor')
var whoamiTest = require('./whoami-test')

module.exports = function (opts) {
  if (!opts) opts = {}

  var port = opts.port

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
    }
  ]

  return tasks

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
}
