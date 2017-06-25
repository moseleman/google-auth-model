const path = require('path')

const g_name = path.basename(__filename, '.js')

function NextStrategy() {}

NextStrategy.register = function() {
	console.log(`---- register strategy: ${g_name}`)

	return g_name
}

NextStrategy.prototype.auth = function(req, res, next) {
	next()
}

NextStrategy.prototype.callback = function(req, res, next) {
	next()
}

NextStrategy.prototype.checkAuth = function(req, res, next) {
  next()
}

module.exports = NextStrategy
