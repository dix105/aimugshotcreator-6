document.addEventListener('DOMContentLoaded', () => {
    
    // ==============================================
    // 1. MOBILE MENU TOGGLE
    // ==============================================
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            // Change icon
            const icon = menuToggle.querySelector('i');
            if (nav.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Close menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (nav.classList.contains('active')) {
                nav.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });

    // ==============================================
    // 2. SCROLL ANIMATIONS (Intersection Observer)
    // ==============================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // ==============================================
    // 3. FAQ ACCORDION
    // ==============================================
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            // Close others
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            // Toggle current
            item.classList.toggle('active');
        });
    });

    // ==============================================
    // 4. API & BACKEND INTEGRATION
    // ==============================================

    // --- Configuration ---
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const EFFECT_ID = 'mugshot';
    const MODEL = 'image-effects';
    const TOOL_TYPE = 'image-effects';
    let currentUploadedUrl = null;

    // --- Core Functions ---

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage (called immediately when file is selected)
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        // Filename is just nanoid.extension (no media/ prefix)
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL from API
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        console.log('Got signed URL');
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // Submit generation job (Image or Video)
    async function submitImageGenJob(imageUrl) {
        const isVideo = MODEL === 'video-effects'; // Currently false
        const endpoint = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0'
        };

        // Construct payload based on type
        let body = {};
        if (isVideo) {
            body = {
                imageUrl: [imageUrl],
                effectId: EFFECT_ID,
                userId: USER_ID,
                removeWatermark: true,
                model: 'video-effects',
                isPrivate: true
            };
        } else {
            body = {
                model: MODEL,
                toolType: TOOL_TYPE,
                effectId: EFFECT_ID,
                imageUrl: imageUrl,
                userId: USER_ID,
                removeWatermark: true,
                isPrivate: true
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Job submitted:', data.jobId, 'Status:', data.status);
        return data;
    }

    // Poll job status until completed or failed
    const POLL_INTERVAL = 2000; // 2 seconds
    const MAX_POLLS = 60; // Max 2 minutes

    async function pollJobStatus(jobId) {
        const isVideo = MODEL === 'video-effects';
        const baseUrl = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            // Update UI with progress
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out after ' + MAX_POLLS + ' polls');
    }

    // --- UI Helpers ---

    function showLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container') || document.querySelector('.result-display');
        const placeholderContent = document.querySelector('.placeholder-content');
        
        if (loader) loader.classList.remove('hidden');
        if (loader) loader.style.display = 'flex';
        
        if (placeholderContent) placeholderContent.classList.add('hidden');
        
        const resultFinal = document.getElementById('result-final');
        if (resultFinal) resultFinal.classList.add('hidden');
        const resultVideo = document.getElementById('result-video');
        if (resultVideo) resultVideo.style.display = 'none';

        if (resultContainer) resultContainer.classList.add('loading');
    }

    function hideLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container') || document.querySelector('.result-display');
        
        if (loader) loader.classList.add('hidden');
        if (loader) loader.style.display = 'none';
        if (resultContainer) resultContainer.classList.remove('loading');
    }

    function updateStatus(text) {
        // Try to find a status element, or update the button
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            if (text === 'READY') {
                generateBtn.textContent = 'Generate Effect';
                generateBtn.disabled = false;
            } else if (text === 'COMPLETE') {
                generateBtn.textContent = 'Generate Again';
                generateBtn.disabled = false;
            } else {
                generateBtn.textContent = text;
                generateBtn.disabled = true;
            }
        }
    }

    function showError(msg) {
        alert('Error: ' + msg); 
        console.error(msg);
    }

    function showPreview(url) {
        const img = document.getElementById('preview-image');
        const uploadContent = document.querySelector('.upload-content');
        const uploadZone = document.getElementById('upload-zone');
        const resetBtn = document.getElementById('reset-btn');

        if (img) {
            img.src = url;
            img.classList.remove('hidden');
            img.style.display = 'block';
        }
        
        if (uploadContent) uploadContent.classList.add('hidden');
        if (uploadZone) uploadZone.style.borderStyle = 'solid';
        if (resetBtn) resetBtn.classList.remove('hidden');
    }

    function showResultMedia(url) {
        const resultImg = document.getElementById('result-final');
        const container = document.getElementById('result-container');
        
        if (!container) return;
        
        // Basic check for video extension
        const isVideo = url.toLowerCase().match(/\.(mp4|webm)(\?.*)?$/i);
        
        if (isVideo) {
            // Hide image
            if (resultImg) {
                resultImg.classList.add('hidden');
                resultImg.style.display = 'none';
            }
            
            // Show/Create video
            let video = document.getElementById('result-video');
            if (!video) {
                video = document.createElement('video');
                video.id = 'result-video';
                video.controls = true;
                video.autoplay = true;
                video.loop = true;
                video.className = resultImg ? resultImg.className : 'w-full h-auto rounded-lg';
                video.style.maxWidth = '100%';
                container.appendChild(video);
            }
            video.src = url;
            video.style.display = 'block';
            video.classList.remove('hidden');
        } else {
            // Hide video
            const video = document.getElementById('result-video');
            if (video) video.style.display = 'none';
            
            // Show image
            if (resultImg) {
                resultImg.classList.remove('hidden');
                resultImg.style.display = 'block';
                resultImg.crossOrigin = 'anonymous';
                // Add cache buster to prevent cached non-CORS response
                resultImg.src = url + '?t=' + new Date().getTime();
            }
        }
    }

    function showDownloadButton(url) {
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.classList.remove('disabled');
            downloadBtn.removeAttribute('disabled');
            // Remove direct href to force click handler usage
            downloadBtn.removeAttribute('href');
        }
    }

    // --- Wiring Handlers ---

    // Handler when file is selected - uploads immediately
    async function handleFileSelect(file) {
        try {
            if (!file.type.startsWith('image/')) {
                alert('Please upload a valid image file.');
                return;
            }

            // Show local preview immediately for better UX while uploading
            const reader = new FileReader();
            reader.onload = (e) => {
                showPreview(e.target.result);
            };
            reader.readAsDataURL(file);

            updateStatus('UPLOADING...');
            
            // Upload to Cloud
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            // Update preview with real URL (optional, but good for verification)
            // showPreview(uploadedUrl); 
            
            updateStatus('READY');
            
        } catch (error) {
            updateStatus('ERROR');
            showError(error.message);
            // Reset state on error
            const resetBtn = document.getElementById('reset-btn');
            if(resetBtn) resetBtn.click();
        }
    }

    // Handler when Generate button is clicked
    async function handleGenerate() {
        if (!currentUploadedUrl) {
            alert("Please upload an image first.");
            return;
        }
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            // Step 1: Submit job to ChromaStudio API
            const jobData = await submitImageGenJob(currentUploadedUrl);
            console.log('Job ID:', jobData.jobId);
            
            updateStatus('JOB QUEUED...');
            
            // Step 2: Poll for completion
            const result = await pollJobStatus(jobData.jobId);
            
            // Step 3: Extract Result
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.video || resultItem?.image;
            
            if (!resultUrl) {
                console.error('Response:', result);
                throw new Error('No image URL in response');
            }
            
            console.log('Result URL:', resultUrl);
            
            // Step 4: Display result
            showResultMedia(resultUrl);
            showDownloadButton(resultUrl);
            
            updateStatus('COMPLETE');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // ==============================================
    // 5. PLAYGROUND LOGIC WIRING
    // ==============================================
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');

    // File Input Logic
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    // Drag & Drop Logic
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
            uploadZone.style.background = '#e0e0e0';
            uploadZone.style.borderColor = 'var(--primary)';
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            uploadZone.style.background = '';
            uploadZone.style.borderColor = '';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            uploadZone.style.background = '';
            uploadZone.style.borderColor = '';
            
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
        
        // Click to upload
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Generate Button Logic
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Download Button Logic (Robust Fetch + Blob)
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.classList.add('disabled');
            
            try {
                // Fetch the file as a blob to force download
                const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
                const response = await fetch(fetchUrl, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch file: ' + response.statusText);
                }
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                // Determine extension
                const contentType = response.headers.get('content-type') || '';
                let extension = 'jpg';
                if (contentType.includes('video') || url.match(/\.(mp4|webm)/i)) {
                    extension = 'mp4';
                } else if (contentType.includes('png') || url.match(/\.png/i)) {
                    extension = 'png';
                } else if (contentType.includes('webp') || url.match(/\.webp/i)) {
                    extension = 'webp';
                }
                
                // Trigger download
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `result_${generateNanoId(8)}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                
            } catch (err) {
                console.error('Download error:', err);
                
                // Fallback: Canvas for images
                try {
                    const img = document.getElementById('result-final');
                    if (img && img.style.display !== 'none' && img.complete && img.naturalWidth > 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const link = document.createElement('a');
                                link.href = URL.createObjectURL(blob);
                                link.download = `result_${generateNanoId(8)}.png`;
                                link.click();
                                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                            } else {
                                fallbackNewTab(url);
                            }
                        }, 'image/png');
                        return; // Success
                    }
                } catch (canvasErr) {
                    console.error('Canvas fallback error:', canvasErr);
                }
                
                // Final fallback
                fallbackNewTab(url);

            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.classList.remove('disabled');
            }
        });
    }

    function fallbackNewTab(url) {
        alert('Direct download failed. The file will open in a new tab.\nRight-click and select "Save as..." to download.');
        window.open(url, '_blank');
    }

    // Reset Button Logic
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Clear state
            currentUploadedUrl = null;
            if (fileInput) fileInput.value = '';
            
            // UI Reset
            const previewImage = document.getElementById('preview-image');
            const uploadContent = document.querySelector('.upload-content');
            const resultFinal = document.getElementById('result-final');
            const resultVideo = document.getElementById('result-video');
            const placeholderContent = document.querySelector('.placeholder-content');
            const resultContainer = document.getElementById('result-container') || document.querySelector('.result-display');
            
            if (previewImage) {
                previewImage.classList.add('hidden');
                previewImage.src = '';
            }
            if (uploadContent) uploadContent.classList.remove('hidden');
            if (resetBtn) resetBtn.classList.add('hidden');
            if (uploadZone) uploadZone.style.borderStyle = 'dashed';
            
            // Reset Generate Button
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Generate';
            }
            
            // Reset Result Area
            hideLoading();
            if (resultFinal) {
                resultFinal.classList.add('hidden');
                resultFinal.src = '';
            }
            if (resultVideo) {
                resultVideo.style.display = 'none';
                resultVideo.pause();
                resultVideo.src = '';
            }
            if (placeholderContent) placeholderContent.classList.remove('hidden');
            
            // Reset Download Button
            if (downloadBtn) {
                downloadBtn.classList.add('disabled');
                delete downloadBtn.dataset.url;
            }
        });
    }

    // ==============================================
    // 6. MODALS (Privacy & Terms)
    // ==============================================
    const openModalBtns = document.querySelectorAll('[data-modal-target]');
    const closeModalBtns = document.querySelectorAll('[data-modal-close]');
    const modals = document.querySelectorAll('.modal');

    openModalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-modal-target');
            const modal = document.getElementById(targetId + '-modal');
            if (modal) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            }
        });
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModal(modal);
        });
    });

    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    function closeModal(modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
});