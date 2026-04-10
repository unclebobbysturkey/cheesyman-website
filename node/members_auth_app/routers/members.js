// membersRouter
// handles requests to /members (landing) and /members/gallery
// gallery lists blobs from Azure Blob Storage and generates short-lived SAS URLs

const express = require('express');
const router = express.Router();
const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions
} = require('@azure/storage-blob');

const PHOTOS_PER_PAGE = 12;

router.get('/', (req, res) => {
    const email = req.session.user.email;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Members Area — Cheesyman.com</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f4f4f4;
        }
        h1 { color: #333; }
        p { color: #555; font-size: 18px; }
        .button {
            display: inline-block;
            margin: 10px;
            padding: 10px 20px;
            font-size: 18px;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.2);
            text-decoration: none;
        }
        .button:hover { opacity: 0.9; }
        #gallery-button { background-color: #2196f3; }
        #gallery-button:hover { background-color: #0b7dda; }
        #home-button { background-color: #4caf50; }
        #home-button:hover { background-color: #3e8e41; }
        #logout-button { background-color: #9e9e9e; }
        #logout-button:hover { background-color: #757575; }
        .button-container { margin-top: 30px; }
        .page-footer {
            text-align: center;
            font-size: 0.9rem;
            color: #666;
            margin-top: 3rem;
            padding: 1rem;
            background-color: rgba(255, 255, 255, 0.5);
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <h1>Members Area</h1>
    <p>Welcome, ${email}</p>
    <div class="button-container">
        <a href="/members/gallery" class="button" id="gallery-button">Photo Gallery</a>
        <a href="/" class="button" id="home-button">Home</a>
        <a href="/auth/logout" class="button" id="logout-button">Logout</a>
    </div>
    <footer class="page-footer">
        &copy; ${new Date().getFullYear()} Cheesyman Inc. All rights reserved.
    </footer>
</body>
</html>`);
});

router.get('/gallery', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
        const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
        const containerName = process.env.BLOB_CONTAINER_NAME;

        const credential = new StorageSharedKeyCredential(accountName, accountKey);
        const containerClient = new BlobServiceClient(
            `https://${accountName}.blob.core.windows.net`,
            credential
        ).getContainerClient(containerName);

        // List all .jpg blobs and sort alphabetically
        const allBlobs = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            if (/\.(jpg|jpeg)$/i.test(blob.name)) allBlobs.push(blob.name);
        }
        allBlobs.sort();

        const totalPages = Math.ceil(allBlobs.length / PHOTOS_PER_PAGE) || 1;
        const safePage = Math.min(page, totalPages);
        const pageBlobs = allBlobs.slice((safePage - 1) * PHOTOS_PER_PAGE, safePage * PHOTOS_PER_PAGE);

        // Generate SAS URLs valid for 1 hour for current page only
        const startsOn = new Date();
        const expiresOn = new Date(Date.now() + 60 * 60 * 1000);

        const photos = pageBlobs.map(blobName => {
            const sasToken = generateBlobSASQueryParameters({
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('r'),
                startsOn,
                expiresOn
            }, credential).toString();
            return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}?${sasToken}`;
        });

        res.send(galleryHtml(photos, safePage, totalPages));
    } catch (err) {
        console.error('Gallery error:', err);
        res.status(500).send('Failed to load gallery');
    }
});

function galleryHtml(photos, currentPage, totalPages) {
    const photosJson = JSON.stringify(photos);
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Members Gallery — Cheesyman.com</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 8px;
        }
        .nav-links {
            text-align: center;
            margin-bottom: 24px;
        }
        .nav-links a {
            color: #2196f3;
            text-decoration: none;
            margin: 0 12px;
            font-size: 15px;
        }
        .nav-links a:hover { text-decoration: underline; }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
            max-width: 1400px;
            margin: 0 auto;
        }
        .gallery-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 8px;
            cursor: pointer;
            display: block;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
            box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.2);
        }
        .gallery-item img:hover {
            transform: translateY(-8px);
            box-shadow: 0px 14px 24px rgba(0, 0, 0, 0.3);
        }

        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            margin: 32px 0 16px;
        }
        .pagination a {
            color: white;
            background-color: #2196f3;
            padding: 8px 18px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 16px;
            box-shadow: 0px 4px 6px rgba(0,0,0,0.2);
        }
        .pagination a:hover { background-color: #0b7dda; }
        .pagination .disabled {
            color: white;
            background-color: #bdbdbd;
            padding: 8px 18px;
            border-radius: 5px;
            font-size: 16px;
            box-shadow: 0px 4px 6px rgba(0,0,0,0.2);
        }
        .pagination .page-info {
            color: #555;
            font-size: 15px;
        }

        /* Lightbox */
        .lightbox {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.92);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        }
        .lightbox.active { display: flex; }
        .lightbox-img-wrap {
            display: flex;
            justify-content: center;
            align-items: center;
            max-width: 90vw;
            max-height: 80vh;
        }
        .lightbox-img-wrap img {
            max-width: 90vw;
            max-height: 80vh;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            object-fit: contain;
            user-select: none;
        }
        .lightbox-controls {
            display: flex;
            align-items: center;
            gap: 24px;
            margin-top: 20px;
        }
        .lightbox-btn {
            background: rgba(255,255,255,0.15);
            border: none;
            color: white;
            font-size: 28px;
            padding: 10px 22px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            user-select: none;
        }
        .lightbox-btn:hover { background: rgba(255,255,255,0.3); }
        .lightbox-counter {
            color: #ccc;
            font-size: 15px;
            min-width: 70px;
            text-align: center;
        }
        .lightbox-close {
            position: absolute;
            top: 16px; right: 22px;
            background: none;
            border: none;
            color: white;
            font-size: 38px;
            line-height: 1;
            cursor: pointer;
        }
        .lightbox-close:hover { color: #ccc; }

        .page-footer {
            text-align: center;
            font-size: 0.9rem;
            color: #666;
            margin-top: 2rem;
            padding: 1rem;
            background-color: rgba(255, 255, 255, 0.5);
            border-top: 1px solid #ddd;
        }

        @media (max-width: 480px) {
            .gallery-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 10px;
            }
            .gallery-item img { height: 150px; }
        }
    </style>
</head>
<body>
    <h1>Members Gallery</h1>
    <div class="nav-links">
        <a href="/members">&larr; Members Home</a>
        <a href="/auth/logout">Logout</a>
    </div>

    <div class="gallery-grid">
        ${photos.map((url, i) => `
        <div class="gallery-item">
            <img src="${url}" alt="Photo ${i + 1}" loading="lazy" onclick="openLightbox(${i})">
        </div>`).join('')}
    </div>

    <div class="pagination">
        ${currentPage > 1
            ? `<a href="/members/gallery?page=${currentPage - 1}">&larr; Prev</a>`
            : `<span class="disabled">&larr; Prev</span>`}
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        ${currentPage < totalPages
            ? `<a href="/members/gallery?page=${currentPage + 1}">Next &rarr;</a>`
            : `<span class="disabled">Next &rarr;</span>`}
    </div>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
        <div class="lightbox-img-wrap" onclick="closeLightbox()">
            <img id="lightbox-img" src="" alt="" onclick="event.stopPropagation()">
        </div>
        <div class="lightbox-controls">
            <button class="lightbox-btn" onclick="prevPhoto()">&#8592;</button>
            <span class="lightbox-counter" id="lightbox-counter"></span>
            <button class="lightbox-btn" onclick="nextPhoto()">&#8594;</button>
        </div>
    </div>

    <footer class="page-footer">
        &copy; ${year} Cheesyman Inc. All rights reserved.
    </footer>

    <script>
        const photos = ${photosJson};
        let currentIndex = 0;

        function openLightbox(index) {
            currentIndex = index;
            updateLightbox();
            document.getElementById('lightbox').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
            document.body.style.overflow = '';
        }

        function updateLightbox() {
            document.getElementById('lightbox-img').src = photos[currentIndex];
            document.getElementById('lightbox-counter').textContent = (currentIndex + 1) + ' / ' + photos.length;
        }

        function nextPhoto() {
            currentIndex = (currentIndex + 1) % photos.length;
            updateLightbox();
        }

        function prevPhoto() {
            currentIndex = (currentIndex - 1 + photos.length) % photos.length;
            updateLightbox();
        }

        // Keyboard navigation
        document.addEventListener('keydown', e => {
            if (!document.getElementById('lightbox').classList.contains('active')) return;
            if (e.key === 'ArrowRight') nextPhoto();
            else if (e.key === 'ArrowLeft') prevPhoto();
            else if (e.key === 'Escape') closeLightbox();
        });

        // Swipe support for mobile
        let touchStartX = 0;
        const lightbox = document.getElementById('lightbox');
        lightbox.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        lightbox.addEventListener('touchend', e => {
            const delta = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(delta) > 50) {
                if (delta > 0) nextPhoto();
                else prevPhoto();
            }
        }, { passive: true });
    </script>
</body>
</html>`;
}

module.exports = router;
