const { runMigrations, clearDatabase } = require('../../src/migrationManager')
const config = require('../../src/config')

async function getApp (s3bucket, ipfsMock) {
  delete require.cache[require.resolve('../../src/app')] // force reload between each test
  delete require.cache[require.resolve('../../src/config')]
  delete require.cache[require.resolve('../../src/fileManager')]
  delete require.cache[require.resolve('../../src/routes/tracks')]
  delete require.cache[require.resolve('../../src/routes/files')]
  const appInfo = require('../../src/app')(8000, config.get('storagePath'), s3bucket, ipfsMock)

  // run all migrations before each test
  await clearDatabase()
  await runMigrations()
  return appInfo
}

module.exports = { getApp }