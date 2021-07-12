const { ethers } = require('hardhat')

module.exports = async ({ deployments }) => {}
module.exports.tags = ['hh_deploy']
module.exports.dependencies = [
  'hh_deploy_factories',
  'hh_deploy_plainPoolTemplate',
  'hh_create_strategy',
  'hh_create_vault',
]
