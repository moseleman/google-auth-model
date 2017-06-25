const fs = require('fs')
const path = require('path')
const redis = require('redis')
const jwt = require('jsonwebtoken')
const Google = require('googleapis')
const GoogleAuth = require('google-auth-library')
const g_msg = require(`${__managerpath}/message/message.js`)
const platformUsersDBT = require(`${__platformdbpath}/user.js`)

// replace the next one
//const g_clientSecretJson = require('../license/clientSecret.json')
let g_clientSecretJson = require('../license/clientSecret.json')
let g_redirectPage = '/token'
let g_configPath = `${__rootpath}/config.json`
if (fs.existsSync(g_configPath)) {
  let g_config = require(g_configPath)
	let testMode = g_config.testMode
	if (testMode == null || testMode === false) {
		g_clientSecretJson = require('../license/clientSecretNormal.json')
		g_redirectPage += '.html'
	}
}

const g_name = path.basename(__filename, '.js')
const REDIS_EXPIRE_TIME = 1200 // seconds
const g_scopes = [
    'https://www.googleapis.com/auth/plus.me',
    'https://www.googleapis.com/auth/userinfo.email'
]

let g_auth = new GoogleAuth()
const g_clientId = g_clientSecretJson.web.client_id
const g_clientSecret = g_clientSecretJson.web.client_secret
const g_redirectUrl = g_clientSecretJson.web.redirect_uris[0]
const g_originUrl = g_clientSecretJson.web.javascript_origins[0]

let oauth2Client = new g_auth.OAuth2(g_clientId, g_clientSecret, g_redirectUrl)
let g_redisDB = redis.createClient()

function GoogleOauth2Strategy() {}

GoogleOauth2Strategy.register = function() {
	console.log(`---- register strategy: ${g_name}`)
	return g_name
}

GoogleOauth2Strategy.prototype.auth = function(req, res, next) {
	//console.log(`get auth origin come from ${req.get('origin')}`)
  //console.log(`get auth go to ${req.protocol}://${req.get('host')}${req.originalUrl}`)

	let authUrl = oauth2Client.generateAuthUrl({
    scope: g_scopes
  })
//	res.cookie('crmToken', 'test', {maxAge: 300000, httpOnly: true})
//  res.json({authUrl: authUrl})
		res.redirect(authUrl)
}

GoogleOauth2Strategy.prototype.callback = function(req, res, next) {
  //console.log(`get callback come from ${req.get('origin')}`)
	//console.log(`get callback go to ${req.protocol}://${req.get('host')}${req.originalUrl}`)

	let code = req.query.code
	//console.log(`code: ${code}`)

	GoogleOauth2Strategy.getAccessTokenFromGoogle(code).then(tokens => {
		//console.log(`tokens: ${JSON.stringify(tokens)}`)

		GoogleOauth2Strategy.getGoogleInfo(tokens).then(async (user) => {
			//console.log(`user: ${JSON.stringify(user)}`)
			let uuid = user.id
			let data = {name:user.name, uuid:uuid, email:user.email}
			//console.log(`name: ${data.name}, uuid: ${data.uuid}, email: ${data.email}`)
			let userName = await platformUsersDBT.checkUserExist(uuid)
			if (userName === false) {
				let info = await platformUsersDBT.insert(data)
				userName = info.name
			}

			// user permission deny
			let enable = await platformUsersDBT.checkUserEnable(uuid)
			if (enable === false) {
				res.redirect(`${g_originUrl}/no-permission`) // 使用者無權使用本系統
				return
			}

			let token = jwt.sign(uuid, tokens.access_token)
			let rData = {name:userName, uuid:uuid, tokens:tokens}
			g_redisDB.set(token, JSON.stringify(rData))
			g_redisDB.expire(token, REDIS_EXPIRE_TIME)

			//console.log(`token: ${token}`)
			res.redirect(`${g_originUrl}${g_redirectPage}?token=${token}&userName=${userName}`)

		}).catch(e => {console.log(e)})
	}).catch(e => {console.log(e)})
}

GoogleOauth2Strategy.getAccessTokenFromGoogle = function(code) {
	return new Promise((resolve, reject) => {
		oauth2Client.getToken(code, (err, accessToken) => {
			if (err)
				reject(err)

			resolve(accessToken)
		})
	})
}

GoogleOauth2Strategy.getGoogleInfo = function(tokens) {
	return new Promise((resolve, reject) => {
		oauth2Client.credentials = tokens
		let service = Google.oauth2('v2')
		service.userinfo.v2.me.get({
			auth: oauth2Client
		}, (err, reply) => {
			if (err)
				reject(err)

			resolve(reply)
		})
	})
}

GoogleOauth2Strategy.prototype.checkAuth = function(req, res, next) {

	let token = req.body.token
	//console.log(`checkAuth: ${token}`)

	if (token == null) {
		res.json(g_msg.warning('2000')) // 請先登入
		return
	}

	g_redisDB.get(token, async (err, reply) => {
		if (reply == null) {
			res.json(g_msg.warning('2001')) // 請重新登入
			return
		}

		// check user enable
		let user = JSON.parse(reply)
		let enable = await platformUsersDBT.checkUserEnable(user.uuid)
		if (enable === false) {
			res.json(g_msg.warning('2002')) // 使用者被停權
			return
		}

		// reflesh toekn expire time
		g_redisDB.expire(token, REDIS_EXPIRE_TIME)
		next()
	})
}

module.exports = GoogleOauth2Strategy
