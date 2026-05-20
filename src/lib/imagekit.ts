import ImageKit from "imagekit";

export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function getImageKitAuthParams() {
  return imagekit.getAuthenticationParameters();
}

export async function deleteImageKitFile(fileId: string) {
  return imagekit.deleteFile(fileId);
}
