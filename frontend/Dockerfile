FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

# Railway's runtime caps fs.aio-max-nr low. nginx 'worker_processes auto' spawns
# one worker per host CPU, and each io_setup() allocates an AIO context; with many
# cores this exhausts the limit -> "io_setup() failed (11: Resource temporarily
# unavailable)" and nginx never serves. Pin to a single worker.
RUN sed -i -E 's/^worker_processes[[:space:]]+auto;/worker_processes 1;/' /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html
# Store as a template; BACKEND_URL and PORT are substituted at container start
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80
# Default PORT to 80 locally (Railway injects its own $PORT), then substitute
# only ${BACKEND_URL} and ${PORT} — other nginx $vars are left untouched.
CMD ["/bin/sh", "-c", "export PORT=\"${PORT:-80}\"; envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
