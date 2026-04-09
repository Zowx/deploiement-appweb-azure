using '../main.bicep'

param location = 'swedencentral'
param environment = 'prod'
param projectName = 'cloudazure'
param dbAdminLogin = 'pgadmin'
param sslCertificateData = readEnvironmentVariable('SSL_CERTIFICATE_DATA')
param sslCertificatePassword = readEnvironmentVariable('SSL_CERTIFICATE_PASSWORD')
