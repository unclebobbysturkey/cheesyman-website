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

// ── Shared cyberpunk CSS (inlined so the members app is self-contained) ────────
const CYBERPUNK_CSS = `
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
:root {
    --bg:          #080810;
    --surface:     #0e0e1a;
    --surface2:    #13131f;
    --surface3:    #1a1a2a;
    --border:      #1e1e3a;
    --text:        #e8e8ff;
    --text-dim:    #7878a8;
    --text-faint:  #3a3a60;
    --green:       #00ff41;
    --green-glow:  rgba(0, 255, 65, 0.35);
    --blue:        #00e5ff;
    --blue-glow:   rgba(0, 229, 255, 0.35);
    --orange:      #ff6600;
    --orange-glow: rgba(255, 102, 0, 0.35);
    --purple:      #df00ff;
    --purple-glow: rgba(223, 0, 255, 0.35);
    --amber:       #ffe600;
    --amber-glow:  rgba(255, 230, 0, 0.3);
    --font-display: 'Orbitron', monospace;
    --font-mono:    'Share Tech Mono', 'Courier New', monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: var(--font-mono);
    background-color: var(--bg);
    color: var(--text);
    min-height: 100vh;
    background-image: radial-gradient(circle, #1a1a3a 1px, transparent 1px);
    background-size: 28px 28px;
}

body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
        to bottom,
        transparent, transparent 3px,
        rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px
    );
    z-index: 9999;
}

.neon-bar {
    height: 4px;
    background: linear-gradient(90deg, var(--purple) 0%, var(--blue) 25%, var(--green) 50%, var(--orange) 75%, var(--purple) 100%);
    box-shadow: 0 0 6px var(--purple), 0 0 16px var(--blue), 0 0 30px var(--green), 0 0 6px var(--orange);
}

.page-wrap {
    max-width: 1050px;
    margin: 0 auto;
    padding: 0 20px 60px;
}

.page-header {
    text-align: center;
    padding: 36px 20px 28px;
    border-bottom: 1px solid var(--border);
    position: relative;
    overflow: hidden;
}
.page-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 110%, var(--purple-glow) 0%, transparent 70%);
    pointer-events: none;
}

.header-kicker {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.4em;
    color: var(--purple);
    text-transform: uppercase;
    margin-bottom: 10px;
    text-shadow: 0 0 10px var(--purple);
}
.header-kicker::before { content: '> '; }

.page-header h1 {
    font-family: var(--font-display);
    font-size: clamp(24px, 5vw, 58px);
    font-weight: 900;
    letter-spacing: 0.08em;
    color: #fff;
    line-height: 1.1;
    text-shadow: 0 0 10px #fff, 0 0 30px var(--purple), 0 0 60px var(--purple), 0 0 100px var(--purple-glow);
}

.header-sub {
    margin-top: 10px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
}

.section-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.3em;
    color: var(--text-dim);
    text-transform: uppercase;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.section-label::before { content: '//'; color: var(--purple); text-shadow: 0 0 8px var(--purple); flex-shrink: 0; }
.section-label::after  { content: ''; flex: 1; height: 1px; background: var(--border); }

.btn {
    display: inline-block;
    padding: 10px 22px;
    font-family: var(--font-mono);
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-decoration: none;
    border: 1px solid currentColor;
    border-radius: 2px;
    cursor: pointer;
    background: transparent;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    margin: 5px;
    line-height: 1.4;
}
.btn::before { content: '['; margin-right: 4px; opacity: 0.6; }
.btn::after  { content: ']'; margin-left:  4px; opacity: 0.6; }
.btn:hover   { transform: translateY(-2px); }

.btn-green  { color: var(--green);  border-color: var(--green);  text-shadow: 0 0 8px var(--green); }
.btn-green:hover  { background: var(--green-glow);  box-shadow: 0 0 8px var(--green),  0 0 24px var(--green-glow),  inset 0 0 16px var(--green-glow); }
.btn-blue   { color: var(--blue);   border-color: var(--blue);   text-shadow: 0 0 8px var(--blue); }
.btn-blue:hover   { background: var(--blue-glow);   box-shadow: 0 0 8px var(--blue),   0 0 24px var(--blue-glow),   inset 0 0 16px var(--blue-glow); }
.btn-purple { color: var(--purple); border-color: var(--purple); text-shadow: 0 0 8px var(--purple); }
.btn-purple:hover { background: var(--purple-glow); box-shadow: 0 0 8px var(--purple), 0 0 24px var(--purple-glow), inset 0 0 16px var(--purple-glow); }
.btn-amber  { color: var(--amber);  border-color: var(--amber);  text-shadow: 0 0 8px var(--amber); }
.btn-amber:hover  { background: var(--amber-glow);  box-shadow: 0 0 8px var(--amber),  0 0 24px var(--amber-glow),  inset 0 0 16px var(--amber-glow); }
.btn-dim    { color: var(--text-dim); border-color: var(--text-dim); }
.btn-dim:hover    { background: rgba(120,120,168,0.15); color: var(--text); border-color: var(--text); }

.page-footer {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
    margin-top: 60px;
    padding: 20px;
    border-top: 1px solid var(--border);
    letter-spacing: 0.1em;
}
</style>`;

