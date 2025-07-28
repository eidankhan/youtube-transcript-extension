
// Constants for elements and API base URL
const messageBox = document.getElementById('message');
const transcriptOutput = document.getElementById('transcript-output');
const transcriptLanguages = document.getElementById('transcript-languages');
const videoInfo = document.getElementById('video-info');

const copyButton = document.getElementById('copy-transcript');
const apiBaseUrl = 'https://transcript.andreszenteno.com';

// Global variables
let transcript = '';
let videoTitle = '';
let videoUrl = '';

// Disable copy button initially
messageBox.style.display = 'none';
copyButton.disabled = true;


// Initialize on popup open
initTranscriptFetching();

async function initTranscriptFetching() {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        videoUrl = await getVideoUrl(tab);

        if (videoUrl) {
            await fetchAndDisplayTranscript(videoUrl);
        } else {
            messageBox.style.display = 'block';
            messageBox.innerText = 'No YouTube video found on this page.';
        }
    });
}

// Get valid video URL from current tab
async function getVideoUrl(tab) {
    const url = tab.url || '';
    if (typeof url !== 'string') return null;

    if (url.includes('youtube.com/watch?v=') || url.includes('youtube.com/shorts') || url.includes('youtu.be/')) {
        return url;
    } else {
        const iframeSrc = await getEmbeddedVideoUrl(tab.id);
        if (iframeSrc) {
            const videoId = iframeSrc.split('embed/')[1]?.split('?')[0];
            return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
        }
    }
    return null;
}

function extractEmbeddedVideoUrl() {
    const iframe = Array.from(document.querySelectorAll('iframe')).find(i => i.src.includes('youtube.com/embed/'));
    return iframe ? iframe.src : null;
}

async function getEmbeddedVideoUrl(tabId) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript({
            target: { tabId },
            func: extractEmbeddedVideoUrl
        }, (results) => {
            resolve(results[0]?.result || null);
        });
    });
}

async function fetchAndDisplayTranscript(url, lang = '') {
    videoInfo.style.display = 'none'; // Hide dropdown before loading
    transcriptOutput.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
      <div class="spinner-text">Fetching transcript... This may take a few seconds.</div>
    </div>
  `;

    const data = await fetchTranscript(url, lang);
    if (data) {
        copyButton.disabled = false;
        transcript = data.transcript;
        videoTitle = data.title;
        const languages = data.languages;
        displayTranscript(languages, data.transcriptLanguageCode);
    } else {
        transcriptOutput.innerHTML = 'Error fetching transcript.';
    }
}

async function fetchTranscript(url, lang = '') {
    try {
        const response = await fetch(`${apiBaseUrl}/simple-transcript-v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, lang })
        });
        if (!response.ok) throw new Error('Failed to fetch transcript');
        return await response.json();
    } catch (error) {
        messageBox.innerText = `Error: ${error.message}`;
        messageBox.style.display = 'block';
        return null;
    }
}

function displayTranscript(languages, currentLangCode = '') {
    transcriptOutput.innerHTML = `<strong>${videoTitle}</strong><br><br>${transcript}`;
    videoInfo.style.display = 'block'; // Reveal dropdown now
    handleLanguageSelection(languages, currentLangCode);
}

function handleLanguageSelection(languages, currentLangCode = '') {
    transcriptLanguages.innerHTML = '';
    if (languages?.length > 0) {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">Available languages</option>';

        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            if (lang.code === currentLangCode) option.selected = true;
            select.appendChild(option);
        });

        transcriptLanguages.appendChild(select);

        select.addEventListener('change', async (event) => {
            const selectedLanguage = event.target.value;
            if (selectedLanguage) {
                await fetchAndDisplayTranscript(videoUrl, selectedLanguage);
            }
        });
    }
}

copyButton.addEventListener('click', async () => {
    if (transcript) {
        await navigator.clipboard.writeText(`${videoTitle}\n\n${transcript}`);
        copyButton.innerText = 'Copied!';
        setTimeout(() => { copyButton.innerText = 'Copy'; }, 2000);
    }
});
