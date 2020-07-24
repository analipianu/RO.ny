#!/bin/sh

omxplayer -o local --loop --win "0 0 799 479"  /home/pi/avx/avexa.mp4 &
sudo python /home/pi/avx/motoare.py &
v4l2-ctl --set-ctrl=rotate=90 &
uv4l --external-driver --device-name=video0 \
--server-option '--enable-www-server=yes' --server-option '--www-root-path=/home/pi/avx' \
--server-option '–www-index-file=index.html' --server-option '--www-port=69' \
--server-option '--www-webrtc-signaling-path=/stream/webrtc' --server-option '--enable-webrtc=yes' \
--server-option '--webrtc-datachannel-label=uv4l' --server-option '--webrtc-datachannel-socket=/tmp/uv4l.socket' \
--server-option '--webrtc-renderer-window=0' --server-option '--webrtc-renderer-window=-31' \
--server-option '--webrtc-renderer-window=799' --server-option '--webrtc-renderer-window=510' \
--server-option '--enable-webrtc-video=yes' --server-option '--enable-webrtc-audio=yes' \
--server-option '–-enable-webrtc-datachannels=yes' --server-option '--www-use-ssl=yes' \
--server-option '--www-ssl-private-key-file=/etc/ssl/private/selfsign.key' --server-option '--www-ssl-certificate-file=/etc/ssl/certs/selfsign.crt' \