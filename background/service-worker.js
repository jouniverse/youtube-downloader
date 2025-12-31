chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadVideo") {
    handleDownloadVideo(request, sendResponse);
    return true; // keep channel open for async response
  }
});

/**
 * Handles a download video request from the content script.
 * @param {object} request - Contains the video ID and title.
 * @param {function} sendResponse - A callback to send a response back to the content script.
 * @return {Promise<undefined>} - Resolves when the download is complete, or immediately with an error.
 */
async function handleDownloadVideo(request, sendResponse) {
  try {
    const { videoId, title } = request;

    const prefs = await chrome.storage.sync.get({
      defaultQuality: "best",
      defaultFormat: "mp4",
      backendApiUrl: "http://127.0.0.1:8765/api/download",
    });

    const quality = prefs.defaultQuality;
    const format = prefs.defaultFormat;
    const backendUrl = prefs.backendApiUrl.replace(/\/$/, "");

    console.log("[YT Downloader] Download request:", {
      videoId,
      quality,
      format,
    });

    const downloadUrl =
      `${backendUrl}` +
      `?videoId=${encodeURIComponent(videoId)}` +
      `&quality=${encodeURIComponent(quality)}` +
      `&format=${encodeURIComponent(format)}`;

    chrome.downloads.download(
      {
        url: downloadUrl,
        filename: `${title}.${format === "audio" ? "mp3" : format}`,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[YT Downloader] Download failed:",
            chrome.runtime.lastError.message
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
  } catch (error) {
    console.error("[YT Downloader] Error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === "complete") {
    console.log("[YT Downloader] Download completed:", delta.id);
  } else if (delta.state?.current === "interrupted") {
    console.error("[YT Downloader] Download interrupted:", delta.id);
  }
});
