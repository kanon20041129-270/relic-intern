macOS（Apple Silicon）で、node・ffmpeg・Homebrewパッケージを使わずに、HTMLのモーショングラフィックスをMP4に書き出すツールを `tools/export/` に作ってください。tools/ 以外は編集しない（video/ は別担当が並行で作成中）。有料のもの・追加インストールは使わない。使えるもの：/Applications/Google Chrome.app、Xcode Command Line Toolsの swift、python3（標準ライブラリのみ）。

## 対象ページのAPI（video/ 側が実装する）
`video/index.html?export=1&format=vertical|horizontal&cut=15|30` を開くと `window.AnswerLoopVideo = { duration, fps, width, height, ready: Promise, renderFrame(t), audioWavBase64(sampleRate) /* Promise<string> */ }` が使える。

## 作るもの
1. `tools/export/export.swift`（または export.py＋encode.swift）：
   - ローカルHTTPサーバー（python3 -m http.server 等、127.0.0.1の空きポート）でリポジトリのルートを配信。
   - headless Chrome を `--remote-debugging-port` で起動し、Chrome DevTools Protocol（WebSocket。Swiftなら URLSessionWebSocketTask、Pythonなら標準ライブラリで最小限のWebSocketクライアントを自作）で制御。ウィンドウ／ビューポートを width×height、deviceScaleFactor 1 に固定（Emulation.setDeviceMetricsOverride）。
   - `await AnswerLoopVideo.ready` → 各フレーム n=0..floor(duration*fps)-1 で `renderFrame(n/fps)` → Page.captureScreenshot（PNG または高品質JPEG）。
   - `audioWavBase64(48000)` を Runtime.evaluate(awaitPromise) で取得し WAV を保存。
   - AVFoundation（AVAssetWriter）で H.264（縦1080×1920／横1920×1080、30fps、ビットレート 12–16Mbps、yuv420、プロファイルHigh）＋ AAC 48kHz ステレオ 256kbps の MP4 を出力。`movflags faststart` 相当（shouldOptimizeForNetworkUse = true）。
   - 使い方：`swift tools/export/export.swift --format vertical --cut 15 --out out/answerloop_15s_vertical.mp4`（または同等のシェルスクリプト `tools/export/export.sh`）。進捗をフレーム単位で表示。終了時にChromeとサーバーを確実に停止。
2. `tools/export/README.md`：使い方、所要時間の目安、トラブルシュート。
3. テスト：video/ がまだ完成していない可能性があるので、`tools/export/testpage.html` に同じAPIを持つ2秒のテストページ（数字のカウントとビープ音）を作り、それを2秒のMP4に書き出して、`AVURLAsset` で長さ・解像度・音声トラックの有無を検証するコマンドまで実行して確認すること。
完了後、実行結果（成功/失敗、出力ファイルのサイズ・長さ）を報告。
