あなたは世界トップクラスのモーショングラフィックスデザイナー兼サウンドデザイナーです。docs/v3/VIDEO_PLAN.md（6節が最優先）、docs/research/promo_video.md、~/.codex/.tmp/plugins/plugins/hyperframes/skills/hyperframes/house-style.md と references/motion-principles.md、references/transitions.md を読み、`video/` を v3 に作り直してください。video/ 以外は編集しない。外部通信・外部素材なし（ナレーションは video/assets/narration/{15,30}/NN.wav と lines.json を使う）。

必須：
- 既存の `window.AnswerLoopVideo`（duration, fps, width, height, ready, renderFrame(t), renderAudio, audioWavBase64）と `?cut=15|30`、`?format=vertical|horizontal`、`?t`、`?embed=1`（ポスター＋再生ボタン）、`?export=1`、`?safe=1`、操作UI、キー操作を維持。renderFrame(t) は時刻だけで決まる（決定的）。
- ツギテ風：紙の背景 #F6F3EC、紺 #1F3556 のワイプ、明朝の見出し、文字単位ブラーイン、下線が引かれる、マッチカット、カメラのドリー/スナップズーム、ステップカウント、パララックス1回。上下にふわふわ揺れる・呼吸する動きは一切使わない（v2の背景グリッドの拍同期の動きも削除）。
- ナレーション：計画の開始秒に配置。リアルタイム再生とOfflineAudioContextの両方で同じ関数で配置。ダッキングとEQは計画どおり。lines.json の duration を読み、文の終わり＋250msでBGMを戻す。
- 音楽：Dメジャー120BPM、イントロ→ビルド（8分アルペジオ＋付点16分ディレイ、リバースシンバル）→ドロップ（ヒット＋キック）→アウトロ（ベル2音＋シマー）。キラキラ：グロッケン（2.76倍・5.40倍の部分音）を根拠チップ着地に音階で、ベルを承認とロゴに、シマーをドロップとロゴに。固定シードのノイズ、合成リバーブ0.65秒。
- 最後に小さく「声：VOICEVOX:No.7」と「デモ用の架空データ」。
完了後、構文確認と、renderAudio のピーク（-1dBFS以下）、各文の配置時刻を数値で報告。書き出し（MP4化）は不要（Claudeが行う）。
