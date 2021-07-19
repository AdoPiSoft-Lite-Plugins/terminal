var core = require('plugin-core')
var { router, middlewares } = core
var { express, bodyParser } = middlewares
var terminal_ctrl = require('./controllers/terminal_ctrl')

router.get('/terminal-plugin', terminal_ctrl.get)
router.post('/terminal-plugin/run-command', express.urlencoded({ extended: true }), bodyParser.json(), terminal_ctrl.runCommand)
router.post('/terminal-plugin/abort-commands', express.urlencoded({ extended: true }), bodyParser.json(), terminal_ctrl.abortCommands)

module.exports = router
