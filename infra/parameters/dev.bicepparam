using '../main.bicep'

param location = 'swedencentral'
param environment = 'dev'
param projectName = 'cloudazure'
param dbAdminLogin = 'pgadmin'
param dbAdminPassword = readEnvironmentVariable('DB_ADMIN_PASSWORD')
param sslCertificateData = readEnvironmentVariable('SSL_CERTIFICATE_DATA')
param sslCertificatePassword = readEnvironmentVariable('SSL_CERTIFICATE_PASSWORD')
