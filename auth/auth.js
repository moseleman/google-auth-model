const fs = require('fs')

let g_auth

function Auth() {}

Auth.initService = function() {
	if (g_auth == null)
		g_auth = {}

	console.log('***** Passport init')

	// Strategy processing
	let Strategy, obj, key
	fs.readdirSync(`${__dirname}/strategy`).filter((f) => {
		return f.endsWith('.js')
	}).forEach((f) => {
		Strategy = require(`${__dirname}/strategy/${f}`)
		key = Strategy.register()
		obj = new Strategy()
		g_auth[key] = obj
		//console.log(`key: ${key}, auth: ${g_auth[key].auth}`)
	})
}

Auth.getAuth = async function(key) {
	if (g_auth == null) {
		await Auth.initService()
	}

	if (g_auth.hasOwnProperty(key) === false) {
		key = 'next'
	}

	return g_auth[key].auth
}

Auth.getCallback = async function(key) {
	if (g_auth == null) {
		await Auth.initService()
	}

	if (g_auth.hasOwnProperty(key) === false) {
		key = 'next'
		return Auth.getAuth(key)
	}

	return g_auth[key].callback
}

Auth.checkAuth = async function(key) {
  if (g_auth == null) {
    await Auth.initService()
  }

  if (g_auth.hasOwnProperty(key) === false) {
    key = 'next'
    return Auth.getAuth(key)
  }

  return g_auth[key].checkAuth
}


module.exports = Auth
