import { SecretClient } from "@azure/keyvault-secrets";
import { AppConfigurationClient } from "@azure/app-configuration";
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();

let secretClient: SecretClient | null = null;
let configClient: AppConfigurationClient | null = null;

function getSecretClient(): SecretClient {
  if (secretClient) return secretClient;

  const vaultName = process.env.AZURE_KEYVAULT_NAME;
  if (!vaultName) {
    throw new Error("AZURE_KEYVAULT_NAME is not set");
  }

  secretClient = new SecretClient(
    `https://${vaultName}.vault.azure.net`,
    credential,
  );
  return secretClient;
}

function getConfigClient(): AppConfigurationClient {
  if (configClient) return configClient;

  const endpoint = process.env.AZURE_APPCONFIG_ENDPOINT;
  if (!endpoint) {
    throw new Error("AZURE_APPCONFIG_ENDPOINT is not set");
  }

  configClient = new AppConfigurationClient(endpoint, credential);
  return configClient;
}

export async function getSecret(secretName: string): Promise<string> {
  const client = getSecretClient();
  const secret = await client.getSecret(secretName);
  return secret.value || "";
}

export async function getConfig(key: string): Promise<string> {
  const client = getConfigClient();
  const setting = await client.getConfigurationSetting({ key });
  return setting.value || "";
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const client = getConfigClient();
  const config: Record<string, string> = {};

  const settings = client.listConfigurationSettings();
  for await (const setting of settings) {
    if (setting.key && setting.value) {
      config[setting.key] = setting.value;
    }
  }

  return config;
}