// ── Members landing ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    const email = req.session.user.email;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Members Area — Cheesyman.com</title>
    ${CYBERPUNK_CSS}
    <style>
        body { text-align: center; }

        .welcome-email {
            font-family: var(--font-mono);
            font-size: 14px;
            color: var(--green);
            text-shadow: 0 0 10px var(--green), 0 0 20px var(--green-glow);
            letter-spacing: 0.1em;
            margin: 24px 0 32px;
        }
        .welcome-email::before { content: '> AUTHENTICATED: '; color: var(--text-dim); }

        .btn-cluster {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 4px;
        }
    </style>
</head>
<body>
    <div class="neon-bar"></div>

    <header class="page-header">
        <div class="header-kicker">cheesyman.com // members</div>
        <h1>MEMBERS AREA</h1>
        <p class="header-sub">Access granted. Welcome to the inner sanctum.</p>
    </header>

    <main class="page-wrap" style="padding-top: 40px;">
        <p class="welcome-email">${email}</p>
        <div class="btn-cluster">
            <a href="/members/gallery" class="btn btn-blue">Photo Gallery</a>
            <a href="/"               class="btn btn-green">Home</a>
            <a href="/auth/logout"    class="btn btn-dim">Logout</a>
        </div>
    </main>

    <footer class="page-footer">
        &copy; ${new Date().getFullYear()} Cheesyman Inc. All rights reserved.
    </footer>
