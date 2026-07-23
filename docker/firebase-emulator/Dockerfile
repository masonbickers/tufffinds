FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global firebase-tools@14.19.0

WORKDIR /workspace

COPY firebase.json firestore.rules storage.rules ./
COPY docker/firebase-emulator/entrypoint.sh docker/firebase-emulator/seed.mjs ./docker/firebase-emulator/

RUN chmod +x ./docker/firebase-emulator/entrypoint.sh

EXPOSE 4000 8080 9099 9199

ENTRYPOINT ["./docker/firebase-emulator/entrypoint.sh"]
