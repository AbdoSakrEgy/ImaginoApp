"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Config = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const S3Config = () => {
    return new client_s3_1.S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
};
exports.S3Config = S3Config;
