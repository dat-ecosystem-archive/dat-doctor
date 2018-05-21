#!/usr/bin/env node

var minimist = require('minimist')
var argv = minimist(process.argv.slice(2))

require('.')({
  port: argv.port,
  peerId: argv._[0]
})
