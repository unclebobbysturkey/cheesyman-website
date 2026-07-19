// Image URL API for cheesyman.com
// Returns presigned URLs for cheese photos stored in Cloudflare R2.
// Route: GET /image_api/images
// Port: 3007

const express = require('express');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 3007;

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const URL_EXPIRY = 3600; // 1 hour

// Lists all .jpg/.jpeg objects in the R2 bucket and returns presigned URLs
app.get('/image_api/images', async (req, res) => {
    try {
        const listCommand = new ListObjectsV2Command({ Bucket: BUCKET });
        const response = await s3.send(listCommand);

        if (!response.Contents || response.Contents.length === 0) {
            return res.json([]);
        }

        // Filter for jpg/jpeg files and sort alphabetically
        const imageKeys = response.Contents
            .map(obj => obj.Key)
            .filter(key => /\.(jpg|jpeg)$/i.test(key))
            .sort();

        // Generate presigned URLs for each image
        const urls = await Promise.all(
            imageKeys.map(key =>
                getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: URL_EXPIRY })
            )
        );

        res.json(urls);
    } catch (err) {
        console.error('Error fetching image URLs from R2:', err);
        res.status(500).json({ error: 'Failed to fetch image URLs' });
    }
});

app.listen(port, () => {
    console.log(`Image URL API is running on port ${port}`);
});
