import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export const generateSuitableBackgrounds = async (options: {
    imagePath: string; 
    count?: number;
}) => {
    const { imagePath, count = 4 } = options;

    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is missing");
    }

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("n", String(count));
    form.append("size", "1024x1024");
    form.append(
        "prompt",
        "Generate realistic high-quality backgrounds that are suitable for the subject in the provided image. " +
            "Backgrounds should be clean, studio-style, minimal, wooden table, gradient, or spotlight."
    );

    form.append("image", fs.createReadStream(imagePath));

    const response = await axios.post(
        "https://api.openai.com/v1/images/edits",
        form,
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                ...form.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        }
    );

    return response.data.data.map(
        (item: { b64_json: string }) => item.b64_json
    );
};
