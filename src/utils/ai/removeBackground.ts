import axios from "axios";

interface RemoveBgOptions {
  imageBase64: string;
}

export const removeBackgroundFromImageBase64 = async ({
  imageBase64,
}: RemoveBgOptions): Promise<string> => {
  if (!process.env.REMOVE_BG_API_KEY) {
    throw new Error("REMOVE_BG_API_KEY not set in environment");
  }

  const response = await axios({
    method: "post",
    url: "https://api.remove.bg/v1.0/removebg",
    data: {
      image_file_b64: imageBase64,
      size: "auto",
      format: "png",
    },
    headers: {
      "X-Api-Key": process.env.REMOVE_BG_API_KEY!,
      "Content-Type": "application/json",
    },
    responseType: "arraybuffer",
  });

  const base64Result = Buffer.from(response.data, "binary").toString("base64");
  return base64Result;
};