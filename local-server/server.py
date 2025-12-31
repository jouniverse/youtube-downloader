#!/usr/bin/env python3
"""
Local server for YouTube Downloader Chrome Extension (Demo)
Uses yt-dlp + ffmpeg to download and merge media correctly.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess
import shutil
import tempfile
import os
import sys

# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

HOST = "127.0.0.1"
PORT = 8765

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def has_ytdlp():
    """Check if yt-dlp Python module is available."""
    try:
        subprocess.check_output(
            [sys.executable, "-m", "yt_dlp", "--version"],
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def check_ffmpeg():
    """Check if ffmpeg is available in PATH."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found in PATH")


def build_format_selector(quality, format_type):
    """Maps UI options to correct yt-dlp format selectors."""

    height_map = {
        "1080": "1080",
        "720": "720",
        "480": "480",
        "360": "360",
    }

    # ------------------ AUDIO ONLY ------------------
    if format_type == "audio":
        return "bestaudio/best"

    # ------------------ MP4 (H.264 + AAC) ------------------
    if format_type == "mp4":
        if quality == "best":
            return "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b"
        h = height_map.get(quality, quality)
        return f"bv*[height<={h}][vcodec^=avc1]+ba[acodec^=mp4a]/b"

    # ------------------ WEBM (VP9 + Opus) ------------------
    if format_type == "webm":
        if quality == "best":
            return "bv*[vcodec^=vp9]+ba[acodec^=opus]/b"
        h = height_map.get(quality, quality)
        return f"bv*[height<={h}][vcodec^=vp9]+ba[acodec^=opus]/b"

    return "best"


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------


@app.route("/api/download", methods=["GET", "OPTIONS"])
def download():
    if request.method == "OPTIONS":
        return "", 200

    try:
        video_id = request.args.get("videoId")
        quality = request.args.get("quality", "best")
        format_type = request.args.get("format", "mp4")

        if not video_id:
            return jsonify(success=False, error="videoId is required"), 400

        if not has_ytdlp():
            raise RuntimeError("yt-dlp Python module not available")

        check_ffmpeg()

        fmt = build_format_selector(quality, format_type)
        url = f"https://www.youtube.com/watch?v={video_id}"

        tmpdir = tempfile.mkdtemp()
        outtmpl = os.path.join(tmpdir, "%(title)s.%(ext)s")

        cmd = [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "-f",
            fmt,
            "-o",
            outtmpl,
        ]

        if format_type == "audio":
            cmd += [
                "--extract-audio",
                "--audio-format",
                "mp3",
                "--audio-quality",
                "192K",
            ]
        else:
            cmd += ["--merge-output-format", format_type]

        cmd.append(url)

        subprocess.run(cmd, check=True)

        files = os.listdir(tmpdir)
        if not files:
            raise RuntimeError("Download failed: no output file")

        file_path = os.path.join(tmpdir, files[0])

        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
        )

    except subprocess.CalledProcessError as e:
        return jsonify(success=False, error=f"yt-dlp failed: {e}"), 500
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        status="ok",
        ytdlp=has_ytdlp(),
        ffmpeg=bool(shutil.which("ffmpeg")),
        python=sys.version,
    )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Starting server at http://{HOST}:{PORT}")
    print("Health check: /health")
    app.run(host=HOST, port=PORT, debug=False)
