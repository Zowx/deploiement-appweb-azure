using '../main.bicep'

param location = 'swedencentral'
param environment = 'prod'
param projectName = 'cloudazure'
param dbAdminLogin = 'pgadmin'
param sslCertificateData = readEnvironmentVariable('SSL_CERTIFICATE_DATA')
param sslCertificatePassword = readEnvironmentVariable('SSL_CERTIFICATE_PASSWORD')
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID')
param googleClientSecret = readEnvironmentVariable('GOOGLE_CLIENT_SECRET')
param sessionSecret = readEnvironmentVariable('SESSION_SECRET')
param baseUrl = readEnvironmentVariable('BASE_URL')
param frontendUrl = readEnvironmentVariable('FRONTEND_URL')