</body>
</html>`);
});

// ── Members gallery ─────────────────────────────────────────────────────────
router.get('/gallery', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const accountName   = process.env.AZURE_STORAGE_ACCOUNT_NAME;
        const accountKey    = process.env.AZURE_STORAGE_ACCOUNT_KEY;
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
        const safePage   = Math.min(page, totalPages);
        const pageBlobs  = allBlobs.slice((safePage - 1) * PHOTOS_PER_PAGE, safePage * PHOTOS_PER_PAGE);

        // Generate SAS URLs valid for 1 hour for current page only
        const startsOn  = new Date();
        const expiresOn = new Date(Date.now() + 60 * 60 * 1000);

        const photos = pageBlobs.map(blobName => {
            const sasToken = generateBlobSASQueryParameters({
                containerName, blobName,
                permissions: BlobSASPermissions.parse('r'),
                startsOn, expiresOn
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
    ${CYBERPUNK_CSS}
    <style>
        .nav-links {
            display: flex;
            justify-content: center;
            gap: 4px;
            margin-bottom: 28px;
            flex-wrap: wrap;
        }

        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 14px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .gallery-item {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 2px;
            overflow: hidden;
            transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
            cursor: pointer;
        }
        .gallery-item:hover {
            border-color: var(--blue);
            box-shadow: 0 0 16px var(--blue-glow), inset 0 0 20px rgba(0,229,255,0.03);
            transform: translateY(-4px);
        }
        .gallery-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
            user-select: none;
        }

        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            margin: 32px 0 16px;
            flex-wrap: wrap;
        }

        .page-info {
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-dim);
            letter-spacing: 0.1em;
            padding: 0 10px;
        }

        .pag-disabled {
            display: inline-block;
            padding: 10px 22px;
            font-family: var(--font-mono);
            font-size: 13px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            border: 1px solid var(--border);
            border-radius: 2px;
            color: var(--text-faint);
            opacity: 0.4;
            margin: 5px;
        }
        .pag-disabled::before { content: '['; margin-right: 4px; }
        .pag-disabled::after  { content: ']'; margin-left:  4px; }

        /* Lightbox */
        .lightbox {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
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
            border-radius: 2px;
            border: 1px solid var(--blue);
            box-shadow: 0 0 30px var(--blue-glow);
            object-fit: contain;
            user-select: none;
        }

        .lightbox-controls {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 20px;
        }

        .lightbox-btn {
            background: transparent;
            border: 1px solid var(--blue);
            color: var(--blue);
            font-family: var(--font-mono);
            font-size: 22px;
            padding: 8px 20px;
            border-radius: 2px;
            cursor: pointer;
            text-shadow: 0 0 8px var(--blue);
            transition: background 0.15s, box-shadow 0.15s;
            line-height: 1;
        }
        .lightbox-btn:hover {
            background: var(--blue-glow);
            box-shadow: 0 0 12px var(--blue), inset 0 0 12px var(--blue-glow);
        }

        .lightbox-counter {
            font-family: var(--font-mono);
            color: var(--text-dim);
            font-size: 13px;
            letter-spacing: 0.1em;
            min-width: 70px;
            text-align: center;
        }

        .lightbox-close {
            position: absolute;
            top: 16px; right: 20px;
            background: none;
            border: none;
            color: var(--text-dim);
            font-size: 36px;
            line-height: 1;
            cursor: pointer;
            transition: color 0.15s, text-shadow 0.15s;
        }
        .lightbox-close:hover { color: var(--blue); text-shadow: 0 0 10px var(--blue); }

        @media (max-width: 480px) {
            .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
            .gallery-item img { height: 150px; }
        }
    </style>
</head>
<body>
    <div class="neon-bar"></div>

    <header class="page-header">
        <div class="header-kicker">cheesyman.com // members // gallery</div>
        <h1>MEMBERS GALLERY</h1>
    </header>

    <main class="page-wrap" style="padding-top: 32px;">

        <div class="nav-links">
            <a href="/members"     class="btn btn-purple">Members Home</a>
            <a href="/auth/logout" class="btn btn-amber">Logout</a>
        </div>

        <div class="gallery-grid">
            ${photos.map((url, i) => `
            <div class="gallery-item">
                <img src="${url}" alt="Photo ${i + 1}" loading="lazy" onclick="openLightbox(${i})">
            </div>`).join('')}
        </div>

        <div class="pagination">
            ${currentPage > 1
                ? `<a href="/members/gallery?page=${currentPage - 1}" class="btn btn-blue">&larr; Prev</a>`
                : `<span class="pag-disabled">&larr; Prev</span>`}
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            ${currentPage < totalPages
                ? `<a href="/members/gallery?page=${currentPage + 1}" class="btn btn-blue">Next &rarr;</a>`
                : `<span class="pag-disabled">Next &rarr;</span>`}
        </div>

    </main>

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

        function nextPhoto() { currentIndex = (currentIndex + 1) % photos.length; updateLightbox(); }
        function prevPhoto() { currentIndex = (currentIndex - 1 + photos.length) % photos.length; updateLightbox(); }

        document.addEventListener('keydown', e => {
            if (!document.getElementById('lightbox').classList.contains('active')) return;
            if (e.key === 'ArrowRight') nextPhoto();
            else if (e.key === 'ArrowLeft') prevPhoto();
            else if (e.key === 'Escape') closeLightbox();
        });

        let touchStartX = 0;
        const lightbox = document.getElementById('lightbox');
        lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        lightbox.addEventListener('touchend', e => {
            const delta = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(delta) > 50) { if (delta > 0) nextPhoto(); else prevPhoto(); }
        }, { passive: true });
    </script>
</body>
</html>`;
}

module.exports = router;
