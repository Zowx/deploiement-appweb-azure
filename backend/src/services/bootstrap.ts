import { getSecret, getConfig, getAllConfig } from "./config.js";
import { loggingService } from "./logging.js";

export interface AppConfig {
  // From Key Vault (secrets)
  databaseConnectionString: string;
  storageAccountName: string;
  storageContainerName: string;

  // From App Configuration
  appName: string;
  environment: string;
  apiVersion: string;
  uploadMaxFileSizeMB: number;
  uploadAllowedExtensions: string[];
  featureLoggingEnabled: boolean;
  featureFileValidationEnabled: boolean;
}

let cachedConfig: AppConfig | null = null;

export async function loadConfiguration(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const isAzureConfigured =
    process.env.AZURE_KEYVAULT_NAME && process.env.AZURE_APPCONFIG_ENDPOINT;

  if (!isAzureConfigured) {
    console.log("⚠️  Azure services not configured, using local defaults");
    cachedConfig = getLocalDefaults();
    return cachedConfig;
  }

  console.log("🔐 Loading configuration from Azure Key Vault...");
  console.log("⚙️  Loading settings from Azure App Configuration...");

  try {
    // Load secrets from Key Vault
    const [databaseConnectionString, storageAccountName, storageContainerName] =
      await Promise.all([
        getSecret("database-connection-string").catch(() => ""),
        getSecret("storage-account-name").catch(() => ""),
        getSecret("storage-container-name").catch(() => "uploads"),
      ]);

    // Load config from App Configuration
    const allConfig = await getAllConfig();

    cachedConfig = {
      // Secrets
      databaseConnectionString:
        databaseConnectionString || process.env.DATABASE_URL || "",
      storageAccountName:
        storageAccountName || process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
      storageContainerName:
        storageContainerName ||
        process.env.AZURE_STORAGE_CONTAINER_NAME ||
        "uploads",

      // App Configuration
      appName: allConfig["App:Name"] || "CloudAzure",
      environment: allConfig["App:Environment"] || "dev",
      apiVersion: allConfig["Api:Version"] || "1.0.0",
      uploadMaxFileSizeMB: parseInt(
        allConfig["Upload:MaxFileSizeMB"] || "10",
        10,
      ),
      uploadAllowedExtensions: (
        allConfig["Upload:AllowedExtensions"] ||
        ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip"
      ).split(","),
      featureLoggingEnabled: allConfig["Feature:LoggingEnabled"] === "true",
      featureFileValidationEnabled:
        allConfig["Feature:FileValidationEnabled"] === "true",
    };

    console.log("✅ Configuration loaded successfully");
    console.log(
      `   App: ${cachedConfig.appName} (${cachedConfig.environment})`,
    );
    console.log(`   API Version: ${cachedConfig.apiVersion}`);
    console.log(`   Max File Size: ${cachedConfig.uploadMaxFileSizeMB}MB`);
    console.log(
      `   Logging: ${cachedConfig.featureLoggingEnabled ? "enabled" : "disabled"}`,
    );

    // Configure Azure Function logging if available
    const functionUrl = process.env.AZURE_FUNCTION_URL;
    const functionKey = process.env.AZURE_FUNCTION_KEY;
    if (functionUrl && functionKey && cachedConfig.featureLoggingEnabled) {
      loggingService.configure(functionUrl, functionKey);
      console.log("📊 Azure Function logging configured");
    }

    return cachedConfig;
  } catch (error) {
    console.error("❌ Error loading Azure configuration:", error);
    console.log("⚠️  Falling back to local defaults");
    cachedConfig = getLocalDefaults();
    return cachedConfig;
  }
}

function getLocalDefaults(): AppConfig {
  return {
    databaseConnectionString: process.env.DATABASE_URL || "",
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
    storageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads",
    appName: "CloudAzure",
    environment: "local",
    apiVersion: "1.0.0",
    uploadMaxFileSizeMB: 10,
    uploadAllowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".zip",
    ],
    featureLoggingEnabled: true,
    featureFileValidationEnabled: true,
  };
}

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    throw new Error(
      "Configuration not loaded. Call loadConfiguration() first.",
    );
  }
  return cachedConfig;
}

export function isAzureStorageConfigured(): boolean {
  return !!cachedConfig?.storageAccountName;
}
