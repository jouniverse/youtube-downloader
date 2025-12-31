// YouTube Downloader Content Script
// Correct version: delegates downloads to service worker

(function () {
  "use strict";

  let downloadButton = null;
  let isInitialized = false;

  /**
   * Extracts the video ID from the current URL.
   * @returns {string} The video ID if found, or null otherwise.
   */
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  /**
   * Sanitizes a filename by removing disallowed characters and trimming to
   * 100 characters.
   * @param {string} filename - The filename to sanitize.
   * @returns {string} The sanitized filename.
   */
  function sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 100);
  }

  /**
   * Shows a notification to the user with a given message and type.
   * If a notification with the same ID already exists, it is removed.
   * The notification is shown for 3 seconds and then removed.
   * @param {string} message - The message to display in the notification.
   * @param {string} [type="info"] - The type of notification (info, error, etc.).
   */
  function showNotification(message, type = "info") {
    const existing = document.getElementById("yt-downloader-notification");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "yt-downloader-notification";
    el.className = `yt-downloader-notification yt-downloader-notification-${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  /**
   * Handles the download button click event.
   * @param {Event} e - The button click event.
   * @fires chrome.runtime#sendMessage - Delegates the download to the service worker.
   * @fires showNotification - Displays a notification to the user with the download status.
   */
  async function handleDownloadClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const videoId = getVideoId();
    if (!videoId) {
      showNotification("Could not detect video ID", "error");
      return;
    }

    const btn = e.currentTarget;
    btn.disabled = true;
    btn.classList.add("downloading");

    try {
      const title =
        document
          .querySelector(
            "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string"
          )
          ?.textContent?.trim() || "video";

      const filename = sanitizeFilename(title);

      // 🚀 Delegate download to service worker
      chrome.runtime.sendMessage(
        {
          action: "downloadVideo",
          videoId,
          title: filename,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[YT Downloader]", chrome.runtime.lastError.message);
            showNotification("Download failed", "error");
            return;
          }

          if (!response || !response.success) {
            showNotification(response?.error || "Download failed", "error");
          } else {
            showNotification("Download started!", "success");
          }
        }
      );
    } catch (err) {
      console.error("[YT Downloader]", err);
      showNotification(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.classList.remove("downloading");
    }
  }

  /**
   * Creates a download button with a YouTube Downloader logo.
   * The button is styled to match YouTube's design.
   * @returns {HTMLButtonElement} The created download button.
   */
  function createDownloadButton() {
    const btn = document.createElement("button");
    btn.id = "yt-downloader-btn";
    btn.className = "yt-downloader-button";
    btn.title = "Download video";
    btn.addEventListener("click", handleDownloadClick);

    const icon = document.createElement("div");
    icon.className = "yt-downloader-icon-container";
    icon.style.backgroundImage = `url(${chrome.runtime.getURL(
      "images/yt-downloader-logo.png"
    )})`;
    icon.style.backgroundSize = "contain";
    icon.style.backgroundRepeat = "no-repeat";
    icon.style.backgroundPosition = "center";

    btn.appendChild(icon);
    return btn;
  }

  /**
   * Finds the best injection point for the download button.
   * If the video is on YouTube's main page, it will be injected into the
   * top-level buttons container. If the video is on a YouTube page with a
   * menu (e.g. YouTube Studio), it will be injected into the menu container.
   * If neither of the above conditions are met, it will be injected into the
   * body.
   * @returns {HTMLElement|null} The best injection point, or null if none is found.
   */
  function findInjectionPoint() {
    return (
      document.querySelector(
        "#top-level-buttons-computed, ytd-menu-renderer"
      ) || document.body
    );
  }

  /**
   * Injects the download button into the YouTube page.
   * If the button already exists, it will be removed and recreated.
   * The button is injected into the best available position, which is
   * determined by the findInjectionPoint function.
   */
  function injectButton() {
    const videoId = getVideoId();
    if (!videoId) return;

    if (downloadButton) downloadButton.remove();

    downloadButton = createDownloadButton();
    findInjectionPoint().appendChild(downloadButton);
  }

  /**
   * Initializes the content script.
   * It injects the download button into the page and sets up a MutationObserver to
   * detect changes in the page's URL. When the URL changes, the download button is
   * reinjected into the new page.
   */
  function init() {
    if (isInitialized) return;

    setTimeout(injectButton, 1000);

    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(injectButton, 1000);
      }
    }).observe(document, { subtree: true, childList: true });

    isInitialized = true;
  }

  init();
})();
