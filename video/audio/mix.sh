#!/usr/bin/env bash
# 書き出した映像に、ナレーション・BGM・効果音を重ねて、提出用の動画を作る。
# 使い方: FFBIN=<ffmpeg の bin> bash audio/mix.sh   (video/ で実行)
set -euo pipefail
cd "$(dirname "$0")/.."
FF="${FFBIN:+$FFBIN/}ffmpeg"
node audio/gen.mjs out/audio
"$FF" -y -loglevel error -i out/full_179.mp4 -i out/narr/narration.wav -i out/audio/bgm.wav -i out/audio/sfx.wav -filter_complex \
  "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.6,asplit=2[n][key];\
[2:a]volume=2.0,equalizer=f=1800:width_type=o:width=1.6:g=-7[b0];\
[b0][key]sidechaincompress=threshold=0.03:ratio=3:attack=30:release=500:makeup=1[b];\
[3:a]volume=0.7[s];\
[n][b][s]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out/bwc-demo-final.mp4
echo "wrote out/bwc-demo-final.mp4"
