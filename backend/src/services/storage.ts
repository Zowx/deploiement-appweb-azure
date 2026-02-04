import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads";

let containerClient: ContainerClient | null = null;
let blobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (blobServiceClient) return blobServiceClient;

  if (!accountName) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME is not set");
  }

  const credential = new DefaultAzureCredential();
  blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );

  return blobServiceClient;
}

function getContainerClient(): ContainerClient {
  if (containerClient) return containerClient;

  containerClient = getBlobServiceClient().getContainerClient(containerName);
  return containerClient;
}

export async function uploadFile(
  fileName: string,
  content: Buffer,
  contentType: string,
): Promise<string> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(fileName);

  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

export async function deleteFile(fileName: string): Promise<void> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(fileName);
  await blockBlobClient.deleteIfExists();
}

export async function listFiles(): Promise<string[]> {
  const client = getContainerClient();
  const files: string[] = [];

  for await (const blob of client.listBlobsFlat()) {
    files.push(blob.name);
  }

  return files;
}

export function getFileUrl(fileName: string): string {
  return `https://${accountName}.blob.core.windows.net/${containerName}/${fileName}`;
}

export async function fileExists(fileName: string): Promise<boolean> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(fileName);
  return blockBlobClient.exists();
}
