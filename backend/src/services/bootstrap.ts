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
      uploadMaxFileSizeMB: parseMaxFileSizeMB(
        allConfig["Upload:MaxFileSizeMB"],
      ),
      uploadAllowedExtensions: parseAllowedExtensions(
        allConfig["Upload:AllowedExtensions"],
      ),
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

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_LIMIT_MB = 500;
const DEFAULT_ALLOWED_EXTENSIONS =
  ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip";

function parseMaxFileSizeMB(raw: string | undefined): number {
  const parsed = parseInt(raw || String(DEFAULT_MAX_FILE_SIZE_MB), 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > MAX_FILE_SIZE_LIMIT_MB) {
    console.warn(
      `⚠️  Invalid Upload:MaxFileSizeMB "${raw}", using default ${DEFAULT_MAX_FILE_SIZE_MB}MB`,
    );
    return DEFAULT_MAX_FILE_SIZE_MB;
  }
  return parsed;
}

function parseAllowedExtensions(raw: string | undefined): string[] {
  const input = raw || DEFAULT_ALLOWED_EXTENSIONS;
  const extensions = input
    .split(",")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => /^\.[a-z0-9]+$/.test(ext));

  if (extensions.length === 0) {
    console.warn(
      `⚠️  No valid extensions in Upload:AllowedExtensions "${raw}", using defaults`,
    );
    return DEFAULT_ALLOWED_EXTENSIONS.split(",");
  }
  return extensions;
}

function getLocalDefaults(): AppConfig {
  return {
    databaseConnectionString: process.env.DATABASE_URL || "",
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
    storageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads",
    appName: "CloudAzure",
    environment: "local",
    apiVersion: "1.0.0",
    uploadMaxFileSizeMB: 100,
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
      ".mp4",
      ".mov",
      ".avi",
      ".webm",
      ".mkv",
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
