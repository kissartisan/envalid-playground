const envalid = require('../')
require('dotenv').config()

module.exports = envalid.cleanEnv(process.env, {
  HOST: envalid.host({ default: '127.0.0.1' }),
  PORT: envalid.port({ default: 3000, desc: 'The port to start the server on' }),
  MESSAGE: envalid.str({ default: 'Hey!' }),
  API_KEY: envalid.str(),
  ADMIN_EMAIL: envalid.email({ default: 'admin@example.com' }),
  EMAIL_CONFIG_JSON: envalid.json({ desc: 'Additional email parameters' }),
  NODE_ENV: envalid.str({ choices: ['develop', 'qa', 'production', 'staging'] }),
  IS_DUMMY: envalid.bool(),
})

// module.exports = envalid.cleanEnv(process.env, {
//   HOST: envalid.host({ default: '127.0.0.1' }),
//   PORT: envalid.port({ default: 3000, desc: 'The port to start the server on' }),
//   MESSAGE: envalid.str({ default: 'Hello, world' }),
// })
