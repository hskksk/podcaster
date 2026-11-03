FROM jrottenberg/ffmpeg:7-scratch AS ffmpeg

FROM alpine:3.20
RUN apk add --no-cache bash curl ca-certificates
COPY --from=ffmpeg /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /usr/local/bin/ffprobe /usr/local/bin/ffprobe
COPY run.sh /run.sh
RUN chmod +x /run.sh
ENTRYPOINT ["/run.sh"]
