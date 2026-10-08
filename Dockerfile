# SkinScan by Dr Maher — production image (self-hosting alternative to Vercel).
#   docker build -t drmaher-skinscan .
#   docker run -p 3000:3000 -e NEXT_PUBLIC_APP_URL=https://skinscan.drmahermahmoud.com drmaher-skinscan
# glibc-based image: sharp and onnxruntime-node ship prebuilt glibc binaries.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_APP_URL=https://skinscan.drmahermahmoud.com
ARG NEXT_PUBLIC_BOOKING_URL=https://drmahermahmoud.com/book
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_BOOKING_URL=$NEXT_PUBLIC_BOOKING_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/models ./models
COPY --from=build /app/next.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "-p", "3000"]
