#!/usr/bin/env python3
"""Capture deterministic Chrome frames and hand them to the AVFoundation encoder."""

import argparse
import base64
from functools import partial
import hashlib
import http.server
import json
import math
import os
from pathlib import Path
import secrets
import signal
import socket
import struct
import subprocess
import tempfile
import threading
import time
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


class DevTools:
    """Single-request CDP client for Chrome's local, uncompressed WebSocket."""
    def __init__(self, sock, url):
        self.sock = sock
        self.stream = sock.makefile("rb")
        self.request_id = 0
        self.loaded_documents = set()
        address = urlsplit(url)
        key = base64.b64encode(secrets.token_bytes(16)).decode()
        request = (
            f"GET {address.path} HTTP/1.1\r\nHost: {address.netloc}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        sock.sendall(request.encode("ascii"))
        status = self.stream.readline().split()
        headers = {}
        while True:
            line = self.stream.readline()
            if line == b"\r\n":
                break
            name, separator, value = line.partition(b":")
            if not separator:
                raise RuntimeError("Invalid Chrome WebSocket handshake")
            headers[name.lower()] = value.strip()
        expected = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
        )
        if status[1:2] != [b"101"] or headers.get(b"sec-websocket-accept") != expected:
            raise RuntimeError("Chrome rejected the WebSocket connection")

    def send(self, opcode, payload):
        count = len(payload)
        if count < 126:
            length = bytes([0x80 | count])
        elif count < 65536:
            length = b"\xfe" + struct.pack("!H", count)
        else:
            length = b"\xff" + struct.pack("!Q", count)
        mask = secrets.token_bytes(4)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.sock.sendall(bytes([0x80 | opcode]) + length + mask + masked)

    def read(self, count):
        data = self.stream.read(count)
        if len(data) != count:
            raise RuntimeError("Chrome closed the WebSocket")
        return data

    def receive(self):
        parts = []
        while True:
            flags, length = self.read(2)
            if length & 0x80 or flags & 0x70:
                raise RuntimeError("Unexpected Chrome WebSocket frame")
            opcode = flags & 0x0f
            if length == 126:
                length, = struct.unpack("!H", self.read(2))
            elif length == 127:
                length, = struct.unpack("!Q", self.read(8))
            payload = self.read(length)
            if opcode == 8:
                raise RuntimeError("Chrome closed the WebSocket")
            if opcode == 9:
                self.send(10, payload)
            if opcode in (0, 1):
                parts.append(payload)
                if flags & 0x80:
                    message = json.loads(b"".join(parts))
                    if message.get("method") == "Page.lifecycleEvent":
                        event = message["params"]
                        if event["name"] == "load":
                            self.loaded_documents.add((event["frameId"], event["loaderId"]))
                    return message

    def call(self, method, **params):
        self.request_id += 1
        self.send(1, json.dumps(dict(id=self.request_id, method=method, params=params)).encode())
        while True:
            response = self.receive()
            if response.get("id") == self.request_id:
                if "error" in response:
                    raise RuntimeError(f"{method}: {response['error']}")
                return response["result"]

    def evaluate(self, expression):
        response = self.call("Runtime.evaluate", expression=expression,
                             awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in response:
            detail = response["exceptionDetails"]
            raise RuntimeError(detail.get("exception", {}).get("description", detail["text"]))
        return response["result"].get("value")


class PageHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def capture(work, args, width, height):
    # Bind port 0 directly so no other process can claim the chosen HTTP port.
    handler = partial(PageHandler, directory=ROOT)
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    except OSError as error:
        raise RuntimeError(f"Could not start HTTP server on 127.0.0.1: {error}") from error
    with server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        chrome = None
        try:
            with (work / "chrome.log").open("w+") as log:
                try:
                    chrome = subprocess.Popen([
                        CHROME, "--headless", "--remote-debugging-port=0",
                        f"--user-data-dir={work / 'profile'}", "--no-first-run",
                        "--no-default-browser-check", "--disable-background-networking",
                        "--disable-background-timer-throttling",
                        "--disable-renderer-backgrounding", "--hide-scrollbars",
                        f"--window-size={width},{height}", "about:blank",
                    ], stdout=log, stderr=log, start_new_session=True)
                    return capture_page(work, args, width, height, server.server_port, chrome)
                except (OSError, RuntimeError):
                    log.seek(0)
                    if tail := log.readlines()[-8:]:
                        print("Chrome log:", "".join(tail), file=os.sys.stderr)
                    raise
        finally:
            try:
                if chrome is not None:
                    try:
                        os.killpg(chrome.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    try:
                        chrome.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(chrome.pid, signal.SIGKILL)
                        chrome.wait()
            finally:
                server.shutdown()
                thread.join()


def capture_page(work, args, width, height, port, chrome):
    import urllib.request

    active_port = work / "profile" / "DevToolsActivePort"
    deadline = time.monotonic() + 20
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while True:
        if chrome.poll() is not None or time.monotonic() >= deadline:
            raise RuntimeError("Chrome DevTools did not start")
        try:
            debug_port = int(active_port.read_text().splitlines()[0])
            with opener.open(f"http://127.0.0.1:{debug_port}/json/list", timeout=2) as response:
                target = next(item for item in json.load(response) if item["type"] == "page")
            break
        except (OSError, IndexError, ValueError, StopIteration):
            time.sleep(0.1)

    page = "tools/export/testpage.html" if args.test else "video/index.html"
    url = f"http://127.0.0.1:{port}/{page}?export=1&format={args.format}&cut={args.cut}"
    with socket.create_connection(("127.0.0.1", debug_port), timeout=60) as sock:
        cdp = DevTools(sock, target["webSocketDebuggerUrl"])
        with cdp.stream:
            cdp.call("Page.enable")
            cdp.call("Page.setLifecycleEventsEnabled", enabled=True)
            cdp.call("Emulation.setDeviceMetricsOverride", width=width, height=height,
                     deviceScaleFactor=1, mobile=False)
            navigation = cdp.call("Page.navigate", url=url)
            if navigation.get("errorText"):
                raise RuntimeError(navigation["errorText"])
            if navigation.get("loaderId"):
                document = (navigation["frameId"], navigation["loaderId"])
                while document not in cdp.loaded_documents:
                    cdp.receive()
            info = cdp.evaluate("""(async () => {
                const video = window.AnswerLoopVideo;
                if (!video || !video.ready || typeof video.ready.then !== 'function' ||
                    typeof video.renderFrame !== 'function' ||
                    typeof video.audioWavBase64 !== 'function') {
                    throw new Error('AnswerLoopVideo export API is missing or incomplete');
                }
                await video.ready;
                const {duration, fps, width, height} = video;
                return {duration, fps, width, height};
            })()""")
            if (info["width"], info["height"], info["fps"]) != (width, height, 30):
                raise RuntimeError(f"Expected {width}x{height} at 30 fps, got {info}")
            duration = info.get("duration")
            if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 1 / 30:
                raise RuntimeError(f"Invalid video duration: {duration}")
            count = math.floor(duration * info["fps"])
            for index in range(count):
                cdp.evaluate(f"(async () => {{ await window.AnswerLoopVideo.renderFrame({index / info['fps']!r}); }})()")
                image = cdp.call("Page.captureScreenshot", format="jpeg", quality=98,
                                 fromSurface=True)["data"]
                (work / f"{index:06d}.jpg").write_bytes(base64.b64decode(image))
                print(f"Capture {index + 1}/{count}", flush=True)
            audio = cdp.evaluate("window.AnswerLoopVideo.audioWavBase64(48000)")
            if not isinstance(audio, str):
                raise RuntimeError("audioWavBase64 did not return a string")
            (work / "audio.wav").write_bytes(base64.b64decode(audio, validate=True))
            return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", required=True, choices=("vertical", "horizontal"))
    parser.add_argument("--cut", required=True, choices=("15", "30"))
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--test", action="store_true", help="export the bundled two-second page")
    args = parser.parse_args()
    if args.out.suffix.lower() != ".mp4":
        parser.error("--out must end in .mp4")
    width, height = (1080, 1920) if args.format == "vertical" else (1920, 1080)
    signal.signal(signal.SIGTERM, interrupter)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    # Stage the final MP4 on the output filesystem for atomic replacement on success.
    with tempfile.TemporaryDirectory(prefix=".answerloop-", dir=args.out.parent) as directory:
        work = Path(directory).resolve()
        encoder = work / "encode"
        subprocess.run(["swiftc", "-O", "-parse-as-library", "-module-cache-path",
                        str(work / "modules"), str(HERE / "encode.swift"),
                        "-o", str(encoder)], check=True)
        count = capture(work, args, width, height)
        staged = work / "video.mp4"
        subprocess.run([str(encoder), str(work), str(staged), str(width), str(height),
                        str(count)], check=True)
        staged.replace(args.out)
    print(f"Saved {args.out} ({args.out.stat().st_size:,} bytes)")


def interrupter(_signum, _frame):
    raise KeyboardInterrupt


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit("Export interrupted")
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Export failed: {error}")
