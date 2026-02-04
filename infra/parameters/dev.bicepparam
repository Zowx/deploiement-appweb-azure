using '../main.bicep'

param location = 'swedencentral'
param environment = 'dev'
param projectName = 'cloudazure'
param dbAdminLogin = 'pgadmin'
param dbAdminPassword = readEnvironmentVariable('DB_ADMIN_PASSWORD')
