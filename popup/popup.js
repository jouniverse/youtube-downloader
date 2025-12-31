// popup.js - Full version for YouTube Downloader Extension

document.addEventListener("DOMContentLoaded", () => {
  const qualitySelect = document.getElementById("quality-select");
  const formatSelect = document.getElementById("format-select");
  const backendInput = document.getElementById("backend-url");
  const saveButton = document.getElementById("save-settings");
  const testButton = document.getElementById("test-connection");
  const statusButton = document.getElementById("check-server-status");
  const serverStatusDiv = document.getElementById("server-status");
  const serverStatusText = document.getElementById("server-status-text");
  const statusSection = document.getElementById("status-section");
  const statusMessage = document.getElementById("status-message");

  // -------------------------
  // Load saved preferences
  // -------------------------
  chrome.storage.sync.get(
    {
      defaultQuality: "best",
      defaultFormat: "mp4",
      backendApiUrl: "http://127.0.0.1:8765/api/download",
    },
    (prefs) => {
      qualitySelect.value = prefs.defaultQuality;
      formatSelect.value = prefs.defaultFormat;
      backendInput.value = prefs.backendApiUrl;
    }
  );

  // -------------------------
  // Save preferences
  // -------------------------
  saveButton.addEventListener("click", () => {
    const newPrefs = {
      defaultQuality: qualitySelect.value,
      defaultFormat: formatSelect.value,
      backendApiUrl: backendInput.value,
    };
    chrome.storage.sync.set(newPrefs, () => {
      statusSection.style.display = "block";
      statusMessage.textContent = "Settings saved successfully!";
      setTimeout(() => {
        statusSection.style.display = "none";
      }, 2000);
    });
  });

  // -------------------------
  // Test backend connection
  // -------------------------
  testButton.addEventListener("click", async () => {
    const backendBase = backendInput.value.replace(/\/$/, "");
    const healthUrl = backendBase.replace(/\/api\/download$/, "") + "/health";

    serverStatusDiv.style.display = "block";
    serverStatusText.textContent = "Checking...";

    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      serverStatusText.textContent = `Success: yt-dlp=${data.ytdlp}, ffmpeg=${data.ffmpeg}, Python=${data.python}`;
    } catch (err) {
      serverStatusText.textContent = `Error: ${err.message}`;
    }
  });

  // -------------------------
  // Check server status
  // -------------------------
  statusButton.addEventListener("click", async () => {
    const backendBase = backendInput.value.replace(/\/$/, "");
    const healthUrl = backendBase.replace(/\/api\/download$/, "") + "/health";

    serverStatusDiv.style.display = "block";
    serverStatusText.textContent = "Checking...";

    try {
      const response = await fetch(healthUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      serverStatusText.textContent = `Server running at ${backendBase.replace(
        /\/api\/download$/,
        ""
      )} (yt-dlp=${data.ytdlp}, ffmpeg=${data.ffmpeg})`;
    } catch (err) {
      serverStatusText.textContent = `Error: ${err.message}`;
    }
  });

  // -------------------------
  // Download button (from popup) - optional
  // -------------------------
  const downloadButton = document.getElementById("download-video");
  if (downloadButton) {
    downloadButton.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        const tab = tabs[0];
        const urlParams = new URLSearchParams(tab.url.split("?")[1]);
        const videoId = urlParams.get("v");
        if (!videoId) {
          statusSection.style.display = "block";
          statusMessage.textContent = "No YouTube video detected on this tab.";
          return;
        }

        const title = tab.title.replace(/[\/\\?%*:|"<>]/g, "_"); // sanitize filename

        chrome.storage.sync.get(
          { defaultQuality: "best", defaultFormat: "mp4" },
          (prefs) => {
            chrome.runtime.sendMessage({
              action: "downloadVideo",
              videoId,
              title,
            });
            statusSection.style.display = "block";
            statusMessage.textContent = "Download started...";
          }
        );
      });
    });
  }
});
