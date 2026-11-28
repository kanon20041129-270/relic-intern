# AnswerLoop MP4 書き出し

Apple Silicon の macOS で、`/Applications/Google Chrome.app`、Xcode Command Line Tools の `swiftc` / `swift`、Python 3.8 以降（標準ライブラリ）を使います。

## 本番ページ

リポジトリのルートから実行します。

```sh
tools/export/export.sh --format vertical --cut 15 --out out/answerloop_15s_vertical.mp4
tools/export/export.sh --format horizontal --cut 30 --out out/answerloop_30s_horizontal.mp4
```

`--format` は `vertical`（1080×1920）か `horizontal`（1920×1080）、`--cut` は `15` か `30` です。ページには `export=1` と一緒にこれらの値を渡します。出力フレーム数はページが返す `floor(duration * fps)` で決まり、30 fps で書き出します。

Python がリポジトリのルートをループバック上で配信し、専用プロファイルの headless Chrome を起動します。`AnswerLoopVideo.ready` の解決後、フレーム時刻を順番に指定して Chrome DevTools Protocol から品質98のJPEGを取得します。映像は H.264 High（8-bit 4:2:0、平均ビットレート設定14 Mbps）、音声はページが返す WAV を AAC 48 kHz ステレオ（256 kbps設定）に変換します。MP4 は再生開始時のダウンロードを抑えるように最適化します。

`Capture` と `Encode` に各工程のフレーム数が表示されます。所要時間の目安は15秒で約1〜3分、30秒で約2〜6分です。初回コンパイル、Macの機種、ページの描画負荷で変わります。出力先と同じボリュームにJPEG・WAV・コンパイル用キャッシュを一時保存するので、空き容量は数百MBを見込んでください。書き出しに成功すると、同名の出力が置き換わります。

## 2秒のテスト

テストページは60フレームのカウントと、開始時および1秒後のビープ音を生成します。`--test` を付けるとこのページを開きます。

```sh
tools/export/export.sh --test --format vertical --cut 15 --out tools/export/test-vertical.mp4
swift tools/export/verify.swift tools/export/test-vertical.mp4 1080 1920 2
```

検証コマンドは `AVURLAsset` で長さ、解像度、30 fps、H.264 High、AAC 48 kHz ステレオの各トラックを確認します。横向きでは `--format horizontal` を指定し、検証コマンドの寸法を `1920 1080` にします。

## トラブルシュート

- `Operation not permitted` がHTTPサーバー起動時に出る場合は、ローカルポートへのバインドが許されている macOS のターミナルで実行してください。
- `Chrome DevTools did not start` の場合は、Chrome の配置と、プロセス起動やループバック接続を制限する設定を確認してください。取得できた Chrome ログの末尾をエラーと一緒に表示します。
- `AnswerLoopVideo export API is missing or incomplete` の場合は、`video/index.html` が指定のクエリでAPIを公開しているか確認してください。ページの準備やWAV生成が60秒以上応答しない場合もタイムアウトします。
- 寸法またはfpsのエラーが出た場合は、ページが指定方向の寸法と30 fpsを返しているか確認してください。WAVのエラーが出た場合は `audioWavBase64(48000)` が WAV ファイル全体をBase64文字列で返すか確認してください。
- エンコード時の書き込みエラーは、出力先の書き込み権限と空き容量を確認してください。Ctrl+C で中断できます。
